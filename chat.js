// chat.js: Futuristic Chat UI Logic for SteveAI 2.0
// Integrates with functions/chat.js for backend responses
// Features: Markdown rendering via Marked.js, typewriter animation (random fast speed), orb loading indicator
// Debug Fixes: Removed initial disabled from HTML; JS sets it. Added console.logs for tracing. Fallback non-module for marked if needed.

document.addEventListener('DOMContentLoaded', () => {
  console.log('🧠 SteveAI: DOM Loaded – Initializing neural interface...');

  const messagesEl = document.getElementById('messages');
  const userInput = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');

  if (!messagesEl || !userInput || !sendBtn) {
    console.error('🚨 SteveAI: Critical – DOM elements missing! Check IDs in chat.html.');
    return;  // Bail if selectors fail
  }

  console.log('🧠 SteveAI: Elements found – Attaching listeners.');

  // Set initial disabled state via JS (safer than HTML attr)
  sendBtn.disabled = true;
  console.log('🧠 SteveAI: Send button disabled (initial).');

  // Enable send button when typing
  userInput.addEventListener('input', () => {
    const hasValue = userInput.value.trim() !== '';
    sendBtn.disabled = !hasValue;
    console.log(`🧠 SteveAI: Input changed – Button ${hasValue ? 'ENABLED' : 'DISABLED'}.`);
  });

  // Send on Enter (no Shift for multiline if needed)
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      console.log('🧠 SteveAI: Enter pressed – Triggering send.');
      e.preventDefault();
      if (!sendBtn.disabled) {
        sendBtn.click();
      }
    }
  });

  // Send handler
  sendBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const prompt = userInput.value.trim();
    if (!prompt) {
      console.log('🧠 SteveAI: Send clicked but empty prompt – Ignoring.');
      return;
    }

    console.log(`🧠 SteveAI: Send activated – Prompt: "${prompt}"`);

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
      console.log('🧠 SteveAI: Fetching response from getBotAnswer...');
      // Get response from backend (handles commands & AI)
      const reply = await getBotAnswer(prompt);
      console.log('🧠 SteveAI: Response received:', reply ? 'Success' : 'Empty');

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
      console.error('🚨 SteveAI: Chat UI Error:', error);
      const content = botMsg.querySelector('.content') || botMsg;
      if (content.tagName === 'DIV') {
        content.innerHTML = '<div class="content">Signal lost. Rebooting interface...</div>';
      } else {
        content.textContent = 'Signal lost. Rebooting interface...';
      }
    } finally {
      // Re-enable send
      sendBtn.disabled = false;
      console.log('🧠 SteveAI: Send button re-enabled.');
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
      if (typeof marked !== 'undefined') {
        element.innerHTML = marked.parse(text);
      } else {
        console.warn('🚨 SteveAI: Marked.js not loaded – Falling back to plain text.');
        element.textContent = text;
      }
      console.log('🧠 SteveAI: Typewriter complete – Markdown rendered.');
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
      // For history load: Render markdown if bot
      if (typeof marked !== 'undefined' && sender === 'bot') {
        content.innerHTML = marked.parse(text);
      } else {
        content.textContent = text;
      }
    }
    div.appendChild(content);
    return div;
  }

  // Scroll to bottom
  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Load chat history on init (render past messages with markdown)
  console.log('🧠 SteveAI: Loading chat history...');
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
  console.log('🧠 SteveAI: Interface online – Ready for transmission!');
});

// Fallback import for module (if ES module fails, log)
if (typeof getBotAnswer === 'undefined') {
  console.error('🚨 SteveAI: Import failed – Check path to ./functions/chat.js and config.js. Ensure no syntax errors.');
}
