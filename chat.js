// chat.js: Futuristic Chat UI Logic for SteveAI 2.0
// Integrates with functions/chat.js for backend responses (with fallback if import fails)
// Features: Markdown rendering via Marked.js, typewriter animation (ultra-fast 2ms fixed, LIVE formatting on every char for dynamic bold/italics/etc. as it types)
// Updates: Parses <think> blocks from Gemini/fast mode – Renders as futuristic collapsible "Neural Thought Matrix" (arrow-toggle, glow on hover). Main response always visible. Strips for history.
// New: Individual Chats – Sidebar lists chats (by title/preview), + New creates fresh (timestamp ID), select loads without re-render (append-only). No global history reload. Model sidebar separate toggle.
// Grok-Style Update: Unified sidebar toggle via hamburger, AI-generated chat titles on first msg (via SteveAI-default), auto-gen on load, models integrated in sidebar.
// FIX: Import config for model refs; pass model to getBotAnswer for title gen; update mock; better statusBar mode display.
// ADDITIONAL FIXES (Halloween 2025): Commands instant (no orb hang via local handler), model default clamp/switch local (no AI ping), tab isolation (sessionStorage msgs), thinking persistence/collapse consistent, orb clear guarantee, sidebar init/highlight, inline toggles, single getBotAnswer call (no dupe), components integration (sidebar, message, loader, toast, chatlist).

import config from './config.js';  // Models + params
import { getBotAnswer, loadTheme, clearSession } from './functions/chat.js';  // Backend
import { Sidebar } from './components/sidebar.js';  // Toggle + models
import { Message } from './components/message.js';  // User/bot render
import { Loader } from './components/loader.js';  // Orb
import { Toast } from './components/toast.js';  // Notifications
import { ChatList } from './components/chatlist.js';  // List render

let currentModel = localStorage.getItem('steveai_current_model') || config.models.default;  // Clamp to default
if (!Object.values(config.models).includes(currentModel)) {
  currentModel = config.models.default;
  localStorage.setItem('steveai_current_model', currentModel);
}
let currentChatId = localStorage.getItem('steveai_current_chat') || 'chat-1';
// Tab-isolated chats
const tabId = sessionStorage.getItem('steveai_tab_id') || `tab-${Date.now()}`;
sessionStorage.setItem('steveai_tab_id', tabId);
let sharedChats = JSON.parse(localStorage.getItem('steveai_chats') || '[]');
let tabChats = JSON.parse(sessionStorage.getItem(`steveai_tab_chats_${tabId}`) || JSON.stringify(sharedChats.map(c => ({ ...c, messages: [] }))));
let chats = tabChats;

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
    return;
  }

  // Components Init
  const toast = new Toast();
  const sidebarComp = new Sidebar(sidebar, hamburgerToggle, sidebarOverlay, modelDropdown, (mode) => {
    currentModel = config.models[mode];
    localStorage.setItem('steveai_current_model', currentModel);
    statusBar.textContent = `Mode: ${mode.toUpperCase()}`;
    toast.show(`Switched to ${mode.toUpperCase()}`);
  });
  sidebarComp.mount();

  const chatListComp = new ChatList(chatList, chats, currentChatId, switchToChat, deleteChat);

  // Initial highlight
  const initialMode = Object.keys(config.models).find(key => config.models[key] === currentModel) || 'default';
  statusBar.textContent = `Mode: ${initialMode.toUpperCase()}`;

  // Theme load
  loadTheme();

  console.log('🧠 SteveAI: Components wired – Attaching listeners.');

  // Attempt import (async)
  import('./functions/chat.js').then(module => {
    getBotAnswer = module.getBotAnswer;
    console.log('🧠 SteveAI: Backend loaded.');
  }).catch(error => {
    console.error('🚨 SteveAI: Backend import failed:', error);
    getBotAnswer = async (prompt, messages = [], model = null) => {
      return { main: `Echo: "${prompt}" – Link offline. Fix import!`, thinking: null, handled: false };
    };
  });

  // Local command handler
  function handleCommand(prompt) {
    if (!prompt.startsWith('/')) return { handled: false };
    const [, cmd, ...args] = prompt.split(' ');
    let main = '';
    switch (cmd.toLowerCase()) {
      case 'clear':
        clearSession();
        main = 'Chat wiped—fresh timeline activated! 🚀';
        break;
      case 'help':
        main = `SteveAI Commands:\n/clear - Reset chat\n/theme dark|light - Toggle mode\n/model default|general|fast|reasoning - Switch AI mode\n/export - Save as JSON\n/help - This list\n/image <prompt> - Gen image (coming soon)\n\nAsk away!`;
        break;
      case 'theme':
        const theme = args[0] || config.defaultTheme;
        document.body.classList.toggle('dark', theme === 'dark');
        localStorage.setItem('steveai_theme', theme);
        main = `Theme switched to ${theme}!`;
        break;
      case 'model':
        const mode = args[0]?.toLowerCase() || 'default';
        if (!['default', 'general', 'fast', 'reasoning'].includes(mode)) {
          main = 'Available modes: default (GPT-5-nano), general (Grok-4), fast (Gemini Flash), reasoning (DeepSeek V3). Usage: /model <mode>';
        } else {
          currentModel = config.models[mode];
          localStorage.setItem('steveai_current_model', currentModel);
          statusBar.textContent = `Mode: ${mode.toUpperCase()}`;
          toast.show(`Switched to ${mode.toUpperCase()}`);
          main = `Mode switched to **${mode.toUpperCase()}** (${currentModel}) – Neural pathways recalibrated! 🚀`;
        }
        break;
      case 'export':
        const chatsData = JSON.parse(localStorage.getItem('steveai_chats') || '[]');
        const currentChatIdData = localStorage.getItem('steveai_current_chat') || 'none';
        const exportData = JSON.stringify({ currentChat: currentChatIdData, chats: chatsData }, null, 2);
        const blob = new Blob([exportData], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'steveai-chats.json';
        a.click();
        URL.revokeObjectURL(url);
        main = "Chats exported—your convos's eternal!";
        break;
      case 'image':
        const imgPrompt = prompt.slice(7).trim();
        main = imgPrompt ? `Image gen queued for "${imgPrompt}" (coming soon!)` : 'Usage: /image <prompt>';
        break;
      default:
        main = 'Unknown command—type /help for options.';
    }
    return { handled: true, response: { main, thinking: null } };
  }

  // Title gen
  async function generateChatTitle(firstPrompt, chatId) {
    const titlePrompt = `Generate a short, catchy, futuristic title (5-8 words max) for this chat based solely on: "${firstPrompt}". Respond with ONLY the title, no extras.`;
    const messages = [{ role: 'system', content: 'You are a title generator. Output only the title.' }];
    const response = await getBotAnswer(titlePrompt, messages, config.models.default);
    const generatedTitle = response.main.trim() || `Chat ${chats.length + 1}`;
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
      chat.title = generatedTitle;
      chat.titleGenerated = true;
      saveChats();
      chatListComp.render();
    }
    return generatedTitle;
  }

  // Chats Logic
  function initChats() {
    if (chats.length === 0) createNewChat();
    chats.forEach(async (chat) => {
      if (!chat.hasOwnProperty('titleGenerated') || !chat.titleGenerated) {
        if (chat.title && (chat.title.startsWith('Chat ') || chat.title === 'New Sync...')) {
          const lastUserMsg = chat.messages.findLast(m => m.role === 'user')?.content || 'New conversation';
          await generateChatTitle(lastUserMsg, chat.id);
        }
      }
    });
    chatListComp.render();
    loadCurrentChat();
  }

  function createNewChat() {
    const newId = `chat-${Date.now()}`;
    const newChat = { id: newId, title: 'New Sync...', preview: 'Awaiting transmission...', messages: [], titleGenerated: false };
    chats.push(newChat);
    saveChats();
    switchToChat(newId);
  }

  function saveChats() {
    sessionStorage.setItem(`steveai_tab_chats_${tabId}`, JSON.stringify(chats));
    sharedChats = sharedChats.map(sc => {
      const tc = chats.find(c => c.id === sc.id);
      return tc ? { ...tc, messages: [] } : sc;
    }).concat(chats.filter(tc => !sharedChats.some(sc => sc.id === tc.id)).map(tc => ({ ...tc, messages: [] })));
    localStorage.setItem('steveai_chats', JSON.stringify(sharedChats));
  }

  function switchToChat(chatId) {
    if (currentChatId) {
      const currentChat = chats.find(c => c.id === currentChatId);
      if (currentChat) {
        currentChat.messages = Array.from(messagesEl.children).map(el => {
          const role = el.classList.contains('user') ? 'user' : 'assistant';
          const content = el.querySelector('.content, .content-main, .content-think')?.textContent || el.textContent || '';
          const thinking = el.querySelector('.content-think')?.textContent || null;
          return { role, content, thinking };
        }).filter(msg => msg.role && msg.content.trim());
        const lastUser = currentChat.messages.findLast(m => m.role === 'user');
        if (lastUser) {
          currentChat.preview = lastUser.content.substring(0, 50) + '...';
          if (!currentChat.titleGenerated) currentChat.title = lastUser.content.substring(0, 30) + (lastUser.content.length > 30 ? '...' : '');
        }
        saveChats();
      }
    }
    currentChatId = chatId;
    localStorage.setItem('steveai_current_chat', chatId);
    loadCurrentChat();
    chatListComp.render();
    console.log(`🧠 SteveAI: Switched to chat ${chatId}.`);
  }

  function loadCurrentChat() {
    messagesEl.innerHTML = '';
    const currentChat = chats.find(c => c.id === currentChatId);
    if (!currentChat) return createNewChat();
    currentChat.messages.forEach(msg => {
      const div = document.createElement('div');
      new Message(div, msg.role, msg).render();
      messagesEl.appendChild(div);
    });
    scrollToBottom();
    if (currentChat.messages.length === 0) {
      const welcomeDiv = document.createElement('div');
      new Message(welcomeDiv, 'bot', { content: 'Neural link established. Transmit your query, operative. **What futures do you seek?**' }).render();
      messagesEl.appendChild(welcomeDiv);
      scrollToBottom();
    }
  }

  function deleteChat(chatId) {
    if (chats.length <= 1) return;
    chats = chats.filter(c => c.id !== chatId);
    if (currentChatId === chatId) currentChatId = chats[0]?.id || createNewChat();
    saveChats();
    chatListComp.render();
    loadCurrentChat();
  }

  newChatBtn.addEventListener('click', createNewChat);

  // Input listeners
  sendBtn.disabled = false;
  userInput.addEventListener('input', () => sendBtn.disabled = userInput.value.trim() === '');
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !sendBtn.disabled) {
      e.preventDefault();
      sendBtn.click();
    }
  });

  // Send handler
  sendBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    const prompt = userInput.value.trim();
    if (!prompt) return;

    userInput.value = '';
    sendBtn.disabled = true;
    userInput.focus();

    const currentChat = chats.find(c => c.id === currentChatId);
    const isFirstMessage = currentChat.messages.length === 0;

    // User msg
    const userDiv = document.createElement('div');
    new Message(userDiv, 'user', prompt).render();
    messagesEl.appendChild(userDiv);
    scrollToBottom();

    // Local cmd or loader + API
    const commandResult = handleCommand(prompt);
    if (commandResult.handled) {
      const sysDiv = document.createElement('div');
      new Message(sysDiv, 'bot', commandResult.response.main).render();
      sysDiv.querySelector('.content').classList.add('system');
      messagesEl.appendChild(sysDiv);
      scrollToBottom();
      currentChat.messages.push({ role: 'user', content: prompt });
      currentChat.messages.push({ role: 'assistant', content: commandResult.response.main });
    } else {
      const loader = new Loader(messagesEl);
      loader.show();
      let responseData = { main: 'Transmission error—retry vector?', thinking: null, handled: false };
      try {
        if (typeof getBotAnswer === 'function') {
          responseData = await getBotAnswer(prompt, currentChat.messages, currentModel);
        } else {
          responseData.main = `Mock: Hi back! "${prompt}" – Interface glitching?`;
        }
      } catch (error) {
        console.error('🚨 SteveAI: getBotAnswer Error:', error);
        responseData.main = 'Signal lost. Rebooting interface...';
      } finally {
        loader.hide();
        const botDiv = document.createElement('div');
        new Message(botDiv, 'bot', responseData).render();
        messagesEl.appendChild(botDiv);
        currentChat.messages.push({ role: 'user', content: prompt });
        currentChat.messages.push({ role: 'assistant', content: responseData.main, thinking: responseData.thinking });
      }
    }

    // Title/preview
    if (isFirstMessage) await generateChatTitle(prompt, currentChatId);
    else currentChat.preview = prompt.substring(0, 50) + '...';
    saveChats();
    chatListComp.render();
    sendBtn.disabled = false;
  });

  // Scroll helper
  function scrollToBottom() {
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  // Global onclicks for inline (legacy)
  window.switchToChat = switchToChat;
  window.deleteChat = deleteChat;

  // Save on unload
  window.addEventListener('beforeunload', saveChats);

  // Init
  loadTheme();
  initChats();
  console.log('🧠 SteveAI: Interface online – Ready for transmission!');
});

// Toast keyframe (CSS inject)
const style = document.createElement('style');
style.textContent = `@keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } .model-toast { animation: slideIn 0.5s ease-out; }`;
document.head.appendChild(style);
