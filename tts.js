// tts.js

// **Crucial Security Note:** The Gemini API Key (AIzaSyCjZE22ItiznexzYSjGHtO1C17Pg11y_So) 
// is NOT used here. It MUST be used only on your secure backend orchestrator (e.g., Netlify Function).

// The endpoint for your *backend* proxy on the SteveAI server
const BACKEND_TTS_ENDPOINT = "https://steve-ai.netlify.app/.netlify/functions/tts-proxy"; 
const MODEL_ID = "gemini-2.5-flash-preview-tts"; 

// Voice options based on common BCP-47 codes supported by Gemini-TTS
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
    // Add more voice options as needed for other languages
};

// --- Parameter Handling ---

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


// --- Form Submission Logic ---

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

    // Construct the text prompt, integrating the emotional style for Gemini's processing
    const fullPrompt = emotion 
        ? `In a ${emotion} voice, say: "${text}"`
        : text;

    // Prepare the request data for your backend
    const requestData = {
        prompt: fullPrompt,
        language: language,
        voice: voice,
        model: MODEL_ID,
    };

    try {
        // Send the request to your secure backend endpoint
        const response = await fetch(BACKEND_TTS_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            let errorMessage = `Server responded with status ${response.status}.`;
            // Check if the server provided a body with more details
            try {
                const errorText = await response.text();
                // Check for 404 specifically, as this is the most common issue
                if (response.status === 404) {
                    errorMessage = `❌ Server Endpoint Not Found (404). Please ensure 'tts-proxy.js' is correctly deployed in the '.netlify/functions/' directory.`;
                } else {
                    errorMessage += ` Server Detail: ${errorText}`;
                }
            } catch (err) {
                // Ignore if reading the error text fails
            }
            throw new Error(errorMessage);
        }

        // The backend should return the audio as a playable format (e.g., a WAV file blob)
        const audioBlob = await response.blob(); 
        
        // Create a URL for the audio and set the player source
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
            
