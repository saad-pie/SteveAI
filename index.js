/* =========================
   index.js — SteveAI (concise & updated with file analysis)
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

/* ====== File upload & analysis ====== */
async function handleFileUpload(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  const reader = new FileReader();

  reader.onload = async () => {
    addMessage(`📄 Uploaded file: ${file.name}`, 'user');

    let contentObj = {};
    try {
      if(['txt','xml','json','csv'].includes(ext)){
        contentObj = { type:'text', text: reader.result };
      } else if(ext==='pdf'){
        const pdfText = await extractPDFText(new Uint8Array(reader.result));
        contentObj = { type:'text', text: pdfText || '⚠️ Could not extract PDF text' };
      } else if(['jpg','jpeg','png','gif'].includes(ext)){
        const mime = ext==='jpg'||ext==='jpeg'?'jpeg':ext;
        contentObj = { type:'image', image: reader.result };
      } else {
        contentObj = { type:'text', text:`⚠️ Unsupported file type: ${ext}` };
      }

      // Send file content to AI
      const payload = {
        model: "provider-5/grok-4-0709",
        messages: [
          { role:'system', content:`${SYSTEM_PROMPT_GLOBAL} ${SYSTEM_PROMPT_GENERAL}` },
          { role:'user', content:[{type:'text', text:'Analyze this file:'}, contentObj] }
        ]
      };
      const data = await fetchAI(payload);
      const reply = data?.choices?.[0]?.message?.content?.trim() || 'No response.';
      addMessage(reply,'bot');

    } catch(e){
      addMessage('⚠️ File analysis failed.','bot');
      console.error(e);
    }
  };

  if(ext==='pdf'){
    reader.readAsArrayBuffer(file); // PDF requires ArrayBuffer
  } else if(['jpg','jpeg','png','gif'].includes(ext)){
    reader.readAsDataURL(file); // images as data URL
  } else {
    reader.readAsText(file, 'utf-8'); // text files
  }
}

/* ====== PDF text extraction helper ====== */
async function extractPDFText(pdfData) {
  const pdfjsLib = window['pdfjs-dist/build/pdf'];
  pdfjsLib.GlobalWorkerOptions.workerSrc = '//cdnjs.cloudflare.com/ajax/libs/pdf.js/3.15.349/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({data: pdfData}).promise;
  let text = '';
  for(let i=1;i<=pdf.numPages;i++){
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item=>item.str).join(' ') + '\n';
  }
  return text;
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

/* ====== Remaining code unchanged ====== */
// ... Your existing chat UI, fetchAI, getChatReply, addMessage, form submission, etc.

