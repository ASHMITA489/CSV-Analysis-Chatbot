# CSV Analysis Chatbot

A desktop application built with Electron that allows users to upload CSV files and chat with an AI bot to analyze the data. The application uses OpenAI's API to provide information about the uploaded file.


## Prerequisites

- Node.js (v14 or higher)
- npm (Node Package Manager)
- OpenAI API key

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd csv-analysis-chatbot
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add your OpenAI API key:
```
OPENAI_API_KEY=your_api_key_here
```

## Running the Application

Start the application:
```bash
npm start
```

## Usage

1. **Upload a CSV File**
   - Drag and drop a CSV file onto the upload area
   - Or click the "Choose File" button to select a file
   - The application will validate that it's a CSV file

2. **Chat with AI**
   - Once the CSV is uploaded, you can start asking questions about the data
   - Type your question in the chat input box
   - Press Enter or click "Send" to get the AI's response

## Project Structure

```
├── main.js           # Electron main process
├── renderer.js       # Frontend logic
├── index.html        # UI structure
├── styles.css        # Styling
├── package.json      # Dependencies and scripts
└── .env             # Environment variables (API key)
```

## Technologies Used

- Electron (main framework)
- OpenAI API (AI response)
- csv-parser (for csv parsing)
- HTML/CSS/JavaScript

## License

This project is licensed under the MIT License - see the LICENSE file for details. 