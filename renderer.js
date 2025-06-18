const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    const dropZone = document.getElementById('drop-zone');
    const fileInput = document.getElementById('file-input');
    const fileInfo = document.getElementById('file-info');
    const fileName = document.getElementById('file-name');
    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
        document.body.addEventListener(eventName, preventDefaults, false);
    });

    // Highlight drop zone when item is dragged over it
    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, highlight, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, unhighlight, false);
    });

    // Handle dropped files
    dropZone.addEventListener('drop', handleDrop, false);

    // Handle file input change
    fileInput.addEventListener('change', handleFileSelect, false);

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function highlight(e) {
        dropZone.classList.add('dragover');
    }

    function unhighlight(e) {
        dropZone.classList.remove('dragover');
    }

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    }

    function handleFileSelect(e) {
        const files = e.target.files;
        handleFiles(files);
    }

    function handleFiles(files) {
        if (files.length > 0) {
            const file = files[0];
            
            // Check if file is a CSV
            if (file.name.toLowerCase().endsWith('.csv')) {
                fileName.textContent = `Selected file: ${file.name}`;
                fileInfo.classList.add('visible');
                // Send file path to main process for parsing
                ipcRenderer.send('parse-csv', file.path);
            } else {
                alert('Please select a CSV file');
                fileInput.value = ''; // Clear the file input
                fileName.textContent = '';
                fileInfo.classList.remove('visible');
            }
        }
    }

    // Listen for parsing result
    ipcRenderer.on('csv-parsed', (event, rowCount) => {
        if (rowCount > 0) {
            fileName.textContent += ` (Parsed ${rowCount} rows)`;
        } else {
            fileName.textContent += ' (Failed to parse)';
        }
    });

    // Chat logic
    function appendMessage(text, sender) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'message ' + sender;
        msgDiv.textContent = text;
        chatMessages.appendChild(msgDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    function sendMessage() {
        const userMsg = chatInput.value.trim();
        if (!userMsg) return;
        appendMessage(userMsg, 'user');
        chatInput.value = '';
        // Send user message to main process
        ipcRenderer.send('user-message', userMsg);
    }

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Listen for AI response
    ipcRenderer.on('ai-message', (event, aiMsg) => {
        appendMessage(aiMsg, 'ai');
    });
}); 