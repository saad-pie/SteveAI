import { API_BASE, API_KEYS, proxiedURL } from './config.js';


// --- DOM Elements ---

const chat = document.getElementById('chat');
const form = document.getElementById('inputForm');
const input = document.getElementById('messageInput');
const themeToggle = document.getElementById('themeToggle');
const clearChatBtn = document.getElementById('clearChat');
const modeSelect = document.getElementById('modeSelect'); // optional dropdown: "chat" | "reasoning"

// --- Memory / Summary ---
let memory = {};
let turn = 0;
let memorySummary = "";
const TYPE_DELAY = 2;
const TOKEN_BUDGET = 2200;
const approxTokens = s => Math.ceil((s || "").length / 4);

// --- Helpers ---
function memoryString() {
  return Object.keys(memory)
    .map(k => `User: ${memory[k].user}\nBot: ${memory[k].bot}`)
    .join('\n');
}

function lastTurns(n = 6) {
  const keys = Object.keys(memory).map(Number).sort((a,b)=>a-b);
  return keys.slice(-n).map(k => `User: ${memory[k].user}\nBot: ${memory[k].bot}`).join('\n');
}

function shouldSummarize() {
  if (memorySummary) return false;
  return turn >= 6 || approxTokens(memoryString()) > TOKEN_BUDGET;
}

// --- Summarization ---
async function generateSummary() {
  const raw = memoryString();
  const payload = {
    model: "provider-3/gpt-4o-mini",
    messages: [
      { role: "system", content: "You are SteveAI, made by saadpie. Summarize the following chat context clearly." },
      { role: "user", content: raw }
    ]
  };
  try {
    const data = await fetchAI(payload);
    return data?.choices?.[0]?.message?.content?.trim() || "";
  } catch {
    return "Summary: " + lastTurns(2).replace(/\n/g, " ").slice(0, 800);
  }
}

async function buildContext() {
  if (shouldSummarize()) {
    const sum = await generateSummary();
    if (sum) {
      memorySummary = sum;
      const keep = {};
      const keys = Object.keys(memory).map(Number).sort((a,b)=>a-b).slice(-4);
      keys.forEach(k => keep[k] = memory[k]);
      memory = keep;
    }
  }
  return memorySummary
    ? `[SESSION SUMMARY]\n${memorySummary}\n\n[RECENT TURNS]\n${lastTurns(6)}`
    : memoryString();
}

// --- Markdown Parser ---
function markdownToHTML(t) { return marked.parse(t || ""); }

// --- UI: Add Messages ---
function addMessage(text, sender) {
  const container = document.createElement('div');
  container.className = 'message-container ' + sender;

  const bubble = document.createElement('div');
  bubble.className = 'bubble ' + sender;
  container.appendChild(bubble);

  const content = document.createElement('div');
  content.className = 'bubble-content';
  bubble.appendChild(content);

  if (sender === 'bot') {
    chat.appendChild(container);
    chat.scrollTop = chat.scrollHeight;

    let i = 0, buf = "";
    (function type() {
      if (i < text.length) {
        buf += text[i++];
        content.innerHTML = markdownToHTML(buf);
        chat.scrollTop = chat.scrollHeight;
        setTimeout(type, TYPE_DELAY);
      } else {
        content.innerHTML = markdownToHTML(text);
        addBotActions(container, bubble, text);
      }
    })();
  } else {
    content.innerHTML = markdownToHTML(text);
    chat.appendChild(container);
    chat.scrollTop = chat.scrollHeight;
    addUserActions(container, bubble, text);
  }
}

// --- Message Actions ---
function addUserActions(container, bubble, text) {
  const actions = document.createElement('div');
  actions.className = 'message-actions';

  const resend = document.createElement('button');
  resend.className = 'action-btn';
  resend.textContent = '🔁';
  resend.title = 'Resend';
  resend.onclick = () => { input.value = text; input.focus(); };

  const copy = document.createElement('button');
  copy.className = 'action-btn';
  copy.textContent = '📋';
  copy.title = 'Copy';
  copy.onclick = () => navigator.clipboard.writeText(text);

  actions.appendChild(resend);
  actions.appendChild(copy);
  container.appendChild(actions);
}

function addBotActions(container, bubble, text) {
  const actions = document.createElement('div');
  actions.className = 'message-actions';

  const copy = document.createElement('button');
  copy.className = 'action-btn';
  copy.textContent = '📋';
  copy.title = 'Copy';
  copy.onclick = () => navigator.clipboard.writeText(text);

  const speak = document.createElement('button');
  speak.className = 'action-btn';
  speak.textContent = '🔊';
  speak.title = 'Speak';
  speak.onclick = () => {
    let u = new SpeechSynthesisUtterance(text);
    speechSynthesis.speak(u);
  };

  actions.appendChild(copy);
  actions.appendChild(speak);
  container.appendChild(actions);
}

// --- Fetch AI ---
async function fetchAI(payload) {
  const url = proxiedURL(API_BASE);
  let lastErrText = "";
  for (const key of API_KEYS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) return await res.json();
      lastErrText = await res.text();
    } catch (e) {
      console.warn("Proxy/network error", e);
    }
  }
  addMessage('⚠️ API unreachable. Check keys or proxy.', 'bot');
  throw new Error(lastErrText || "API error");
}

// --- Commands ---
function toggleTheme() {
  document.body.classList.toggle('light');
  addMessage('🌓 Theme toggled.', 'bot');
}
function clearChat() {
  chat.innerHTML = '';
  memory = {};
  memorySummary = '';
  turn = 0;
  addMessage('🧹 Chat cleared.', 'bot');
}
function exportChat() {
  const text = memorySummary
    ? `[SUMMARY]\n${memorySummary}\n\n[CHAT LOG]\n${memoryString()}`
    : `[CHAT LOG]\n${memoryString()}`;
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `SteveAI_Chat_${new Date().toISOString().slice(0,19)}.txt`;
  a.click();
  addMessage('💾 Chat exported as text file.', 'bot');
}
function showContact() {
  const info = `
**📬 Contact SteveAI**
- Creator: [@saadpie](https://github.com/saad-pie)
- Website: [steve-ai.netlify.app](https://steve-ai.netlify.app)
- Feedback: Use /export to send logs.
  `;
  addMessage(info, 'bot');
}
async function playSummary() {
  addMessage('🎬 Generating chat summary...', 'bot');
  if (!memorySummary) memorySummary = await generateSummary();
  addMessage(`🧠 **Chat Summary:**\n${memorySummary}`, 'bot');
}
function showAbout() {
  const text = `
🤖 **About SteveAI**
Built by *saadpie* — the bot from the future.

- Models: GPT-5-Nano, DeepSeek-V3, Imagen-4
- Modes: Chat | Reasoning
- Features: Context memory, Summarization, Commands, Theme toggle, Speech, Export

_Type /help to explore commands._
  `;
  addMessage(text, 'bot');
}
function changeMode(arg) {
  if (!arg || !['chat', 'reasoning'].includes(arg.toLowerCase())) {
    addMessage('⚙️ Usage: /mode chat | reasoning', 'bot');
    return;
  }
  if (modeSelect) modeSelect.value = arg.toLowerCase();
  addMessage(`🧭 Switched mode to **${arg}**.`, 'bot');
}
function showTime() {
  const now = new Date();
  addMessage(`⏰ Local time: ${now.toLocaleTimeString()}`, 'bot');
}
function showHelp() {
  const helpText = `
**🧭 Available Commands**

- /clear — Clears current chat
- /theme — Toggle dark/light mode
- /help — Show this help
- /image <prompt> — Generate an image (Imagen-4)
- /export — Export chat as .txt
- /contact — Show contact info
- /play — Summarize / replay conversation
- /about — About SteveAI
- /mode <chat|reasoning> — Change mode
- /time — Show local time
  `;
  addMessage(helpText, 'bot');
}

// --- Command Router ---
function handleCommand(cmd) {
  const [command, ...args] = cmd.trim().split(' ');
  const argString = args.join(' ');
  switch (command.toLowerCase()) {
    case '/clear': return clearChat();
    case '/theme': return toggleTheme();
    case '/help': return showHelp();
    case '/image': return addMessage(`🖼️ Image gen not yet integrated: "${argString}"`, 'bot');
    case '/export': return exportChat();
    case '/contact': return showContact();
    case '/play': return playSummary();
    case '/about': return showAbout();
    case '/mode': return changeMode(argString);
    case '/time': return showTime();
    default: return addMessage(`❓ Unknown command: ${command}`, 'bot');
  }
}

// --- Chat Flow ---
async function getChatReply(msg) {
  const context = await buildContext();
  const mode = (modeSelect?.value || 'chat').toLowerCase();
  const model = mode === 'reasoning'
    ? "provider-3/deepseek-v3-0324"
    : "provider-3/gpt-5-nano";
  const botName = mode === 'reasoning' ? "SteveAI-reasoning" : "SteveAI-chat";
  const payload = {
    model,
    messages: [
      { role: "system", content: `You are ${botName}, made by saadpie.` },
      { role: "user", content: `${context}\n\nUser: ${msg}` }
    ]
  };
  const data = await fetchAI(payload);
  const reply = data?.choices?.[0]?.message?.content || "No response.";
  memory[++turn] = { user: msg, bot: reply };
  return reply;
}

// --- Form Submit ---
form.onsubmit = async e => {
  e.preventDefault();
  const msg = input.value.trim();
  if (!msg) return;
  if (msg.startsWith('/')) return handleCommand(msg);
  addMessage(msg, 'user');
  input.value = '';
  input.style.height = 'auto';
  try {
    const r = await getChatReply(msg);
    addMessage(r, 'bot');
  } catch {
    addMessage('⚠️ Request failed. Check console.', 'bot');
  }
};

// --- Input Auto Resize ---
input.oninput = () => {
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';
};

// --- Theme Toggle ---
themeToggle.onclick = () => toggleTheme();

// --- Clear Chat ---
clearChatBtn.onclick = () => clearChat();
