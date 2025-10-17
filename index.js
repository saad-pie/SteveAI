// --- DOM Elements ---
const chat = document.getElementById('chat');
const form = document.getElementById('inputForm');
const input = document.getElementById('messageInput');
const themeToggle = document.getElementById('themeToggle');
const clearChatBtn = document.getElementById('clearChat');
const modeSelect = document.getElementById('modeSelect'); // optional dropdown: "chat" | "reasoning"

// --- API Config ---
const API_BASE = "https://api.a4f.co/v1/chat/completions";
const PROXY = "https://corsproxy.io/?url=";
const proxiedURL = (base) => PROXY + encodeURIComponent(base);

// Two API keys as fallback
const API_KEYS = [
  "ddc-a4f-d61cbe09b0f945ea93403a420dba8155",
  "ddc-a4f-93af1cce14774a6f831d244f4df3eb9e"
];

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
    model: "provider-3/gpt-4",
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

// --- Chat Flow ---
async function getChatReply(msg) {
  const context = await buildContext();

  // detect mode (default: chat)
  const mode = (modeSelect?.value || 'chat').toLowerCase();

  // Select model and name dynamically
  const model =
    mode === 'reasoning'
      ? "provider-1/deepseek-v3-0324-turbo"
      : "provider-3/gpt-5-nano";

  const botName = mode === 'reasoning' ? "SteveAI-reasoning" : "SteveAI-chat";

  const payload = {
    model,
    messages: [
      {
        role: "system",
        content: `You are ${botName}, a helpful assistant made by saadpie. Be clear, concise, and smart.`
      },
      {
        role: "user",
        content: `${context}\n\nUser: ${msg}`
      }
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
themeToggle.onclick = () => document.body.classList.toggle('light');

// --- Clear Chat ---
clearChatBtn.onclick = () => {
  chat.innerHTML = '';
  memory = {};
  memorySummary = '';
  turn = 0;
  addMessage('🧹 Chat cleared.', 'bot');
};
  
