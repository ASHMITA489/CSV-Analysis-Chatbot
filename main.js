const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config();
const { OpenAI } = require('openai');

let csvData = [];
let chatHistory = [];

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile('index.html');
}

// Listen for CSV file path from renderer
ipcMain.on('parse-csv', (event, filePath) => {
  csvData = [];
  fs.createReadStream(filePath)
    .pipe(csv())
    .on('data', (row) => {
      csvData.push(row);
    })
    .on('end', () => {
      event.reply('csv-parsed', csvData.length);
    })
    .on('error', (err) => {
      event.reply('csv-parsed', 0);
    });
});

// chat messages from renderer
ipcMain.on('user-message', async (event, userMessage) => {
  try {
    chatHistory.push({ role: 'user', content: userMessage });                // add user message to chat history

    // prepare prompt with CSV data and chat history
    const csvPreview = JSON.stringify(csvData.slice(0, 10));                 // Only send first 10 rows for context
    const systemPrompt = `You are a helpful assistant. The user has uploaded a CSV file. Here are the first 10 rows: ${csvPreview}. Answer questions about this data.`;
    const messages = [
      { role: 'system', content: systemPrompt },
      ...chatHistory
    ];

    // Call OpenAI API (v4.x style)
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages
    });
    const aiResponse = completion.choices[0].message.content;

    // Add AI response to chat history
    chatHistory.push({ role: 'assistant', content: aiResponse });

    // Send AI response back to renderer
    event.reply('ai-message', aiResponse);
  } catch (err) {
    event.reply('ai-message', 'Sorry, there was an error.');
  }
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
}); 