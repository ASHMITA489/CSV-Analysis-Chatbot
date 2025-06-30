const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const csv = require('csv-parser');
require('dotenv').config();
const { OpenAI } = require('openai');

let csvData = [];
let csvSchema = {};

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

// schema extraction
function inferType(values) {
  let numCount = 0, boolCount = 0, dateCount = 0, total = values.length;
  for (const val of values) {
    if (val === '' || val === null || val === undefined) continue;
    if (!isNaN(Number(val)) && val.trim() !== '') numCount++;
    if (typeof val === 'string' && (val.toLowerCase() === 'true' || val.toLowerCase() === 'false')) boolCount++;
    if (!isNaN(Date.parse(val))) dateCount++;
  }
  if (numCount / total > 0.8) return 'number';
  if (boolCount / total > 0.8) return 'boolean';
  if (dateCount / total > 0.8) return 'date';
  return 'string';
}

function extractSchema(data, sampleSize = 20) {
  if (!data || data.length === 0) return { columns: [], columnTypes: {} };
  const columns = Object.keys(data[0]);
  const columnTypes = {};
  for (const col of columns) {
    const values = data.slice(0, sampleSize).map(row => row[col]);
    columnTypes[col] = inferType(values);
  }
  return { columns, columnTypes };
}

// LLM prompt builder
function buildLLMPrompt(schema, userQuestion, dataSample) {
  const { columns, columnTypes } = schema;
  const schemaDescription = columns.map(col => `${col}: ${columnTypes[col]}`).join(', ');
  const sampleRows = JSON.stringify(dataSample, null, 2);

  return `
You are a JavaScript developer. You are given a CSV file parsed as an array of objects called data, where each object represents a row.

The schema of the data is:
${schemaDescription}

Here are some sample rows:
${sampleRows}

Write ONLY a JavaScript function named 'answer' that takes the array 'data' as input and returns the answer to the following question:

"${userQuestion}"

IMPORTANT: 
- Use only the columns and types shown in the schema and sample.
- Output ONLY the JavaScript function code
- Do not include any explanations, comments, or markdown formatting
- Do not include \`\`\`javascript or \`\`\` blocks
- Start directly with 'function answer(data) {'
- End with the closing brace '}'
- Your function MUST use a 'return' statement to return the answer.
- If the answer cannot be computed, return a string explaining why.
- Do NOT use console.log or print, only return the answer.
- The function should answer the question directly.
- Example: function answer(data) { return data.length; }
- If you are unsure, return a string explaining why.
`;
}

// code extraction
function extractCodeFromResponse(response) {
  // Remove markdown code blocks if present
  let code = response.replace(/```javascript\s*/g, '').replace(/```\s*/g, '');
  // Find the function answer(data) { ... } pattern
  const functionMatch = code.match(/function\s+answer\s*\(\s*data\s*\)\s*\{[\s\S]*\}/);
  if (functionMatch) {
    return functionMatch[0];
  }
  // If no function found, try to extract just the function body
  const bodyMatch = code.match(/\{[\s\S]*\}/);
  if (bodyMatch) {
    return `function answer(data) ${bodyMatch[0]}`;
  }
  // If still no match, try to wrap the entire response in a function
  if (code.trim()) {
    return `function answer(data) {\n${code}\n}`;
  }
  // If still no match, return the cleaned response
  return code.trim();
}

function runCodeSafely(code, data) {
  const cleanCode = extractCodeFromResponse(code);
  const sanitizedCode = cleanCode
    .replace(/require\(/g, '// require(')
    .replace(/import\(/g, '// import(')
    .replace(/process\./g, '// process.')
    .replace(/global\./g, '// global.')
    .replace(/__dirname/g, '// __dirname')
    .replace(/__filename/g, '// __filename')
    .replace(/fs\./g, '// fs.')
    .replace(/child_process/g, '// child_process')
    .replace(/exec\(/g, '// exec(')
    .replace(/spawn\(/g, '// spawn(')
    .replace(/eval\(/g, '// eval(')
    .replace(/Function\(/g, '// Function(');

  let result;
  try {
    result = eval(`(() => {\n${sanitizedCode}\nreturn answer(data);\n})()`);
    if (result === undefined) {
      return `The function did not return a value. Please check the generated code below for debugging.\n\nGenerated code was:\n${cleanCode}`;
    }
    if (typeof result === 'object') {
      return JSON.stringify(result, null, 2);
    }
    return String(result);
  } catch (err) {
    return `Error executing code: ${err.message}\n\nGenerated code was:\n${cleanCode}`;
  }
}

// csv parsing and schema extraction
ipcMain.on('parse-csv', async (event, filePath) => {
  try {
    csvData = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          csvData.push(row);
        })
        .on('end', resolve)
        .on('error', reject);
    });
    // Extract schema after parsing
    csvSchema = extractSchema(csvData);
    console.log('Extracted schema:', csvSchema);
    event.reply('csv-parsed', csvData.length);
  } catch (err) {
    console.error('Error parsing CSV:', err);
    event.reply('csv-parsed', 0);
  }
});

// chat processing
ipcMain.on('user-message', async (event, userMessage) => {
  try {
    // Build the prompt for the LLM using schema and a data sample
    const prompt = buildLLMPrompt(csvSchema, userMessage, csvData.slice(0, 3));
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'system', content: prompt }]
    });

    const code = completion.choices[0].message.content.trim();
    const result = runCodeSafely(code, csvData);
    event.reply('ai-message', result);

  } catch (err) {
    console.error('Error in chat processing:', err);
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