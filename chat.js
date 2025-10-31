// chat.js: Futuristic Chat UI Logic for SteveAI 2.0
// Integrates with functions/chat.js for backend responses (with fallback if import fails)
// Features: Markdown rendering via Marked.js, typewriter animation (ultra-fast 2ms fixed, LIVE formatting on every char for dynamic bold/italics/etc. as it types)
// Updates: Parses <think> blocks from Gemini/fast mode – Renders as futuristic collapsible "Neural Thought Matrix" (arrow-toggle, glow on hover). Main response always visible. Strips for history.
// New: Individual Chats – Sidebar lists chats (by title/preview), + New creates fresh (timestamp ID), select loads without re-render (append-only). No global history reload. Model sidebar separate toggle.

let getBotAnswer;  // Declare globally for fallback
let currentChatId = localStorage.getItem('steveai_current_chat') || 'chat-1';  // Default first chat
let chats = JSON.parse(localStorage.getItem('steveai_chats') || '[]');  // Array of {id, title, preview, messages: []}

document.addEventListener('DOMContentLoaded', () => {
  console.log('🧠 SteveAI: DOM Loaded – Initializing neural interface...');

  const messagesEl = document.getElementById('messages');
  const userInput = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  const chatSidebar = document.getElementById('chat-sidebar');
  const newChatBtn = document.getElementById('new-chat-btn');
  const chatList = document.getElementById('chat-list');
  const modelSidebar = document.getElementById('model-sidebar');
  const modelToggle = document.getElementById('model-toggle');
  const modelDropdown = document.getElementById('model-dropdown');
  const statusBar = document.getElementById('status-bar');

  if (!messagesEl || !userInput || !sendBtn || !chatSidebar || !newChatBtn) {
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

  // Individual Chats Logic
  function initChats() {
    if (chats.length === 0) {
      createNewChat();
    }
    loadChatList();
    loadCurrentChat();
  }

  function createNewChat() {
    const newId = `chat-${Date.now()}`;
    const newChat = {
      id: newId,
      title: `Chat ${chats.length + 1}`,
      preview: 'New neural sync...',
      messages: [{ role: 'system', content: '' }]  // Empty system for new
    };
    chats.push(newChat);
    saveChats();
    switchToChat(newId);
  }

  function saveChats() {
    localStorage.setItem('steveai_chats', JSON.stringify(chats));
  }

  function loadChatList() {
    chatList.innerHTML = '';
    chats.forEach(chat => {
      const li = document.createElement('li');
      li.className = `chat-item ${currentChatId === chat.id ? 'active' : ''}`;
      li.innerHTML = `
        <div class="chat-preview" onclick="switchToChat('${chat.id}')">
          <span class="chat-title">${chat.title}</span>
          <span class="chat-snippet">${chat.preview}</span>
        </div>
        <button class="delete-chat" onclick="deleteChat('${chat.id}')">×</button>
      `;
      chatList.appendChild(li);
    });
  }

  function switchToChat(chatId) {
    if (currentChatId) {
      // Save current chat state
      const currentChat = chats.find(c => c.id === currentChatId);
      if (currentChat) {
        currentChat.messages = Array.from(messagesEl.children).map(el => ({
          role: el.classList.contains('user') ? 'user' : 'assistant',
          content: el.querySelector('.content, .content-main, .content-think')?.textContent || el.textContent || ''
        })).filter(msg => msg.role && msg.content.trim());  // Extract clean
        // Update preview/title based on last user msg
        const lastUser = currentChat.messages.findLast(m => m.role === 'user');
        if (lastUser) {
          currentChat.preview = lastUser.content.substring(0, 50) + '...';
          currentChat.title = lastUser.content.substring(0, 30) + (lastUser.content.length > 30 ? '...' : '');
        }
        saveChats();
      }
    }
    currentChatId = chatId;
    localStorage.setItem('steveai_current_chat', chatId);
    loadCurrentChat();
    loadChatList();
    console.log(`🧠 SteveAI: Switched to chat ${chatId}.`);
  }

  function loadCurrentChat() {
    messagesEl.innerHTML = '';  // Clear without re-render loop
    const currentChat = chats.find(c => c.id === currentChatId);
    if (!currentChat) return createNewChat();
    currentChat.messages.slice(1).forEach(msg => {  // Skip system
      const msgEl = createMessage(msg.role, msg.content);
      messagesEl.appendChild(msgEl);
    });
    scrollToBottom();
    if (currentChat.messages.length <= 1) {
      // Welcome for truly new
      const welcomeDiv = document.createElement('div');
      welcomeDiv.className = 'message bot';
      const welcomeContent = document.createElement('div');
      welcomeContent.className = 'content';
      welcomeContent.innerHTML = marked.parse('Neural link established. Transmit your query, operative. **What futures do you seek?**');
      welcomeDiv.appendChild(welcomeContent);
      messagesEl.appendChild(welcomeDiv);
      scrollToBottom();
    }
  }

  function deleteChat(chatId) {
    if (chats.length <= 1) return;  // Keep at least one
    chats = chats.filter(c => c.id !== chatId);
    if (currentChatId === chatId) {
      currentChatId = chats[0]?.id || createNewChat();
    }
    saveChats();
    loadChatList();
    loadCurrentChat();
  }

  // Event Listeners for Chats
  newChatBtn.addEventListener('click', createNewChat);

  // Model Sidebar Toggle (separate from chat sidebar)
  modelToggle.addEventListener('click', () => {
    modelSidebar.classList.toggle('open');
    const isOpen = modelSidebar.classList.contains('open');
    modelToggle.innerHTML = `<span class="icon">${isOpen ? '✕' : '⚙️'}</span><span class="label">${isOpen ? 'Close' : 'Neural Modes'}</span>`;
  });

  // Model Selection
  modelDropdown.addEventListener('click', async (e) => {
    if (e.target.closest('.dropdown-item')) {
      const item = e.target.closest('.dropdown-item');
      const mode = item.dataset.mode;
      console.log(`🧠 SteveAI: Model selected – ${mode}`);
      const response = await getBotAnswer(`/model ${mode}`);
      if (response.main) {
        // Toast confirmation
        const toast = document.createElement('div');
        toast.className = 'model-toast';
        toast.textContent = response.main;
        toast.style.cssText = 'position: fixed; top: 20px; right: 20px; background: rgba(0,247,255,0.9); color: #000; padding: 1rem; border-radius: 8px; box-shadow: 0 0 20px var(--neon-cyan); z-index: 30; animation: slideIn 0.5s;';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      }
      modelSidebar.classList.remove('open');
      modelToggle.innerHTML = '<span class="icon">⚙️</span><span class="label">Neural Modes</span>';
      // Update status
      statusBar.innerHTML += `<span style="color: var(--neon-purple); font-size: 0.7rem;"> | Mode: ${mode.toUpperCase()}</span>`;
    }
  });

  // Close model sidebar on outside click
  document.addEventListener('click', (e) => {
    if (!modelSidebar.contains(e.target) && !modelToggle.contains(e.target)) {
      modelSidebar.classList.remove('open');
      modelToggle.innerHTML = '<span class="icon">⚙️</span><span class="label">Neural Modes</span>';
    }
  });

  // Set initial state: Button ENABLED
  sendBtn.disabled = false;
  console.log('🧠 SteveAI: Send button enabled (initial).');

  // Enable/disable send button when typing
  userInput.addEventListener('input', () => {
    const hasValue = userInput.value.trim() !== '';
    sendBtn.disabled = !hasValue;
  });

  // Send on Enter
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) sendBtn.click();
    }
  });

  // Send handler (append to current chat only)
  sendBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const prompt = userInput.value.trim();
    if (!prompt) return;

    userInput.value = '';
    sendBtn.disabled = true;
    userInput.focus();

    // Add user message (append, no re-render)
    const userMsg = createMessage('user', prompt);
    messagesEl.appendChild(userMsg);
    scrollToBottom();

    // Generating orb
    const botMsg = document.createElement('div');
    botMsg.className = 'message bot';
    botMsg.innerHTML = `<div class="generating"><div class="orb"></div><span>Syncing neural net... (Quantum processing)</span></div>`;
    messagesEl.appendChild(botMsg);
    scrollToBottom();

    let responseData = { main: 'Transmission error—retry vector?', thinking: null };

    try {
      if (typeof getBotAnswer === 'function') {
        responseData = await getBotAnswer(prompt);
      } else {
        responseData.main = `Mock: Hi back! "${prompt}" – Interface glitching?`;
      }
    } catch (error) {
      console.error('🚨 SteveAI: getBotAnswer Error:', error);
      responseData.main = 'Signal lost. Rebooting interface...';
    } finally {
      renderBotResponse(botMsg, responseData);
      sendBtn.disabled = false;
      // Update current chat preview/title
      const currentChat = chats.find(c => c.id === currentChatId);
      if (currentChat) {
        currentChat.preview = prompt.substring(0, 50) + '...';
        saveChats();
        loadChatList();  // Refresh list preview
      }
    }
  });

  // Render bot response (as before)
  function renderBotResponse(botMsg, { main, thinking }) {
    let html = `<div class="msg-main"><div class="content-main"></div></div>`;
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
      if (thinking) {
        const thinkDiv = botMsg.querySelector('.msg-think');
        thinkDiv.style.display = 'none';
        const headerText = botMsg.querySelector('.header-text');
        headerText.textContent = 'Neural Thought Matrix [Collapsed]';
        const thinkContent = botMsg.querySelector('.content-think');
        thinkContent.innerHTML = marked.parse(thinking);
      }
    });
  }

  // Global toggle (as before)
  window.toggleCollapse = function(header) {
    const think = header.nextElementSibling;
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
    scrollToBottom();
  };

  window.switchToChat = switchToChat;
  window.deleteChat = deleteChat;

  // Typewriter (as before)
  function typeWriter(element, text, index, currentText, onComplete) {
    if (index < text.length) {
      currentText += text.charAt(index);
      if (typeof marked !== 'undefined') {
        element.innerHTML = marked.parse(currentText);
      } else {
        element.textContent = currentText;
      }
      setTimeout(() => typeWriter(element, text, index + 1, currentText, onComplete), 2);
    } else {
      if (onComplete) onComplete();
    }
  }

  // Create message (as before)
  function createMessage(sender, text) {
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    if (sender === 'user') {
      const content = document.createElement('div');
      content.className = 'content';
      content.textContent = text;
      div.appendChild(content);
    } else {
      let main = text;
      let thinking = null;
      const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/i);
      if (thinkMatch) {
        thinking = thinkMatch[1].trim();
        main = text.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
      }
      renderBotResponse(div, { main, thinking });
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

  // Init
  initChats();
  console.log('🧠 SteveAI: Interface online – Ready for transmission!');
});

// Toast keyframe
const style = document.createElement('style');
style.textContent = `@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } .model-toast { animation: slideIn 0.5s ease-out; }`;
document.head.appendChild(style);
