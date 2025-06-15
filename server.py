from flask import Flask, request, jsonify
from flask_cors import CORS
from llama_cpp import Llama
import tempfile
import os
import whisper
import threading

# ✅ Init Flask
app = Flask(__name__)
CORS(app)

# ✅ Load Models
llm = Llama(model_path="D:/path/to/llama-2-7b-chat.Q4_K_M.gguf", n_ctx=4096)
whisper_model = whisper.load_model("base")

# ✅ Text Generation
@app.route("/ask", methods=["POST"])
def ask():
    if not request.is_json:
        return jsonify({"error": "Expected application/json"}), 415
    data = request.get_json()
    prompt = data.get("prompt", "").strip()
    if not prompt:
        return jsonify({"error": "Empty prompt"}), 400
    try:
        output = llm(f"[INST] {prompt} [/INST]", max_tokens=256, stop=["</s>"], echo=False)
        response_text = output["choices"][0]["text"].strip()
        return jsonify({"response": response_text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# ✅ Voice Transcription
@app.route("/voice", methods=["POST"])
def voice():
    if "audio" not in request.files:
        return jsonify({"error": "No audio file"}), 400
    audio = request.files["audio"]
    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as temp:
        audio.save(temp.name)
        result = whisper_model.transcribe(temp.name)
        os.remove(temp.name)
    return jsonify({"transcript": result["text"]})

# ✅ Start server (do not use ngrok here)
def run_app():
    app.run(host="0.0.0.0", port=5000)

threading.Thread(target=run_app).start()
