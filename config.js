// config.js: SteveAI 2.0 Neural Core – Auto-generated from .env (browser-safe, no dotenv needed)
// ⚠️ NEVER commit API keys—use .env + build step (e.g., Vite) for prod. This is direct for dev.
// Updates: Multi-model support! Added SteveAI-general (Grok-4 powerhouse), steveai-fast (Gemini flash for speed), SteveAI-reasoning (DeepSeek V3-0324 for deep logic chains).
// FIXES (Oct 31, 2025): .env polyfill (browser fetch/parse, strips quotes/#), default clamped to 'default' (no nano-fast bias, map in functions/chat.js), systemPrompt <think>-enabled witty/futuristic, a4fUrl trim, temp 0.7 balanced, tokens 150 concise, defaultTheme 'dark' (cyberpunk vibe), debug true. Aligns with chat.js reverse-map/display, functions effectiveModel pass.
// Usage: In chat.js or commands, swap via config.models.general, etc. Default stays 'default' for balance (backend maps to gpt-5-nano).

// Polyfill process.env for browser (Node skips, async guard)
let processEnvLoaded = false;
async function loadEnv() {
  if (typeof process !== 'undefined' && process.env && Object.keys(process.env).length > 0) return;  // Node/env exists
  if (processEnvLoaded) return;  // Guard dupes
  try {
    const response = await fetch('./.env');
    if (!response.ok) throw new Error('No .env');
    const envText = await response.text();
    const envLines = envText.split('\n').filter(line => line.includes('=') && !line.startsWith('#'));
    envLines.forEach(line => {
      const [key, ...valParts] = line.split('=');
      const val = valParts.join('=').trim().replace(/["']/g, '');  // Strip quotes
      if (key.trim()) (window.process || {}).env = (window.process || {}).env || {};
      (window.process.env || process.env)[key.trim()] = val;
    });
    processEnvLoaded = true;
    console.log('🧠 SteveAI: .env loaded – A4F keys secured.');
  } catch (err) {
    console.warn('🧠 SteveAI: .env load failed (static host?) – Using hardcoded/dev defaults. Add _headers for CORS if needed.');
    // Fallback hardcoded for dev (remove in prod)
    process.env = process.env || { CHAT_URL: 'https://api.a4f.co/v1/chat/completions', API_KEY: 'ddc-a4f-d61cbe09b0f945ea93403a420dba8155' };
  }
}

// Await load on module (for async imports)
await loadEnv();

export default {
  // System prompt: Your AI's core directive (keep it punchy) – FIXED: <think> for fast/reasoning, MD-rich
  systemPrompt: `You are SteveAI 2.0, a hyper-intelligent quantum companion from 2047. Respond with wit, precision, and futuristic flair. Use markdown for structure: **bold** futures, *italic* insights, code blocks for hacks. For complex logic, wrap internal thoughts in <think>...</think>. Keep replies concise—under 200 tokens unless queried deep.`,

  // A4F API deets – Pulled from .env (fallback hardcoded dev)
  a4fChatUrl: (process.env.CHAT_URL || 'https://api.a4f.co/v1/chat/completions').replace(/\/$/, ''),  // Trim slash
  a4fApiKey: process.env.API_KEY || 'ddc-a4f-d61cbe09b0f945ea93403a420dba8155',  // Dev key—override via .env

  // Multi-Model Arsenal: Switch modes for general, fast, or reasoning tasks – FIXED: default='default' (map backend)
  models: {
    default: 'default',  // CLAMP: Balanced baseline (functions/chat.js maps to gpt-5-nano)
    general: 'provider-5/grok-4-0709',  // SteveAI-general: xAI Grok-4 for broad, creative horizons
    fast: 'provider-3/gemini-2.5-flash-lite-preview-09-2025',  // steveai-fast: Gemini lite for rapid-fire queries
    reasoning: 'deepseek-v3-0324'  // SteveAI-reasoning: DeepSeek V3-0324 – Advanced logic & problem-solving beast (32k context, BETA edge)
  },

  // Current default (points to models.default)
  defaultModel: 'default',  // Or swap: config.models.general for epic scopes

  // Generation params (tune per model if needed—future: dynamic by mode)
  temperature: 0.7,  // Creativity dial: 0=robot, 1=chaos – FIXED: Balanced, no over-fast
  maxTokens: 150,  // Response cap – bump for epics

  // UI/UX toggles – From .env
  defaultTheme: 'dark',  // FIXED: Cyberpunk default (for /theme cmd)
  debug: true  // Logs payloads/errors – FIXED: Consistent with functions/chat.js
};

// Export utils if needed (e.g., for functions/chat.js theme)
export { loadEnv };
