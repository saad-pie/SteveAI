// netlify/functions/steveai-image.js
import fetch from 'node-fetch';

const IMAGE_ENDPOINT = "https://api.a4f.co/v1/images/generations";
const API_KEYS = [
  process.env.A4F_KEY_1,
  process.env.A4F_KEY_2
];

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const { prompt } = JSON.parse(event.body);
    if (!prompt) return { statusCode: 400, body: JSON.stringify({ error: "No prompt provided" }) };

    let lastErr = '';
    for (const key of API_KEYS) {
      try {
        const res = await fetch(IMAGE_ENDPOINT, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ model:"provider-4/imagen-4", prompt, n:1, size:"1024x1024" })
        });
        if (res.ok) {
          const data = await res.json();
          const url = data?.data?.[0]?.url || null;
          return { statusCode: 200, body: JSON.stringify({ url }) };
        }
        lastErr = await res.text();
      } catch (e) {
        lastErr = e.message;
      }
    }

    return { statusCode: 500, body: JSON.stringify({ error: lastErr || "Image API unreachable" }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
