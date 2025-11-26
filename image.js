import config from './config.js'; 

// --- AVAILABLE IMAGE GENERATION MODELS ---
export const IMAGE_MODELS = [
    // ------------------------------------------
    // 🌟 Provider 4 & 5 (Official/Proprietary Models)
    // ------------------------------------------
    // Flux Models (Fast, newer architecture)
    { id: "provider-4/flux-schnell", name: "Flux Schnell (Fast)" },
    { id: "provider-5/flux-fast", name: "Flux Fast" },
    // Imagen Models
    { id: "provider-4/imagen-3.5", name: "Imagen 3.5" },
    { id: "provider-4/imagen-4", name: "Imagen 4 (Original)" },
    { id: "provider-5/imagen-4-fast", name: "Imagen 4 Fast" },
    // Other Proprietary Models
    { id: "provider-5/dall-e-2", name: "DALL-E 2" },
    { id: "provider-4/qwen-image", name: "Qwen Image" },
    { id: "provider-4/phoenix", name: "Phoenix" },
    { id: "provider-4/sdxl-lite", name: "SDXL Lite (Fast)" },
    
    // ------------------------------------------
    // 🛠️ Provider 2 (Top Community Stable Diffusion Models)
    // ------------------------------------------
    // Photorealism / Hyper-Realism
    { id: "provider-2/realvis-xl", name: "RealVis XL (Photorealism)" },
    { id: "provider-2/fluently-xl", name: "Fluently XL (Balanced Realism)" },
    { id: "provider-2/realism-by-stable-yogi", name: "Realism by Stable Yogi (Hyperrealism)" },
    { id: "provider-2/juggernaut-x-hyper", name: "Juggernaut X Hyper (Fast Photorealism)" },
    { id: "provider-2/sdxxxl", name: "SDXXXL (Hyper-Detailed XL)" },
    { id: "provider-2/dreamlike-photoreal-2.0", name: "Dreamlike Photoreal 2.0 (SD 1.5 Photorealism)" },

    // Anime / Illustration
    { id: "provider-2/animagine-xl-2.0", name: "Animagine XL 2.0 (Anime HQ)" },
    { id: "provider-2/animagine-xl", name: "Animagine XL (Anime Base)" },
    { id: "provider-2/kivotos-xl", name: "Kivotos XL (Blue Archive Style)" },
    
    // Versatile / Speed / Specialized
    { id: "provider-2/dreamshaper", name: "Dreamshaper (Versatile Art/Realism)" },
    { id: "provider-2/playground-v2.5", name: "Playground V2.5 (Aesthetic HQ)" },
    { id: "provider-2/realism-illustrious", name: "Realism Illustrious (SD 1.5 Illustration)" },
    { id: "provider-2/sdxl-flash", name: "SDXL Flash (Speed Optimized)" },
    { id: "provider-2/opencole-sdxl", name: "Opencole SDXL (Graphic Design Focus)" },
];

// 🌟 IMAGE GENERATION (HTTP FETCH)
// Now accepts numImages for the 'n' parameter in the API call
export async function generateImage(prompt, modelName = IMAGE_MODELS[0].id, numImages = 1) { 
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
