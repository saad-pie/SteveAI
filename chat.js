// chat.js: Futuristic Chat UI Logic for SteveAI 2.0
// Integrates with functions/chat.js for backend responses
// Features: Markdown rendering via Marked.js, typewriter animation (random fast speed), orb loading indicator
// Fix: Wrapped all in DOMContentLoaded to ensure DOM ready before attaching listeners/selectors

import { getBotAnswer } from './functions/chat.js';  // Adjust path if needed (e.g., '../functions/chat.js')

document.addEventListener('DOMContentLoaded', () => {
  const messagesEl = document.getElementById('messages');
  const userInput = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');

  // Enable send button when typing
  userInput.addEventListener('input', () => {
    sendBtn.disabled = userInput.value.trim() === '';
  });

  // Send on Enter (no Shift for multiline if needed)
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  // Send handler
  sendBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const prompt = userInput.value.trim();
    if (!prompt) return;

    // Clear input & disable
    userInput.value = '';
    sendBtn.disabled = true;
    userInput.focus();  // Keep focus for next input

    // Add user message (plain text, no markdown)
    const userMsg = createMessage('user', prompt);
    messagesEl.appendChild(userMsg);
    scrollToBottom();

    // Create bot message with generating orb
    const botMsg = document.createElement('div');
    botMsg.className = 'message bot';
    botMsg.innerHTML = `
      <div class="generating">
        <div class="orb"></div>
        <span>Syncing neural net... (Quantum processing)</span>
      </div>
    `;
    messagesEl.appendChild(botMsg);
    scrollToBottom();

    try {
      // Get response from backend (handles commands & AI)
      const reply = await getBotAnswer(prompt);

      // Replace generating with content wrapper
      botMsg.innerHTML = '<div class="content"></div>';
      const content = botMsg.querySelector('.content');

      if (reply) {
        // Typewriter animation: Fast random speed (20-80ms per char)
        typeWriter(content, reply, 0);
      } else {
        content.textContent = 'Transmission error—retry vector?';
      }
    } catch (error) {
      console.error('Chat UI Error:', error);
      const content = botMsg.querySelector('.content') || botMsg;
      content.innerHTML = '<div class="content">Signal lost. Rebooting interface...</div>';
    } finally {
      // Re-enable send
      sendBtn.disabled = false;
    }
  });

  // Typewriter function: Types markdown text, then renders as HTML
  function typeWriter(element, text, index) {
    if (index < text.length) {
      element.textContent += text.charAt(index);
      const delay = Math.random() * 60 + 20;  // Random fast: 20-80ms
      setTimeout(() => typeWriter(element, text, index + 1), delay);
    } else {
      // Animation complete: Parse & render markdown to HTML
      element.innerHTML = marked.parse(text);
    }
  }

  // Create message element
  function createMessage(sender, text) {
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    const content = document.createElement('div');
    content.className = 'content';
    if (sender === 'user') {
      content.textContent = text;  // Plain for user
    } else {
      content.innerHTML = marked.parse(text);  // Markdown for bot (if pre-rendered)
    }
    div.appendChild(content);
    return div;
  }

  // Scroll to bottom
  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Load chat history on init (render past messages with markdown)
  const hist = JSON.parse(localStorage.getItem('steveai_messages') || '[]');
  for (let msg of hist.slice(1)) {  // Skip system prompt
    const msgEl = createMessage(msg.role, msg.content);
    messagesEl.appendChild(msgEl);
  }
  if (hist.length > 1) {
    scrollToBottom();
  } else {
    // Welcome message if fresh
    const welcome = createMessage('bot', 'Neural link established. Transmit your query, operative. **What futures do you seek?**');
    messagesEl.appendChild(welcome);
    scrollToBottom();
  }
});
