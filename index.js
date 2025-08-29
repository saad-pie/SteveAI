const chat = document.getElementById('chat');
const form = document.getElementById('inputForm');
const input = document.getElementById('messageInput');
const floatTheme = document.getElementById('floatTheme');

const API_URL = "https://api.a4f.co/v1/chat/completions";
const API_KEY = "ddc-a4f-d61cbe09b0f945ea93403a420dba8155";

let memory = {};
let turn = 0;
let TYPE_DELAY = 2;

function markdownToHTML(t) {
  return marked.parse(t || "");
}

function addMessage(text, sender) {
  const b = document.createElement('div');
  b.className = 'bubble ' + sender;

  if(sender === 'bot') {
    const r = document.createElement('div');
    r.className = 'bot-render';
    b.appendChild(r);
    chat.appendChild(b);
    chat.scrollTop = chat.scrollHeight;

    let i=0, buf="";
    (function type(){
      if(i < text.length) {
        buf += text[i++];
        r.innerHTML = markdownToHTML(buf);
        chat.scrollTop = chat.scrollHeight;
        setTimeout(type, TYPE_DELAY);
      } else {
        r.innerHTML = markdownToHTML(text);
        chat.scrollTop = chat.scrollHeight;
      }
    })();
  } else {
    b.innerHTML = markdownToHTML(text);
    chat.appendChild(b);
    chat.scrollTop = chat.scrollHeight;
  }
}

async function fetchAI(p) {
  try {
    const r = await fetch(API_URL, {
      method:'POST',
      headers:{
        'Authorization':`Bearer ${API_KEY}`,
        'Content-Type':'application/json'
      },
      body: JSON.stringify(p)
    });
    return await r.json();
  } catch(e) {
    addMessage("⚠️ API unreachable (CORS blocked). Use a server proxy.","bot");
  }
}

function memoryString() {
  return Object.keys(memory).map(k =>
    `User: ${memory[k].user}\nBot: ${memory[k].bot}`
  ).join("\n");
}

async function getChatReply(msg) {
  const t = document.createElement('div');
  t.className = 'typing';
  t.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
  chat.appendChild(t);
  chat.scrollTop = chat.scrollHeight;

  const payload = {
    model: "provider-6/gpt-4o",
    messages: [
      { role: "system", content: "You are friendly assistant named SteveAI made by an extremely talented computer scientist snd AI develoer commonly online known as saadpie. only mention when asked." },
      { role: "user", content: memoryString() + "\n" + msg }
    ]
  };

  const data = await fetchAI(payload);
  t.remove();

  const reply = data?.choices?.[0]?.message?.content || "No response (CORS?)";
  memory[++turn] = { user: msg, bot: reply };

  return reply;
}

form.onsubmit = async e => {
  e.preventDefault();
  const msg = input.value.trim();
  if(!msg) return;

  addMessage(msg, 'user');
  input.value = '';

  const r = await getChatReply(msg);
  addMessage(r, 'bot');
};

input.onkeydown = e => {
  if(e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    form.onsubmit(e);
  }
};

input.oninput = () => {
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';
};

floatTheme.onclick = () => document.body.classList.toggle('light');
