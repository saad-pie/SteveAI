// Pre-DAGI.js

// --- Imports: We need the config, fetch helper, and context builder from chat.js ---
// NOTE: These utility functions need to be exported from chat.js 
// or moved to a shared utils.js file to be imported here.
import config from './config.js'; 
import { buildContext, fetchAI } from './chat.js'; // Assumes you export these two functions from chat.js

// --- Model Definitions (Use the IDs from chat.js) ---
const MODELS = {
    FAST_ROUTER: "provider-2/gemini-2.5-flash", 
    CHAT_TONE: "provider-5/gpt-5-nano",
    REASONING_STRUCTURE: "provider-1/deepseek-r1-0528"
};

// --- Tree of Thoughts (ToT) System Prompt ---
// Forces the model to generate high-quality, structured output.
const TOT_SYSTEM_PROMPT = `
METHODOLOGY: TREE OF THOUGHTS (ToT) FOR SPECIALISTS
1. BRAINSTORM: Generate 3 distinct approaches/branches (e.g., plot ideas, character styles).
2. EVALUATE: Critically analyze the pros and cons of each branch in a <review> tag.
3. DECIDE: Select the single best approach.
4. OUTPUT: Provide ONLY the final selected content/structure of the best approach. 
`;

/**
 * Parses a model's thinking tags to find a specific action keyword.
 * @param {string} text - The model's raw output.
 * @returns {string | null} The action keyword, e.g., 'DELEGATE'.
 */
function parseAction(text) {
    // Aggressively finds the action outside the thinking tags
    const cleanOutput = text.replace(/<think>(.*?)<\/think>/s, '').trim();
    if (cleanOutput.startsWith("ACTION: ")) {
        return cleanOutput.substring("ACTION: ".length).trim();
    }
    return null;
}

/**
 * The new multi-agent orchestrator logic for content generation.
 * @param {string} msg - The user's message.
 * @param {string} currentMode - The user's current selected mode (from modeSelect).
 * @returns {Promise<string>} The final combined reply text.
 */
export async function getDagiReply(msg, currentMode) { // Renamed from getChatReply
    const context = await buildContext();
    const botName = "SteveAI-writer Orchestrator";

    // --- 1. PHASE: SteveAI-fast (The Router) - CoT ---
    
    // We display a status message to the user to explain the upcoming latency.
    addMessage(`🧠 ${botName} is analyzing intent (Mode: **${currentMode}**). Please expect a small delay if delegation is required.`, 'system-status');
    
    const routerSystemPrompt = `
        <role>You are SteveAI-fast, the orchestrator. You use Chain-of-Thought (CoT).</role>
        <task>
        Analyze the user request: "${msg}" considering the conversation context.
        
        Use <think> tags to reason step-by-step:
        1. Is the request a creative writing task (story, poetry, script, etc.) OR a simple, fast-answer question?
        2. If creative, set the action to DELEGATE. If simple, answer directly.
        
        If delegating: After the </think> tag, output exactly: "ACTION: DELEGATE"
        If answering directly: After the </think> tag, provide the final answer.
        </task>
    `;

    const routerPayload = {
        model: MODELS.FAST_ROUTER,
        messages: [
            { role: "system", content: routerSystemPrompt },
            { role: "user", content: `${context}\n\nUser: ${msg}` }
        ]
    };

    const routerData = await fetchAI(routerPayload);
    const routerReply = routerData?.choices?.[0]?.message?.content || "No response.";
    const action = parseAction(routerReply);
    
    // --- Parse Thinking (We skip the thinking part of the fast model if it delegates) ---
    const { thinking: routerThinking } = parseThinkingResponse(routerReply);
    
    if (action === 'DELEGATE') {
        
        // --- 2. PHASE: Parallel Specialists (ToT) ---
        addMessage(`📞 **Delegating:** Contacting SteveAI-reasoning & SteveAI-chat for parallel processing (ToT).`, 'system-status');
        
        const reasoningCall = fetchAI({
            model: MODELS.REASONING_STRUCTURE,
            messages: [
                { role: "system", content: TOT_SYSTEM_PROMPT + "\nFocus on: PLOT STRUCTURE, NARRATIVE LOGIC, and OUTLINE." },
                { role: "user", content: msg }
            ]
        });

        const chatCall = fetchAI({
            model: MODELS.CHAT_TONE,
            messages: [
                { role: "system", content: TOT_SYSTEM_PROMPT + "\nFocus on: TONE, VOICE, and CHARACTER DIALOGUE style." },
                { role: "user", content: msg }
            ]
        });

        const [resReasoning, resChat] = await Promise.all([reasoningCall, chatCall]);

        const bestStructure = resReasoning?.choices?.[0]?.message?.content || "Structure input missing.";
        const bestTone = resChat?.choices?.[0]?.message?.content || "Tone input missing.";
        
        // --- 3. PHASE: Synthesis (Final Combination) ---
        addMessage(`🔗 **Synthesizing:** Combining structure and tone into the ultimate draft...`, 'system-status');
        
        const synthesisSystemPrompt = `
            You are the Master Writer for SteveAI. Combine the Expert Structure and Expert Tone inputs to write the final high-quality piece for the user.
            
            EXPERT STRUCTURE: ${bestStructure}
            EXPERT TONE: ${bestTone}
            
            Your final answer must be a single, polished output.
        `;
        
        const synthesisPayload = {
            model: MODELS.FAST_ROUTER, // Use fast model for final quick merge
            messages: [
                { role: "system", content: synthesisSystemPrompt },
                { role: "user", content: `User's original request: ${msg}` }
            ]
        };
        
        const finalData = await fetchAI(synthesisPayload);
        const finalReply = finalData?.choices?.[0]?.message?.content || "Synthesis failed.";
        
        // --- Final Output Composition ---
        // We include the router's thinking in the final response for the user to see the process.
        const fullFinalText = `
<think>
[SteveAI Orchestration Log]
1. Router (Fast/CoT) Decision: Creative task detected. Delegation required.
2. Specialist 1 (Reasoning/ToT): Generated Structure.
3. Specialist 2 (Chat/ToT): Generated Tone/Voice.
4. Finalizer (Fast): Combined inputs for ultimate idea.

Router Thinking: ${routerThinking}
</think>
${finalReply}
        `;
        return fullFinalText;

    } else {
        // --- SIMPLE PATH: Fast Router answered directly ---
        return routerReply;
    }
}
