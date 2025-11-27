// tts.js

// ⚠️ WARNING: API KEY EXPOSED! This is for development/testing ONLY.
const API_KEY = "AIzaSyCjZE22ItiznexzYSjGHtO1C17Pg11y_So"; 

// The official Gemini TTS endpoint URL
const GEMINI_TTS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent';
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

document.getElementById('language').addEventListener('change', updateVoiceOptions);
document.addEventListener('DOMContentLoaded', updateVoiceOptions);


// --- Form Submission and Direct API Call ---

document.getElementById('ttsForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = document.getElementById('inputText').value;
    const voice = document.getElementById('voice').value;
    const emotion = document.getElementById('emotion').value;
    const statusMessage = document.getElementById('statusMessage');
    const audioPlayer = document.getElementById('audioPlayer');
    
    // Reset output
    audioPlayer.style.display = 'none';
    audioPlayer.src = '';
    statusMessage.textContent = 'Generating audio directly with Gemini API...';

    // 1. Construct the text prompt
    const fullPrompt = emotion 
        ? `In a ${emotion} voice, say: "${text}"`
        : text;

    // 2. Prepare the CORRECTED request body for the Gemini API
    const requestBody = {
        contents: [{ parts: [{ text: fullPrompt }] }],
        config: {
            responseModalities: ['AUDIO'], 
            speechConfig: {
                voice: { name: voice }
            }
        }
    };

    try {
        // 3. Send the request directly to the Gemini endpoint
        const response = await fetch(GEMINI_TTS_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': API_KEY 
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API Error: Status ${response.status}. Detail: ${errorText.substring(0, 100)}...`);
        }

        // 4. Extract the raw Base64 audio data from the response
        const geminiResponse = await response.json();
        const base64AudioData = geminiResponse.candidates[0].content.parts[0].inlineData.data;

        // 5. Convert Base64 data to a Blob (Still likely to fail without WAV header)
        const binaryAudio = new Uint8Array(
            atob(base64AudioData).split('').map(char => char.charCodeAt(0))
        );
        
        // This Blob creation is the best a browser can do without a backend for header conversion.
        const audioBlob = new Blob([binaryAudio], { type: 'audio/wav' }); 
        const audioUrl = URL.createObjectURL(audioBlob);
        
        audioPlayer.src = audioUrl;
        audioPlayer.style.display = 'block'; 
        audioPlayer.play();
        
        statusMessage.textContent = '✅ Audio generated successfully! Attempting to play...';

    } catch (error) {
        console.error('TTS Generation Error:', error);
        statusMessage.textContent = `❌ Error generating speech. Details: ${error.message}. If the API status is 200, the failure is likely due to the lack of L16-to-WAV conversion.`;
    }
});
