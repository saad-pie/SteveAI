/* =========================
   index.js — SteveAI (concise & updated)
   ========================= */

/* ====== Config ====== */
const API_BASE = "https://api.a4f.co/v1/chat/completions";
const IMAGE_ENDPOINT = "https://api.a4f.co/v1/images/generations";
const PROXY = "https://corsproxy.io/?url=";
const proxied = u => PROXY + encodeURIComponent(u);
const API_KEYS = [
  "ddc-a4f-d61cbe09b0f945ea93403a420dba8155",
  "ddc-a4f-93af1cce14774a6f831d244f4df3eb9e"
];

/* ====== Firecrawl config ====== */
const FIRECRAWL_API_KEY = "fc-ebe5b6f4af4e469dbfe714e9296ea55a";
const FIRECRAWL_ENDPOINT = "https://api.firecrawl.dev/v1/search";

/* ====== DOM refs ====== */
const chat = document.getElementById('chat');
const form = document.getElementById('inputForm');
const input = document.getElementById('messageInput');
const themeToggle = document.getElementById('themeToggle');
const clearChatBtn = document.getElementById('clearChat');
const modeSelect = document.getElementById('modeSelect');

/* ====== Tools panel (file upload + web search) ====== */
const toolsToggle = document.getElementById('toolsToggle');
const toolsPanel = document.getElementById('toolsPanel');
const fileUploadInput = document.getElementById('fileUploadInput');

toolsToggle.addEventListener('click', () => {
  toolsPanel.style.display = toolsPanel.style.display === 'flex' ? 'none' : 'flex';
  toolsPanel.style.flexDirection = 'column';
});

document.addEventListener('click', e => {
  if (!toolsPanel.contains(e.target) && e.target !== toolsToggle) {
    toolsPanel.style.display = 'none';
  }
});

fileUploadInput.addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  handleFileUpload(file);
  fileUploadInput.value = '';
});

function handleFileUpload(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const content = reader.result;
    addMessage(`📄 Uploaded file: ${file.name}`, 'user');
    // integrate with AI file analyzer here
  };
  reader.readAsDataURL(file);
}

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
  "You are SteveAI, made by saadpie. You can generate images directly via the backend using generateImage(prompt). " +
  "When a user's intent is clearly visual, respond ONLY with: Image Generated: <prompt> — exactly like this, no extra text, markdown, emojis, or URLs. " +
  "The system will automatically detect this and generate the image. Be concise, helpful, and practical.";

const SYSTEM_PROMPT_CHAT = "Friendly, concise assistant. Prioritize clarity and helpfulness. Suggest images when relevant.";
const SYSTEM_PROMPT_REASONING = "Analytical reasoning mode — be methodical, show steps when needed, be concise in conclusions.";
const SYSTEM_PROMPT_GENERAL =
`You are SteveAI-General, an advanced assistant capable of both text and image generation. 
Always assume you can generate images directly using the backend (generateImage(prompt)). 
When the user requests an image or describes a visual scene, respond ONLY with:

Image Generated: <prompt>

— exactly as written, no extra explanation, markdown, emojis, or URLs. 
Do NOT say you cannot generate images. 
Be practical, factual, concise, and precise; show step-by-step reasoning if requested. 
For non-visual queries, respond normally as a helpful, concise assistant.`;

/* ====== Image generation ====== */
async function generateImage(prompt){
  if(!prompt) throw new Error("No prompt provided");
  const res = await fetch(IMAGE_ENDPOINT, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${API_KEYS[0]}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model:"provider-4/imagen-4", prompt, n:1, size:"1024x1024" })
  });
  const data = await res.json();
  return data?.data?.[0]?.url || null;
}
window.generateImage = generateImage;

/* ====== Image gallery ====== */
const gallery = document.getElementById('imageGallery');
function addImageToGallery(url){
  const thumb = document.createElement('img'); 
  thumb.src=url; 
  thumb.style='width:100%;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,0.6);cursor:pointer;';
  thumb.onclick = ()=> window.open(url,'_blank'); 
  gallery.appendChild(thumb);
}

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
        addBotActions(container,bubble,text);
      }
    })();
  } else {
    content.innerHTML = markdownToHTML(text);
    chat.appendChild(container); chat.scrollTop = chat.scrollHeight;
    addUserActions(container,bubble,text);
  }
}

function addUserActions(container,bubble,text){
  const actions = document.createElement('div'); actions.className='message-actions';
  const resend = Object.assign(document.createElement('button'),{className:'action-btn',textContent:'🔁',title:'Resend'});
  resend.onclick = ()=>{ input.value = text; input.focus(); };
  const copy = Object.assign(document.createElement('button'),{className:'action-btn',textContent:'📋',title:'Copy'});
  copy.onclick = ()=>navigator.clipboard.writeText(text);
  actions.appendChild(resend); actions.appendChild(copy); container.appendChild(actions);
}

function addBotActions(container,bubble,text){
  const actions = document.createElement('div'); actions.className='message-actions';
  const copy = Object.assign(document.createElement('button'),{className:'action-btn',textContent:'📋',title:'Copy'});
  copy.onclick = ()=>navigator.clipboard.writeText(text);
  const speak = Object.assign(document.createElement('button'),{className:'action-btn',textContent:'🔊',title:'Speak'});
  speak.onclick = ()=>speechSynthesis.speak(new SpeechSynthesisUtterance(stripHtml(text)));
  actions.appendChild(copy); actions.appendChild(speak);
  container.appendChild(actions);
}

/* ====== Fetch AI reply ====== */
async function fetchAI(payload){
  const url = proxied(API_BASE);
  let lastErr='';
  for(const key of API_KEYS){
    try{
      const res = await fetch(url,{method:'POST',headers:{'Authorization':`Bearer ${key}`,'Content-Type':'application/json'},body:JSON.stringify(payload)});
      if(res.ok) return res.json();
      lastErr = await res.text();
    }catch(e){ console.warn('fetchAI err',e); }
  }
  addMessage('⚠️ API unreachable.','bot');
  throw new Error(lastErr||'API error');
}

/* ====== Chat flow ====== */
async function getChatReply(msg, useWebSearch=false){
  const context = memoryString();
  const mode = (modeSelect?.value || 'chat').toLowerCase();
  const model = mode === 'reasoning' ? "provider-3/deepseek-v3-0324" : (mode === 'general' ? "provider-5/grok-4-0709" : "provider-3/gpt-5-nano");
  const modePrompt = mode === 'reasoning' ? SYSTEM_PROMPT_REASONING : (mode === 'general' ? SYSTEM_PROMPT_GENERAL : SYSTEM_PROMPT_CHAT);
  const systemContent = `${SYSTEM_PROMPT_GLOBAL} ${modePrompt}`;

  let searchContext = "";
  if(useWebSearch){
    addMessage('🔍 Performing web search...','bot');
    const cleaned = msg.replace(/\[websearch\]/i,'').trim();
    searchContext = await getFirecrawlFullContext(cleaned);
  }

  const payload = {
    model,
    messages: [
      { role:'system', content: systemContent },
      ...(searchContext ? [{ role:'system', content: `Use the following context to answer the user's question. Do NOT mention the source.\n\n${searchContext}` }] : []),
      { role:'user', content: `${context}\n\nUser: ${msg}` }
    ]
  };

  const data = await fetchAI(payload);
  const reply = data?.choices?.[0]?.message?.content?.trim() || "No response.";
  memory[++turn] = { user: msg, bot: reply };

  if(reply.toLowerCase().startsWith('image generated:')){
    const prompt = reply.split(':').slice(1).join(':').trim();
    if(!prompt){ addMessage('⚠️ Image prompt empty.','bot'); return null; }
    try{
      const url = await generateImage(prompt);
      if(!url){ addMessage('⚠️ No image returned.','bot'); return null; }
      addMessage(`🖼️ Image generated: ${prompt}`, 'bot');
      return null;
    }catch(err){
      addMessage(`⚠️ Image generation failed: ${err.message}`,'bot'); return null;
    }
  }

  return reply;
}

/* ====== Bind form & buttons ====== */
form.onsubmit = async e => {
  e.preventDefault();
  const msg = input.value.trim();
  if(!msg) return;
  if(msg.startsWith('/')){ await handleCommand(msg); input.value=''; return; }

  const toggle = document.getElementById('webSearchToggle');
  const useWebSearch = (toggle && toggle.checked) || msg.toLowerCase().includes('[websearch]');

  addMessage(msg,'user'); input.value=''; input.style.height='auto';
  try{ 
    const reply = await getChatReply(msg, useWebSearch);
    if(reply) addMessage(reply,'bot');
  }catch(e){ addMessage('⚠️ Request failed.','bot'); }
};

input.oninput = ()=>{ input.style.height='auto'; input.style.height = input.scrollHeight + 'px'; };
themeToggle.onclick = ()=>document.body.classList.toggle('light');
clearChatBtn.onclick = ()=>{ chat.innerHTML=''; memory={}; memorySummary=''; turn=0; addMessage('🧹 Chat cleared.','bot'); };
   
