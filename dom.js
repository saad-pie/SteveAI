// dom.js — ESM (named exports)
// DOM rendering utilities for SteveAI chat UI.
// Exports: addMessage, appendChunkToLastMessage, updateLastMessage, setThinking,
//          addImageToGallery, clearChat, renderAnalysisCard
//
// Depends on utils.js for safeHTML + scrollToBottom (imported below)

import { safeHTML, scrollToBottom } from './utils.js';

const CHAT_ID = 'chat';
const GALLERY_ID = 'imageGallery';
const TYPE_DELAY = 2; // ms per char typing effect (used only for small type animations)

/** markdownToHTML: use marked if available, otherwise escape text */
function markdownToHTML(t) {
  if (!t && t !== '') return '';
  if (typeof marked !== 'undefined') {
    try { return marked.parse(t || ''); } catch (e) { /* fallback */ }
  }
  // minimal fallback: escape and preserve line breaks
  const escaped = safeHTML(String(t));
  return escaped.replace(/\n/g, '<br/>');
}

/** Helper: create element with className */
function el(tag = 'div', className = '') {
  const d = document.createElement(tag);
  if (className) d.className = className;
  return d;
}

/** Add user actions (resend/copy) — similar to the prior inline functions */
function addUserActions(container, bubble, text) {
  const actions = el('div', 'message-actions');
  const resend = Object.assign(document.createElement('button'), { className: 'action-btn', textContent: '🔁', title: 'Resend' });
  resend.onclick = () => { const input = document.getElementById('messageInput'); if (input) { input.value = text; input.focus(); } };
  const copy = Object.assign(document.createElement('button'), { className: 'action-btn', textContent: '📋', title: 'Copy' });
  copy.onclick = () => navigator.clipboard.writeText(text).catch(()=>{});
  actions.appendChild(resend);
  actions.appendChild(copy);
  container.appendChild(actions);
}

/** Add bot actions (copy/speak and image controls if meta present) */
function addBotActions(container, bubble, text, meta = {}) {
  const actions = el('div', 'message-actions');
  const copy = Object.assign(document.createElement('button'), { className: 'action-btn', textContent: '📋', title: 'Copy' });
  copy.onclick = () => navigator.clipboard.writeText(stripHtml(text)).catch(()=>{});
  const speak = Object.assign(document.createElement('button'), { className: 'action-btn', textContent: '🔊', title: 'Speak' });
  speak.onclick = () => {
    try {
      speechSynthesis.speak(new SpeechSynthesisUtterance(stripHtml(text)));
    } catch (e) { /* ignore */ }
  };
  actions.appendChild(copy);
  actions.appendChild(speak);

  // image controls (if meta contains dataset)
  if (meta && meta.prompt) {
    const openBtn = Object.assign(document.createElement('button'), { className: 'action-btn', textContent: '🔗', title: 'Open image' });
    openBtn.onclick = () => window.open(meta.url || '', '_blank');
    const regen = Object.assign(document.createElement('button'), { className: 'action-btn', textContent: '🔁', title: 'Regenerate' });
    regen.onclick = async () => {
      if (typeof window.generateImage === 'function' && meta.prompt) {
        try {
          addMessage('🔄 Regenerating image...', 'bot');
          const newUrl = await window.generateImage(meta.prompt);
          if (!newUrl) return addMessage('⚠️ No image returned.', 'bot');
          // update displayed image if bubble contains img
          const img = bubble.querySelector('img');
          if (img) img.src = newUrl;
          if (meta.url) meta.url = newUrl;
        } catch (err) {
          addMessage('⚠️ Regenerate failed: ' + (err?.message || err), 'bot');
        }
      } else {
        addMessage('⚠️ Regenerate not available.', 'bot');
      }
    };
    const save = Object.assign(document.createElement('button'), { className: 'action-btn', textContent: '💾', title: 'Save to gallery' });
    save.onclick = () => addImageToGallery(meta.url || '');
    actions.appendChild(openBtn);
    actions.appendChild(regen);
    actions.appendChild(save);
  }

  container.appendChild(actions);
}

/** stripHtml: remove markup for copy/speech */
function stripHtml(s) {
  const d = document.createElement('div');
  d.innerHTML = s || '';
  return d.textContent || d.innerText || '';
}

/**
 * addMessage(text, sender='bot', meta = {})
 * - text: string (markdown permitted). If text contains HTML image tags, they will render.
 * - sender: 'bot' | 'user' | 'system'
 * - meta: optional object, e.g. { model, prompt, url } used for bot image controls
 */
export function addMessage(text = '', sender = 'bot', meta = {}) {
  const chat = document.getElementById(CHAT_ID);
  if (!chat) {
    console.warn('addMessage: chat container not found');
    return;
  }

  const container = el('div', `message-container ${sender}`);
  const bubble = el('div', `bubble ${sender}`);
  const content = el('div', 'bubble-content');

  // If text appears to be an image URL only (common for image returns), show image
  const trimmed = (text || '').trim();
  const isImageUrl = /^https?:\/\/.+\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?.*)?$/i.test(trimmed);
  if (isImageUrl) {
    content.innerHTML = `<img src="${safeHTML(trimmed)}" style="max-width:90%;border-radius:10px;margin-top:6px;" />`;
  } else {
    // If the text contains explicit <img> or other HTML, allow it; otherwise render markdown
    const containsHtml = /<\/?[a-z][\s\S]*>/i.test(trimmed);
    content.innerHTML = containsHtml ? trimmed : markdownToHTML(trimmed);
  }

  bubble.appendChild(content);
  container.appendChild(bubble);
  chat.appendChild(container);
  scrollToBottom(chat);

  // Attach actions
  if (sender === 'user') {
    addUserActions(container, bubble, text);
  } else {
    addBotActions(container, bubble, text, meta);
  }

  return { container, bubble, content };
}

/**
 * appendChunkToLastMessage(chunk)
 * - Append chunk of text to last bot message (used for streaming/partial updates).
 * - chunk is plain text (not sanitized); we'll insert as markdown fragment.
 */
export function appendChunkToLastMessage(chunk = '') {
  const chat = document.getElementById(CHAT_ID);
  if (!chat) return;
  // find last bot bubble-content
  const last = Array.from(chat.querySelectorAll('.message-container.bot .bubble .bubble-content')).pop();
  if (!last) return;
  // combine previous text + chunk
  // We treat chunk as raw text and re-render markdown
  const prev = last.__rawText ?? last.textContent ?? '';
  const combined = prev + chunk;
  last.__rawText = combined;
  last.innerHTML = markdownToHTML(combined);
  scrollToBottom(chat);
}

/**
 * updateLastMessage(fullText)
 * - Replace content of last bot message fully (final commit after streaming)
 */
export function updateLastMessage(fullText = '') {
  const chat = document.getElementById(CHAT_ID);
  if (!chat) return;
  const last = Array.from(chat.querySelectorAll('.message-container.bot .bubble .bubble-content')).pop();
  if (!last) return;
  last.__rawText = fullText;
  last.innerHTML = markdownToHTML(fullText);
  scrollToBottom(chat);
}

/**
 * setThinking(on, opts)
 * - shows/hides a small typing indicator bubble
 * - opts: { sender: 'bot'|'system', text } optional
 */
let _thinkingEl = null;
export function setThinking(on = true, opts = {}) {
  const chat = document.getElementById(CHAT_ID);
  if (!chat) return;
  if (on) {
    if (_thinkingEl) return; // already shown
    const container = el('div', 'message-container bot thinking');
    const bubble = el('div', 'bubble bot');
    const content = el('div', 'bubble-content');
    // simple animated dots
    const dots = el('span', 'thinking-dots');
    dots.innerHTML = '<span style="opacity:0.9;">•</span><span style="opacity:0.6;">•</span><span style="opacity:0.3;">•</span>';
    content.appendChild(dots);
    if (opts && opts.text) {
      const t = el('div', 'thinking-text');
      t.textContent = opts.text;
      content.appendChild(t);
    }
    bubble.appendChild(content);
    container.appendChild(bubble);
    chat.appendChild(container);
    _thinkingEl = container;
    scrollToBottom(chat);
    return _thinkingEl;
  } else {
    if (!_thinkingEl) return;
    try { _thinkingEl.remove(); } catch (e) { /* ignore */ }
    _thinkingEl = null;
  }
}

/**
 * addImageToGallery(url)
 */
export function addImageToGallery(url) {
  if (!url) return;
  const gallery = document.getElementById(GALLERY_ID);
  if (!gallery) return;
  const img = document.createElement('img');
  img.src = url;
  img.style = 'width:100%;border-radius:8px;box-shadow:0 6px 18px rgba(0,0,0,0.6);cursor:pointer;margin-bottom:8px;';
  img.onclick = () => window.open(url, '_blank');
  gallery.appendChild(img);
  // keep gallery from growing forever? not in this basic helper
}

/**
 * clearChat()
 */
export function clearChat() {
  const chat = document.getElementById(CHAT_ID);
  if (!chat) return;
  chat.innerHTML = '';
}

/**
 * renderAnalysisCard(fileName, analysis)
 * - analysis: { summary, fullText, keyPoints, toc, conclusion }
 * - preserves the previous render style from your index.js
 */
export function renderAnalysisCard(fileName, analysis = {}) {
  const card = document.createElement('div');
  card.className = 'analysis-card';
  card.style = 'background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.04);padding:12px;border-radius:10px;margin:10px 0;white-space:pre-wrap;';
  const header = document.createElement('div');
  header.innerHTML = `**📄 Analysis: ${safeHTML(fileName || 'file')}**`;
  header.style = 'font-weight:700;margin-bottom:8px;';
  card.appendChild(header);

  const section = (title, content) => {
    const elSec = document.createElement('div');
    elSec.style = 'margin-bottom:8px;';
    elSec.innerHTML = `<strong>${safeHTML(title)}</strong>\n<pre style="white-space:pre-wrap;margin:6px 0;padding:8px;border-radius:6px;background:rgba(0,0,0,0.04)">${safeHTML(String(content || '—'))}</pre>`;
    return elSec;
  };

  card.appendChild(section('Summary', analysis.summary || 'No summary.'));
  card.appendChild(section('Table of Contents (detected)', (analysis.toc && analysis.toc.length) ? analysis.toc.join('\n') : 'None detected.'));
  card.appendChild(section('Full Extracted Text (truncated)', (analysis.fullText || '').slice(0, 15000) + ((analysis.fullText || '').length > 15000 ? '\n\n[...truncated]' : '')));
  card.appendChild(section('Key Points', (analysis.keyPoints && analysis.keyPoints.length) ? analysis.keyPoints.map((p,i)=>`${i+1}. ${p}`).join('\n') : 'None.'));
  card.appendChild(section('Conclusion / Answer', analysis.conclusion || 'No conclusion.'));

  // append to chat as bot message container but with card inside
  const container = document.createElement('div');
  container.className = 'message-container bot';
  const bubble = document.createElement('div');
  bubble.className = 'bubble bot';
  const contentWrap = document.createElement('div');
  contentWrap.className = 'bubble-content';
  contentWrap.appendChild(card);
  bubble.appendChild(contentWrap);
  container.appendChild(bubble);
  const chat = document.getElementById(CHAT_ID);
  if (!chat) return;
  chat.appendChild(container);
  scrollToBottom(chat);
  addBotActions(container, bubble, '[File Analysis]');
}

/* =====================
   Default export
   ===================== */
export default {
  addMessage,
  appendChunkToLastMessage,
  updateLastMessage,
  setThinking,
  addImageToGallery,
  clearChat,
  renderAnalysisCard
};
                               
