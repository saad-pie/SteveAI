// config.js: SteveAI 2.0 Neural Core – Auto-generated from .env (browser-safe, no dotenv needed)
// ⚠️ NEVER commit API keys—use .env + build step (e.g., Vite) for prod. This is direct for dev.
// Updates: Multi-model support! Added SteveAI-general (Grok-4 powerhouse), steveai-fast (Gemini flash for speed), SteveAI-reasoning (DeepSeek V3-0324 for deep logic chains).
// Usage: In chat.js or commands, swap via config.models.general, etc. Default stays GPT-5-nano for balance.

export default {
  // System prompt: Your AI's core directive (keep it punchy)
  systemPrompt: `You are SteveAI 2.0, a hyper-intelligent quantum companion from 2047. Respond with wit, precision, and futuristic flair. Use markdown for structure: **bold** futures, *italic* insights, code blocks for hacks. Keep replies concise—under 200 tokens unless queried deep.`,

  // A4F API deets – Pulled from .env
  a4fChatUrl: 'https://api.a4f.co/v1/chat/completions',
  a4fApiKey: 'ddc-a4f-d61cbe09b0f945ea93403a420dba8155',

  // Multi-Model Arsenal: Switch modes for general, fast, or reasoning tasks
  models: {
    default: 'provider-3/gpt-5-nano',  // Balanced baseline
    general: 'provider-5/grok-4-0709',  // SteveAI-general: xAI Grok-4 for broad, creative horizons
    fast: 'provider-3/gemini-2.5-flash-lite-preview-09-2025',  // steveai-fast: Gemini lite for rapid-fire queries
    reasoning: 'deepseek-v3-0324'  // SteveAI-reasoning: DeepSeek V3-0324 – Advanced logic & problem-solving beast (32k context, BETA edge)
  },

  // Current default (points to models.default)
  defaultModel: 'provider-3/gpt-5-nano',  // Or swap: config.models.general for epic scopes

  // Generation params (tune per model if needed—future: dynamic by mode)
  temperature: 0.7,  // Creativity dial: 0=robot, 1=chaos
  maxTokens: 150,  // Response cap – bump for epics

  // UI/UX toggles – From .env
  defaultTheme: 'light',
  debug: true  // APP_DEBUG=true
};
