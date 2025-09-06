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

// Proxies for CORS bypass
const PROXIES = [
    "https://cors-anywhere.herokuapp.com/",
    "https://thingproxy.freeboard.io/fetch/",
    "https://api.allorigins.win/raw?url="
];

// Build proxied URL
function proxiedURL(base, proxy) {
    if (proxy.includes("allorigins")) {
        return proxy + encodeURIComponent(base);
    }
    return proxy + base;
}

// --- Memory ---
let memory = {};
let summary = "Conversation so far: None.";   // NEW
let turn = 0, TYPE_DELAY = 2;
const MAX_TURNS = 6;                          // NEW
const TOKEN_THRESHOLD = 600;                  // NEW

// --- Rough token counter --- // NEW
function tokenCount(text) {
    return Math.ceil(text.split(/\s+/).length * 1.3);
}

// Convert Markdown to HTML
function markdownToHTML(t) { 
    return marked.parse(t || ""); 
}

// Add a message
function addMessage(text, sender) {
    const container = document.createElement('div');
    container.className = 'message-container ' + sender;

    const bubble = document.createElement('div');
    bubble.className = 'bubble ' + sender;
    container.appendChild(bubble);

    const content = document.createElement('div');
    content.className = 'bubble-content';
    bubble.appendChild(content);

    if(sender === 'bot') {
        chat.appendChild(container);
        chat.scrollTop = chat.scrollHeight;

        let i=0, buf="";
        (function type() {
            if(i < text.length) {
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

// --- User Buttons ---
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

// --- Bot Buttons ---
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

// --- Fetch AI with proxy & key fallback ---
async function fetchAI(payload) {
    for (let key of API_KEYS) {
        for (let proxy of PROXIES) {
            try {
                const res = await fetch(proxiedURL(API_BASE, proxy), {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${key}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                });
                if (res.ok) {
                    return await res.json();
                }
            } catch (e) {
                console.warn(`Failed with key ${key} via proxy ${proxy}`, e);
            }
        }
    }
    addMessage('⚠️ API unreachable (all keys/proxies failed)', 'bot');
}

// --- Memory string ---
function memoryString() {
    return Object.keys(memory)
        .map(k => `User: ${memory[k].user}\nBot: ${memory[k].bot}`)
        .join('\n');
}

// --- Summarize memory when needed --- // NEW
async function updateSummary() {
    const convo = memoryString();
    const payload = {
        model: "provider-3/gpt-4",
        messages: [
            { role: "system", content: "Summarize the following conversation briefly, keeping key details about user intent and important facts." },
            { role: "user", content: convo }
        ]
    };
    const data = await fetchAI(payload);
    const sum = data?.choices?.[0]?.message?.content || "";
    summary = "Conversation so far: " + sum;
    memory = {};
    turn = 0;
}

// --- Get AI reply ---
async function getChatReply(msg) {
    const convo = memoryString();
    const payload = {
        model: "provider-3/gpt-4",
        messages: [
            { role: "system", content: "You are SteveAI, friendly AI made by saadpie." },
            { role: "system", content: summary },
            { role: "user", content: convo + "\n" + msg }
        ]
    };
    const data = await fetchAI(payload);
    const reply = data?.choices?.[0]?.message?.content || "No response (CORS?)";

    memory[++turn] = { user: msg, bot: reply };

    // Gear shift if memory too big
    if (turn > MAX_TURNS || tokenCount(convo) > TOKEN_THRESHOLD) {
        await updateSummary();
    }

    return reply;
}

// --- Form Submit ---
form.onsubmit = async e => {
    e.preventDefault();
    const msg = input.value.trim();
    if(!msg) return;
    addMessage(msg, 'user');
    input.value = '';
    input.style.height = 'auto';
    const r = await getChatReply(msg);
    addMessage(r, 'bot');
};

// --- Input Auto Resize ---
input.oninput = () => { 
    input.style.height = 'auto'; 
    input.style.height = input.scrollHeight + 'px'; 
};

// --- Theme Toggle ---
themeToggle.onclick = () => document.body.classList.toggle('light');

// --- Clear Chat ---
clearChatBtn.onclick = () => chat.innerHTML = '';
        
