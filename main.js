const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config();
const { OpenAI } = require('openai');

let csvData = [];
let chatHistory = [];
let csvChunks = [];

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

// tokens estimation in a chunk of data
function estimateTokenCount(data) {
  return JSON.stringify(data).length / 4;                 // roughly 1 token = 4 characters in English
}

function calculateOptimalChunkSize(data) {
  const MAX_TOKENS_PER_CHUNK = 2000; 
  const MIN_CHUNKS = 3; 
  const MAX_CHUNKS = 50; 
  
  const totalRows = data.length;
  if (totalRows === 0) return 1;
  
  const sampleSize = Math.min(50, totalRows);
  const sample = data.slice(0, sampleSize);
  const avgTokensPerRow = estimateTokenCount(sample) / sampleSize;
  
  const rowsPerChunk = Math.floor(MAX_TOKENS_PER_CHUNK / avgTokensPerRow);
  
  const idealNumChunks = Math.ceil(totalRows / rowsPerChunk);                           // no. of chunks needed
  
  const finalNumChunks = Math.max(MIN_CHUNKS, Math.min(MAX_CHUNKS, idealNumChunks));
  
  const chunkSize = Math.ceil(totalRows / finalNumChunks);                             // final chunk size
  
  return chunkSize;
}

// Create chunks of CSV data
function createCsvChunks(data) {
  const chunkSize = calculateOptimalChunkSize(data);
  const chunks = [];
  
  for(let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    chunks.push({
      id: `chunk_${i/chunkSize}`,
      startRow: i,
      endRow: Math.min(i + chunkSize - 1, data.length - 1),
      data: chunk,
      estimatedTokens: Math.round(estimateTokenCount(chunk))
    });
  }
  
  return chunks;
}

// find relevant chunks based on user question
function findRelevantChunks(userQuestion, chunks) {
  const question = userQuestion.toLowerCase();
  const relevantChunks = [];
  
  chunks.forEach(chunk => {
    let score = 0;
    const chunkContent = JSON.stringify(chunk.data).toLowerCase();
    
    // keyword matching
    question.split(' ').forEach(word => {
      if(word.length > 3 && chunkContent.includes(word)) {
        score += 1;
      }
    });
    
    if(score > 0) {
      relevantChunks.push({ ...chunk, score});
    }
  });
  
  // sort by relevance score and return top 3 most relevant chunks
  return relevantChunks
    .sort((a,b) => b.score - a.score)
    .slice(0,3);
}

// CSV file path from renderer
ipcMain.on('parse-csv', async (event, filePath) => {
  try {
    csvData = [];
    
    // load csv data
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          csvData.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    csvChunks = createCsvChunks(csvData);
    
    event.reply('csv-parsed', csvData.length);
  } catch (err) {
    console.error('Error parsing CSV:', err);
    event.reply('csv-parsed', 0);
  }
});

// chat messages from renderer
ipcMain.on('user-message', async (event, userMessage) => {
  try {
    chatHistory.push({ role: 'user', content: userMessage });                       // add user message to chat history
    
    const relevantChunks = findRelevantChunks(userMessage, csvChunks);
    
    let contextPrompt = `You are analyzing a CSV file with ${csvData.length} rows. Based on the question, here is the relevant data:\n\n`;
    
    if(relevantChunks.length > 0) {
      relevantChunks.forEach((chunk, index) => {
        contextPrompt += `Data Sample ${index + 1}:\n${JSON.stringify(chunk.data, null, 2)}\n\n`;
      });
    } else {
      contextPrompt += `Sample data (first 10 rows):\n${JSON.stringify(csvData.slice(0,10), null, 2)}`;
    }
    
    const messages = [
      { role: 'system', content: contextPrompt },
      ...chatHistory
    ];
    
    // Call OpenAI API
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',  
      messages
    });
    const aiResponse = completion.choices[0].message.content;
    
    // Add AI response to chat history
    chatHistory.push({ role: 'assistant', content: aiResponse });
    
    // Send response back to renderer
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