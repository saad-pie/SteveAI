// config.js — full config (ESM)
// Exports endpoints, keys, model map, prompts, misc constants.

export const API_BASE = "https://api.a4f.co/v1/chat/completions";
export const IMAGE_ENDPOINT = "https://api.a4f.co/v1/images/generations";
export const PROXY = "https://corsproxy.io/?url=";
export const proxied = (u) => PROXY + encodeURIComponent(u);

// API keys (kept as you provided)
export const API_KEYS = [
  "ddc-a4f-d61cbe09b0f945ea93403a420dba8155",
  "ddc-a4f-93af1cce14774a6f831d244f4df3eb9e"
];

// Analyzer model (used only for uploaded file analysis)
export const ANALYZER_MODEL = "provider-3/gpt-4.1-nano";

// Firecrawl config
export const FIRECRAWL_API_KEY = "fc-ebe5b6f4af4e469dbfe714e9296ea55a";
export const FIRECRAWL_ENDPOINT = "https://api.firecrawl.dev/v1/search";

// Image model (explicit)
export const IMAGE_MODEL = "provider-3/imagen-4";

// Model map & vision support (exact names from your index.js)
export const STEVEAI_MODELS = {
  fast: "provider-3/gemini-2.5-flash-lite-preview-09-2025",
  chat: "provider-3/gpt-5-nano",
  reasoning: "provider-3/deepseek-v3-0324",
  general: "provider-5/grok-4-0709"
};

export const VISION_CAPABLE = new Set([
  "provider-3/gemini-2.5-flash-lite-preview-09-2025",
  "provider-3/gpt-5-nano",
  "provider-3/deepseek-v3-0324",
  "provider-3/gpt-4.1-nano"
]);

// Misc constants / defaults
export const TYPE_DELAY = 2; // ms typing interval per char approximation
export const DEFAULT_TEMPERATURE = 0.7;
export const DEFAULT_MAX_TOKENS = 1500;
export const SUMMARIZER_MODEL = "provider-3/gpt-4o-mini";
export const ANALYZER_MODEL_FALLBACK = ANALYZER_MODEL;

// System prompts (all config here)
export const SYSTEM_PROMPT_GLOBAL =
  "You are SteveAI, made by saadpie. You can generate images directly via the backend using generateImage(prompt). " +
  "When a user's intent is clearly visual, respond ONLY with: Image Generated: <prompt> — exactly like this, no extra text, markdown, emojis, or URLs. " +
  "Be concise and practical.";

export const SYSTEM_PROMPT_CHAT = "Friendly, concise assistant. Suggest images when relevant.";
export const SYSTEM_PROMPT_REASONING = "Analytical reasoning mode — be methodical and concise.";
export const SYSTEM_PROMPT_GENERAL = `You are SteveAI-General, an advanced assistant capable of both text and image generation.
When the user requests an image or describes a visual scene, respond ONLY with:
Image Generated: <prompt>
— exactly as written.`;

// Export a small helper to indicate thinking UI type
// T1 (Gemini compact) selected by you
export const THINK_UI = "T1";
