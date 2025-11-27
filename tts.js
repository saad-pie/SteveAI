// tts.js

// **Crucial Security Note:** // The actual Gemini API Key (AIzaSyCjZE22ItiznexzYSjGHtO1C17Pg11y_So) 
// is NOT used here. It MUST be used only on your secure backend orchestrator.

// The endpoint for your *backend* proxy on the SteveAI server
const BACKEND_TTS_ENDPOINT = "https://steve-ai.netlify.app/.netlify/functions/tts-proxy"; 
// You will need to create this serverless function (e.g., in Node.js or Python)

// The model ID is passed as a parameter to the backend
const MODEL_ID = "gemini-2.5-flash-preview-tts"; 

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
    const fullPrompt = emotion 
        ? `In a ${emotion} voice, say: "${text}"`
        : text;

    // 2. Prepare the request data for your backend
    const requestData = {
        prompt: fullPrompt,
        language: language,
        voice: voice,
        model: MODEL_ID,
        // The backend uses the API Key to call the official Gemini URL
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
             // Attempt to read error message from the backend response body
            const errorText = await response.text();
            throw new Error(`Server responded with status ${response.status}: ${errorText}`);
        }

        // 4. The backend should return the audio as a playable format (e.g., a WAV file blob)
        // If your backend converts the L16 data to WAV, this will work seamlessly.
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

// A small utility to populate the voice list based on language (for future use)
document.getElementById('language').addEventListener('change', (e) => {
    const voiceSelect = document.getElementById('voice');
    // Clear existing options
    voiceSelect.innerHTML = ''; 

    // **TODO:** In a production app, you would dynamically fetch the supported voices 
    // for the selected language from a lookup table or a dedicated API call.
    // For now, just add a generic option.
    voiceSelect.innerHTML = '<option value="default-voice">Default Voice (Dynamic)</option>';
    
    // Example for a specific language set (Conceptual)
    if (e.target.value === 'en-US') {
        voiceSelect.innerHTML += '<option value="Kore">Kore (Neutral US)</option>';
    }
});
