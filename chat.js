// chat.js: Futuristic Chat UI Logic for SteveAI 2.0
// Integrates with functions/chat.js for backend responses (with fallback if import fails)
// Features: Markdown rendering via Marked.js, typewriter animation (ultra-fast 2ms fixed, LIVE formatting on every char for dynamic bold/italics/etc. as it types)
// Updates: Parses <think> blocks from Gemini/fast mode – Renders as futuristic collapsible "Neural Thought Matrix" (arrow-toggle, glow on hover). Main response always visible. Strips for history.
// New: Individual Chats – Sidebar lists chats (by title/preview), + New creates fresh (timestamp ID), select loads without re-render (append-only). No global history reload. Model sidebar separate toggle.
// Grok-Style Update: Unified sidebar toggle via hamburger, AI-generated chat titles on first msg (via SteveAI-default), auto-gen on load, models integrated in sidebar.
// FIX: Import config for model refs; pass model to getBotAnswer for title gen; update mock; better statusBar mode display.

import config from './config.js';  // NEW: Import for model mappings

let getBotAnswer;  // Declare globally for fallback
let currentModel = localStorage.getItem('steveai_current_model') || config.models.default;  // Use config default
let currentChatId = localStorage.getItem('steveai_current_chat') || 'chat-1';  // Default first chat
let chats = JSON.parse(localStorage.getItem('steveai_chats') || '[]');  // Array of {id, title, preview, messages: [], titleGenerated: false}

document.addEventListener('DOMContentLoaded', () => {
  console.log('🧠 SteveAI: DOM Loaded – Initializing neural interface...');

  const messagesEl = document.getElementById('messages');
  const userInput = document.getElementById('user-input');
  const sendBtn = document.getElementById('send-btn');
  const sidebar = document.getElementById('sidebar');
  const hamburgerToggle = document.getElementById('hamburger-toggle');
  const newChatBtn = document.getElementById('new-chat-btn');
  const chatList = document.getElementById('chat-list');
  const modelDropdown = document.getElementById('model-dropdown');
  const statusBar = document.getElementById('status-bar');
  const sidebarOverlay = document.getElementById('sidebar-overlay');

  if (!messagesEl || !userInput || !sendBtn || !sidebar || !newChatBtn) {
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
    // Mock fallback for testing – UPDATED: Handle model param
    getBotAnswer = async (prompt, messages = [], model = null) => {
      console.log('🧠 SteveAI: Using MOCK response (import failed).');
      return { main: `Echo: "${prompt}" – Neural link offline. Fix import for real AI! (Debug: Check console for details.)`, thinking: null };
    };
  });

  // Sidebar Toggle (Grok-style hamburger)
  function toggleSidebar() {
    sidebar.classList.toggle('open');
    const isOpen = sidebar.classList.contains('open');
    if (isOpen) {
      sidebarOverlay.style.display = 'block'; // Show overlay
    } else {
      sidebarOverlay.style.display = 'none';
    }
  }

  hamburgerToggle.addEventListener('click', toggleSidebar);
  sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarOverlay.style.display = 'none';
  });

  // NEW: Generate AI Title for Chat (uses SteveAI-default via param, short prompt)
  async function generateChatTitle(firstPrompt, chatId) {
    const titlePrompt = `Generate a short, catchy, futuristic title (5-8 words max) for this chat based solely on: "${firstPrompt}". Respond with ONLY the title, no extras.`;
    const messages = [{ role: 'system', content: 'You are a title generator. Output only the title.' }];
    // Pass model param to getBotAnswer (no global override)
    const response = await getBotAnswer(titlePrompt, messages, config.models.default);  // FIXED: Pass default model
    const generatedTitle = response.main.trim() || `Chat ${chats.length + 1}`; // Fallback
    // Update chat
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
      chat.title = generatedTitle;
      chat.titleGenerated = true;
      saveChats();
      loadChatList(); // Refresh UI
    }
    return generatedTitle;
  }

  // Individual Chats Logic
  function initChats() {
    if (chats.length === 0) {
      createNewChat();
    }
    // Check for pending title gens on load – UPDATED: Better placeholder check
    chats.forEach(async (chat) => {
      if (!chat.hasOwnProperty('titleGenerated') || !chat.titleGenerated) {  // Handle legacy chats
        if (chat.title && (chat.title.startsWith('Chat ') || chat.title === 'New Sync...')) {
          const lastUserMsg = chat.messages.findLast(m => m.role === 'user')?.content || 'New conversation';
          await generateChatTitle(lastUserMsg, chat.id);
        }
      }
    });
    loadChatList();
    loadCurrentChat();
  }

  function createNewChat() {
    const newId = `chat-${Date.now()}`;
    const newChat = {
      id: newId,
      title: `New Sync...`, // Temp
      preview: 'Awaiting transmission...',
      messages: [], // Empty for truly new
      titleGenerated: false
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
        // Update preview/title based on last user msg (skip if AI-generated)
        const lastUser = currentChat.messages.findLast(m => m.role === 'user');
        if (lastUser) {
          currentChat.preview = lastUser.content.substring(0, 50) + '...';
          if (!currentChat.titleGenerated) {
            currentChat.title = lastUser.content.substring(0, 30) + (lastUser.content.length > 30 ? '...' : '');
          }
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
    currentChat.messages.forEach(msg => {  // No skip system; assume clean
      const msgEl = createMessage(msg.role, msg.content);
      messagesEl.appendChild(msgEl);
    });
    scrollToBottom();
    if (currentChat.messages.length === 0) {
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

  // Model Selection (in unified sidebar)
  modelDropdown.addEventListener('click', async (e) => {
    if (e.target.closest('.dropdown-item')) {
      const mode = e.target.closest('.dropdown-item').dataset.mode;
      console.log(`🧠 SteveAI: Model selected – ${mode}`);
      const response = await getBotAnswer(`/model ${mode}`);
      // Toast confirmation (simplified)
      const toast = document.createElement('div');
      toast.className = 'model-toast';
      toast.textContent = `Switched to ${mode.toUpperCase()}`;
      toast.style.cssText = 'position: fixed; top: 20px; right: 20px; background: rgba(0,247,255,0.9); color: #000; padding: 1rem; border-radius: 8px; box-shadow: 0 0 20px var(--neon-cyan); z-index: 30; animation: slideIn 0.5s;';
      document.body.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);
      // Update status – UPDATED: Use mode key
      statusBar.textContent = `Mode: ${mode.toUpperCase()}`;
      // Close sidebar
      toggleSidebar();
    }
  });

  // Set initial state: Button ENABLED
  sendBtn.disabled = false;
  // UPDATED: Better initial status from config reverse-map
  const initialMode = Object.keys(config.models).find(key => config.models[key] === currentModel) || 'DEFAULT';
  statusBar.textContent = `Mode: ${initialMode.toUpperCase()}`;
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

    const currentChat = chats.find(c => c.id === currentChatId);
    const isFirstMessage = currentChat.messages.length === 0;

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
        responseData = await getBotAnswer(prompt, currentChat.messages);  // Pass chat messages for context
      } else {
        responseData.main = `Mock: Hi back! "${prompt}" – Interface glitching?`;
      }
    } catch (error) {
      console.error('🚨 SteveAI: getBotAnswer Error:', error);
      responseData.main = 'Signal lost. Rebooting interface...';
    } finally {
      renderBotResponse(botMsg, responseData);
      // Add to chat messages (main only)
      currentChat.messages.push({ role: 'user', content: prompt });
      currentChat.messages.push({ role: 'assistant', content: responseData.main });
      // If first, gen title
      if (isFirstMessage) {
        await generateChatTitle(prompt, currentChatId);
      } else {
        currentChat.preview = prompt.substring(0, 50) + '...';
        saveChats();
        loadChatList();  // Refresh list preview
      }
      sendBtn.disabled = false;
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

  // Create message (as before) - For history load, assume content is main (stripped)
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
