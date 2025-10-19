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
const FIRECRAWL_API_KEY = "fc-ebe5b6f4af4e469dbfe714e9296ea55a"; // replace if needed
const FIRECRAWL_ENDPOINT = "https://api.firecrawl.dev/v1/search";

/* ====== DOM refs ====== */
const chat = document.getElementById('chat');
const form = document.getElementById('inputForm');
const input = document.getElementById('messageInput');
const themeToggle = document.getElementById('themeToggle');
const clearChatBtn = document.getElementById('clearChat');
const modeSelect = document.getElementById('modeSelect'); // supports 'chat' | 'reasoning' | 'general'

/* ====== Add Web Search toggle UI (vanilla) ====== */
(function createWebSearchToggle(){
  try{
    // create a small label+checkbox and insert near modeSelect if possible
    const container = document.createElement('div');
    container.style = 'display:inline-flex;align-items:center;gap:6px;margin-left:12px;font-size:13px;color:var(--muted, #ddd);';
    container.id = 'webSearchContainer';

    const label = document.createElement('label');
    label.style = 'display:inline-flex;align-items:center;gap:6px;cursor:pointer;';
    label.title = 'Toggle web search (Firecrawl) for messages';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.id = 'webSearchToggle';
    cb.style = 'transform:scale(0.95);';

    const span = document.createElement('span');
    span.textContent = 'Web Search';
    span.style = 'font-size:12px;opacity:0.85;';

    label.appendChild(cb);
    label.appendChild(span);
    container.appendChild(label);

    if(modeSelect && modeSelect.parentNode){
      modeSelect.parentNode.insertBefore(container, modeSelect.nextSibling);
    } else {
      document.body.appendChild(container);
    }
  }catch(e){ console.warn('web search toggle init failed', e); }
})();

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

/* ====== Image generation (HTTP fetch) ====== */
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

  // attach image controls if dataset present
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

/* ====== fetchAI (rotating keys + proxy) ====== */
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

/* ====== Firecrawl: search/scrape/crawl/map ====== */
async function getFirecrawlFullContext(userQuery){
  try{
    const body = {
      query: userQuery,
      formats: ["markdown"],
      limit: 4,
      crawl: true,
      map: true
    };

    const res = await fetch(FIRECRAWL_ENDPOINT,{
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${FIRECRAWL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    const data = await res.json();
    if(!data || !data.results || !data.results.length) return "No relevant content found.";

    // Firecrawl already returns mapped summaries; combine them for LLM context
    const combined = data.results.map(r => r.markdown || r.text || r.summary || '').filter(Boolean).join('\n\n---\n\n');
    return combined || "No relevant content found.";
  }catch(e){
    console.error('Firecrawl error', e);
    return "Error fetching web content.";
  }
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

/* ====== Chat reply + image-detection workflow (with optional websearch) ====== */
async function getChatReply(msg, useWebSearch=false){
  const context = await buildContext();
  const mode = (modeSelect?.value || 'chat').toLowerCase();
  const model = mode === 'reasoning' ? "provider-3/deepseek-v3-0324" : (mode === 'general' ? "provider-5/grok-4-0709" : "provider-3/gpt-5-nano");
  const modePrompt = mode === 'reasoning' ? SYSTEM_PROMPT_REASONING : (mode === 'general' ? SYSTEM_PROMPT_GENERAL : SYSTEM_PROMPT_CHAT);
  const systemContent = `${SYSTEM_PROMPT_GLOBAL} ${modePrompt}`;

  let searchContext = "";
  if(useWebSearch){
    addMessage('🔍 Performing web search...','bot');
    // strip tag if present
    const cleaned = msg.replace(/\[websearch\]/i,'').trim();
    searchContext = await getFirecrawlFullContext(cleaned);
  }

  const payload = {
    model,
    messages: [
      { role:'system', content: systemContent },
      // silently attach web context as system guidance (do not mention the source)
      ...(searchContext ? [{ role:'system', content: `Use the following context to answer the user's question. Do NOT mention the source or say that external content was provided.\n\n${searchContext}` }] : []),
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
async function getAndShowReply(msg, useWebSearch=false){
  const reply = await getChatReply(msg, useWebSearch);
  if(reply) addMessage(reply,'bot');
}

form.onsubmit = async e => {
  e.preventDefault();
  const msg = input.value.trim();
  if(!msg) return;
  if(msg.startsWith('/')){ await handleCommand(msg); input.value=''; return; }

  // decide whether to use web search: checkbox OR [websearch] tag in message
  const toggle = document.getElementById('webSearchToggle');
  const useWebSearch = (toggle && toggle.checked) || msg.toLowerCase().includes('[websearch]');

  addMessage(msg,'user'); input.value=''; input.style.height='auto';
  try{ await getAndShowReply(msg, useWebSearch); }catch(e){ addMessage('⚠️ Request failed. Check console.','bot'); }
};

input.oninput = ()=>{ input.style.height='auto'; input.style.height = input.scrollHeight + 'px'; };
themeToggle.onclick = ()=>toggleTheme();
clearChatBtn.onclick = ()=>clearChat();
                      
