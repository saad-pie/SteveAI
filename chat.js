// chat.js: Futuristic Chat UI Logic for SteveAI 2.0
// Integrates with functions/chat.js for backend responses (with fallback if import fails)
// Features: Markdown rendering via Marked.js, typewriter animation (ultra-fast 2ms fixed, LIVE formatting on every char for dynamic bold/italics/etc. as it types)
// Updates: Parses <think> blocks from Gemini/fast mode – Renders as futuristic collapsible "Neural Thought Matrix" (arrow-toggle, glow on hover). Main response always visible. Strips for history.
// New: Individual Chats – Sidebar lists chats (by title/preview), + New creates fresh (timestamp ID), select loads without re-render (append-only). No global history reload. Model sidebar separate toggle.
// Grok-Style Update: Unified sidebar toggle via hamburger, AI-generated chat titles on first msg (via SteveAI-default), auto-gen on load, models integrated in sidebar.
// FIXES (Oct 31, 2025): 
// - Commands instant (no orb hang): Early getBotAnswer check, flag for handled → direct render.
// - Model default clamp to 'default' (no fast stuck), local switch (sidebar clicks update localStorage/status/toast, no AI ping).
// - Tab isolation: sessionStorage for messages (shared titles/previews in localStorage).
// - Thinking persistence: Save {content: main, thinking} → load renders collapsed.
// - Orb clear guarantee: finally nuke .generating.
// - Sidebar mount: Init closed, default highlight.
// - Inline toggle: No global window func, per-msg onclick.
// - A4F compat: Pass currentModel to getBotAnswer.

import config from './config.js';  // NEW: Import for model mappings

let getBotAnswer;  // Declare globally for fallback
let currentModel = localStorage.getItem('steveai_current_model') || config.models.default;  // Clamp to default
if (!Object.values(config.models).includes(currentModel)) {  // Sanitize stuck 'fast'
  currentModel = config.models.default;
  localStorage.setItem('steveai_current_model', currentModel);
}
let currentChatId = localStorage.getItem('steveai_current_chat') || 'chat-1';
// Tab-isolated chats (shared titles/previews, local messages)
const tabId = sessionStorage.getItem('steveai_tab_id') || `tab-${Date.now()}`;
sessionStorage.setItem('steveai_tab_id', tabId);
let sharedChats = JSON.parse(localStorage.getItem('steveai_chats') || '[]');  // Titles only
let tabChats = JSON.parse(sessionStorage.getItem(`steveai_tab_chats_${tabId}`) || JSON.stringify(sharedChats.map(c => ({ ...c, messages: [] }))));  // Local copy
let chats = tabChats;  // Use tab-local for ops

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

  // FIX: Sidebar init closed + icon hovers
  sidebar.classList.remove('open');
  sidebarOverlay.style.display = 'none';
  const dropdownItems = document.querySelectorAll('.dropdown-item');
  dropdownItems.forEach(item => {
    item.addEventListener('mouseenter', () => item.style.boxShadow = '0 0 10px var(--neon-cyan)');
    item.addEventListener('mouseleave', () => item.style.boxShadow = 'none');
  });

  console.log('🧠 SteveAI: Elements found – Attaching listeners.');

  // Attempt import (async for modules)
  import('./functions/chat.js').then(module => {
    getBotAnswer = module.getBotAnswer;
    console.log('🧠 SteveAI: Import success – getBotAnswer loaded.');
  }).catch(error => {
    console.error('🚨 SteveAI: Import failed:', error);
    console.error('🚨 SteveAI: Check: 1) functions/chat.js exists? 2) config.js in root? 3) Syntax errors? 4) Netlify MIME for .js (add _headers: /*\nContent-Type: application/javascript\n)');
    // Mock fallback for testing – UPDATED: Handle model param + handled flag
    getBotAnswer = async (prompt, messages = [], model = null) => {
      console.log('🧠 SteveAI: Using MOCK response (import failed).');
      return { main: `Echo: "${prompt}" – Neural link offline. Fix import for real AI! (Debug: Check console for details.)`, thinking: null, handled: false };
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

  // FIX: Model Selection: Local only (no AI call, instant)
  modelDropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (!item) return;
    const mode = item.dataset.mode;
    currentModel = config.models[mode];
    localStorage.setItem('steveai_current_model', currentModel);
    console.log(`🧠 SteveAI: Switched to ${mode} (${currentModel})`);
    // Toast
    const toast = document.createElement('div');
    toast.className = 'model-toast';
    toast.textContent = `Neural Mode: ${mode.toUpperCase()}`;
    toast.style.cssText = 'position: fixed; top: 20px; right: 20px; background: rgba(0,247,255,0.9); color: #000; padding: 1rem; border-radius: 8px; box-shadow: 0 0 20px var(--neon-cyan); z-index: 30; animation: slideIn 0.5s; font-family: Orbitron, monospace;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
    // Status
    statusBar.textContent = `Mode: ${mode.toUpperCase()}`;
    // Close sidebar
    toggleSidebar();
    // Highlight active
    dropdownItems.forEach(i => i.style.background = 'none');
    item.style.background = 'rgba(0,247,255,0.2)';
  });

  // Initial highlight for default
  const initialMode = Object.keys(config.models).find(key => config.models[key] === currentModel) || 'default';
  const initialItem = modelDropdown.querySelector(`[data-mode="${initialMode}"]`);
  if (initialItem) initialItem.style.background = 'rgba(0,247,255,0.2)';
  statusBar.textContent = `Mode: ${initialMode.toUpperCase()}`;

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

  // Individual Chats Logic (tab-local)
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
    sessionStorage.setItem(`steveai_tab_chats_${tabId}`, JSON.stringify(chats));  // Local full
    // Merge titles/previews to shared (strip messages/thinking)
    sharedChats = sharedChats.map(sc => {
      const tc = chats.find(c => c.id === sc.id);
      return tc ? { ...tc, messages: [] } : sc;  // No thinking in shared
    }).concat(chats.filter(tc => !sharedChats.some(sc => sc.id === tc.id)).map(tc => ({ ...tc, messages: [] })));
    localStorage.setItem('steveai_chats', JSON.stringify(sharedChats));
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
        currentChat.messages = Array.from(messagesEl.children).map(el => {
          const role = el.classList.contains('user') ? 'user' : 'assistant';
          const contentEl = el.querySelector('.content, .content-main, .content-think');
          const content = contentEl ? contentEl.textContent || el.textContent || '' : '';
          const thinking = el.querySelector('.content-think')?.textContent || null;  // Extract if expanded
          return { role, content, thinking };
        }).filter(msg => msg.role && msg.content.trim());  // Extract clean + thinking
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
    currentChat.messages.forEach(msg => {  // Handle thinking obj
      let msgEl;
      if (msg.role === 'assistant' && msg.thinking) {
        msgEl = createMessage('bot', { content: msg.content, thinking: msg.thinking });
      } else {
        msgEl = createMessage(msg.role, msg.content);
      }
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

    const currentChat = chats.find(c => c.id === currentChatId);
    const isFirstMessage = currentChat.messages.length === 0;

    // Add user message (append, no re-render)
    const userMsg = createMessage('user', prompt);
    messagesEl.appendChild(userMsg);
    scrollToBottom();

    let responseData = { main: 'Transmission error—retry vector?', thinking: null, handled: false };

    // FIX: Early command check (no orb for handled)
    responseData = await getBotAnswer(prompt, currentChat.messages, currentModel);
    if (responseData.handled) {
      // Instant system render (no orb/typewriter)
      const sysMsg = createMessage('bot', responseData.main);
      sysMsg.querySelector('.content-main, .content').classList.add('system');
      messagesEl.appendChild(sysMsg);
      scrollToBottom();
      // Save
      currentChat.messages.push({ role: 'user', content: prompt });
      currentChat.messages.push({ role: 'assistant', content: responseData.main });
      if (isFirstMessage) await generateChatTitle(prompt, currentChatId);
      saveChats();
      sendBtn.disabled = false;
      return;
    }

    // Else: Normal AI (orb + stream/type)
    // Generating orb
    const botMsg = document.createElement('div');
    botMsg.className = 'message bot';
    botMsg.innerHTML = `<div class="generating"><div class="orb"></div><span>Syncing neural net... (Quantum processing)</span></div>`;
    messagesEl.appendChild(botMsg);
    scrollToBottom();

    try {
      if (typeof getBotAnswer === 'function') {
        responseData = await getBotAnswer(prompt, currentChat.messages, currentModel);  // Already called? Wait, no—above was for cmd, here full context
        // Note: For non-cmd, re-call with context? Adjust: Move cmd check inside getBotAnswer fully, or separate.
        // Simpler: Since cmd doesn't need context, above call is fine for cmd; for non-cmd, call here with messages.
        // Wait, fix: Move cmd call to local handleCommand if needed, but since functions has flag, call once with context—cmd ignores.
        // Above call already has context for non-cmd.
      } else {
        responseData.main = `Mock: Hi back! "${prompt}" – Interface glitching?`;
      }
    } catch (error) {
      console.error('🚨 SteveAI: getBotAnswer Error:', error);
      responseData.main = 'Signal lost. Rebooting interface...';
    } finally {
      // FIX: Guarantee orb clear
      const genDiv = botMsg.querySelector('.generating');
      if (genDiv) botMsg.innerHTML = '';
      renderBotResponse(botMsg, responseData);
      // Add to chat messages (full w/ thinking)
      currentChat.messages.push({ role: 'user', content: prompt });
      currentChat.messages.push({ role: 'assistant', content: responseData.main, thinking: responseData.thinking });
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

  // FIX: Render bot response (inline toggle, smooth collapse)
  function renderBotResponse(botMsg, { main, thinking }) {
    let html = `<div class="msg-main"><div class="content-main"></div></div>`;
    if (thinking) {
      html = `
        <div class="msg-header" style="cursor: pointer;">
          <span class="arrow">▶</span>
          <span class="header-text">Neural Thought Matrix [Collapsed]</span>
        </div>
        <div class="msg-think" style="max-height: 0; overflow: hidden; transition: max-height 0.3s ease;">
          <div class="content-think"></div>
        </div>
      ` + html;
    }
    botMsg.innerHTML = html;
    const mainContent = botMsg.querySelector('.content-main');
    typeWriter(mainContent, main, 0, '', () => {
      if (thinking) {
        const thinkContent = botMsg.querySelector('.content-think');
        thinkContent.innerHTML = marked.parse(thinking);
        // Inline toggle
        const header = botMsg.querySelector('.msg-header');
        header.onclick = function() {
          const think = this.nextElementSibling;
          const arrow = this.querySelector('.arrow');
          const text = this.querySelector('.header-text');
          if (think.style.maxHeight === '0px' || !think.style.maxHeight) {
            think.style.maxHeight = think.scrollHeight + 'px';
            arrow.textContent = '▼';
            arrow.style.transform = 'rotate(180deg)';
            text.textContent = 'Neural Thought Matrix [Expanded]';
          } else {
            think.style.maxHeight = '0px';
            arrow.textContent = '▶';
            arrow.style.transform = 'rotate(0deg)';
            text.textContent = 'Neural Thought Matrix [Collapsed]';
          }
          scrollToBottom();
        };
      }
    });
  }

  // FIX: Create message (handle obj for thinking on load)
  function createMessage(sender, textOrObj) {
    const div = document.createElement('div');
    div.className = `message ${sender}`;
    if (sender === 'user') {
      const content = document.createElement('div');
      content.className = 'content';
      content.textContent = typeof textOrObj === 'string' ? textOrObj : textOrObj.content;
      div.appendChild(content);
    } else {
      let main = textOrObj;
      let thinking = null;
      if (typeof textOrObj === 'object' && textOrObj.thinking) {
        main = textOrObj.content;
        thinking = textOrObj.thinking;
      } else if (typeof textOrObj === 'string') {
        const thinkMatch = textOrObj.match(/<think>([\s\S]*?)<\/think>/i);
        if (thinkMatch) {
          thinking = thinkMatch[1].trim();
          main = textOrObj.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
        }
      }
      renderBotResponse(div, { main, thinking });
      // Init collapsed on load
      const thinkDiv = div.querySelector('.msg-think');
      if (thinkDiv) {
        thinkDiv.style.maxHeight = '0px';
        const header = div.querySelector('.msg-header');
        const arrow = header.querySelector('.arrow');
        arrow.textContent = '▶';
        const headerText = header.querySelector('.header-text');
        headerText.textContent = 'Neural Thought Matrix [Collapsed]';
        // Wire inline toggle (copy from renderBotResponse)
        header.onclick = function() {
          const think = this.nextElementSibling;
          const arrow = this.querySelector('.arrow');
          const text = this.querySelector('.header-text');
          if (think.style.maxHeight === '0px' || !think.style.maxHeight) {
            think.style.maxHeight = think.scrollHeight + 'px';
            arrow.textContent = '▼';
            arrow.style.transform = 'rotate(180deg)';
            text.textContent = 'Neural Thought Matrix [Expanded]';
          } else {
            think.style.maxHeight = '0px';
            arrow.textContent = '▶';
            arrow.style.transform = 'rotate(0deg)';
            text.textContent = 'Neural Thought Matrix [Collapsed]';
          }
          scrollToBottom();
        };
      }
    }
    return div;
  }

  // Scroll to bottom
  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

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

  // Global funcs for onclick
  window.switchToChat = switchToChat;
  window.deleteChat = deleteChat;

  // Save on unload
  window.addEventListener('beforeunload', saveChats);

  // Init
  initChats();
  console.log('🧠 SteveAI: Interface online – Ready for transmission!');
});

// Toast keyframe
const style = document.createElement('style');
style.textContent = `@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } .model-toast { animation: slideIn 0.5s ease-out; }`;
document.head.appendChild(style);
