/* =========================
   index.js — SteveAI (browser-only)
   ========================= */

/* ====== Config ====== */
const API_BASE = "https://api.a4f.co/v1/chat/completions";
const IMAGE_ENDPOINT = "https://api.a4f.co/v1/images/generations";
const PROXY = "https://api.allorigins.win/raw?url="; // browser-safe CORS proxy
const proxied = u => PROXY + encodeURIComponent(u);
const API_KEYS = [
  "ddc-a4f-d61cbe09b0f945ea93403a420dba8155",
  "ddc-a4f-93af1cce14774a6f831d244f4df3eb9e"
];

/* ====== DOM refs ====== */
const chat = document.getElementById('chat');
const form = document.getElementById('inputForm');
const input = document.getElementById('messageInput');
const themeToggle = document.getElementById('themeToggle');
const clearChatBtn = document.getElementById('clearChat');
const modeSelect = document.getElementById('modeSelect');

/* ====== Memory & utils ====== */
let memory = {}, turn = 0, memorySummary = "";
const TYPE_DELAY = 2;
const approxTokens = s => Math.ceil((s || "").length / 4);
const markdownToHTML = t => marked.parse(t || "");
function memoryString(){ return Object.keys(memory).map(k=>`User: ${memory[k].user}\nBot: ${memory[k].bot}`).join('\n'); }
function lastTurns(n=6){ return Object.keys(memory).map(Number).sort((a,b)=>a-b).slice(-n).map(k=>`User: ${memory[k].user}\nBot: ${memory[k].bot}`).join('\n'); }
function shouldSummarize(){ return !memorySummary && (turn>=6 || approxTokens(memoryString())>2200); }

/* ====== System prompts ====== */
const SYSTEM_PROMPT_GLOBAL =
  "You are SteveAI, made by saadpie. You can trigger image generation through generateImage(prompt). " +
  "If generating an image, respond ONLY with: Image Generated: <prompt>.";

const SYSTEM_PROMPT_CHAT = "Friendly, concise assistant. Suggest images when relevant.";
const SYSTEM_PROMPT_REASONING = "Analytical reasoning mode — methodical, concise conclusions.";
const SYSTEM_PROMPT_GENERAL = "General assistant: factual, concise, step-by-step answers when requested.";

/* ====== Image generation ====== */
async function generateImage(prompt){
  if(!prompt) throw new Error("No prompt provided");
  const res = await fetch(proxied(IMAGE_ENDPOINT), {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEYS[0]}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model:"provider-4/imagen-4", prompt, n:1, size:"1024x1024" })
  });
  const data = await res.json();
  return data?.data?.[0]?.url || null;
}
window.generateImage = generateImage;

/* ====== UI helpers ====== */
function stripHtml(s){ const d=document.createElement('div'); d.innerHTML=s; return d.textContent||d.innerText||''; }
function addMessage(text,sender='bot'){
  const container = document.createElement('div'); container.className=`message-container ${sender}`;
  const bubble = document.createElement('div'); bubble.className=`bubble ${sender}`;
  const content = document.createElement('div'); content.className='bubble-content';
  bubble.appendChild(content); container.appendChild(bubble);

  if(sender === 'bot'){
    chat.appendChild(container); chat.scrollTop = chat.scrollHeight;
    let i=0, buf='';
    (function type(){
      if(i < text.length){
        buf += text[i++]; content.innerHTML = markdownToHTML(buf); chat.scrollTop = chat.scrollHeight;
        setTimeout(type, TYPE_DELAY);
      } else {
        content.innerHTML = markdownToHTML(text);
      }
    })();
  } else {
    content.innerHTML = markdownToHTML(text);
    chat.appendChild(container); chat.scrollTop = chat.scrollHeight;
  }
}

/* ====== Fetch AI (browser-safe) ====== */
async function fetchAI(payload){
  for(const key of API_KEYS){
    try{
      const res = await fetch(proxied(API_BASE),{
        method:'POST',
        headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},
        body:JSON.stringify(payload)
      });
      if(res.ok) return res.json();
    } catch(e){ console.warn('fetchAI error', e); }
  }
  addMessage('⚠️ API unreachable.','bot');
  return null;
}

/* ====== Build context & reply ====== */
async function buildContext(){
  if(shouldSummarize()){
    memorySummary = lastTurns(4); // simple browser-friendly summary
    const keep = {}; Object.keys(memory).map(Number).sort((a,b)=>a-b).slice(-4).forEach(k=>keep[k]=memory[k]);
    memory = keep;
  }
  return memorySummary ? `[SESSION SUMMARY]\n${memorySummary}\n\n[RECENT TURNS]\n${lastTurns(6)}` : memoryString();
}

async function getChatReply(msg){
  const context = await buildContext();
  const mode = (modeSelect?.value || 'chat').toLowerCase();
  const model = mode === 'reasoning' ? "provider-3/deepseek-v3-0324" : (mode === 'general' ? "provider-3/grok-4-0709" : "provider-3/gpt-5-nano");
  const modePrompt = mode === 'reasoning' ? SYSTEM_PROMPT_REASONING : (mode === 'general' ? SYSTEM_PROMPT_GENERAL : SYSTEM_PROMPT_CHAT);

  const payload = { model, messages:[ {role:'system', content:`${SYSTEM_PROMPT_GLOBAL} ${modePrompt}`}, {role:'user', content:`${context}\n\nUser: ${msg}`} ] };
  const data = await fetchAI(payload);
  const reply = data?.choices?.[0]?.message?.content?.trim() || "No response.";
  memory[++turn] = { user: msg, bot: reply };

  if(reply.toLowerCase().startsWith('image generated:')){
    const prompt = reply.split(':').slice(1).join(':').trim();
    if(prompt){
      const url = await generateImage(prompt);
      if(url) addMessage(`🖼️ Image: ${url}`,'bot');
      return null;
    }
  }

  return reply;
}

/* ====== Chat flow ====== */
async function getAndShowReply(msg){
  const reply = await getChatReply(msg);
  if(reply) addMessage(reply,'bot');
}

form.onsubmit = async e=>{
  e.preventDefault();
  const msg = input.value.trim();
  if(!msg) return;
  addMessage(msg,'user'); input.value=''; input.style.height='auto';
  await getAndShowReply(msg);
};

input.oninput = ()=>{ input.style.height='auto'; input.style.height = input.scrollHeight + 'px'; };
themeToggle.onclick = ()=>document.body.classList.toggle('light');
clearChatBtn.onclick = ()=>{ chat.innerHTML=''; memory={}; memorySummary=''; turn=0; addMessage('🧹 Chat cleared.','bot'); };
