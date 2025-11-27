// tts.js

// **IMPORTANT SECURITY NOTE:**
// The API key should ideally be used on a secure backend server (e.g., your Multi-Modal Orchestrator)
// to prevent exposing it in the client-side JavaScript. This example is conceptual.
const API_KEY = "AIzaSyCjZE22ItiznexzYSjGHtO1C17Pg11y_So"; 
const API_ENDPOINT = "YOUR_ORCHESTRATOR_BACKEND_ENDPOINT/tts"; // Recommended: Route through a server
const MODEL_ID = "gemini-2.5-flash-preview-tts"; 

document.getElementById('ttsForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const text = document.getElementById('inputText').value;
    const language = document.getElementById('language').value;
    const voice = document.getElementById('voice').value;
    const emotion = document.getElementById('emotion').value;
    const statusMessage = document.getElementById('statusMessage');
    
    statusMessage.textContent = 'Generating audio... Please wait.';

    // Construct the text prompt, integrating the emotional style
    const fullPrompt = emotion 
        ? `In a ${emotion} voice, say: "${text}"`
        : text;

    // This data structure represents the request to your backend orchestrator.
    // The orchestrator will then format the actual Gemini API call.
    const requestData = {
        prompt: fullPrompt,
        language: language,
        voice: voice,
        model: MODEL_ID,
        // The orchestrator should use the API_KEY securely
    };

    try {
        // Step 1: Send the request to your *backend orchestrator* (where the key is secure)
        const response = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                // For a client-side test (less secure), you might pass the key,
                // but for production, your orchestrator handles auth.
                // 'Authorization': `Bearer ${API_KEY}` 
            },
            body: JSON.stringify(requestData)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Step 2: Receive the audio data (e.g., as a Base64 string or binary blob)
        const audioBlob = await response.blob(); 
        
        // Step 3: Create a URL for the audio and set the player source
        const audioUrl = URL.createObjectURL(audioBlob);
        const audioPlayer = document.getElementById('audioPlayer');
        audioPlayer.src = audioUrl;
        audioPlayer.style.display = 'block'; // Show the player
        audioPlayer.play();
        
        statusMessage.textContent = 'Audio generated successfully!';

    } catch (error) {
        console.error('TTS Generation Error:', error);
        statusMessage.textContent = `Error generating speech: ${error.message}. Check the console for details.`;
    }
});

// A function to update voice options based on the selected language could be added here
// For simplicity, we are using a fixed "default-voice" for now.
      
