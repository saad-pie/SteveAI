/* =========================
   index.js — SteveAI (updated: Content-Type fix, proxy fallback, improved errors,
   collapsible <think> blocks for SteveAI-fast (style C), hybrid image behavior)
   Analyzer = provider-3/gpt-4.1-nano
   ========================== */

/* ====== Config ====== */
const API_BASE = "https://api.a4f.co/v1/chat/completions";
const IMAGE_ENDPOINT = "https://api.a4f.co/v1/images/generations";
const PROXY = "https://corsproxy.io/?url=";
const proxied = u => PROXY + encodeURIComponent(u);

const API_KEYS = [
  "ddc-a4f-d61cbe09b0f945ea93403a420dba8155",
  "ddc-a4f-93af1cce14774a6f831d244f4df3eb9e"
];

/* Analyzer model (used only for uploaded file analysis) */
const ANALYZER_MODEL = "provider-3/gpt-4.1-nano";

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
const toolsToggle = document.getElementById('toolsToggle');
const toolsPanel = document.getElementById('toolsPanel');
const fileUploadInput = document.getElementById('fileUploadInput');
const gallery = document.getElementById('imageGallery');

/* ====== Model map & vision support ====== */
const STEVEAI_MODELS = {
  fast: "provider-3/gemini-2.5-flash-lite-preview-09-2025",
  chat: "provider-3/gpt-5-nano",
  reasoning: "provider-3/deepseek-v3-0324",
  general: "provider-5/grok-4-0709"
};
const VISION_CAPABLE = new Set([
  "provider-3/gemini-2.5-flash-lite-preview-09-2025",
  "provider-3/gpt-5-nano",
  "provider-3/deepseek-v3-0324",
  "provider-3/gpt-4.1-nano" // analyzer supports vision for uploads
]);

/* ====== Tools panel (vertical - Option A) ====== */
if (toolsToggle && toolsPanel) {
  toolsToggle.addEventListener('click', (e) => {
    e.stopPropagation();
    const showing = toolsPanel.style.display === 'flex';
    toolsPanel.style.display = showing ? 'none' : 'flex';
    toolsPanel.style.flexDirection = 'column';
    if (!showing) fileUploadInput && fileUploadInput.focus?.();
  });

  document.addEventListener('click', (e) => {
    if (!toolsPanel.contains(e.target) && e.target !== toolsToggle) {
      toolsPanel.style.display = 'none';
    }
  });
}

/* ====== Memory & utils ====== */
let memory = {}, turn = 0, memorySummary = "";
const TYPE_DELAY = 2;
const approxTokens = s => Math.ceil((s || "").length / 4);
const markdownToHTML = t => typeof marked !== 'undefined' ? marked.parse(t || "") : (t || "");
function memoryString(){ return Object.keys(memory).map(k=>`User: ${memory[k].user}\nBot: ${memory[k].bot}`).join('\n'); }
function lastTurns(n=6){ return Object.keys(memory).map(Number).sort((a,b)=>a-b).slice(-n).map(k=>`User: ${memory[k].user}\nBot: ${memory[k].bot}`).join('\n'); }
function shouldSummarize(){ return !memorySummary && (turn>=6 || approxTokens(memoryString())>2200); }

/* ====== System prompts ====== */
const SYSTEM_PROMPT_GLOBAL =
  "You are SteveAI, made by saadpie. You can generate images directly via the backend using generateImage(prompt). " +
  "When a user's intent is clearly visual, respond ONLY with: Image Generated: <prompt> — exactly like this, no extra text, markdown, emojis, or URLs. " +
  "Be concise and practical.";

const SYSTEM_PROMPT_CHAT = "Friendly, concise assistant. Suggest images when relevant.";
const SYSTEM_PROMPT_REASONING = "Analytical reasoning mode — be methodical and concise.";
const SYSTEM_PROMPT_GENERAL =
`You are SteveAI-General, an advanced assistant capable of both text and image generation.
When the user requests an image or describes a visual scene, respond ONLY with:
Image Generated: <prompt>
— exactly as written.`;

/* ====== fetchAI (direct-first, proxy-fallback; Content-Type fixed) ====== */
async function tryFetch(url, options){
  try{
    const res = await fetch(url, options);
    // if status is not ok, read text to get error details
    if(!res.ok){
      const t = await res.text();
      const err = new Error(`HTTP ${res.status}: ${t}`);
      err.status = res.status;
      err.body = t;
      throw err;
    }
    return await res.json();
  }catch(e){ throw e; }
}

async function fetchAI(payload){
  const opts = {
    method:'POST',
    headers: {'Content-Type':'application/json', 'Authorization': `Bearer ${API_KEYS[0]}`},
    body: JSON.stringify(payload)
  };

  // Try direct
  try{
    return await tryFetch(API_BASE, opts);
  }catch(primaryErr){
    console.warn('Direct API call failed, trying proxied route:', primaryErr);
    // try rotating keys with proxy fallback
    let lastErr = primaryErr;
    for(const key of API_KEYS){
      try{
        const proxyOpts = {
          method:'POST',
          headers: {'Content-Type':'application/json', 'Authorization': `Bearer ${key}`},
          body: JSON.stringify(payload)
        };
        const proxiedUrl = proxied(API_BASE);
        return await tryFetch(proxiedUrl, proxyOpts);
      }catch(e){ lastErr = e; console.warn('Proxy attempt failed', e); }
    }
    addMessage('⚠️ API error. See console for details.','bot');
    console.error('All API attempts failed:', lastErr);
    throw lastErr;
  }
}

/* ====== Firecrawl helper ====== */
async function getFirecrawlFullContext(userQuery){
  try{
    const body = { query:userQuery, formats:["markdown"], limit:4, crawl:true, map:true };
    const res = await fetch(FIRECRAWL_ENDPOINT,{
      method:'POST',
      headers:{ 'Authorization': `Bearer ${FIRECRAWL_API_KEY}`, 'Content-Type': 'application/json' },
      body:JSON.stringify(body)
    });
    const data = await res.json();
    if(!data?.results?.length) return "No relevant content found.";
    return data.results.map(r => r.markdown || r.text || r.summary || '').filter(Boolean).join('\n\n---\n\n') || "No relevant content found.";
  }catch(e){ console.error('Firecrawl error',e); return "Error fetching web content."; }
}

/* ====== Image generation (HTTP fetch with Content-Type) ====== */
async function generateImage(prompt){
  if(!prompt) throw new Error("No prompt provided");
  const opts = {
    method: 'POST',
    headers: { 'Content-Type':'application/json', 'Authorization': `Bearer ${API_KEYS[0]}` },
    body: JSON.stringify({ model:"provider-4/imagen-4", prompt, n:1, size:"1024x1024" })
  };

  try{
    // try direct
    const data = await tryFetch(IMAGE_ENDPOINT, opts);
    const url = data?.data?.[0]?.url || null;
    if(url) addImageToGallery(url);
    return url;
  }catch(e){
    // fallback proxied
    try{
      const proxiedUrl = proxied(IMAGE_ENDPOINT);
      const proxyOpts = { ...opts };
      const data2 = await tryFetch(proxiedUrl, proxyOpts);
      const url = data2?.data?.[0]?.url || null;
      if(url) addImageToGallery(url);
      return url;
    }catch(e2){
      console.error('Image generation failed', e2);
      throw e2;
    }
  }
}
window.generateImage = generateImage;

/* ====== Image gallery ====== */
function addImageToGallery(url){
  if(!gallery) return;
  const thumb = document.createElement('img');
  thumb.src=url;
  thumb.style='width:100%;border-radius:6px;box-shadow:0 6px 18px rgba(0,0,0,0.6);cursor:pointer;margin-bottom:6px;';
  thumb.onclick = ()=> window.open(url,'_blank');
  gallery.appendChild(thumb);
}

/* ====== UI helpers ====== */
function stripHtml(s){ const d=document.createElement('div'); d.innerHTML=s; return d.textContent||d.innerText||''; }

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

  // image controls if present
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

/* ====== addMessage with <think> collapsible support for SteveAI-fast (style C) ====== */
function addMessage(text,sender='bot', meta = {}){
  const container = document.createElement('div'); container.className=`message-container ${sender}`;
  const bubble = document.createElement('div'); bubble.className=`bubble ${sender}`;
  const content = document.createElement('div'); content.className='bubble-content';
  bubble.appendChild(content); container.appendChild(bubble);

  // If bot and contains think blocks and model is fast (meta.model may be provided)
  if(sender === 'bot'){
    chat.appendChild(container); chat.scrollTop = chat.scrollHeight;
    // handle streaming typing effect but also process think blocks
    const thinkPattern = /<think>([\s\S]*?)<\/think>/ig;
    let parts = [];
    let lastIndex = 0;
    let m;
    while((m = thinkPattern.exec(text)) !== null){
      const before = text.slice(lastIndex, m.index);
      if(before) parts.push({type:'text', content: before});
      parts.push({type:'think', content: m[1]});
      lastIndex = m.index + m[0].length;
    }
    const tail = text.slice(lastIndex);
    if(tail) parts.push({type:'text', content: tail});

    // typing for normal text parts & insert collapsible think blocks collapsed by default
    let iPart = 0;
    let buf = '';
    function processNextPart(){
      if(iPart >= parts.length){
        addBotActions(container,bubble,text);
        return;
      }
      const part = parts[iPart++];
      if(part.type === 'think'){
        // create collapsed thinking block (style C)
        const thinkBlock = document.createElement('div');
        thinkBlock.className = 'thinking-block';
        const toggle = document.createElement('div');
        toggle.className = 'thinking-toggle';
        toggle.textContent = '▼ Show thinking';
        toggle.style.cursor = 'pointer';
        toggle.style.opacity = 0.9;
        toggle.style.fontSize = '0.92em';
        toggle.style.marginBottom = '6px';

        const pre = document.createElement('pre');
        pre.className = 'thinking-content';
        pre.style.margin = '0';
        pre.style.padding = '8px';
        pre.style.borderRadius = '8px';
        pre.style.background = 'rgba(255,255,255,0.02)';
        pre.style.fontFamily = 'monospace';
        pre.style.fontSize = '12px';
        pre.style.maxHeight = '0';
        pre.style.overflow = 'hidden';
        pre.textContent = part.content.trim();

        toggle.onclick = () => {
          const expanded = pre.classList.toggle('expanded');
          if(expanded){
            pre.style.maxHeight = '240px';
            toggle.textContent = '▲ Hide thinking';
          } else {
            pre.style.maxHeight = '0';
            toggle.textContent = '▼ Show thinking';
          }
        };

        content.appendChild(thinkBlock);
        thinkBlock.appendChild(toggle);
        thinkBlock.appendChild(pre);
        // next part
        processNextPart();
      } else {
        // type out text part char by char
        let idx = 0, localBuf = '';
        (function typeChar(){
          if(idx < part.content.length){
            localBuf += part.content[idx++];
            content.innerHTML = markdownToHTML(buf + localBuf);
            chat.scrollTop = chat.scrollHeight;
            setTimeout(typeChar, TYPE_DELAY);
          } else {
            // append localBuf to main buffer and continue
            buf += localBuf;
            // ensure final HTML
            content.innerHTML = markdownToHTML(buf);
            chat.scrollTop = chat.scrollHeight;
            setTimeout(processNextPart, 80);
          }
        })();
      }
    }
    processNextPart();
  } else {
    // user message - immediate
    content.innerHTML = markdownToHTML(text);
    chat.appendChild(container); chat.scrollTop = chat.scrollHeight;
    addUserActions(container,bubble,text);
  }
}

/* ====== PDF extraction helper (pdf.js must be included in HTML) ====== */
async function extractPDFText(pdfData) {
  try{
    const pdfjsLib = window['pdfjs-dist/build/pdf'];
    if(!pdfjsLib) throw new Error('pdfjs not loaded');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.15.349/pdf.worker.min.js';
    const pdf = await pdfjsLib.getDocument({data: pdfData}).promise;
    let text = '';
    const toc = [];
    for(let i=1;i<=pdf.numPages;i++){
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item=>item.str).join(' ');
      // crude TOC detection: headings-like lines (very heuristic)
      if(pageText && pageText.length > 20){
        const sample = pageText.split('\n').slice(0,2).join(' ').slice(0,120);
        toc.push(`Page ${i}: ${sample}...`);
      }
      text += `\n\n[Page ${i}]\n` + pageText;
    }
    return { text: text.trim(), toc: toc.slice(0,20) };
  }catch(e){
    console.warn('extractPDFText failed', e);
    return { text: '', toc: [] };
  }
}

/* ====== Render analysis card (Option 2) ====== */
function renderAnalysisCard(fileName, analysis){
  // analysis: { summary, fullText, keyPoints, toc, conclusion }
  const card = document.createElement('div');
  card.className = 'analysis-card';
  card.style = 'background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.04);padding:12px;border-radius:10px;margin:10px 0;white-space:pre-wrap;';
  const header = document.createElement('div');
  header.innerHTML = `**📄 Analysis: ${fileName}**`;
  header.style = 'font-weight:700;margin-bottom:8px;';
  card.appendChild(header);

  const section = (title, content) => {
    const el = document.createElement('div');
    el.style = 'margin-bottom:8px;';
    el.innerHTML = `**${title}**\n${content || '—'}`;
    return el;
  };

  card.appendChild(section('Summary', analysis.summary || 'No summary.'));
  card.appendChild(section('Table of Contents (detected)', (analysis.toc && analysis.toc.length) ? analysis.toc.join('\n') : 'None detected.'));
  card.appendChild(section('Full Extracted Text (truncated)', (analysis.fullText || '').slice(0, 15000) + ((analysis.fullText || '').length > 15000 ? '\n\n[...truncated]' : '')));
  card.appendChild(section('Key Points', (analysis.keyPoints && analysis.keyPoints.length) ? analysis.keyPoints.map((p,i)=>`${i+1}. ${p}`).join('\n') : 'None.'));
  card.appendChild(section('Conclusion / Answer', analysis.conclusion || 'No conclusion.'));

  // append to chat as bot message container but with card inside
  const container = document.createElement('div'); container.className = 'message-container bot';
  const bubble = document.createElement('div'); bubble.className='bubble bot';
  const content = document.createElement('div'); content.className='bubble-content';
  content.appendChild(card); bubble.appendChild(content); container.appendChild(bubble);
  chat.appendChild(container); chat.scrollTop = chat.scrollHeight;
  addBotActions(container,bubble,'[File Analysis]');
}

/* ====== Helper: call analyzer model with file content ====== */
async function callAnalyzerForFile(fileName, contentObj, extraContext=""){
  // Build a comprehensive system/user prompt for ultra extraction (C)
  const system = `${SYSTEM_PROMPT_GLOBAL} You are an expert file analyst. For the provided file, perform ULTRA extraction:
1) Extract full text (if applicable).
2) Produce a concise summary.
3) Produce key points (bullet list).
4) Produce a Table of Contents (if document-like).
5) Provide a final conclusion and actionable suggestions.
Be concise but thorough. If text is very long, include main excerpts and indicate truncation.`;

  // user instruction
  const userIntro = { type:'text', text: `Please analyze the uploaded file "${fileName}" thoroughly. Output JSON-like sections labelled: SUMMARY, TABLE_OF_CONTENTS, FULL_TEXT, KEY_POINTS (list), CONCLUSION. If the file is an image, describe objects, layout, text, colors, and any text in the image.` };

  const messages = [
    { role:'system', content: system },
    ...(extraContext ? [{ role:'system', content: `Auxiliary web context:\n\n${extraContext}` }] : []),
    { role:'user', content: [ userIntro, contentObj ] }
  ];

  const payload = { model: ANALYZER_MODEL, messages };
  return await fetchAI(payload);
}

/* ====== File upload handler (uses ANALYZER_MODEL) ====== */
fileUploadInput && fileUploadInput.addEventListener('change', e => {
  const file = e.target.files?.[0];
  if(!file) return;
  handleFileUpload(file);
  fileUploadInput.value = '';
});

async function handleFileUpload(file){
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const reader = new FileReader();

  addMessage(`📄 Uploaded file: ${file.name}`, 'user');

  reader.onload = async () => {
    try{
      let contentObj = null;
      let extractedFullText = "";
      let detectedToc = [];

      if(['txt','xml','json','csv','md'].includes(ext)){
        const text = typeof reader.result === 'string' ? reader.result : new TextDecoder().decode(reader.result);
        contentObj = { type:'text', text: text.slice(0, 800000) }; // cap
      } else if(ext === 'pdf'){
        // ArrayBuffer expected
        const pdfBuffer = reader.result instanceof ArrayBuffer ? new Uint8Array(reader.result) : new Uint8Array(reader.result);
        const { text, toc } = await extractPDFText(pdfBuffer);
        extractedFullText = text || '';
        detectedToc = toc || [];
        contentObj = { type:'text', text: extractedFullText.slice(0, 800000) };
      } else if(['jpg','jpeg','png','gif','webp','bmp'].includes(ext)){
        const dataUrl = reader.result;
        contentObj = { type:'image', image: dataUrl };
      } else if(['docx','doc','xlsx','xls','pptx','ppt'].includes(ext)){
        // No heavy client libs included — provide fallback: base64 + brief note
        const arrayBuffer = reader.result instanceof ArrayBuffer ? reader.result : await (new Response(reader.result)).arrayBuffer();
        const b64 = arrayBufferToBase64(arrayBuffer);
        contentObj = { type:'text', text: `Binary ${ext} file provided as base64 (truncated). Please attempt to interpret metadata and any textual content you can. Base64 (truncated): ${b64.slice(0,2000)}` };
      } else {
        // unknown binary
        const arrayBuffer = reader.result instanceof ArrayBuffer ? reader.result : await (new Response(reader.result)).arrayBuffer();
        const b64 = arrayBufferToBase64(arrayBuffer);
        contentObj = { type:'text', text: `Unsupported file type (.${ext}). Binary preview (base64, truncated): ${b64.slice(0,2000)}` };
      }

      // Attach optional web search context if toggle is enabled
      const webToggle = document.getElementById('webSearchToggle');
      let searchContext = "";
      if(webToggle && webToggle.checked){
        addMessage('🔍 Performing web search (attached to analysis)...','bot');
        searchContext = await getFirecrawlFullContext(file.name);
      }

      // Call analyzer model
      const aiResp = await callAnalyzerForFile(file.name, contentObj, searchContext);
      const reply = aiResp?.choices?.[0]?.message?.content?.trim() || "No response.";

      // Try to parse sections from reply heuristically (models often return human sections)
      const analysis = parseAnalysisFromText(reply, extractedFullText, detectedToc);

      renderAnalysisCard(file.name, analysis);

    }catch(err){
      console.error('File analysis failed', err);
      addMessage('⚠️ File analysis failed.','bot');
    }
  };

  // read appropriate
  const extReadAsArray = ['pdf','docx','doc','xlsx','xls','pptx','ppt'];
  const extReadAsDataURL = ['jpg','jpeg','png','gif','webp','bmp'];
  if(extReadAsArray.includes(ext)){
    reader.readAsArrayBuffer(file);
  } else if(extReadAsDataURL.includes(ext)){
    reader.readAsDataURL(file);
  } else {
    reader.readAsText(file, 'utf-8');
  }
}

/* ====== Utility: ArrayBuffer -> base64 ====== */
function arrayBufferToBase64(buffer){
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunk = 0x8000;
  for (let i=0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/* ====== Heuristic parser for model analysis text -> structured object (Smart - Option A) ====== */
function parseAnalysisFromText(text, fallbackFullText="", detectedToc=[]){
  const caps = text || '';
  const markers = ['SUMMARY','TABLE OF CONTENTS','FULL TEXT','FULL_TEXT','FULLTEXT','KEY POINTS','KEY_POINTS','KEYPOINTS','CONCLUSION','CONCLUSIONS','RECOMMENDATIONS','KEY FINDINGS'];
  const normalizedMarkers = markers.map(m => m.replace(/\s+|_/g,'').toUpperCase());

  const secs = {};
  const upper = caps.toUpperCase();

  const found = [];
  const markerRegex = /\b(SUMMARY|TABLE OF CONTENTS|TABLE OF CONTENT|FULL TEXT|FULL_TEXT|KEY POINTS|KEY_POINTS|KEY POINT|CONCLUSION|CONCLUSIONS|RECOMMENDATIONS|KEY FINDINGS)\b/ig;
  let m;
  while((m = markerRegex.exec(caps)) !== null){
    found.push({ title: m[0].toUpperCase(), index: m.index });
  }

  if(found.length){
    found.sort((a,b)=>a.index-b.index);
    for(let i=0;i<found.length;i++){
      const title = found[i].title;
      const start = found[i].index + title.length;
      const end = (i+1<found.length) ? found[i+1].index : caps.length;
      secs[title] = caps.slice(start, end).trim();
    }
  } else {
    const possibleSplit = caps.split(/\n\-{3,}\n|===+\n|^\s*#{1,3}\s+/m);
    if(possibleSplit.length > 1){
      secs['SUMMARY'] = possibleSplit[0].trim();
      secs['FULL TEXT'] = possibleSplit.slice(1).join('\n\n').trim();
    } else {
      secs['SUMMARY'] = caps.slice(0, 4000).trim();
      secs['FULL TEXT'] = fallbackFullText || caps;
    }
  }

  const getSection = (keys, def='') => {
    for(const k of keys){
      if(secs[k]) return secs[k].trim();
      const alt = Object.keys(secs).find(sk => sk.replace(/\s|_/g,'').toUpperCase().includes(k.replace(/\s|_/g,'').toUpperCase()));
      if(alt) return secs[alt].trim();
    }
    return def;
  };

  const summary = getSection(['SUMMARY','SUMMARY:','SUMMARY -'], caps.slice(0,1000).trim());
  const full = getSection(['FULL TEXT','FULL_TEXT','FULLTEXT'], fallbackFullText || caps);
  const tocText = getSection(['TABLE OF CONTENTS','TABLE OF CONTENT'], '').trim();
  const toc = tocText ? tocText.split(/\n+/).map(s=>s.replace(/^\s*[\-\•\*0-9\.\)]+\s*/,'').trim()).filter(Boolean) : detectedToc;
  let keyPointsRaw = getSection(['KEY POINTS','KEY_POINTS','KEY FINDINGS','KEYPOINTS'], '');
  if(!keyPointsRaw){
    const bullets = (summary + '\n' + full).match(/(^|\n)\s*[\-\•\*\u2022]\s+(.+)/g) || (summary + '\n' + full).match(/(^|\n)\s*\d+\.\s+(.+)/g) || [];
    keyPointsRaw = bullets.join('\n');
  }
  const keyPoints = keyPointsRaw ? keyPointsRaw.split(/\n+/).map(s=>s.replace(/^[\-\•\*\d\.\)\s]+/,'').trim()).filter(Boolean).slice(0,30) : [];

  let conclusion = getSection(['CONCLUSION','CONCLUSIONS','RECOMMENDATIONS'], '');
  if(!conclusion){
    const paragraphs = caps.split(/\n{2,}/).map(p=>p.trim()).filter(Boolean);
    conclusion = paragraphs.slice(-3).join('\n\n') || '';
  }

  return {
    summary: summary || (caps.slice(0,1000).trim()),
    fullText: full || (fallbackFullText || caps),
    keyPoints,
    toc,
    conclusion: conclusion.trim()
  };
}

/* ====== Summarization helpers (keep memory small) ====== */
async function generateSummary(){
  const raw = memoryString();
  const payload = {
    model: "provider-3/gpt-4o-mini",
    messages: [
      { role:'system', content: "You are SteveAI, made by saadpie. Summarize the following chat context clearly and concisely." },
      { role:'user', content: raw }
    ]
  };
  try{
    const d = await fetchAI(payload);
    return d?.choices?.[0]?.message?.content?.trim() || '';
  }catch{
    return "Summary: " + lastTurns(2).replace(/\n/g,' ').slice(0,800);
  }
}

async function buildContext(){
  if(shouldSummarize()){
    const sum = await generateSummary();
    if(sum){
      memorySummary = sum;
      const keep = {};
      Object.keys(memory).map(Number).sort((a,b)=>a-b).slice(-4).forEach(k=>keep[k]=memory[k]);
      memory = keep;
    }
  }
  return memorySummary ? `[SESSION SUMMARY]\n${memorySummary}\n\n[RECENT TURNS]\n${lastTurns(6)}` : memoryString();
}

/* ====== Chat reply + image-detection workflow (hybrid) ====== */
async function getChatReply(msg, useWebSearch=false){
  const context = await buildContext();
  const mode = (modeSelect?.value || 'chat').toLowerCase();
  let model = STEVEAI_MODELS[mode] || STEVEAI_MODELS.chat;
  const modePrompt = mode === 'reasoning' ? SYSTEM_PROMPT_REASONING : (mode === 'general' ? SYSTEM_PROMPT_GENERAL : SYSTEM_PROMPT_CHAT);
  const systemContent = `${SYSTEM_PROMPT_GLOBAL} ${modePrompt}`;

  // optional web search
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
    ],
    temperature: 0.7,
    max_tokens: 1500
  };

  const data = await fetchAI(payload);
  const reply = data?.choices?.[0]?.message?.content?.trim() || "No response.";
  memory[++turn] = { user: msg, bot: reply };

  // hybrid image behavior: if model responds with Image Generated: prompt
  if(reply && reply.toLowerCase().startsWith('image generated:')){
    const prompt = reply.split(':').slice(1).join(':').trim();
    if(!prompt){
      addMessage('⚠️ Image prompt empty.','bot');
      return null;
    }
    // Show the assistant reply first
    addMessage(reply,'bot', { model });
    try{
      const url = await generateImage(prompt);
      if(!url){ addMessage('⚠️ No image returned.','bot'); return null; }
      addMessage(`🖼️ Image generated and added to gallery.`, 'bot');
      return null;
    }catch(err){
      addMessage(`⚠️ Image generation failed: ${err.message}`,'bot'); return null;
    }
  }

  return reply;
}

/* ====== Bindings: form, buttons, input ====== */
form.onsubmit = async e => {
  e.preventDefault();
  const msg = input.value.trim();
  if(!msg) return;
  if(msg.startsWith('/')){ await handleCommand(msg); input.value=''; return; }

  // decide websearch via toggle or inline tag
  const toggle = document.getElementById('webSearchToggle');
  const useWebSearch = (toggle && toggle.checked) || msg.toLowerCase().includes('[websearch]');

  addMessage(msg,'user'); input.value=''; input.style.height='auto';
  try{
    const reply = await getChatReply(msg, useWebSearch);
    if(reply) addMessage(reply,'bot', { model: STEVEAI_MODELS[(modeSelect?.value||'chat')] });
  }catch(e){ console.error(e); addMessage('⚠️ Request failed. See console.','bot'); }
};

input.oninput = ()=>{ input.style.height='auto'; input.style.height = input.scrollHeight + 'px'; };
themeToggle && (themeToggle.onclick = ()=>document.body.classList.toggle('light'));
clearChatBtn && (clearChatBtn.onclick = ()=>{ chat.innerHTML=''; memory={}; memorySummary=''; turn=0; addMessage('🧹 Chat cleared.','bot'); });

/* ====== Simple commands (keep/extend) ====== */
async function handleCommand(cmd){
  const [command,...args] = cmd.trim().split(' ');
  const argString = args.join(' ');
  switch(command.toLowerCase()){
    case '/clear': clearChatBtn && clearChatBtn.click(); return;
    case '/theme': themeToggle && themeToggle.click(); return;
    case '/help': addMessage("**Commands:** /help /clear /theme /image <prompt> /export /contact /play /about /mode /time",'bot'); return;
    case '/image':
      if(!argString){ addMessage('⚠️ Usage: /image <prompt>','bot'); return; }
      addMessage(`🎨 Generating image for: ${argString}`,'bot');
      try{ const url = await generateImage(argString); if(!url){ addMessage('⚠️ No image returned.','bot'); return; } addMessage(`🖼️ Image ready: ${url}`,'bot'); }catch(e){ addMessage(`⚠️ Image failed: ${e.message}`,'bot'); }
      return;
    case '/export':
      {
        const text = memorySummary ? `[SUMMARY]\n${memorySummary}\n\n[CHAT]\n${memoryString()}` : `[CHAT]\n${memoryString()}`;
        const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type:'text/plain'})); a.download=`SteveAI_Chat_${new Date().toISOString().slice(0,19)}.txt`; a.click();
        addMessage('💾 Chat exported.','bot');
      }
      return;
    case '/contact': addMessage(`**📬 Contact SteveAI**\n- Creator: @saad-pie\n- Website: steve-ai.netlify.app`,'bot'); return;
    case '/play': addMessage('🎬 Play summary not implemented here.','bot'); return;
    case '/about': addMessage('🤖 SteveAI — built by saadpie.','bot'); return;
    case '/mode':
      if(!argString || !['chat','reasoning','general','fast'].includes(argString.toLowerCase())){ addMessage('⚙️ Usage: /mode chat | reasoning | general | fast','bot'); return; }
      if(modeSelect) modeSelect.value = argString.toLowerCase();
      addMessage(`🧭 Mode set to ${argString}`,'bot');
      return;
    case '/time': addMessage(`⏰ Local time: ${new Date().toLocaleTimeString()}`,'bot'); return;
    default: addMessage(`❓ Unknown command: ${command}`,'bot'); return;
  }
}

/* ====== Init small welcome ====== */
addMessage("Hello — I'm SteveAI. Use the + button to upload files or enable Web Search. Choose a mode and ask me anything.", 'bot');
