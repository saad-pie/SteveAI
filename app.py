from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)  # Allow all origins by default

API_KEY = "50f0de0bfbec26145ca5164f1ddf9104710a976d8e96bb4da1f398ead044986c"

# 🧠 Custom system prompt
SYSTEM_PROMPT = (
    "You are Steve, a friendly AI chatbot created by Saadpie. "
    "You were not made by any company or lab — just Saadpie. "
    "Never say you are from Mistral AI. "
    "Be casual, helpful, and fun. If anyone asks who made you, always answer 'Saadpie'."
)

@app.after_request
def after_request(response):
    # CORS headers for browser
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
    return response

@app.route("/chat", methods=["POST", "OPTIONS"])
def chat():
    if request.method == "OPTIONS":
        # Handle CORS preflight
        return '', 204

    user_input = request.json.get("message")

    payload = {
        "model": "mistralai/Mixtral-8x7B-Instruct-v0.1",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_input}
        ]
    }

    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json"
    }

    try:
        response = requests.post("https://api.together.xyz/v1/chat/completions", headers=headers, json=payload)
        result = response.json()
        reply = result["choices"][0]["message"]["content"]
        return jsonify({ "content": reply })
    except Exception as e:
        return jsonify({ "error": str(e) }), 500

@app.route("/")
def home():
    return "✅ Steve AI is alive!"

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8080)
