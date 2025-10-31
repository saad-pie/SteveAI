// chat.js: Futuristic Chat UI Logic for SteveAI 2.0
// Integrates with functions/chat.js for backend responses (with fallback if import fails)
// Features: Markdown rendering via Marked.js, typewriter animation (ultra-fast 2ms fixed, LIVE formatting on every char for dynamic bold/italics/etc. as it types)
// Updates: Parses <think> blocks from Gemini/fast mode – Renders as futuristic collapsible "Neural Thought Matrix" (arrow-toggle, glow on hover). Main response always visible. Strips for history.
// New: Sidebar model selector – Toggle button opens holographic dropdown; selects trigger /model command for seamless switch (no history clutter via direct export if avail, else command).

let getBotAnswer;  // Declare globally for fallback

document.addEventListener('DOMContentLoaded', () => {
  console.log('🧠 SteveAI: DOM Loaded – Initializing neural interface...');

  const messagesEl = document.getElementById('messages');
  const userInput = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const modelDropdown = document.getElementById('model-dropdown');
  const statusBar = document.querySelector('.status-bar');

  if (!messagesEl || !userInput || !sendBtn || !sidebar || !sidebarToggle) {
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
      return { main: `Echo: "${prompt}" – Neural link offline. Fix import for real AI! (Debug: Check console for details.)`, thinking: null };
    };
  });

  // Sidebar Toggle
  sidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    const isOpen = sidebar.classList.contains('open');
    sidebarToggle.innerHTML = `<span class="icon">${isOpen ? '✕' : '⚙️'}</span><span class="label">${isOpen ? 'Close' : 'Neural Modes'}</span>`;
    console.log(`🧠 SteveAI: Sidebar ${isOpen ? 'opened' : 'closed'}.`);
  });

  // Model Selection – Click item to switch (triggers /model command silently, no history add)
  modelDropdown.addEventListener('click', async (e) => {
    if (e.target.closest('.dropdown-item')) {
      const item = e.target.closest('.dropdown-item');
      const mode = item.dataset.mode;
      console.log(`🧠 SteveAI: Model selected – ${mode}`);
      // Trigger model switch via command (handled in functions/chat.js – returns response for UI toast)
      const response = await getBotAnswer(`/model ${mode}`);
      // Show toast-like confirmation (main response)
      if (response.main) {
        const toast = document.createElement('div');
        toast.className = 'model-toast';
        toast.textContent = response.main;
        toast.style.cssText = 'position: fixed; top: 20px; right: 20px; background: rgba(0,247,255,0.9); color: #000; padding: 1rem; border-radius: 8px; box-shadow: 0 0 20px var(--neon-cyan); z-index: 30; animation: slideIn 0.5s;';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      }
      // Close sidebar
      sidebar.classList.remove('open');
      sidebarToggle.innerHTML = '<span class="icon">⚙️</span><span class="label">Neural Modes</span>';
      // Update status bar with current mode (fetch from localStorage or config)
      const currentModel = localStorage.getItem('steveai_current_model') || 'provider-3/gpt-5-nano';
      statusBar.innerHTML += `<span style="color: var(--neon-purple); font-size: 0.7rem;"> | Mode: ${mode.toUpperCase()}</span>`;
    }
  });

  // Close sidebar on outside click
  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !sidebarToggle.contains(e.target)) {
      sidebar.classList.remove('open');
      sidebarToggle.innerHTML = '<span class="icon">⚙️</span><span class="label">Neural Modes</span>';
    }
  });

  // Set initial state: Button ENABLED (user can type/send immediately; disable on empty via input)
  sendBtn.disabled = false;  // Start enabled – input listener handles
  console.log('🧠 SteveAI: Send button enabled (initial).');

  // Enable/disable send button when typing
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

    let responseData = { main: 'Transmission error—retry vector?', thinking: null };  // Default error

    try {
      if (typeof getBotAnswer === 'function') {
        console.log('🧠 SteveAI: Calling real getBotAnswer...');
        responseData = await getBotAnswer(prompt);
        console.log('🧠 SteveAI: Real response received:', responseData.main ? 'Success' : 'Empty');
      } else {
        console.log('🧠 SteveAI: Skipping getBotAnswer (undefined) – Using mock.');
        responseData.main = `Mock: Hi back! "${prompt}" – Interface glitching? Check import logs above.`;
      }
    } catch (error) {
      console.error('🚨 SteveAI: getBotAnswer Error:', error);
      responseData.main = 'Signal lost. Rebooting interface... (Error details in console.)';
    } finally {
      // Render with optional <think> collapsible
      renderBotResponse(botMsg, responseData);
      // Re-enable send
      sendBtn.disabled = false;
      console.log('🧠 SteveAI: Send button re-enabled.');
    }
  });

  // Render bot response: Main always visible, <think> as collapsible if present
  function renderBotResponse(botMsg, { main, thinking }) {
    let html = `
      <div class="msg-main">
        <div class="content-main"></div>
      </div>
    `;
    if (thinking) {
      html = `
        <div class="msg-header" onclick="toggleCollapse(this)">
          <span class="arrow">▶</span>
          <span class="header-text">Neural Thought Matrix [Expand]</span>
        </div>
        <div class="msg-think">
          <div class="content-think"></div>
        </div>
      ` + html;
    }
    botMsg.innerHTML = html;
    const mainContent = botMsg.querySelector('.content-main');
    typeWriter(mainContent, main, 0, '', () => {
      console.log('🧠 SteveAI: Main response complete.');
      if (thinking) {
        // Auto-collapse think by default (futuristic hide until probed)
        const thinkDiv = botMsg.querySelector('.msg-think');
        thinkDiv.style.display = 'none';
        const headerText = botMsg.querySelector('.header-text');
        headerText.textContent = 'Neural Thought Matrix [Collapsed]';
      }
    });
    if (thinking) {
      const thinkContent = botMsg.querySelector('.content-think');
      thinkContent.innerHTML = marked.parse(thinking);  // Render think as markdown
    }
  }

  // Global toggle function (for onclick)
  window.toggleCollapse = function(header) {
    const think = header.nextElementSibling;  // .msg-think
    const arrow = header.querySelector('.arrow');
    const headerText = header.querySelector('.header-text');
    if (think.style.display === 'none') {
      think.style.display = 'block';
      arrow.textContent = '▼';
      arrow.style.transform = 'rotate(180deg)';
      headerText.textContent = 'Neural Thought Matrix [Expanded]';
    } else {
      think.style.display = 'none';
      arrow.textContent = '▶';
      arrow.style.transform = 'rotate(0deg)';
      headerText.textContent = 'Neural Thought Matrix [Collapsed]';
    }
    scrollToBottom();  // Auto-scroll if expanded
  };

  // Typewriter function: Types markdown text, parses/renders HTML LIVE on every char for dynamic formatting
  function typeWriter(element, text, index, currentText, onComplete) {
    if (index < text.length) {
      currentText += text.charAt(index);
      // Live parse & render: Updates innerHTML with formatted markdown instantly
      if (typeof marked !== 'undefined') {
        element.innerHTML = marked.parse(currentText);
      } else {
        element.textContent = currentText;  // Fallback if no Marked
      }
      const delay = 2;  // Fixed 2ms – blazing fast
      setTimeout(() => typeWriter(element, text, index + 1, currentText, onComplete), delay);
    } else {
      console.log('🧠 SteveAI: Typewriter complete – Full markdown rendered.');
      if (onComplete) onComplete();
    }
  }

  // Create message element (updated for history: parse <think> if present, collapsible)
  function createMessage(sender, text) {
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    if (sender === 'user') {
      const content = document.createElement('div');
      content.className = 'content';
      content.textContent = text;  // Plain for user
      div.appendChild(content);
    } else {
      // Parse for <think> in history text (assume string; if object, adapt)
      let main = text;
      let thinking = null;
      const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/i);
      if (thinkMatch) {
        thinking = thinkMatch[1].trim();
        main = text.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
      }
      renderBotResponse(div, { main, thinking });
      // For history: Expand think if present (past context)
      const thinkDiv = div.querySelector('.msg-think');
      if (thinkDiv) {
        thinkDiv.style.display = 'block';
        const arrow = div.querySelector('.arrow');
        arrow.textContent = '▼';
        const headerText = div.querySelector('.header-text');
        headerText.textContent = 'Neural Thought Matrix [Expanded]';
      }
    }
    return div;
  }

  // Scroll to bottom
  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Load chat history on init (render past messages with markdown – collapsibles for bots with <think>)
  console.log('🧠 SteveAI: Loading chat history...');
  const hist = JSON.parse(localStorage.getItem('steveai_messages') || '[]');
  for (let msg of hist.slice(1)) {  // Skip system prompt
    const msgEl = createMessage(msg.role, msg.content);
    messagesEl.appendChild(msgEl);
  }
  if (hist.length > 1) {
    scrollToBottom();
  } else {
    // Welcome message if fresh (non-collapsible)
    const welcomeDiv = document.createElement('div');
    welcomeDiv.className = 'message bot';
    const welcomeContent = document.createElement('div');
    welcomeContent.className = 'content';
    welcomeContent.innerHTML = marked.parse('Neural link established. Transmit your query, operative. **What futures do you seek?**');
    welcomeDiv.appendChild(welcomeContent);
    messagesEl.appendChild(welcomeDiv);
    scrollToBottom();
  }
  console.log('🧠 SteveAI: Interface online – Ready for transmission!');
});

// Add slideIn keyframe for toast
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  .model-toast { animation: slideIn 0.5s ease-out; }
`;
document.head.appendChild(style);
