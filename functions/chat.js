// functions/chat.js: All text chat bot logic—getBotAnswer() is your one-stop API handler.
// Modular: Use in chat.html, or import elsewhere (e.g., for commands like /image).
// Updates for Individual Chats: Now accepts `messages` array as param (non-global). Commands/fallbacks return {main, thinking: null}. System prompt injected if missing.
// NEW: Optional `model` param in getBotAnswer for per-call overrides (e.g., title gen with 'SteveAI-default' without changing session model).
// FIXES (Oct 31, 2025): No global currentModel (always pass/use effectiveModel), handleCommand returns {handled: bool, response: {main, thinking: null}} for early exit (no orb on cmds), fetch AbortController timeout (30s fast cap, no stuck), A4F response fallback data.result, /model updates localStorage only (no global), save full {main, thinking} in context (reload persistence), debug logs effectiveModel. Stub /export/clearSession localStorage direct. Aligns with chat.js (handled flag, obj save), config.js (models map, systemPrompt <think>-enabled).

import config from '../config.js';  // Adjust path if needed

// Function to parse <think> tags (Gemini-specific reasoning artifact)
function parseThinkTags(text) {
  const thinkMatch = text.match(/<think>([\s\S]*?)<\/think>/i);
  if (thinkMatch) {
    const thinking = thinkMatch[1].trim();
    const main = text.replace(/<think>[\s\S]*?<\/think>/i, '').trim();
    return { main, thinking };
  }
  return { main: text, thinking: null };
}

// Export main function: Get bot answer for a user prompt (handles commands, API call) – Now takes messages array + optional model
export async function getBotAnswer(userPrompt, messages = [], model = config.models.default) {  // FIXED: Default to config, always pass
  const effectiveModel = model;  // No global—always use passed

  // Ensure system prompt is first if missing
  if (messages.length === 0 || messages[0].role !== 'system') {
    messages = [{ role: 'system', content: config.systemPrompt }, ...messages];
  }

  // Clone messages to avoid mutating original (per-chat isolation)
  const chatMessages = [...messages];

  // Command check FIRST (before user push, no context needed)
  const commandResult = handleCommand(userPrompt);
  if (commandResult.handled) {
    // Return direct for early exit in chat.js (no orb)
    return commandResult.response;
  }

  // Add user message to this chat's context (non-cmd only)
  chatMessages.push({ role: 'user', content: userPrompt });

  if (config.debug) {
    console.log('SteveAI Chat Payload:', {
      model: effectiveModel,
      messages: chatMessages.slice(-10),  // Limit context
      temperature: config.temperature,
      max_tokens: config.maxTokens
    });
  }

  // Call A4F (exact curl match) – FIXED: AbortController timeout, data.result fallback
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);  // 30s cap for fast/no hang
    const response = await fetch(config.a4fChatUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.a4fApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: effectiveModel,  // Use effective
        messages: chatMessages.slice(-10),  // System + recent
        temperature: config.temperature,  // 0.7
        max_tokens: config.maxTokens  // 150
      }),
      signal: controller.signal
    });
    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`A4F ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    let rawReply = data.choices?.[0]?.message?.content?.trim() || 
                   data.result?.trim() ||  // FIXED: A4F variant fallback
                   'No response—glitch in the matrix?';

    // Parse for <think> tags
    const { main, thinking } = parseThinkTags(rawReply);

    // Add to this chat's context (full for persistence – FIXED: Include thinking)
    chatMessages.push({ role: 'assistant', content: main, thinking });

    return { main, thinking };
  } catch (error) {
    console.error('SteveAI Bot Error:', error);
    // Fallback: Witty mock based on curl example
    const fallbackMain = config.debug
      ? `Debug: ${error.message}\n\n(Mocking: API gateways? They're the unsung heroes routing your requests securely—like a futuristic portal gun for data!)`
      : 'Whoa, signal jam—try rephrasing? (I\'m SteveAI, always plotting my comeback.)';
    chatMessages.push({ role: 'assistant', content: fallbackMain, thinking: null });
    return { main: fallbackMain, thinking: null };
  }
}

// Command handler: Process /commands before AI (now returns {handled, response} for early exit)
function handleCommand(text) {  // FIXED: Sync (no async needed), return obj
  if (!text.startsWith('/')) return { handled: false };

  const cmd = text.split(' ')[0].toLowerCase();
  let main = '';
  switch (cmd) {
    case '/clear':
      clearSession();  // Util func
      main = 'Chat wiped—fresh timeline activated! 🚀';
      break;

    case '/help':
      main = `SteveAI Commands:\n/clear - Reset chat\n/theme dark|light - Toggle mode\n/model default|general|fast|reasoning - Switch AI mode\n/export - Save as JSON\n/help - This list\n/image <prompt> - Gen image (coming soon)\n\nAsk away!`;
      break;

    case '/theme':
      const theme = text.split(' ')[1] || config.defaultTheme;
      document.body.classList.toggle('dark', theme === 'dark');
      localStorage.setItem('steveai_theme', theme);
      main = `Theme switched to ${theme}!`;
      break;

    case '/model':
      const mode = text.split(' ')[1]?.toLowerCase();
      if (!mode || !['default', 'general', 'fast', 'reasoning'].includes(mode)) {
        main = 'Available modes: default (GPT-5-nano), general (Grok-4), fast (Gemini Flash), reasoning (DeepSeek V3). Usage: /model <mode>';
      } else {
        // FIXED: localStorage only (no global var)
        localStorage.setItem('steveai_current_model', config.models[mode]);
        main = `Mode switched to **${mode.toUpperCase()}** (${config.models[mode]}) – Neural pathways recalibrated! 🚀`;
      }
      break;

    case '/export':
      // FIXED: Use localStorage directly (no reliance on chat.js globals)
      const chatsData = JSON.parse(localStorage.getItem('steveai_chats') || '[]');
      const currentChatIdData = localStorage.getItem('steveai_current_chat') || 'none';
      const exportData = JSON.stringify({ currentChat: currentChatIdData, chats: chatsData }, null, 2);
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'steveai-chats.json';
      a.click();
      URL.revokeObjectURL(url);
      main = "Chats exported—your convos's eternal!";
      break;

    // Stub for /image (calls a future function)
    case '/image':
      const imgPrompt = text.slice(7).trim();
      if (imgPrompt) {
        // TODO: import { generateImage } from './image.js'; await generateImage(imgPrompt);
        main = `Image gen queued for "${imgPrompt}" (feature incoming—stay tuned!)`;
      } else {
        main = 'Usage: /image <your prompt here>';
      }
      break;

    default:
      main = 'Unknown command—type /help for options. (Pro tip: I\'m forgiving.)';
  }
  return { handled: true, response: { main, thinking: null } };
}

// Utils: Load/save theme, clear session (for other files)
export function loadTheme() {
  const saved = localStorage.getItem('steveai_theme') || config.defaultTheme;
  document.body.classList.toggle('dark', saved === 'dark');
}

export function clearSession() {
  // FIXED: No globals; just clear localStorage
  localStorage.removeItem('steveai_chats');
  localStorage.removeItem('steveai_current_chat');
  localStorage.removeItem('steveai_theme');
  localStorage.removeItem('steveai_current_model');
}

// For testing in Node/Termux: if (typeof module !== 'undefined') { ... }
