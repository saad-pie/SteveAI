import config from './config.js'; 

// --- AVAILABLE MODELS ---
export const IMAGE_MODELS = [
    { id: "provider-4/sdxl-lite", name: "SDXL Lite (Fast)" },
    { id: "provider-4/flux-schnell", name: "Flux Schnell (Fast)" },
    { id: "provider-5/flux-fast", name: "Flux Fast" },
    { id: "provider-4/imagen-3.5", name: "Imagen 3.5" },
    { id: "provider-5/imagen-4-fast", name: "Imagen 4 Fast" },
    { id: "provider-4/imagen-4", name: "Imagen 4 (Original)" },
    { id: "provider-5/dall-e-2", name: "DALL-E 2" },
    { id: "provider-4/qwen-image", name: "Qwen Image" },
    { id: "provider-4/phoenix", name: "Phoenix" },
];

// 🌟 IMAGE GENERATION (HTTP FETCH)
// Now accepts numImages for the 'n' parameter in the API call
export async function generateImage(prompt, modelName = IMAGE_MODELS[5].id, numImages = 1) { 
  if (!prompt) throw new Error("No prompt provided");
  if (numImages < 1 || numImages > 4) throw new Error("Number of images must be between 1 and 4."); // API limits often exist

  try {
    const apiKey = config.API_KEYS[0]; 

    const response = await fetch("https://api.a4f.co/v1/images/generations", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: modelName, 
        prompt,
        n: numImages, // Use the provided numImages value
        size: "1024x1024" 
      })
    });

    const data = await response.json();
    
    console.log("API Response:", data);

    if (!response.ok) {
        const errorText = JSON.stringify(data);
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}. API Error: ${errorText}`);
    }

    // Expect an array of URLs now
    const imageUrls = data?.data?.map(item => item.url) || [];

    if (imageUrls.length === 0) {
        throw new Error("API response received, but no image URLs were found.");
    }
    
    return imageUrls; // Return an array of URLs

  } catch (err) {
    console.error("Image generation error:", err);
    throw err;
  }
}
