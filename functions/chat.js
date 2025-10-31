// functions/chat.js: All text chat bot logic—getBotAnswer() is your one-stop API handler.
// Modular: Use in chat.html, or import elsewhere (e.g., for commands like /image).

import config from '../config.js';  // Adjust path if needed

// Global state: Messages history (session-persisted via localStorage)
let messages = JSON.parse(localStorage.getItem('steveai_messages') || '[]');
if (messages.length === 0) {
  messages = [{ role: 'system', content: config.systemPrompt }];
  localStorage.setItem('steveai_messages', JSON.stringify(messages));
}

// Global state: Current AI model (session-persisted via localStorage)
let currentModel = localStorage.getItem('steveai_current_model') || config.models.default;

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

// Export main function: Get bot answer for a user prompt (handles commands, API call)
export async function getBotAnswer(userPrompt) {
  // Add user message to history first
  messages.push({ role: 'user', content: userPrompt });
  localStorage.setItem('steveai_messages', JSON.stringify(messages));

  // Parse commands (e.g., /clear, /help)
  const commandResponse = await handleCommand(userPrompt);
  if (commandResponse !== false) {
    // Handle special case for /clear (re-add user after reset)
    if (userPrompt.toLowerCase().startsWith('/clear')) {
      messages = [
        { role: 'system', content: config.systemPrompt },
        { role: 'user', content: userPrompt }
      ];
    }
    // Add command response to history (as main only)
    const { main } = parseThinkTags(commandResponse);  // Though commands have no <think>
    messages.push({ role: 'assistant', content: main });
    localStorage.setItem('steveai_messages', JSON.stringify(messages));
    return { main, thinking: null };
  }

  if (config.debug) {
    console.log('SteveAI Chat Payload:', {
      model: currentModel,
      messages: messages.slice(-10),  // Limit context
      temperature: config.temperature,
      max_tokens: config.maxTokens
    });
  }

  // Call A4F (exact curl match)
  try {
    const response = await fetch(config.a4fChatUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.a4fApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: currentModel,
        messages: messages.slice(-10),  // System + recent
        temperature: config.temperature,  // 0.7
        max_tokens: config.maxTokens  // 150
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`A4F ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    let rawReply = data.choices[0]?.message?.content?.trim() || 'No response—glitch in the matrix?';

    // Parse for <think> tags
    const { main, thinking } = parseThinkTags(rawReply);

    // Add to history (main only – thinking is UI ephemeral)
    messages.push({ role: 'assistant', content: main });
    localStorage.setItem('steveai_messages', JSON.stringify(messages));

    return { main, thinking };
  } catch (error) {
    console.error('SteveAI Bot Error:', error);
    // Fallback: Witty mock based on curl example
    const fallbackMain = config.debug
      ? `Debug: ${error.message}\n\n(Mocking: API gateways? They're the unsung heroes routing your requests securely—like a futuristic portal gun for data!)`
      : 'Whoa, signal jam—try rephrasing? (I\'m SteveAI, always plotting my comeback.)';
    // Add fallback to history (main only)
    messages.push({ role: 'assistant', content: fallbackMain });
    localStorage.setItem('steveai_messages', JSON.stringify(messages));
    return { main: fallbackMain, thinking: null };
  }
}

// Command handler: Process /commands before AI
async function handleCommand(text) {
  if (!text.startsWith('/')) return false;

  const cmd = text.split(' ')[0].toLowerCase();
  switch (cmd) {
    case '/clear':
      messages = [{ role: 'system', content: config.systemPrompt }];
      localStorage.setItem('steveai_messages', JSON.stringify(messages));
      return 'Chat wiped—fresh timeline activated! 🚀';

    case '/help':
      return `SteveAI Commands:\n/clear - Reset chat\n/theme dark|light - Toggle mode\n/model default|general|fast|reasoning - Switch AI mode\n/export - Save as JSON\n/help - This list\n/image <prompt> - Gen image (coming soon)\n\nAsk away!`;

    case '/theme':
      const theme = text.split(' ')[1] || config.defaultTheme;
      document.body.classList.toggle('dark', theme === 'dark');
      localStorage.setItem('steveai_theme', theme);
      return `Theme switched to ${theme}!`;

    case '/model':
      const mode = text.split(' ')[1]?.toLowerCase();
      if (!mode || !['default', 'general', 'fast', 'reasoning'].includes(mode)) {
        return 'Available modes: default (GPT-5-nano), general (Grok-4), fast (Gemini Flash), reasoning (DeepSeek V3). Usage: /model <mode>';
      }
      currentModel = config.models[mode];
      localStorage.setItem('steveai_current_model', currentModel);
      return `Mode switched to **${mode.toUpperCase()}** (${currentModel}) – Neural pathways recalibrated! 🚀`;

    case '/export':
      const exportData = JSON.stringify(messages, null, 2);
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'steveai-chat.json';
      a.click();
      URL.revokeObjectURL(url);
      return "Chat exported—your convo's eternal!";

    // Stub for /image (calls a future function)
    case '/image':
      const imgPrompt = text.slice(7).trim();
      if (imgPrompt) {
        // TODO: import { generateImage } from './image.js'; await generateImage(imgPrompt);
        return `Image gen queued for "${imgPrompt}" (feature incoming—stay tuned!)`;
      }
      return 'Usage: /image <your prompt here>';

    default:
      return 'Unknown command—type /help for options. (Pro tip: I\'m forgiving.)';
  }
}

// Utils: Load/save theme, clear session (for other files)
export function loadTheme() {
  const saved = localStorage.getItem('steveai_theme') || config.defaultTheme;
  document.body.classList.toggle('dark', saved === 'dark');
}

export function clearSession() {
  localStorage.removeItem('steveai_messages');
  localStorage.removeItem('steveai_theme');
  localStorage.removeItem('steveai_current_model');
  messages = [{ role: 'system', content: config.systemPrompt }];
  currentModel = config.models.default;
}

// For testing in Node/Termux: if (typeof module !== 'undefined') { ... }
