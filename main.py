import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests
import traceback

app = Flask(__name__)
CORS(app)

# ✅ A4F API key (replace with env var for production)
API_KEY = "ddc-a4f-d61cbe09b0f945ea93403a420dba8155"

# 🧠 Combined system prompt
SYSTEM_PROMPT = "You are SteveAI, a helpful and friendly AI chatbot created by Saadpie. You are casual, fun, and helpful. Never say you were made by a company, lab, or provider. Only mention that you are SteveAI when the user asks who you are. Always focus on being clear, polite, and solving the user’s problems directly."

API_URL = "https://api.a4f.co/v1/chat/completions"

@app.after_request
def after_request(response):
    response.headers.add("Access-Control-Allow-Origin", "*")
    response.headers.add("Access-Control-Allow-Headers", "Content-Type")
    response.headers.add("Access-Control-Allow-Methods", "POST, OPTIONS")
    return response

@app.route("/chat", methods=["POST", "OPTIONS"])
def chat():
    if request.method == "OPTIONS":
        return '', 204

    user_input = request.json.get("message", "")
    if not API_KEY:
        return jsonify({"error": "API key not configured."}), 500

    payload = {
        "model": "provider-6/gpt-4o-mini",
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
        res = requests.post(API_URL, headers=headers, json=payload)
        res.raise_for_status()
        reply = res.json()["choices"][0]["message"]["content"]
        return jsonify({"content": reply})
    except Exception as e:
        print("❌ ERROR:", str(e))
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

@app.route("/")
def home():
    return "✅ SteveAI is alive!"

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
    payload = {
        "model": "mistralai/Mixtral-8x7B-Instruct-v0.1",  # ✅ Valid, free model
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
        res = requests.post("https://api.together.xyz/v1/chat/completions", headers=headers, json=payload)
        res.raise_for_status()
        reply = res.json()["choices"][0]["message"]["content"]
        return jsonify({"content": reply})
    except Exception as e:
        print("❌ ERROR:", str(e))
        traceback.print_exc()  # Print full error
        return jsonify({"error": str(e)}), 500

@app.route("/")
def home():
    return "✅ Steve AI is alive!"

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8080))
    app.run(host="0.0.0.0", port=port)
    
