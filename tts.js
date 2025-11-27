// tts.js

// **Crucial Security Note:** The Gemini API Key must NOT be exposed here. 
// It MUST be used only on your secure backend orchestrator (e.g., Netlify Function).

// The endpoint for your *backend* proxy on the SteveAI server
const BACKEND_TTS_ENDPOINT = "https://steve-ai.netlify.app/.netlify/functions/tts-proxy"; 
const MODEL_ID = "gemini-2.5-flash-preview-tts"; 

// Voice options based on common BCP-47 codes supported by Gemini-TTS
// This should ideally be loaded dynamically or fetched from a cache
const VOICE_OPTIONS = {
    'en-US': [
        { value: 'Kore', name: 'Kore (Neutral US, F)' },
        { value: 'Fenrir', name: 'Fenrir (Excitable US, M)' },
        { value: 'Leda', name: 'Leda (Youthful US, F)' }
    ],
    'en-GB': [
        { value: 'Achernar', name: 'Achernar (Soft UK, M)' },
        { value: 'Achird', name: 'Achird (Friendly UK, M)' }
    ],
    'fr-FR': [
        { value: 'Aoede', name: 'Aoede (Breezy French, F)' }
    ],
    // Add more voice options as needed for other languages
};

/**
 * Updates the voice dropdown based on the selected language.
 */
function updateVoiceOptions() {
    const language = document.getElementById('language').value;
    const voiceSelect = document.getElementById('voice');
    
    // Clear existing options
    voiceSelect.innerHTML = ''; 

    const voices = VOICE_OPTIONS[language] || [];
    
    if (voices.length === 0) {
         voiceSelect.innerHTML = '<option value="default-voice">Default Voice (No Specific Voice Selected)</option>';
    } else {
        voices.forEach(voice => {
            const option = document.createElement('option');
            option.value = voice.value;
            option.textContent = voice.name;
            voiceSelect.appendChild(option);
        });
    }
}

// Attach event listener to update voices when language changes
document.getElementById('language').addEventListener('change', updateVoiceOptions);

// Initialize voices on load
document.addEventListener('DOMContentLoaded', updateVoiceOptions);


document.getElementById('ttsForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = document.getElementById('inputText').value;
    const language = document.getElementById('language').value;
    const voice = document.getElementById('voice').value;
    const emotion = document.getElementById('emotion').value;
    const statusMessage = document.getElementById('statusMessage');
    const audioPlayer = document.getElementById('audioPlayer');
    
    // Reset output
    audioPlayer.style.display = 'none';
    audioPlayer.src = '';
    statusMessage.textContent = 'Generating audio via SteveAI Orchestrator...';

    // 1. Construct the text prompt, integrating the emotional style for Gemini's processing
    // Note: The prompt uses natural language to guide the tone/style, leveraging Gemini's capability.
    const fullPrompt = emotion 
        ? `In a ${emotion} voice, say: "${text}"`
        : text;

    // 2. Prepare the request data for your backend
    const requestData = {
        prompt: fullPrompt,
        language: language,
        voice: voice,
        model: MODEL_ID,
    };

    try {
        // 3. Send the request to your secure backend endpoint
        const response = await fetch(BACKEND_TTS_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            // Read error message from the backend response body
            const errorText = await response.text();
            throw new Error(`Server responded with status ${response.status}: ${errorText}`);
        }

        // 4. The backend should return the audio as a playable format (e.g., a WAV file blob)
        const audioBlob = await response.blob(); 
        
        // 5. Create a URL for the audio and set the player source
        const audioUrl = URL.createObjectURL(audioBlob);
        
        audioPlayer.src = audioUrl;
        audioPlayer.style.display = 'block'; 
        audioPlayer.play();
        
        statusMessage.textContent = '✅ Audio generated successfully! Playing now...';

    } catch (error) {
        console.error('TTS Generation Error:', error);
        statusMessage.textContent = `❌ Error generating speech. Details: ${error.message}`;
    }
});
