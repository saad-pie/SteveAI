// live.js

// 🛑 SECURITY UPDATE: API Key is REMOVED from the client and must be handled by the serverless proxy.
const PROXY_ENDPOINT = "/.netlify/functions/gemini-audio-proxy"; 
const MODEL_ID = "models/gemini-2.5-flash-native-audio-preview-09-2025";

// UI Elements
const chatContainer = document.getElementById('chat-container');
const recordBtn = document.getElementById('record-btn');
const stopBtn = document.getElementById('stop-btn');
const statusDiv = document.getElementById('status');

// Audio variables
let mediaRecorder;
let audioChunks = [];
let audioContext;
let audioSource;

// Parameters (as requested: closable voice)
const customParams = {
    voice: "closable",
    session: "closable" 
};

/**
 * Appends a message to the chat UI.
 * @param {string} text - The content of the message.
 * @param {string} sender - 'user' or 'ai'.
 */
function addMessage(text, sender) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    messageDiv.textContent = text;
    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Updates the recording status and controls state.
 * @param {string} message - Status message to display.
 * @param {boolean} isRecording - Whether the recording is active.
 */
function setStatus(message, isRecording = false) {
    statusDiv.textContent = message;
    recordBtn.disabled = isRecording;
    stopBtn.disabled = !isRecording;
    
    if (isRecording) {
        recordBtn.classList.add('recording');
        recordBtn.textContent = '🔴 Recording...';
    } else {
        recordBtn.classList.remove('recording');
        recordBtn.textContent = '🎤 Start Recording';
    }
}

// --- Audio Recording Functions ---

async function startRecording() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Use a high-quality, widely supported format if possible, or stick to webm
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' }); 
        audioChunks = [];

        mediaRecorder.ondataavailable = event => {
            audioChunks.push(event.data);
        };

        mediaRecorder.onstop = uploadAudio;

        mediaRecorder.start();
        setStatus('Recording...', true);
    } catch (err) {
        console.error('Error accessing microphone:', err);
        setStatus('Error: Microphone access denied.', false);
    }
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
        setStatus('Processing...', false);
    }
}

// --- API Interaction (Now points to Proxy) ---

async function uploadAudio() {
    const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
    
    const reader = new FileReader();
    reader.readAsArrayBuffer(audioBlob);
    
    reader.onloadend = async () => {
        const arrayBuffer = reader.result;
        // Base64 encode the audio data
        const base64Audio = btoa(
            new Uint8Array(arrayBuffer)
                .reduce((data, byte) => data + String.fromCharCode(byte), '')
        );

        // 4. Construct the Payload for the PROXY
        const payload = {
            // Send the necessary data to the proxy function
            model: MODEL_ID, 
            audioData: base64Audio,
            mimeType: audioBlob.type,
            config: { custom_params: customParams } 
        };

        try {
            setStatus('Sending audio to Proxy...');
            // Call the Netlify Serverless Function endpoint
            const response = await fetch(PROXY_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Proxy Error: ${response.status} - ${errorText}`);
            }

            const data = await response.json();
            handleGeminiResponse(data);

        } catch (error) {
            console.error('Proxy request failed:', error);
            setStatus(`API Failed: ${error.message}`, false);
            addMessage('Sorry, I encountered an error.', 'ai');
        }
    };
}

// --- Response Handling ---

/**
 * Handles the response from the Gemini API, displaying the text and playing the audio.
 * The proxy should ensure the response format is clean.
 * @param {object} data - The JSON response from the proxy/API.
 */
function handleGeminiResponse(data) {
    setStatus('Receiving response...', false);
    
    // Assuming the proxy returns a simplified object with text and audio data
    const text = data.text || "No text response.";
    addMessage(text, 'ai');

    const audioPart = data.audio; // Proxy should package the audio part here
    if (audioPart && audioPart.mimeType.startsWith('audio/') && audioPart.data) {
        playAudio(audioPart.data, audioPart.mimeType);
    }
    
    // If we only received text or had an error but no audio, set status back to ready
    if (!audioPart) {
        setStatus('Ready', false);
    }
}

/**
 * Decodes and plays the audio data received from the proxy.
 * @param {string} base64Data - Base64 encoded audio data.
 * @param {string} mimeType - The MIME type of the audio.
 */
function playAudio(base64Data, mimeType) {
    try {
        const audioBlob = new Blob([Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))], { type: mimeType });
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        
        audio.onplaying = () => setStatus('AI Speaking...');
        audio.onended = () => setStatus('Ready');

        audio.play().catch(e => console.error("Error playing audio:", e));
    } catch (e) {
        console.error("Audio playback failure:", e);
        setStatus('Ready');
    }
}

// --- Event Listeners ---

recordBtn.addEventListener('click', startRecording);
stopBtn.addEventListener('click', stopRecording);

// Initial message
addMessage("Press 'Start Recording' and talk to SteveAI! (Proxy Enabled)", 'ai');
    
