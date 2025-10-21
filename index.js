// index.js — main app logic (ESM)
// Exposes window.sendChatMessage and window.handleFileUpload
// Depends on: config.js, utils.js, dom.js
//
// Ensure load order in HTML: config.js -> utils.js -> dom.js -> index.js -> chat.js

import {
  STEVEAI_MODELS,
  ANALYZER_MODEL,
  IMAGE_ENDPOINT,
  IMAGE_MODEL,
  SUMMARIZER_MODEL,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS
} from './config.js';

import {
  apiFetch,
  apiFetchRaw,
  buildChatPayload,
  parseCommand,
  readFileAsArrayBuffer,
  readFileAsText,
  readFileAsDataURL,
  readFileAsBase64,
  detectFileType,
  sleep,
  getModelFor
} from './utils.js';

import dom from './dom.js'; // dom.addMessage, dom.setThinking, dom.addImageToGallery, etc.

// ---------------------------
// Helpers
// ---------------------------
function safeLog(...args) { try { console.debug(...args); } catch (e) {} }

function _makeSystemPromptForMode(mode) {
  // Combine a light global system + mode-specific (if you want to customize per-mode in config later)
  const base = "You are SteveAI, made by saadpie. Be concise and practical. When user's intent is visual, reply EXACTLY with: Image Generated: <prompt>";
  // mode-specific overlays (simple)
  if (mode === 'reasoning') return `${base}\nAnalytical reasoning mode — be methodical and concise.`;
  if (mode === 'general') return `${base}\nYou are SteveAI-General, an advanced assistant capable of both text and image generation.`;
  return `${base}\nFriendly, concise assistant. Suggest images when relevant.`;
}

// small helper to extract plain content from API response object
function extractMessageFromResponse(resp) {
  return resp?.choices?.[0]?.message?.content?.trim() || null;
}

// ---------------------------
// Chat & Command Handlers
// ---------------------------

/**
 * sendChatMessage(userText)
 * Main entry point used by chat.js UI on submit.
 */
export async function sendChatMessage(userText) {
  if (!userText || !userText.trim()) return;

  // Quick parse for slash commands
  const cmd = parseCommand(userText);
  if (cmd) {
    const c = cmd.command.toLowerCase();
    const args = cmd.args.join(' ');
    switch (c) {
      case 'image':
        return await _handleImageCommand(args || '');
      case 'analyze':
        // If invoked as /analyze <url-or-text> we try to analyze text or instruct uploader flow
        return await _handleAnalyzeCommand(args);
      case 'summarize':
        return await _handleSummarizeCommand(args || '');
      case 'export':
        return _handleExport();
      case 'clear':
        return _handleClear();
      case 'mode':
        return _handleMode(args);
      case 'help':
        return _handleHelp();
      default:
        // fallback: send as normal message
        break;
    }
  }

  // Default: normal chat
  return await _handleChat(userText);
}

/* ====== /help ====== */
function _handleHelp() {
  dom.addMessage("**Commands:**\n- /help\n- /clear\n- /mode <chat|reasoning|general|fast>\n- /image <prompt>\n- /analyze (attach file)\n- /summarize <text or attach file>\n- /export", 'bot');
}

/* ====== /clear ====== */
function _handleClear() {
  dom.clearChat();
  dom.addMessage('🧹 Chat cleared.', 'bot');
}

/* ====== /export ====== */
function _handleExport() {
  // attempt to collect chat text from DOM (simple)
  const chat = document.getElementById('chat');
  if (!chat) { dom.addMessage('⚠️ Export failed: chat not found', 'bot'); return; }
  const texts = Array.from(chat.querySelectorAll('.bubble-content')).map(n => n.innerText || n.textContent || '').join('\n\n');
  const blob = new Blob([texts], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `SteveAI_Chat_${new Date().toISOString().slice(0,19)}.txt`;
  a.click();
  dom.addMessage('💾 Chat exported.', 'bot');
}

/* ====== /mode ====== */
function _handleMode(argString) {
  const s = (argString || '').trim().toLowerCase();
  if (!s || !['chat','reasoning','general','fast'].includes(s)) {
    dom.addMessage('⚙️ Usage: /mode chat | reasoning | general | fast', 'bot');
    return;
  }
  const sel = document.getElementById('modeSelect');
  if (sel) sel.value = s;
  dom.addMessage(`🧭 Mode set to ${s}`, 'bot');
}

/* ====== Chat (default) ====== */
async function _handleChat(userText) {
  // UI: show user's message
  dom.addMessage(userText, 'user');

  // Build payload
  const mode = (document.getElementById('modeSelect')?.value || 'chat').toLowerCase();
  const model = getModelFor(mode);
  const system = _makeSystemPromptForMode(mode);

  const contextString = ""; // We rely on server-side or local memory aggregation in future (memory handled elsewhere)
  const messages = [
    { role: 'system', content: system },
    { role: 'user', content: `${contextString}\n\nUser: ${userText}` }
  ];

  // show thinking
  dom.setThinking(true, { text: 'SteveAI is thinking...' });

  try {
    const payload = buildChatPayload({ model, messages, temperature: 0.7, max_tokens: 800 });
    const resp = await apiFetch(payload); // utils.apiFetch
    const reply = extractMessageFromResponse(resp) || 'No response.';
    dom.setThinking(false);

    // hybrid image behavior: if model returns "Image Generated: <prompt>"
    if (reply.toLowerCase().startsWith('image generated:')) {
      // show the assistant reply (dom will render think blocks if present)
      dom.addMessage(reply, 'bot', { model });
      const prompt = reply.split(':').slice(1).join(':').trim();
      if (prompt) {
        // call image endpoint via apiFetchRaw (IMAGE_ENDPOINT)
        try {
          dom.addMessage('🎨 Generating image...', 'bot');
          const imagePayload = {
            model: IMAGE_MODEL || 'provider-4/imagen-4',
            prompt,
            n: 1,
            size: "1024x1024"
          };
          const imageResp = await apiFetchRaw(IMAGE_ENDPOINT, imagePayload);
          const url = imageResp?.data?.[0]?.url || imageResp?.url || null;
          if (url) {
            dom.addImageToGallery(url);
            dom.addMessage('🖼️ Image generated and added to gallery.', 'bot');
          } else {
            dom.addMessage('⚠️ Image generation returned no url.', 'bot');
          }
        } catch (imgErr) {
          console.error('Image generation failed', imgErr);
          dom.addMessage(`⚠️ Image generation failed: ${imgErr?.message || imgErr}`, 'bot');
        }
      } else {
        dom.addMessage('⚠️ Image prompt empty.', 'bot');
      }
      return;
    }

    // Normal reply
    dom.addMessage(reply, 'bot', { model });
    return reply;
  } catch (err) {
    dom.setThinking(false);
    console.error('Chat error', err);
    dom.addMessage('⚠️ Request failed. See console for details.', 'bot');
    return null;
  }
}

/* ====== /image command ====== */
async function _handleImageCommand(promptText) {
  const prompt = promptText && promptText.trim();
  if (!prompt) {
    dom.addMessage('⚠️ Usage: /image <prompt>', 'bot');
    return;
  }
  dom.addMessage(`🎨 Generating image: ${prompt}`, 'bot');
  try {
    const imagePayload = { model: IMAGE_MODEL || 'provider-4/imagen-4', prompt, n: 1, size: "1024x1024" };
    const resp = await apiFetchRaw(IMAGE_ENDPOINT, imagePayload);
    const url = resp?.data?.[0]?.url || resp?.url || null;
    if (!url) {
      dom.addMessage('⚠️ No image returned.', 'bot');
      return;
    }
    dom.addImageToGallery(url);
    dom.addMessage(`🖼️ Image ready: ${url}`, 'bot');
    return url;
  } catch (err) {
    console.error('Image gen error', err);
    dom.addMessage(`⚠️ Image failed: ${err?.message || err}`, 'bot');
  }
}

/* ====== /summarize command ====== */
async function _handleSummarizeCommand(textOrArgs) {
  // If there is text inline, summarize that. Otherwise, instruct user to attach file / paste text.
  const content = (textOrArgs || '').trim();
  if (!content) {
    dom.addMessage('ℹ️ Usage: /summarize <text>  — or upload a file to analyze + summarize.', 'bot');
    return;
  }
  dom.addMessage('📝 Summarizing...', 'bot');
  try {
    const model = SUMMARIZER_MODEL || 'provider-3/gpt-4o-mini';
    const system = "You are SteveAI. Summarize the following text clearly and concisely.";
    const messages = [
      { role: 'system', content: system },
      { role: 'user', content: content }
    ];
    const payload = buildChatPayload({ model, messages, temperature: 0.2, max_tokens: 400 });
    const resp = await apiFetch(payload);
    const reply = extractMessageFromResponse(resp) || 'No summary produced.';
    dom.addMessage(reply, 'bot');
    return reply;
  } catch (err) {
    console.error('Summarize error', err);
    dom.addMessage('⚠️ Summarization failed.', 'bot');
  }
}

/* ====== /analyze command & file uploads ====== */
/**
 * handleFileUpload(file, isVision=false)
 * - isVision true: treat upload as vision/image and call analyzer with image type
 * - otherwise: process file (pdf, text, office) and call analyzer model
 */
export async function handleFileUpload(file, isVision = false) {
  if (!file) return;
  dom.addMessage(`📄 Uploaded file: ${file.name}`, 'user');

  try {
    const dt = detectFileType(file);
    let contentObj = null;
    let extractedFullText = '';
    let detectedToc = [];

    if (dt.isText) {
      const text = await readFileAsText(file);
      contentObj = { type: 'text', text: text.slice(0, 800000) };
    } else if (dt.isPdf) {
      // try read as array buffer and extract via pdf.js if available in index.html,
      // fallback to base64 if extraction not available
      const buffer = await readFileAsArrayBuffer(file);
      // If window.extractPDFText is available (from pdf.js integration), use it
      if (typeof window.extractPDFText === 'function') {
        const { text, toc } = await window.extractPDFText(buffer);
        extractedFullText = text || '';
        detectedToc = toc || [];
        contentObj = { type: 'text', text: extractedFullText.slice(0, 800000) };
      } else {
        // fallback: base64 + hint
        const b64 = await readFileAsBase64(file);
        contentObj = { type: 'text', text: `PDF file base64 (truncated): ${b64.slice(0, 2000)}` };
      }
    } else if (dt.isImage || isVision) {
      // read as DataURL for analyzer to inspect the image
      const dataUrl = await readFileAsDataURL(file);
      contentObj = { type: 'image', image: dataUrl };
    } else if (dt.isOffice) {
      // read as arraybuffer -> base64
      const buf = await readFileAsArrayBuffer(file);
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      contentObj = { type: 'text', text: `Office file provided as base64 (truncated): ${b64.slice(0,2000)}` };
    } else {
      const b64 = await readFileAsBase64(file);
      contentObj = { type: 'text', text: `Unknown file type. Base64 (truncated): ${b64.slice(0,2000)}` };
    }

    // optional web search context from toggle
    let webContext = '';
    const webToggle = document.getElementById('webSearchToggle');
    if (webToggle && webToggle.checked) {
      dom.addMessage('🔍 Performing web search attached to analysis...', 'bot');
      // call a simple web search helper if available (getFirecrawlFullContext) — but this was earlier in index.js in prior versions
      if (typeof window.getFirecrawlFullContext === 'function') {
        webContext = await window.getFirecrawlFullContext(file.name);
      }
    }

    // Call analyzer with constructed messages
    dom.addMessage('🔎 Analyzing file...', 'bot');
    const system = `${_makeSystemPromptForMode('reasoning')} You are an expert file analyst. For the provided file, perform ULTRA extraction: SUMMARY, TABLE_OF_CONTENTS, FULL_TEXT, KEY_POINTS, CONCLUSION.`;
    const userIntro = `Please analyze the uploaded file "${file.name}" thoroughly. Output JSON-like sections labelled: SUMMARY, TABLE_OF_CONTENTS, FULL_TEXT, KEY_POINTS, CONCLUSION.`;

    const messages = [
      { role: 'system', content: system },
      ...(webContext ? [{ role: 'system', content: `Auxiliary web context:\n\n${webContext}` }] : []),
      { role: 'user', content: userIntro },
      { role: 'user', content: JSON.stringify(contentObj).slice(0, 800000) } // keep payload sane
    ];

    const payload = buildChatPayload({ model: ANALYZER_MODEL, messages, temperature: 0.0, max_tokens: 1200 });
    const resp = await apiFetch(payload);
    const reply = extractMessageFromResponse(resp) || 'No analysis returned.';
    // Parse heuristically and render using dom.renderAnalysisCard (dom has implementation)
    // We'll do a simple parse attempt: hand to dom.renderAnalysisCard with minimal structure
    const analysis = _parseAnalysisReply(reply, extractedFullText, detectedToc);
    dom.renderAnalysisCard(file.name, analysis);

  } catch (err) {
    console.error('File upload / analysis failed', err);
    dom.addMessage('⚠️ File analysis failed. See console for details.', 'bot');
  }
}

/* ====== small heuristic parser used for renderAnalysisCard (mirrors utils.parseAnalysisFromText approach) */
function _parseAnalysisReply(text, fallbackFullText = '', detectedToc = []) {
  // Very small heuristics: split by common markers
  const caps = text || '';
  const sectionRe = /\b(SUMMARY|TABLE OF CONTENTS|FULL TEXT|FULL_TEXT|KEY POINTS|KEY_POINTS|CONCLUSION|CONCLUSIONS|RECOMMENDATIONS)\b/ig;
  const found = [];
  let match;
  while ((match = sectionRe.exec(caps)) !== null) {
    found.push({ title: match[0].toUpperCase(), index: match.index });
  }
  const secs = {};
  if (found.length) {
    found.sort((a, b) => a.index - b.index);
    for (let i = 0; i < found.length; i++) {
      const t = found[i].title;
      const start = found[i].index + t.length;
      const end = (i + 1 < found.length) ? found[i + 1].index : caps.length;
      secs[t] = caps.slice(start, end).trim();
    }
  } else {
    secs['SUMMARY'] = caps.slice(0, 2000).trim();
    secs['FULL TEXT'] = fallbackFullText || caps;
  }

  const summary = secs['SUMMARY'] || secs['SUMMARY:'] || caps.slice(0, 1000);
  const fullText = secs['FULL TEXT'] || fallbackFullText || caps;
  const toc = (secs['TABLE OF CONTENTS'] && secs['TABLE OF CONTENTS'].split(/\n+/).map(s=>s.trim()).filter(Boolean)) || detectedToc;
  const keyPoints = (secs['KEY POINTS'] ? secs['KEY POINTS'].split(/\n+/) : []).map(s=>s.replace(/^[\-\•\*\d\.\)\s]+/,'').trim ? s : s).filter(Boolean).slice(0,30);

  const conclusion = secs['CONCLUSION'] || secs['CONCLUSIONS'] || secs['RECOMMENDATIONS'] || '';

  return { summary: summary || '', fullText: fullText || '', keyPoints: keyPoints || [], toc: toc || [], conclusion: conclusion || '' };
}

/* ============================
   Expose for global UI (chat.js)
   ============================ */
window.sendChatMessage = sendChatMessage;
window.handleFileUpload = handleFileUpload;

// small welcome message using dom
dom.addMessage("Hello — I'm SteveAI. Use the + button to upload files or enable Web Search. Choose a mode and ask me anything.", 'bot');

export default {
  sendChatMessage,
  handleFileUpload
};
       
