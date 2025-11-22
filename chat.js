// chat.js
// IMPORTANT: This file relies on 'marked.js' being loaded in your HTML for markdown parsing.

// --- Module Imports ---
import config from './config.js'; 
import { generateImage, IMAGE_MODELS } from './image.js'; 

// --- Config Variables from Import ---
const API_BASE = config.API_BASE;
const PROXY = config.PROXY;
const proxiedURL = config.proxiedURL;
const API_KEYS = config.API_KEYS; // Used in fetchAI

// --- DOM Elements ---
const chat = document.getElementById('chat');
const form = document.getElementById('inputForm');
const input = document.getElementById('messageInput');
const themeToggle = document.getElementById('themeToggle');
const clearChatBtn = document.getElementById('clearChat');
const modeSelect = document.getElementById('modeSelect');

// --- Memory / Summary ---
let memory = {};
let turn = 0;
let memorySummary = "";
// const TYPE_DELAY = 2; // REMOVED
const TOKEN_BUDGET = 2200;
const approxTokens = s => Math.ceil((s || "").length / 4);

// --- Helpers ---
function memoryString() {
  return Object.keys(memory)
    .map(k => `User: ${memory[k].user}\nBot: ${memory[k].bot}`)
    .join('\n');
}

function lastTurns(n = 6) {
  const keys = Object.keys(memory).map(Number).sort((a,b)=>a-b);
  return keys.slice(-n).map(k => `User: ${memory[k].user}\nBot: ${memory[k].bot}`).join('\n');
}

function shouldSummarize() {
  if (memorySummary) return false;
  return turn >= 6 || approxTokens(memoryString()) > TOKEN_BUDGET;
}

/**
 * Generates a random delay for a more natural, fast typing effect (1ms to 2ms).
 * @returns {number} Random delay in milliseconds.
 */
function getRandomTypingDelay() {
    return Math.floor(Math.random() * (1 - 1 + 1)) + 1;
}

// --- Summarization ---
async function generateSummary() {
  const raw = memoryString();
  const payload = {
    model: "provider-3/gpt-4o-mini",
    messages: [
      { role: "system", content: "You are SteveAI, made by saadpie. Summarize the following chat context clearly." },
      { role: "user", content: raw }
    ]
  };
  try {
    const data = await fetchAI(payload);
    return data?.choices?.[0]?.message?.content?.trim() || "";
  } catch {
    return "Summary: " + lastTurns(2).replace(/\n/g, " ").slice(0, 800);
  }
}

async function buildContext() {
  if (shouldSummarize()) {
    const sum = await generateSummary();
    if (sum) {
      memorySummary = sum;
      const keep = {};
      const keys = Object.keys(memory).map(Number).sort((a,b)=>a-b).slice(-4);
      keys.forEach(k => keep[k] = memory[k]);
      memory = keep;
    }
  }
  return memorySummary
    ? `[SESSION SUMMARY]\n${memorySummary}\n\n[RECENT TURNS]\n${lastTurns(6)}`
    : memoryString();
}

// --- Markdown Parser ---
function markdownToHTML(t) { return marked.parse(t || ""); }

/**
 * Parses the response for <think> tags and separates the thinking steps from the final answer.
 * @param {string} text - The raw AI response.
 * @returns {{answer: string, thinking: string}}
 */
function parseThinkingResponse(text) {
    const thinkingRegex = /<think>(.*?)<\/think>/gs;
    const match = thinkingRegex.exec(text);

    if (match) {
        // Content inside <think> tags
        const thinking = match[1].trim(); 
        
        // Everything else is the answer (remove the matched tag block)
        let answer = text.replace(thinkingRegex, '').trim(); 
        
        // Handle case where only the thinking block was returned or the answer is empty
        if (!answer && thinking) {
            answer = "The model produced a thinking step but no explicit final answer.";
        }

        return { answer, thinking };
    }
    
    // If no <think> tag found, return the whole text as the answer
    return { answer: text, thinking: null };
}

/**
 * Parses the answer for the specific image generation command pattern using the simplified format.
 * NEW: Uses split and substring operations based on the strict format: "Image Generated:model:name,prompt:text"
 * @param {string} text - The raw AI answer text.
 * @returns {{prompt: string, model: string} | null}
 */
function parseImageGenerationCommand(text) {
    const commandStart = "Image Generated:";
    
    // Aggressive Cleanup: Remove control chars, newlines, and formatting, then trim.
    let cleanText = text.trim()
        .replace(/\n/g, ' ') 
        .replace(/(\*\*|🧠|Reasoning\/Steps)/gi, '')
        .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") 
        .trim();

    // 1. Check if the text starts with the exact command identifier (case-insensitive)
    if (!cleanText.toLowerCase().startsWith(commandStart.toLowerCase())) {
        return null;
    }
    
    // 2. Extract the content after "Image Generated:"
    let content = cleanText.substring(commandStart.length).trim();
    
    // 3. Look for the required format: "model:name,prompt:text"
    // Find the separator
    const commaIndex = content.indexOf(',');
    if (commaIndex === -1) {
        return null; // Format error: no comma separator found
    }
    
    const modelSegment = content.substring(0, commaIndex).trim();
    const promptSegment = content.substring(commaIndex + 1).trim();

    // 4. Extract model name
    if (!modelSegment.toLowerCase().startsWith('model:')) {
        return null; // Format error: model key not found
    }
    const model = modelSegment.substring('model:'.length).trim();

    // 5. Extract prompt text
    if (!promptSegment.toLowerCase().startsWith('prompt:')) {
        return null; // Format error: prompt key not found
    }
    const prompt = promptSegment.substring('prompt:'.length).trim();

    if (!model || !prompt) {
        return null; // Extraction failed or parts are empty
    }

    // Success!
    return { prompt, model };
}

// --- UI: Add Messages (FIXED to handle image generation command and random typing speed) ---
function addMessage(text, sender) {
  const container = document.createElement('div');
  container.className = 'message-container ' + sender;

  const bubble = document.createElement('div');
  bubble.className = 'bubble ' + sender;
  container.appendChild(bubble);

  const content = document.createElement('div');
  content.className = 'bubble-content';
  bubble.appendChild(content);

  // Parse the thinking step and the final answer
  const { answer, thinking } = parseThinkingResponse(text);
  const imageCommand = parseImageGenerationCommand(answer);
  
  // If this is an image command, we need to bypass normal message display
  if (sender === 'bot' && imageCommand) {
    // Record memory first, including the command text
    memory[++turn] = { user: input.value.trim(), bot: text };

    // --- FIX: Pass clean data to handleCommand directly ---
    const cleanPrompt = imageCommand.prompt;
    const cleanModelName = imageCommand.model; 

    // Find the model ID using the clean model name
    const modelObject = IMAGE_MODELS.find(m => m.name.toLowerCase() === cleanModelName.toLowerCase());
    const modelId = modelObject ? modelObject.id : IMAGE_MODELS[5].id; // Fallback if not found

    // Call handleCommand with an object containing pre-parsed image data
    handleCommand({
      type: 'image_auto',
      prompt: cleanPrompt,
      modelId: modelId,
      numImages: 1 // AI always generates 1 image
    }); 
    // --- END FIX ---
    
    return; // Exit as image generation handles its own output
  }

  // --- STANDARD MESSAGE FLOW ---
  // Default (Collapsed) HTML for the final output
  const thinkingHTML = thinking ? `
    <details class="thinking-details">
        <summary>🧠 **Reasoning/Steps**</summary>
        <div class="thinking-content">
            ${markdownToHTML(thinking)}
        </div>
    </details>
    <hr class="thinking-divider">
  ` : '';

  const finalFullHTML = thinkingHTML + markdownToHTML(answer);


  if (sender === 'bot') {
    chat.appendChild(container);
    chat.scrollTop = chat.scrollHeight;

    let i = 0, buf = "";
    const contentToType = thinking ? answer : text;

    (function type() {
      if (i < contentToType.length) {
        buf += contentToType[i++];
        
        let tempHtml;
        if (thinking) {
             // While typing, keep the details section OPEN so the user sees the reasoning load.
             let openThinkingHTML = `
                <details class="thinking-details" open>
                    <summary>🧠 **Reasoning/Steps**</summary>
                    <div class="thinking-content">
                        ${markdownToHTML(thinking)}
                    </div>
                </details>
                <hr class="thinking-divider">
             `;
             tempHtml = openThinkingHTML + markdownToHTML(buf);
        } else {
             tempHtml = markdownToHTML(buf);
        }
        
        content.innerHTML = tempHtml;
        chat.scrollTop = chat.scrollHeight;
        // Use random delay for natural speed
        setTimeout(type, getRandomTypingDelay());
      } else {
        // --- FINAL STEP: Use the standard, default-collapsed HTML ---
        content.innerHTML = finalFullHTML; 
        addBotActions(container, bubble, text);
      }
    })();
  } else {
    // User messages are instant
    content.innerHTML = markdownToHTML(text); 
    chat.appendChild(container);
    chat.scrollTop = chat.scrollHeight;
    addUserActions(container, bubble, text);
  }
}

// ... (addUserActions and addBotActions remain unchanged)

function addUserActions(container, bubble, text) {
  const actions = document.createElement('div');
  actions.className = 'message-actions';

  const resend = document.createElement('button');
  resend.className = 'action-btn';
  resend.textContent = '🔁';
  resend.title = 'Resend';
  resend.onclick = () => { input.value = text; input.focus(); };

  const copy = document.createElement('button');
  copy.className = 'action-btn';
  copy.textContent = '📋';
  copy.title = 'Copy';
  copy.onclick = () => navigator.clipboard.writeText(text);

  actions.appendChild(resend);
  actions.appendChild(copy);
  container.appendChild(actions);
}

function addBotActions(container, bubble, text) {
  const actions = document.createElement('div');
  actions.className = 'message-actions';

  const copy = document.createElement('button');
  copy.className = 'action-btn';
  copy.textContent = '📋';
  copy.title = 'Copy';
  // Pass the original, unparsed text for accurate copying
  copy.onclick = () => navigator.clipboard.writeText(text); 

  const speak = document.createElement('button');
  speak.className = 'action-btn';
  speak.textContent = '🔊';
  speak.title = 'Speak';
  // Pass only the ANSWER content for speaking
  const { answer } = parseThinkingResponse(text);
  speak.onclick = () => {
    let u = new SpeechSynthesisUtterance(answer);
    speechSynthesis.speak(u);
  };

  actions.appendChild(copy);
  actions.appendChild(speak);
  container.appendChild(actions);
}

// --- Fetch AI (Chat) ---
async function fetchAI(payload) {
  const url = proxiedURL(API_BASE);
  let lastErrText = "";
  for (const key of API_KEYS) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) return await res.json();
      lastErrText = await res.text();
    } catch (e) {
      console.warn("Proxy/network error", e);
    }
  }
  addMessage('⚠️ API unreachable. Check keys or proxy.', 'bot');
  throw new Error(lastErrText || "API error");
}

// --- Commands ---
function toggleTheme() {
  document.body.classList.toggle('light');
  addMessage('🌓 Theme toggled.', 'bot');
}
function clearChat() {
  chat.innerHTML = '';
  memory = {};
  memorySummary = '';
  turn = 0;
  addMessage('🧹 Chat cleared.', 'bot');
}
function exportChat() {
  const text = memorySummary
    ? `[SUMMARY]\n${memorySummary}\n\n[CHAT LOG]\n${memoryString()}`
    : `[CHAT LOG]\n${memoryString()}`;
  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `SteveAI_Chat_${new Date().toISOString().slice(0,19)}.txt`;
  a.click();
  addMessage('💾 Chat exported as text file.', 'bot');
}
function showContact() {
  const info = `
**📬 Contact SteveAI**
- Creator: [@saadpie](https://github.com/saad-pie)
- Website: [steve-ai.netlify.app](https://steve-ai.netlify.app)
- Feedback: Use /export to send logs.
  `;
  addMessage(info, 'bot');
}
async function playSummary() {
  addMessage('🎬 Generating chat summary...', 'bot');
  if (!memorySummary) memorySummary = await generateSummary();
  addMessage(`🧠 **Chat Summary:**\n${memorySummary}`, 'bot');
}
function showAbout() {
  const text = `
🤖 **About SteveAI**
Built by *saadpie* — the bot from the future.

- Models: GPT-5-Nano, DeepSeek-R1, Gemini-2.5-flash, Qwen-3, Ax-4.0, GLM-4.5, Deepseek-v3, Allam-7b, ${IMAGE_MODELS.map(m => m.name).join(', ')}
- Modes: Chat | Reasoning | Fast | Math | Korean | General | Coding | Arabic
- Features: Context memory, Summarization, Commands, Theme toggle, Speech, Export

_Type /help to explore commands._
  `;
  addMessage(text, 'bot');
}
function changeMode(arg) {
  const allowedModes = ['chat', 'reasoning', 'fast', 'math', 'korean', 'general', 'coding', 'arabic'];
  if (!arg || !allowedModes.includes(arg.toLowerCase())) {
    addMessage(`⚙️ Usage: /mode ${allowedModes.join(' | ')}`, 'bot');
    return;
  }
  if (modeSelect) modeSelect.value = arg.toLowerCase();
  addMessage(`🧭 Switched mode to **${arg}**.`, 'bot');
}
function showTime() {
  const now = new Date();
  addMessage(`⏰ Local time: ${now.toLocaleTimeString()}`, 'bot');
}
function showHelp() {
  const modelNames = IMAGE_MODELS.map(m => m.name).join(', ');
  const helpText = `
**🧭 Available Commands**

- /clear — Clears current chat
- /theme — Toggle dark/light mode
- /help — Show this help
- /image <prompt> [model] [n=1] — Generate image(s)
  - Models: ${modelNames}
  - Max Images: 4
- /export — Export chat as .txt
- /contact — Show contact info
- /play — Summarize / replay conversation
- /about — About SteveAI
- /mode <chat|reasoning|fast|math|korean|general|coding|arabic> — Change mode
- /time — Show local time
  `;
  addMessage(helpText, 'bot');
}

// --- Command Router (MODIFIED to accept direct image parameters) ---
async function handleCommand(cmdOrParsedData) {
  let command, prompt, model, numImages;
  
  if (typeof cmdOrParsedData === 'string') {
    // This is a user-typed command like "/image my prompt model 1"
    const parts = cmdOrParsedData.trim().split(' ');
    command = parts[0].toLowerCase();
    const args = parts.slice(1);

    if (command === '/image') {
      prompt = args.join(' ');
      numImages = 1; // Default
      model = IMAGE_MODELS[5].id; // Default to Imagen 4 ID

      // Parse numImages from end if present
      const lastArg = args[args.length - 1];
      if (!isNaN(parseInt(lastArg, 10)) && parseInt(lastArg, 10) > 0) {
        numImages = Math.min(4, parseInt(lastArg, 10));
        prompt = args.slice(0, -1).join(' '); 
      }
      
      // Parse model from prompt string if present (Fuzzy model detection for user input)
      const modelMatch = IMAGE_MODELS.find(m => prompt.toLowerCase().includes(m.name.toLowerCase()));
      if (modelMatch) {
          model = modelMatch.id;
          // IMPORTANT: Remove only the model *name* from the prompt, not the ID path
          const nameRegex = new RegExp(modelMatch.name.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi');
          prompt = prompt.replace(nameRegex, '').trim();
      }
    }
  } else if (typeof cmdOrParsedData === 'object' && cmdOrParsedData.type === 'image_auto') {
    // This is an AI-generated image command, data is pre-parsed
    command = '/image';
    prompt = cmdOrParsedData.prompt;
    model = cmdOrParsedData.modelId; // This is the actual model ID (e.g., provider-4/sdxl-turbo)
    numImages = cmdOrParsedData.numImages; 
  } else {
    // Handle other commands (clear, help, etc.)
    const parts = cmdOrParsedData.trim().split(' ');
    command = parts[0].toLowerCase();
  }


  // --- BEGIN COMMON COMMAND LOGIC ---
  switch (command) {
    case '/clear': return clearChat();
    case '/theme': return toggleTheme();
    case '/help': return showHelp();
    case '/export': return exportChat();
    case '/contact': return showContact();
    case '/play': return playSummary();
    case '/about': return showAbout();
    case '/mode': return changeMode(cmdOrParsedData.trim().split(' ')[1]); // Special case for mode
    case '/time': return showTime();

    case '/image': {
      if (!prompt) {
        addMessage('⚠️ Usage: /image <prompt> [model name snippet] [n=1-4]', 'bot');
        return;
      }

      const modelNameForDisplay = IMAGE_MODELS.find(m => m.id === model)?.name || model.split('/').pop();
      addMessage(`🎨 Generating **${numImages}** image(s) with **${modelNameForDisplay}** for: *${prompt}* ...`, 'bot');

      try {
        const imageUrls = await generateImage(prompt, model, numImages);

        if (!imageUrls || imageUrls.length === 0) {
          addMessage('⚠️ No images were returned from the server.', 'bot');
          return;
        }

        const imageHTML = imageUrls.map((url, index) => {
            return `
<figure style="margin:5px 0;">
    <img src="${url}" alt="AI Image ${index + 1}" style="max-width:90%;border-radius:10px;margin-top:10px;display:block;margin-left:auto;margin-right:auto;" />
    <figcaption style="font-size:0.8em;text-align:center;">
        🔗 <a href="${url}" target="_blank">${modelNameForDisplay} Image ${index + 1}</a>
    </figcaption>
</figure>
            `;
        }).join('');

        const finalHTML = `
**🖼️ Generated Images:** "${prompt}"
${imageHTML}
        `;

        const container = document.createElement('div');
        container.className = 'message-container bot';

        const bubble = document.createElement('div');
        bubble.className = 'bubble bot';
        container.appendChild(bubble);

        const content = document.createElement('div');
        content.className = 'bubble-content';
        content.innerHTML = markdownToHTML(finalHTML);
        bubble.appendChild(content);

        chat.appendChild(container);
        chat.scrollTop = chat.scrollHeight;

        addBotActions(container, bubble, finalHTML);
      } catch (err) {
        addMessage(`⚠️ Image generation failed: ${err.message}`, 'bot');
      }
      return;
    }

    default: return addMessage(`❓ Unknown command: ${command}`, 'bot');
  }
}

// --- Chat Flow (UPDATED System Prompt AND Mode Logic) ---
async function getChatReply(msg) {
  const context = await buildContext();
  const mode = (modeSelect?.value || 'chat').toLowerCase();
  
  let model;
  let botName;

  switch (mode) {
    case 'math':
      model = "provider-1/qwen3-235b-a22b-instruct-2507";
      botName = "SteveAI-math";
      break;
    case 'korean':
      model = "provider-1/ax-4.0";
      botName = "SteveAI-Korean";
      break;
    case 'general': 
      model = "provider-3/glm-4.5-free"; 
      botName = "SteveAI-general";
      break;
    case 'coding':
      model = "provider-1/deepseek-v3-0324";
      botName = "SteveAI-coding";
      break;
    case 'arabic':
      model = "provider-1/allam-7b-instruct-preview";
      botName = "SteveAI-Arabic";
      break;
    case 'reasoning': 
      model = "provider-1/deepseek-r1-0528";
      botName = "SteveAI-reasoning";
      break;
    case 'fast': 
      model = "provider-2/gemini-2.5-flash"; 
      botName = "SteveAI-fast";
      break;
    case 'chat': 
    default:
      model = "provider-5/gpt-5-nano";
      botName = "SteveAI-chat";
      break;
  }
  
  // Get image model names for the prompt
  const imageModelNames = IMAGE_MODELS.map(m => m.name).join(', ');

  const systemPrompt = `You are ${botName}, made by saadpie. 
  
  1. **Reasoning:** You must always output your reasoning steps inside <think> tags, followed by the final answer, UNLESS an image is being generated.
  2. **Image Generation:** If the user asks you to *generate*, *create*, or *show* an image, you must reply with **ONLY** the following exact pattern. **DO NOT add any greetings, explanations, emojis, periods, newlines, or follow-up text whatsoever.** Your output must be the single, raw command string: 
     Image Generated:model:model name,prompt:prompt text
     Available image models: ${imageModelNames}. Use the most relevant model name in your response.
  
  The user has asked: ${msg}`;

  const payload = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `${context}\n\nUser: ${msg}` }
    ]
  };
  const data = await fetchAI(payload);
  const reply = data?.choices?.[0]?.message?.content || "No response.";
  memory[++turn] = { user: msg, bot: reply };
  return reply;
}

// --- Form Submit (Unchanged) ---
form.onsubmit = async e => {
  e.preventDefault();
  const msg = input.value.trim();
  if (!msg) return;
  if (msg.startsWith('/')) {
    await handleCommand(msg);
    input.value = '';
    input.style.height = 'auto';
    return;
  }
  addMessage(msg, 'user');
  input.value = '';
  input.style.height = 'auto';
  try {
    const r = await getChatReply(msg);
    addMessage(r, 'bot');
  } catch {
    addMessage('⚠️ Request failed. Check console.', 'bot');
  }
};

// --- Input Auto Resize (Unchanged) ---
input.oninput = () => {
  input.style.height = 'auto';
  input.style.height = input.scrollHeight + 'px';
};

// --- Theme Toggle (Unchanged) ---
themeToggle.onclick = () => toggleTheme();

// --- Clear Chat (Unchanged) ---
clearChatBtn.onclick = () => clearChat();
