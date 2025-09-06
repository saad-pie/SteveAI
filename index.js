const chat = document.getElementById('chat');
const form = document.getElementById('inputForm');
const input = document.getElementById('messageInput');
const themeToggle = document.getElementById('themeToggle');
const clearChatBtn = document.getElementById('clearChat');

// --- API Config ---
const API_BASE = "https://api.a4f.co/v1/chat/completions";

// Two API keys as fallback
const API_KEYS = [
  "ddc-a4f-d61cbe09b0f945ea93403a420dba8155",
  "ddc-a4f-93af1cce14774a6f831d244f4df3eb9e"
];

// Single proxy that supports POST + Authorization
const PROXY = "https://corsproxy.io/?url=";
const proxiedURL = (base) => PROXY + encodeURIComponent(base);

// --- Memory / Summary ---
let memory = {};          // { turnNumber: { user, bot } }
let turn = 0;             // turn counter
let memorySummary = "";   // compact summary after we "shift gears"
const TYPE_DELAY = 2;

// soft token budget (super rough est: ~4 chars per token)
const TOKEN_BUDGET = 2200;
const approxTokens = (s) => Math.ceil((s || "").length / 4);

// Build full memory string (raw)
function memoryString() {
  return Object.keys(memory)
    .map(k => `User: ${memory[k].user}\nBot: ${memory[k].bot}`)
    .join('\n');
}

// Last N turns only
function lastTurns(n = 6) {
  const keys = Object.keys(memory).map(Number).sort((a,b)=>a-b);
  const slice = keys.slice(-n);
  return slice.map(k => `User: ${memory[k].user}\nBot: ${memory[k].bot}`).join('\n');
}

// Should we switch to summary mode?
function shouldSummarize() {
  if (memorySummary) return false; // already summarized
  const raw = memoryString();
  return turn >= 6 || approxTokens(raw) > TOKEN_BUDGET;
}

// Ask model to summarize the convo (fallback to naive on failure)
async function generateSummary() {
  const raw = memoryString();
  const payload = {
    model: "provider-3/gpt-4",
    messages: [
      { role: "system", content: "You are a succinct conversation summarizer." },
      { role: "user", content: `Summarize the following chat in <= 180 tokens.\nFocus on: goals, decisions, preferences, facts, open questions. Avoid fluff.\n\n${raw}` }
    ]
  };
  try {
    const data = await fetchAI(payload);
    const sum = data?.choices?.[0]?.message?.content?.trim();
    return sum || "";
  } catch (e) {
    console.warn("Summarization failed, using naive fallback", e);
    // naive fallback: keep only last 2 turns as a pseudo-summary
    return "Conversation so far: " + lastTurns(2).replace(/\n/g, " ").slice(0, 800);
  }
}

// Build context to send with each user message
async function buildContext() {
  if (shouldSummarize()) {
    const sum = await generateSummary();
    if (sum) {
      memorySummary = sum;
      // After summarizing, we can trim raw memory to just a few most recent turns
      const keep = {};
      const keys = Object.keys(memory).map(Number).sort((a,b)=>a-b).slice(-4);
      keys.forEach(k => keep[k] = memory[k]);
      memory = keep;
    }
  }
  if (memorySummary) {
    return `[SESSION SUMMARY]\n${memorySummary}\n\n[RECENT TURNS]\n${lastTurns(6)}`;
  }
  return memoryString();
}

// --- Markdown to HTML ---
function markdownToHTML(t) { 
  return marked.parse(t || ""); 
}

// --- UI: Add message bubble ---
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

    let i=0, buf="";
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

// --- UI: User bubble actions ---
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

// --- UI: Bot bubble actions ---
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

// --- Fetch AI (tries both keys via corsproxy.io) ---
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
      if (res.ok) {
        return await res.json();
      } else {
        const txt = await res.text().catch(()=> "");
        lastErrText = `HTTP ${res.status} ${res.statusText} ${txt}`;
        console.warn(`A4F error with key ${key}:`, lastErrText);
        // try next key
      }
    } catch (e) {
      console.warn(`Network/proxy error with key ${key}:`, e);
      // try next key
    }
  }
  addMessage('⚠️ API unreachable (both keys via proxy failed). Check CORS/proxy status or rotate keys.', 'bot');
  throw new Error(lastErrText || "All attempts failed");
}

// --- Chat flow ---
async function getChatReply(msg) {
  const context = await buildContext();
  const payload = {
    model: "provider-3/gpt-4",
    messages: [
      { role: "system", content: "You are SteveAI, a helpful, concise assistant made by saadpie. Prefer direct answers with minimal fluff." },
      { role: "user", content: `${context}\n\nUser: ${msg}` }
    ]
  };
  const data = await fetchAI(payload);
  const reply = data?.choices?.[0]?.message?.content || "No response (CORS?)";
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
  } catch (e) {
    addMessage('⚠️ Request failed. See console for details.', 'bot');
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
