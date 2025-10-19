/* =========================
   index.js — SteveAI (concise)
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

/* ====== Simple DOM refs ====== */
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

function memoryString(){
  return Object.keys(memory).map(k=>`User: ${memory[k].user}\nBot: ${memory[k].bot}`).join('\n');
}
function lastTurns(n=6){
  return Object.keys(memory).map(Number).sort((a,b)=>a-b).slice(-n)
    .map(k=>`User: ${memory[k].user}\nBot: ${memory[k].bot}`).join('\n');
}
function shouldSummarize(){ return !memorySummary && (turn>=6 || approxTokens(memoryString())>2200); }

/* ====== System prompt (merged & concise) ======
   IMPORTANT: keep exact phrase "Image Generated:" behavior in mind.
*/
const SYSTEM_PROMPT = [
  "You are SteveAI, made by saadpie.",
  "You have the ability to trigger image generation through the backend (generateImage(prompt)).",
  "If you want an image generated, do NOT describe, explain, or include URLs. Respond ONLY with:",
  "Image Generated: <prompt>",
  "The title MUST be exactly 'Image Generated:' (capital I, capital G, colon included).",
  "No extra sentences, markdown, emojis, or code. The system will detect that line and generate the image.",
  "Auto-generate when the user's intent is clearly visual (e.g. 'Show me', 'Create a poster of'). Otherwise suggest instead of auto-generating.",
  "Be helpful, concise and not spammy."
].join(' ');

/* ====== Image generation (HTTP fetch) ====== */
async function generateImage(prompt){
  if(!prompt) throw new Error("No prompt provided");
  const res = await fetch(IMAGE_ENDPOINT, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEYS[0]}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: "provider-4/imagen-4", prompt, n:1, size:"1024x1024" })
  });
  const data = await res.json();
  return data?.data?.[0]?.url || null;
}
window.generateImage = generateImage; // accessible for image.html

/* ====== UI helpers ====== */
function addMessage(text, sender='bot'){
  const container = document.createElement('div');
  container.className = `message-container ${sender}`;
  const bubble = document.createElement('div'); bubble.className = `bubble ${sender}`;
  const content = document.createElement('div'); content.className = 'bubble-content';
  bubble.appendChild(content); container.appendChild(bubble);

  if(sender==='bot'){
    chat.appendChild(container); chat.scrollTop = chat.scrollHeight;
    // typing animation for plain text only (not HTML)
    let i=0, buf="";
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
  actions.appendChild(copy); actions.appendChild(speak); container.appendChild(actions);
}

function stripHtml(s){ const d=document.createElement('div'); d.innerHTML=s; return d.textContent||d.innerText||''; }

/* Append an image-only bot bubble (NO prompt, NO URL shown) */
function appendImageBubble(imgUrl){
  const container = document.createElement('div'); container.className='message-container bot';
  const bubble = document.createElement('div'); bubble.className='bubble bot';
  const content = document.createElement('div'); content.className='bubble-content';
  content.innerHTML = `<img src="${imgUrl}" alt="AI Image" style="max-width:90%;border-radius:10px;margin-top:6px;" />`;
  bubble.appendChild(content); container.appendChild(bubble);
  addBotActions(container,bubble,'[Image]');
  chat.appendChild(container); chat.scrollTop = chat.scrollHeight;
}

/* ====== Fetch AI (rotating keys) ====== */
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
  addMessage('⚠️ API unreachable. Check keys or proxy.','bot');
  throw new Error(lastErr||'API error');
}

/* ====== Summarization (kept minimal) ====== */
async function generateSummary(){
  const raw = memoryString();
  const payload = { model:"provider-3/gpt-4o-mini", messages:[{role:"system",content:"You are SteveAI, made by saadpie. Summarize the following chat context clearly."},{role:"user",content:raw}] };
  try { const d = await fetchAI(payload); return d?.choices?.[0]?.message?.content?.trim()||''; } catch { return "Summary: " + lastTurns(2).replace(/\n/g,' ').slice(0,800); }
}
async function buildContext(){
  if(shouldSummarize()){
    const sum = await generateSummary();
    if(sum){ memorySummary=sum; const keep={}; Object.keys(memory).map(Number).sort((a,b)=>a-b).slice(-4).forEach(k=>keep[k]=memory[k]); memory=keep; }
  }
  return memorySummary ? `[SESSION SUMMARY]\n${memorySummary}\n\n[RECENT TURNS]\n${lastTurns(6)}` : memoryString();
}

/* ====== Chat: get reply and image-detection ====== */
async function getChatReply(msg){
  const context = await buildContext();
  const mode = (modeSelect?.value || 'chat').toLowerCase();
  const model = mode==='reasoning' ? "provider-3/deepseek-v3-0324" : "provider-3/gpt-5-nano";
  const botName = mode==='reasoning' ? "SteveAI-reasoning" : "SteveAI-chat";

  const payload = {
    model,
    messages: [
      { role:"system", content: `${botName}, made by saadpie. ${SYSTEM_PROMPT}` },
      { role:"user", content: `${context}\n\nUser: ${msg}` }
    ]
  };

  const data = await fetchAI(payload);
  const reply = data?.choices?.[0]?.message?.content?.trim() || "No response.";
  memory[++turn] = { user: msg, bot: reply };

  // detect "Image Generated:" (case-insensitive)
  if(reply && reply.toLowerCase().startsWith('image generated:')){
    const prompt = reply.split(':').slice(1).join(':').trim();
    if(!prompt){ addMessage('⚠️ Image prompt empty.', 'bot'); return null; }
    try{
      const url = await generateImage(prompt);
      if(!url){ addMessage('⚠️ No image returned from server.','bot'); return null; }
      appendImageBubble(url); // only the image shown
      return null; // already handled and shown
    }catch(err){
      addMessage(`⚠️ Image generation failed: ${err.message}`,'bot');
      return null;
    }
  }

  return reply;
}

/* ====== Commands (kept short) ====== */
async function handleCommand(cmd){
  const [command,...args] = cmd.trim().split(' ');
  const argString = args.join(' ');
  switch(command.toLowerCase()){
    case '/clear': clearChat(); return;
    case '/theme': toggleTheme(); return;
    case '/help': showHelp(); return;
    case '/image':
      if(!argString){ addMessage('⚠️ Usage: /image <prompt>','bot'); return; }
      addMessage(`🎨 Generating image for: ${argString}`,'bot');
      try{
        const url = await generateImage(argString);
        if(!url){ addMessage('⚠️ No image returned.','bot'); return; }
        appendImageBubble(url);
      }catch(e){ addMessage(`⚠️ Image failed: ${e.message}`,'bot'); }
      return;
    case '/export': exportChat(); return;
    case '/contact': showContact(); return;
    case '/play': await playSummary(); return;
    case '/about': showAbout(); return;
    case '/mode': changeMode(argString); return;
    case '/time': showTime(); return;
    default: addMessage(`❓ Unknown command: ${command}`,'bot'); return;
  }
}

/* ====== UI helpers (theme, clear, export, help...) ====== */
function toggleTheme(){ document.body.classList.toggle('light'); addMessage('🌓 Theme toggled.','bot'); }
function clearChat(){ chat.innerHTML=''; memory={}; memorySummary=''; turn=0; addMessage('🧹 Chat cleared.','bot'); }
function exportChat(){ const text = memorySummary ? `[SUMMARY]\n${memorySummary}\n\n[CHAT]\n${memoryString()}` : `[CHAT]\n${memoryString()}`; const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'})); a.download=`SteveAI_Chat_${new Date().toISOString().slice(0,19)}.txt`; a.click(); addMessage('💾 Chat exported.','bot'); }
function showContact(){ addMessage(`**📬 Contact SteveAI**\n- Creator: @saad-pie\n- Website: steve-ai.netlify.app`,'bot'); }
async function playSummary(){ addMessage('🎬 Generating chat summary...','bot'); if(!memorySummary) memorySummary = await generateSummary(); addMessage(`🧠 **Chat Summary:**\n${memorySummary}`,'bot'); }
function showAbout(){ addMessage('🤖 SteveAI — built by saadpie.','bot'); }
function changeMode(arg){ if(!arg || !['chat','reasoning'].includes(arg.toLowerCase())){ addMessage('⚙️ Usage: /mode chat | reasoning','bot'); return; } if(modeSelect) modeSelect.value = arg.toLowerCase(); addMessage(`🧭 Mode: ${arg}`,'bot');}
function showTime(){ addMessage(`⏰ Local time: ${new Date().toLocaleTimeString()}`,'bot'); }
function showHelp(){ addMessage(`**Commands:** /help /clear /theme /image <prompt> /export /contact /play /about /mode /time`,'bot'); }

/* ====== Chat flow & bindings ====== */
async function getAndShowReply(msg){
  const reply = await getChatReply(msg);
  if(reply) addMessage(reply,'bot'); // if null => handled (e.g. image)
}

form.onsubmit = async e => {
  e.preventDefault();
  const msg = input.value.trim();
  if(!msg) return;
  if(msg.startsWith('/')){ await handleCommand(msg); input.value=''; return; }
  addMessage(msg,'user'); input.value=''; input.style.height='auto';
  try{ await getAndShowReply(msg); } catch(e){ addMessage('⚠️ Request failed. Check console.','bot'); }
};

input.oninput = ()=>{ input.style.height='auto'; input.style.height = input.scrollHeight + 'px'; };
themeToggle.onclick = ()=>toggleTheme();
clearChatBtn.onclick = ()=>clearChat();

