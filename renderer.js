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

    // Handle dropped files
    dropZone.addEventListener('drop', handleDrop, false);

    // Handle file input change
    fileInput.addEventListener('change', handleFileSelect, false);

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
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
            
            if (file.name.toLowerCase().endsWith('.csv')) {
                fileName.textContent = `Selected file: ${file.name}`;
                fileInfo.classList.add('visible');
                ipcRenderer.send('parse-csv', file.path);
            } else {
                alert('Please select a CSV file');
                fileInput.value = '';
                fileName.textContent = '';
                fileInfo.classList.remove('visible');
            }
        }
    }

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
        ipcRenderer.send('user-message', userMsg);
    }

    sendBtn.addEventListener('click', sendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // AI response
    ipcRenderer.on('ai-message', (event, aiMsg) => {
        appendMessage(aiMsg, 'ai');
    });
}); 