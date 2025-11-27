// tts.js

// ⚠️ WARNING: API KEY EXPOSED! This is for development/testing ONLY.
const API_KEY = "AIzaSyCjZE22ItiznexzYSjGHtO1C17Pg11y_So"; 
const GEMINI_TTS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent';

// --- Global Constants ---
const SAMPLE_RATE = 24000; // Gemini TTS output sample rate is 24kHz
const NUM_CHANNELS = 1;     // TTS output is typically mono
const BIT_DEPTH = 16;       // Gemini L16 is 16-bit PCM

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

// --- WAV Header Writer Utility ---
/**
 * Writes the WAV file header to the beginning of the L16 raw audio data.
 * @param {ArrayBuffer} rawPcmData - The raw 16-bit PCM audio data.
 * @param {number} sampleRate - The sample rate (24000 Hz for Gemini TTS).
 * @returns {Blob} A Blob object containing a playable WAV file.
 */
function createWavBlob(rawPcmData, sampleRate) {
    const dataView = new DataView(new ArrayBuffer(44)); // 44 bytes for the header
    const dataSize = rawPcmData.byteLength;
    const byteRate = NUM_CHANNELS * sampleRate * (BIT_DEPTH / 8);
    const blockAlign = NUM_CHANNELS * (BIT_DEPTH / 8);

    // Write RIFF chunk
    dataView.setUint32(0, 0x52494646, false); // "RIFF"
    dataView.setUint32(4, 36 + dataSize, true); // ChunkSize (File size - 8)
    dataView.setUint32(8, 0x57415645, false); // "WAVE"

    // Write FMT sub-chunk
    dataView.setUint32(12, 0x666d7420, false); // "fmt "
    dataView.setUint32(16, 16, true); // Sub-chunk 1 size (16 for PCM)
    dataView.setUint16(20, 1, true); // AudioFormat (1 for Linear PCM)
    dataView.setUint16(22, NUM_CHANNELS, true); // NumChannels (1 or 2)
    dataView.setUint32(24, sampleRate, true); // SampleRate
    dataView.setUint32(28, byteRate, true); // ByteRate
    dataView.setUint16(32, blockAlign, true); // BlockAlign
    dataView.setUint16(34, BIT_DEPTH, true); // BitsPerSample

    // Write DATA sub-chunk
    dataView.setUint32(36, 0x64617461, false); // "data"
    dataView.setUint32(40, dataSize, true); // Sub-chunk 2 size (Audio Data Size)

    // Combine header and raw data into a single Blob
    return new Blob([dataView, rawPcmData], { type: 'audio/wav' });
}
// --- End WAV Header Writer Utility ---


document.getElementById('ttsForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = document.getElementById('inputText').value;
    const voice = document.getElementById('voice').value;
    const emotion = document.getElementById('emotion').value;
    const statusMessage = document.getElementById('statusMessage');
    const audioPlayer = document.getElementById('audioPlayer');
    
    audioPlayer.style.display = 'none';
    audioPlayer.src = '';
    statusMessage.textContent = 'Generating audio directly with Gemini API...';

    const fullPrompt = emotion 
        ? `In a ${emotion} voice, say: "${text}"`
        : text;

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

        // 4. Extract the raw Base64 audio data
        const geminiResponse = await response.json();
        const base64AudioData = geminiResponse.candidates[0].content.parts[0].inlineData.data;

        // Convert Base64 string to an ArrayBuffer of raw PCM data
        const rawPcmArrayBuffer = new Uint8Array(
            atob(base64AudioData).split('').map(char => char.charCodeAt(0))
        ).buffer;
        
        // 5. CRITICAL STEP: Create a playable WAV Blob using the header writer utility
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
