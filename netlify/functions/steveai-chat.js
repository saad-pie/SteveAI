// netlify/functions/steveai-chat.js
import fetch from 'node-fetch';

const API_BASE = "https://api.a4f.co/v1/chat/completions";
const API_KEYS = [
  process.env.A4F_KEY_1,
  process.env.A4F_KEY_2
];

export async function handler(event) {
  try {
    if (event.httpMethod !== 'POST') {
      return { statusCode: 405, body: "Method Not Allowed" };
    }

    const body = JSON.parse(event.body);
    const payload = {
      model: body.model,
      messages: body.messages,
      temperature: body.temperature || 0.7,
      max_tokens: body.max_tokens || 800,
      stream: false
    };

    let lastErr = '';
    for (const key of API_KEYS) {
      try {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (res.ok) {
          const data = await res.json();
          return { statusCode: 200, body: JSON.stringify(data) };
        }
        lastErr = await res.text();
      } catch (e) {
        lastErr = e.message;
      }
    }

    return { statusCode: 500, body: JSON.stringify({ error: lastErr || "API unreachable" }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
}
