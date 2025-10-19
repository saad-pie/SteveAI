/* =========================
   index.js — SteveAI (serverless safe)
   ========================= */

/* ====== DOM refs ====== */
const chat = document.getElementById('chat');
const form = document.getElementById('inputForm');
const input = document.getElementById('messageInput');
const themeToggle = document.getElementById('themeToggle');
const clearChatBtn = document.getElementById('clearChat');
const modeSelect = document.getElementById('modeSelect'); // supports 'chat' | 'reasoning' | 'general'

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
  "You are SteveAI, made by saadpie. You have the ability to trigger image generation through the backend (generateImage(prompt)). " +
  "If you want an image generated, do NOT describe, explain, or include URLs. Respond ONLY with: Image Generated: <prompt>. " +
  "The title MUST be exactly 'Image Generated:' (capital I, capital G, colon included). No extra sentences, markdown, emojis, or code. " +
  "The system will detect that line and generate the image automatically. Auto-generate when the user's intent is clearly visual; otherwise suggest. Be helpful, concise and not spammy.";

const SYSTEM_PROMPT_CHAT = "Friendly, concise assistant. Prioritize clarity and helpfulness. Suggest images when relevant.";
const SYSTEM_PROMPT_REASONING = "Analytical reasoning mode — be methodical, show steps when needed, be concise in conclusions.";
const SYSTEM_PROMPT_GENERAL = "General assistant (steveai-general / grok-4-0709): practical, factual, concise, prefer precise answers and step-by-step when requested; avoid hallucination.";

/* ====== Serverless fetch helpers ====== */
async function fetchAI(payload){
  try {
    const res = await fetch('/.netlify/functions/steveai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error('Server error');
    return await res.json();
  } catch(e){
    addMessage('⚠️ API unreachable. Check server function.', 'bot');
    throw e;
  }
}

async function generateImage(prompt){
  if(!prompt) throw new Error("No prompt provided");
  try {
    const res = await fetch('/.netlify/functions/steveai-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'image', prompt })
    });
    if(!res.ok) throw new Error('Image server error');
    const data = await res.json();
    return data?.url || null;
  } catch(e){
    addMessage(`⚠️ Image generation failed: ${e.message}`, 'bot');
    return null;
  }
}
window.generateImage = generateImage;

/* ====== Image gallery (DOM + styles) ====== */
const gallery = document.createElement('div'); gallery.id = 'imageGallery';
gallery.style = 'position:fixed;right:12px;bottom:12px;max-width:220px;z-index:9999;display:flex;flex-direction:column;gap:8px;';
document.body.appendChild(gallery);
const galleryTitle = document.createElement('div'); galleryTitle.textContent='Gallery'; galleryTitle.style='font-size:12px;color:#fff;opacity:0.8;text-align:center;';
gallery.appendChild(galleryTitle);
function addImageToGallery(url){
  const thumb = document.createElement('img'); thumb.src=url; thumb.style='width:100%;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,0.6);cursor:pointer;';
  thumb.onclick = ()=> window.open(url,'_blank'); gallery.appendChild(thumb);
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

  if(container.dataset && container.dataset.prompt){
    const openBtn = Object.assign(document.createElement('button'),{className:'action-btn',textContent:'🔗',title:'Open image'});
    openBtn.onclick = ()=> window.open(container.dataset.url,'_blank');
    const regen = Object.assign(document.createElement('button'),{className:'action-btn',textContent:'🔁',title:'Regenerate'});
    regen.onclick = async ()=>{
      try{
        const p = container.dataset.prompt;
        addMessage('🔄 Regenerating image...','bot');
        const newUrl = await generateImage(p);
        if(!newUrl) return addMessage('⚠️ No image returned.','bot');
        container.querySelector('.bubble-content').innerHTML = `<img src="${newUrl}" style="max-width:90%;border-radius:10px;margin-top:6px;" />`;
        container.dataset.url = newUrl;
      }catch(e){ addMessage('⚠️ Regenerate failed: '+e.message,'bot'); }
    };
    const save = Object.assign(document.createElement('button'),{className:'action-btn',textContent:'💾',title:'Save to gallery'});
    save.onclick = ()=> addImageToGallery(container.dataset.url);
    actions.appendChild(openBtn); actions.appendChild(regen); actions.appendChild(save);
  }

  container.appendChild(actions);
}

/* append image-only bubble */
function appendImageBubble(imgUrl, prompt){
  const container = document.createElement('div'); container.className='message-container bot';
  container.dataset.prompt = prompt || '';
  container.dataset.url = imgUrl;
  const bubble = document.createElement('div'); bubble.className='bubble bot';
  const content = document.createElement('div'); content.className='bubble-content';
  content.innerHTML = `<img src="${imgUrl}" alt="AI Image" style="max-width:90%;border-radius:10px;margin-top:6px;" />`;
  bubble.appendChild(content); container.appendChild(bubble);
  chat.appendChild(container); chat.scrollTop = chat.scrollHeight;
  addBotActions(container,bubble,'[Image]');
}

/* ====== Summarize helpers ====== */
async function generateSummary(){
  const raw = memoryString();
  const payload = { model:"provider-3/gpt-4o-mini", messages:[{role:"system",content:"You are SteveAI, made by saadpie. Summarize the following chat context clearly."},{role:"user",content:raw}] };
  try{ const d = await fetchAI(payload); return d?.choices?.[0]?.message?.content?.trim()||''; }catch{ return "Summary: "+ lastTurns(2).replace(/\n/g,' ').slice(0,800); }
}
async function buildContext(){
  if(shouldSummarize()){
    const sum = await generateSummary();
    if(sum){ memorySummary=sum; const keep={}; Object.keys(memory).map(Number).sort((a,b)=>a-b).slice(-4).forEach(k=>keep[k]=memory[k]); memory=keep; }
  }
  return memorySummary ? `[SESSION SUMMARY]\n${memorySummary}\n\n[RECENT TURNS]\n${lastTurns(6)}` : memoryString();
}

/* ====== Chat reply + image-detection workflow ====== */
async function getChatReply(msg){
  const context = await buildContext();
  const mode = (modeSelect?.value || 'chat').toLowerCase();
  const model = mode === 'reasoning' ? "provider-3/deepseek-v3-0324" : (mode === 'general' ? "provider-3/grok-4-0709" : "provider-3/gpt-5-nano");
  const modePrompt = mode === 'reasoning' ? SYSTEM_PROMPT_REASONING : (mode === 'general' ? SYSTEM_PROMPT_GENERAL : SYSTEM_PROMPT_CHAT);
  const systemContent = `${SYSTEM_PROMPT_GLOBAL} ${modePrompt}`;

  const payload = {
    model,
    messages: [
      { role:'system', content: systemContent },
      { role:'user', content: `${context}\n\nUser: ${msg}` }
    ]
  };

  const data = await fetchAI(payload);
  const reply = data?.choices?.[0]?.message?.content?.trim() || "No response.";
  memory[++turn] = { user: msg, bot: reply };

  if(reply && reply.toLowerCase().startsWith('image generated:')){
    const prompt = reply.split(':').slice(1).join(':').trim();
    if(!prompt){ addMessage('⚠️ Image prompt empty.','bot'); return null; }
    try{
      const url = await generateImage(prompt);
      if(!url){ addMessage('⚠️ No image returned from server.','bot'); return null; }
      appendImageBubble(url, prompt);
      return null;
    }catch(err){
      addMessage(`⚠️ Image generation failed: ${err.message}`,'bot'); return null;
    }
  }

  return reply;
}

/* ====== Commands ====== */
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
      try{ const url = await generateImage(argString); if(!url){ addMessage('⚠️ No image returned.','bot'); return; } appendImageBubble(url,argString); }catch(e){ addMessage(`⚠️ Image failed: ${e.message}`,'bot'); }
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

/* ====== Misc UI helpers ====== */
function toggleTheme(){ document.body.classList.toggle('light'); addMessage('🌓 Theme toggled.','bot'); }
function clearChat(){ chat.innerHTML=''; memory={}; memorySummary=''; turn=0; addMessage('🧹 Chat cleared.','bot'); }
function exportChat(){ const text = memorySummary ? `[SUMMARY]\n${memorySummary}\n\n[CHAT]\n${memoryString()}` : `[CHAT]\n${memoryString()}`; const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'})); a.download=`SteveAI_Chat_${new Date().toISOString().slice(0,19)}.txt`; a.click(); addMessage('💾 Chat exported.','bot'); }
function showContact(){ addMessage(`**📬 Contact SteveAI**\n- Creator: @saad-pie\n- Website: steve-ai.netlify.app`,'bot'); }
async function playSummary(){ addMessage('🎬 Generating chat summary...','bot'); if(!memorySummary) memorySummary = await generateSummary(); addMessage(`🧠 **Chat Summary:**\n${memorySummary}`,'bot'); }
function showAbout(){ addMessage('🤖 SteveAI — built by saadpie.','bot'); }
function changeMode(arg){ if(!arg || !['chat','reasoning','general'].includes(arg.toLowerCase())){ addMessage('⚙️ Usage: /mode chat | reasoning | general','bot'); return; } if(modeSelect) modeSelect.value = arg.toLowerCase(); addMessage(`🧭 Mode: ${arg}`,'bot'); }
function showTime(){ addMessage(`⏰ Local time: ${new Date().toLocaleTimeString()}`,'bot'); }
function showHelp(){ addMessage(`**Commands:** /help /clear /theme /image <prompt> /export /contact /play /about /mode /time`,'bot'); }

/* ====== Chat flow & bindings ====== */
async function getAndShowReply(msg){
  const reply = await getChatReply(msg);
  if(reply) addMessage(reply,'bot');
}

form.onsubmit = async e => {
  e.preventDefault();
  const msg = input.value.trim();
  if(!msg) return;
  if(msg.startsWith('/')){ await handleCommand(msg); input.value=''; return; }
  addMessage(msg,'user'); input.value=''; input.style.height='auto';
  try{ await getAndShowReply(msg); }catch(e){ addMessage('⚠️ Request failed. Check console.','bot'); }
};

input.oninput = ()=>{ input.style.height='auto'; input.style.height = input.scrollHeight + 'px'; };
themeToggle.onclick = ()=>toggleTheme();
clearChatBtn.onclick = ()=>clearChat();
         
