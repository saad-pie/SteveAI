from flask import Flask, request, jsonify
from flask_cors import CORS
from llama_cpp import Llama
from pyngrok import ngrok

app = Flask(__name__)

# ✅ Allow cross-origin requests from any origin
CORS(app, origins="*", supports_credentials=True)

llm = Llama(model_path="/content/drive/MyDrive/llama-2-7b-chat.Q4_K_M.gguf", n_ctx=4096)

@app.route("/ask", methods=["POST", "OPTIONS"])
def ask():
    # Handle preflight request
    if request.method == "OPTIONS":
        return '', 200

    data = request.get_json()
    prompt = data.get("prompt", "").strip()
    if not prompt:
        return jsonify({"error": "Empty prompt"}), 400
    output = llm(f"[INST] {prompt} [/INST]", max_tokens=256, stop=["</s>"], echo=False)
    return jsonify({"response": output["choices"][0]["text"].strip()})

# Start ngrok tunnel
public_url = ngrok.connect("http://172.28.0.12:5000")
print("🔗 Public Steve AI URL:", public_url)

# Run Flask
app.run(host="0.0.0.0", port=5000)
