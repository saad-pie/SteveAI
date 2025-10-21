// utils.js — ESM (named exports)
// Generic helpers: network (apiFetch + proxy fallback), streaming helper, file readers,
// command parsing, model lookup (reads from config.js), DOM helpers, misc utils.
//
// Note: this file intentionally DOES NOT hardcode model names. Use config.js for that.

import {
  API_BASE,
  IMAGE_ENDPOINT,
  PROXY,
  proxied,
  API_KEYS,
  STEVEAI_MODELS,
  ANALYZER_MODEL,
  IMAGE_MODEL,
  SUMMARIZER_MODEL,
  DEFAULT_TEMPERATURE,
  DEFAULT_MAX_TOKENS
} from './config.js';

/* =====================
   Networking helpers
   ===================== */

async function tryFetch(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    // attempt to read body for debugging
    let body = null;
    try { body = await res.text(); } catch (e) { body = '[no body]'; }
    const err = new Error(`HTTP ${res.status}: ${body}`);
    err.status = res.status;
    err.body = body;
    throw err;
  }
  // Try to parse JSON; if fails return text
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) return await res.json();
  return await res.text();
}

/**
 * apiFetch
 * - Tries direct POST to API_BASE with the first key
 * - If that fails, attempts proxied requests rotating through API_KEYS
 * - Payload is a JS object and will be JSON.stringified
 *
 * @param {object} payload - body payload for the chat/image endpoint
 * @param {object} [opts] - optional overrides: { endpoint, useProxyFallback=true, method='POST' }
 */
export async function apiFetch(payload, opts = {}) {
  const endpoint = opts.endpoint || API_BASE;
  const method = opts.method || 'POST';
  const useProxyFallback = opts.useProxyFallback !== false;

  const headers = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEYS[0]}` };
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);

  // primary attempt (direct)
  try {
    return await tryFetch(endpoint, { method, headers, body });
  } catch (primaryErr) {
    // If proxies disabled, rethrow
    if (!useProxyFallback) throw primaryErr;

    console.warn('Primary API call failed, attempting proxied + rotating keys', primaryErr);

    let lastErr = primaryErr;
    for (const key of API_KEYS) {
      try {
        const proxyHeaders = { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` };
        const proxiedUrl = proxied(endpoint);
        return await tryFetch(proxiedUrl, { method, headers: proxyHeaders, body });
      } catch (e) {
        lastErr = e;
        console.warn('Proxied attempt failed for key, trying next', e);
      }
    }
    // All attempts failed — throw the last error
    throw lastErr;
  }
}

/**
 * apiFetchRaw — convenience wrapper when you want to call a specific endpoint (image/chat)
 * @param {string} endpoint - full url
 * @param {object} payload
 * @param {object} opts
 */
export async function apiFetchRaw(endpoint, payload, opts = {}) {
  return await apiFetch(payload, { ...opts, endpoint });
}

/* =====================
   Streaming helper (basic)
   ===================== */

/**
 * streamResponse
 * Tries to perform a fetch and stream the response (useful for incremental outputs).
 * It yields decoded string chunks via an async iterator.
 *
 * Example:
 * for await (const chunk of streamResponse(url, opts)) { handleChunk(chunk) }
 *
 * NOTE: Not all endpoints stream. This helper gracefully falls back to returning full text.
 */
export async function streamResponse(url, options = {}) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const t = await res.text().catch(() => '[no body]');
    throw new Error(`HTTP ${res.status}: ${t}`);
  }

  // If body is not a ReadableStream, return full text as single chunk
  if (!res.body || !res.body.getReader) {
    const text = await res.text();
    return (async function* () { yield text; })();
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  return (async function* stream() {
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        yield decoder.decode(value, { stream: true });
      }
    } finally {
      try { reader.releaseLock(); } catch (e) { /* ignore */ }
    }
  })();
}

/* =====================
   File helpers
   ===================== */

/**
 * readFileAsArrayBuffer(file)
 * readFileAsText(file)
 * readFileAsDataURL(file)
 * readFileAsBase64(file)
 */
export function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Failed to read file as ArrayBuffer'));
    fr.onload = () => resolve(fr.result);
    fr.readAsArrayBuffer(file);
  });
}
export function readFileAsText(file, encoding = 'utf-8') {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Failed to read file as text'));
    fr.onload = () => resolve(fr.result);
    fr.readAsText(file, encoding);
  });
}
export function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Failed to read file as DataURL'));
    fr.onload = () => resolve(fr.result);
    fr.readAsDataURL(file);
  });
}
export async function readFileAsBase64(file) {
  const dataUrl = await readFileAsDataURL(file);
  // data:[<mediatype>][;base64],<data>
  const comma = dataUrl.indexOf(',');
  return dataUrl.slice(comma + 1);
}

/**
 * detectFileType(file)
 * returns { ext, mime, isImage, isPdf, isText, isOffice }
 */
export function detectFileType(file) {
  const name = file.name || '';
  const ext = (name.split('.').pop() || '').toLowerCase();
  const mime = file.type || '';
  const imageExts = new Set(['jpg','jpeg','png','gif','webp','bmp','tiff','heic']);
  const officeExts = new Set(['doc','docx','xls','xlsx','ppt','pptx']);
  return {
    ext,
    mime,
    isImage: imageExts.has(ext) || mime.startsWith('image/'),
    isPdf: ext === 'pdf' || mime === 'application/pdf',
    isText: ['txt','md','csv','json','xml'].includes(ext) || mime.startsWith('text/'),
    isOffice: officeExts.has(ext),
  };
}

/* =====================
   Command helpers
   ===================== */

/**
 * parseCommand — returns { command, args, raw }
 * If not a command (doesn't start with '/'), returns null
 */
export function parseCommand(text) {
  if (!text || typeof text !== 'string') return null;
  const s = text.trim();
  if (!s.startsWith('/')) return null;
  const parts = s.split(/\s+/);
  const command = parts[0].slice(1).toLowerCase();
  const args = parts.slice(1);
  return { command, args, raw: text };
}
export function isCommand(text) { return !!parseCommand(text); }

/* =====================
   Model helpers (reads from config)
   ===================== */

/**
 * getModelFor(mode)
 * mode: 'chat'|'reasoning'|'fast'|'general' etc
 */
export function getModelFor(mode = 'chat') {
  const key = (mode || 'chat').toLowerCase();
  return STEVEAI_MODELS[key] || STEVEAI_MODELS.chat;
}

/* =====================
   DOM helpers
   ===================== */

export function scrollToBottom(el = null) {
  try {
    const container = el || document.getElementById('chat');
    if (!container) return;
    container.scrollTop = container.scrollHeight + 1000;
  } catch (e) { /* ignore */ }
}

/**
 * safeHTML: produce a sanitized-ish small HTML snippet for basic use.
 * NOTE: This is intentionally minimal. For production use, replace with a proper sanitizer.
 */
export function safeHTML(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * notify: small in-UI toast using console fallback
 */
export function notify(msg, level = 'info') {
  try {
    // minimal toast: append to body
    let el = document.getElementById('steveai-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'steveai-toast';
      el.style = 'position:fixed;right:12px;bottom:12px;padding:10px 12px;border-radius:8px;background:rgba(0,0,0,0.6);color:#fff;z-index:99999;font-size:13px;';
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.display = 'block';
    setTimeout(() => { try { el.style.display = 'none'; } catch (e) {} }, 3000);
  } catch (e) {
    console[level || 'log']('[notify]', msg);
  }
}

/* =====================
   Misc utils
   ===================== */

export function sleep(ms = 200) { return new Promise(resolve => setTimeout(resolve, ms)); }

export function safeJSON(v, fallback = null) {
  try { return JSON.parse(v); } catch (e) { return fallback; }
}

/* =====================
   Specialized helpers
   ===================== */

/**
 * buildChatPayload
 * - convenience for building payloads consumed by your chat endpoint.
 * - you can override model, messages, temperature, max_tokens.
 */
export function buildChatPayload({ model, messages, temperature = DEFAULT_TEMPERATURE, max_tokens = DEFAULT_MAX_TOKENS } = {}) {
  return {
    model,
    messages,
    temperature,
    max_tokens
  };
}

/* =====================
   Exports
   ===================== */

export default {
  tryFetch,
  apiFetch,
  apiFetchRaw,
  streamResponse,
  readFileAsArrayBuffer,
  readFileAsText,
  readFileAsDataURL,
  readFileAsBase64,
  detectFileType,
  parseCommand,
  isCommand,
  getModelFor,
  scrollToBottom,
  safeHTML,
  notify,
  sleep,
  safeJSON,
  buildChatPayload
};
      
