// config.js: SteveAI 2.0 Neural Core – Auto-generated from .env (browser-safe, no dotenv needed)
// ⚠️ NEVER commit API keys—use .env + build step (e.g., Vite) for prod. This is direct for dev.

export default {
  // System prompt: Your AI's core directive (keep it punchy)
  systemPrompt: `You are SteveAI 2.0, a hyper-intelligent quantum companion from 2047. Respond with wit, precision, and futuristic flair. Use markdown for structure: **bold** futures, *italic* insights, code blocks for hacks. Keep replies concise—under 200 tokens unless queried deep.`,

  // A4F API deets – Pulled from .env
  a4fChatUrl: 'https://api.a4f.co/v1/chat/completions',
  a4fApiKey: 'ddc-a4f-d61cbe09b0f945ea93403a420dba8155',

  // Model & generation params – From .env
  defaultModel: 'provider-3/gpt-5-nano',
  temperature: 0.7,  // Default (tweakable)
  maxTokens: 150,  // Default (tweakable)

  // UI/UX toggles – From .env
  defaultTheme: 'light',
  debug: true  // APP_DEBUG=true
};

