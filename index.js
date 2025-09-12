const chat = document.getElementById('chat');
const form = document.getElementById('inputForm');
const input = document.getElementById('messageInput');
const themeToggle = document.getElementById('themeToggle');
const clearChatBtn = document.getElementById('clearChat');

// --- API Config ---
const API_BASE = "https://38664dca.teveai.pages.dev/api/chat";

// --- Memory / Summary ---
let memory = {};
let turn = 0;
let memorySummary = "";
const TYPE_DELAY = 2;

function markdownToHTML(t) { 
  return marked.parse(t || ""); 
}

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
      }
    })();
  } else {
    content.innerHTML = markdownToHTML(text);
    chat.appendChild(container);
    chat.scrollTop = chat.scrollHeight;
  }
}

// --- Fetch AI (your Worker handles auth + forwarding) ---
async function fetchAI(msg, context) {
  const payload = {
    user: msg,
    context: context || ""
  };
  const res = await fetch(API_BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

// --- Chat flow ---
async function getChatReply(msg) {
  const context = memorySummary || "";
  const data = await fetchAI(msg, context);
  const reply = data.reply || data.response || "⚠️ No reply (check Worker)";
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
    console.error(e);
    addMessage('⚠️ Request failed.', 'bot');
  }
};

input.oninput = () => { 
  input.style.height = 'auto'; 
  input.style.height = input.scrollHeight + 'px'; 
};

themeToggle.onclick = () => document.body.classList.toggle('light');

clearChatBtn.onclick = () => {
  chat.innerHTML = '';
  memory = {};
  memorySummary = '';
  turn = 0;
  addMessage('🧹 Chat cleared.', 'bot');
};
