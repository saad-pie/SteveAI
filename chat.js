// chat.js: Futuristic Chat UI Logic for SteveAI 2.0
// Integrates with functions/chat.js for backend responses (with fallback if import fails)
// Features: Markdown rendering via Marked.js, typewriter animation (ultra-fast 2ms fixed, LIVE formatting on every char for dynamic bold/italics/etc. as it types)

let getBotAnswer;  // Declare globally for fallback

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

  // Attempt import (async for modules)
  import('./functions/chat.js').then(module => {
    getBotAnswer = module.getBotAnswer;
    console.log('🧠 SteveAI: Import success – getBotAnswer loaded.');
  }).catch(error => {
    console.error('🚨 SteveAI: Import failed:', error);
    console.error('🚨 SteveAI: Check: 1) functions/chat.js exists? 2) config.js in root? 3) Syntax errors? 4) Netlify MIME for .js (add _headers: /*\nContent-Type: application/javascript\n)');
    // Mock fallback for testing
    getBotAnswer = async (prompt) => {
      console.log('🧠 SteveAI: Using MOCK response (import failed).');
      return `Echo: "${prompt}" – Neural link offline. Fix import for real AI! (Debug: Check console for details.)`;
    };
  });

  // Set initial state: Button ENABLED (user can type/send immediately; disable on empty via input)
  sendBtn.disabled = false;  // Start enabled – input listener handles
  console.log('🧠 SteveAI: Send button enabled (initial).');

  // Enable/disable send button when typing (redundant if always enabled, but safe)
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
      } else {
        console.log('🧠 SteveAI: Enter ignored – Input empty.');
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

    // Clear input & disable during process
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

    let reply = 'Transmission error—retry vector?';  // Default error

    try {
      if (typeof getBotAnswer === 'function') {
        console.log('🧠 SteveAI: Calling real getBotAnswer...');
        reply = await getBotAnswer(prompt);
        console.log('🧠 SteveAI: Real response received:', reply ? 'Success' : 'Empty');
      } else {
        console.log('🧠 SteveAI: Skipping getBotAnswer (undefined) – Using mock.');
        reply = `Mock: Hi back! "${prompt}" – Interface glitching? Check import logs above.`;
      }
    } catch (error) {
      console.error('🚨 SteveAI: getBotAnswer Error:', error);
      reply = 'Signal lost. Rebooting interface... (Error details in console.)';
    } finally {
      // Replace generating with content wrapper
      botMsg.innerHTML = '<div class="content"></div>';
      const content = botMsg.querySelector('.content');

      // Typewriter animation: Ultra-fast 2ms fixed, LIVE markdown formatting on every char
      typeWriter(content, reply, 0, '');

      // Re-enable send
      sendBtn.disabled = false;
      console.log('🧠 SteveAI: Send button re-enabled.');
    }
  });

  // Typewriter function: Types markdown text, parses/renders HTML LIVE on every char for dynamic formatting
  function typeWriter(element, text, index, currentText) {
    if (index < text.length) {
      currentText += text.charAt(index);
      // Live parse & render: Updates innerHTML with formatted markdown instantly
      if (typeof marked !== 'undefined') {
        element.innerHTML = marked.parse(currentText);
      } else {
        element.textContent = currentText;  // Fallback if no Marked
      }
      const delay = 2;  // Fixed 2ms – blazing fast
      setTimeout(() => typeWriter(element, text, index + 1, currentText), delay);
    } else {
      console.log('🧠 SteveAI: Typewriter complete – Full markdown rendered.');
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
