document.getElementById('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = document.getElementById('prompt').value;
    if (!prompt) return;

    // Add user message
    addMessage('user', prompt);
    document.getElementById('prompt').value = '';

    // Mock AI response (replace with fetch('/api/chat', {method: 'POST', body: JSON.stringify({prompt})}))
    setTimeout(() => addMessage('ai', 'Echo: ' + prompt + ' (Real AI soon!)'), 500);
});

function addMessage(sender, text) {
    const div = document.createElement('div');
    div.className = sender;
    div.textContent = `${sender.toUpperCase()}: ${text}`;
    document.getElementById('messages').appendChild(div);
}
