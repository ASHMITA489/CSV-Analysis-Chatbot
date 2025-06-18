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

## Technologies Used

- Electron (main framework)
- OpenAI API (AI response)
- csv-parser (for csv parsing)
- HTML/CSS/JavaScript

## License

This project is licensed under the MIT License