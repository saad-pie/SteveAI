const chat = document.getElementById('chat');
const form = document.getElementById('inputForm');
const input = document.getElementById('messageInput');
const themeToggle = document.getElementById('themeToggle');
const clearChatBtn = document.getElementById('clearChat');

const API_URL = "https://api.a4f.co/v1/chat/completions";
const API_KEY = "ddc-a4f-d61cbe09b0f945ea93403a420dba8155";

let memory = {}, turn = 0, TYPE_DELAY = 2;

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

    // Create a content wrapper for proper Markdown rendering
    const content = document.createElement('div');
    content.className = 'bubble-content';
    bubble.appendChild(content);

    // Bot typing animation
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

// --- Fetch AI ---
async function fetchAI(payload) {
    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        return await res.json();
    } catch(e) {
        addMessage('⚠️ API unreachable', 'bot');
    }
}

// --- Memory string ---
function memoryString() {
    return Object.keys(memory)
        .map(k => `User: ${memory[k].user}\nBot: ${memory[k].bot}`)
        .join('\n');
}

// --- Get AI reply ---
async function getChatReply(msg) {
    const payload = {
        model: "provider-6/gpt-4o",
        messages: [
            { role: "system", content: "You are SteveAI, friendly AI made by saadpie." },
            { role: "user", content: memoryString() + "\n" + msg }
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
    if(!msg) return;
    addMessage(msg, 'user');
    input.value = '';
    input.style.height = 'auto';
    const r = await getChatReply(msg);
    addMessage(r, 'bot');
};

// --- Input Auto Resize ---
input.oninput = () => { input.style.height = 'auto'; input.style.height = input.scrollHeight + 'px'; };

// --- Theme Toggle ---
themeToggle.onclick = () => document.body.classList.toggle('light');

// --- Clear Chat ---
clearChatBtn.onclick = () => chat.innerHTML = '';
      
