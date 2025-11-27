// tts.js
// Final troubleshooting attempt for Status 400 JSON error.

// ⚠️ WARNING: API KEY EXPOSED! This is for development/testing ONLY.
const API_KEY = "AIzaSyCjZE22ItiznexzYSjGHtO1C17Pg11y_So"; 
const GEMINI_TTS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent';

// --- Global Constants ---
const SAMPLE_RATE = 24000; 
const NUM_CHANNELS = 1;    
const BIT_DEPTH = 16;      

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

function updateVoiceOptions() {
    const language = document.getElementById('language').value;
    const voiceSelect = document.getElementById('voice');
    voiceSelect.innerHTML = ''; 
    const voices = VOICE_OPTIONS[language] || [];
    
    voices.forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.value;
        option.textContent = voice.name;
        voiceSelect.appendChild(option);
    });
}

document.getElementById('language').addEventListener('change', updateVoiceOptions);
document.addEventListener('DOMContentLoaded', updateVoiceOptions);

// --- WAV Header Writer Utility (Remains the same) ---
function createWavBlob(rawPcmData, sampleRate) {
    // ... [WAV Header creation logic remains the same as previous turn] ...
    const dataView = new DataView(new ArrayBuffer(44)); 
    const dataSize = rawPcmData.byteLength;
    const byteRate = NUM_CHANNELS * sampleRate * (BIT_DEPTH / 8);
    const blockAlign = NUM_CHANNELS * (BIT_DEPTH / 8);

    dataView.setUint32(0, 0x52494646, false); 
    dataView.setUint32(4, 36 + dataSize, true); 
    dataView.setUint32(8, 0x57415645, false); 

    dataView.setUint32(12, 0x666d7420, false); 
    dataView.setUint32(16, 16, true); 
    dataView.setUint16(20, 1, true); 
    dataView.setUint16(22, NUM_CHANNELS, true); 
    dataView.setUint32(24, sampleRate, true); 
    dataView.setUint32(28, byteRate, true); 
    dataView.setUint16(32, blockAlign, true); 
    dataView.setUint16(34, BIT_DEPTH, true); 

    dataView.setUint32(36, 0x64617461, false); 
    dataView.setUint32(40, dataSize, true); 

    return new Blob([dataView, rawPcmData], { type: 'audio/wav' });
}
// --- End WAV Header Writer Utility ---


document.getElementById('ttsForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = document.getElementById('inputText').value;
    const voice = document.getElementById('voice').value;
    const emotion = document.getElementById('emotion').value;
    const language = document.getElementById('language').value; // Get language code
    const statusMessage = document.getElementById('statusMessage');
    const audioPlayer = document.getElementById('audioPlayer');
    
    audioPlayer.style.display = 'none';
    audioPlayer.src = '';
    statusMessage.textContent = 'Generating audio directly with Gemini API...';

    const fullPrompt = emotion 
        ? `In a ${emotion} voice, say: "${text}"`
        : text;

    // 2. Prepare the request body: Using the documented structure, but ensuring
    // language is available in case the voice requires it for validation.
    const requestBody = {
        contents: [{ parts: [{ text: fullPrompt }] }],
        config: {
            responseModalities: ['AUDIO'], 
            speechConfig: {
                languageCode: language, // Explicitly adding languageCode
                voice: { name: voice }
            }
        }
    };

    try {
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

        const geminiResponse = await response.json();
        const base64AudioData = geminiResponse.candidates[0].content.parts[0].inlineData.data;

        const rawPcmArrayBuffer = new Uint8Array(
            atob(base64AudioData).split('').map(char => char.charCodeAt(0))
        ).buffer;
        
        const audioBlob = createWavBlob(rawPcmArrayBuffer, SAMPLE_RATE);
        const audioUrl = URL.createObjectURL(audioBlob);
        
        audioPlayer.src = audioUrl;
        audioPlayer.style.display = 'block'; 
        audioPlayer.play();
        
        statusMessage.textContent = '✅ Audio generated and WAV header successfully added! Playing now...';

    } catch (error) {
        console.error('TTS Generation Error:', error);
        statusMessage.textContent = `❌ Error generating speech. Details: ${error.message}.`;
    }
});
                 
