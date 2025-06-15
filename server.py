from flask import Flask, request, jsonify
from flask_cors import CORS
from llama_cpp import Llama
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import tempfile
import os
import whisper

app = Flask(__name__)

# ✅ CORS for GitHub Pages & localhost
CORS(app, resources={r"/*": {"origins": ["https://saad-pie.github.io", "http://127.0.0.1:5500"]}}, supports_credentials=True)

# ✅ Rate limiting
limiter = Limiter(get_remote_address, app=app, default_limits=["15 per minute"])

# ✅ Load LLaMA and Whisper (use tiny for speed)
llm = Llama(model_path="./models/llama-2.gguf", n_ctx=4096)
whisper_model = whisper.load_model("tiny")

@app.route("/ask", methods=["POST"])
@limiter.limit("10 per minute")
def ask():
    if not request.is_json:
        return jsonify({"error": "Expected application/json"}), 415
    data = request.get_json()
    prompt = data.get("prompt", "").strip()
    if not prompt:
        return jsonify({"error": "Empty prompt"}), 400
    try:
        print(f"[🧠 Prompt] {prompt}")
        output = llm(f"[INST] {prompt} [/INST]", max_tokens=256, stop=["</s>"], echo=False)
        response_text = output["choices"][0]["text"].strip()
        print(f"[🤖 Response] {response_text}")
        return jsonify({"response": response_text})
    except Exception as e:
        print(f"[❌ Error] {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/voice", methods=["POST"])
@limiter.limit("5 per minute")
def voice():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file"}), 400
    audio = request.files["audio"]
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp:
        audio.save(temp.name)
        print(f"[🎤 Voice] Saved to {temp.name}")
        result = whisper_model.transcribe(temp.name)
        print(f"[📝 Transcript] {result['text']}")
        os.remove(temp.name)
    return jsonify({"transcript": result["text"]})

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
