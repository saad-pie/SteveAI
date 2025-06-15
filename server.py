from flask import Flask, request, jsonify
from flask_cors import CORS
from llama_cpp import Llama
import tempfile
import os
import whisper
from pyngrok import ngrok
import threading
import sys
import importlib

# ✅ Patch Colab spam error more forcefully
if "google.colab._debugpy_repr" in sys.modules:
    import google.colab._debugpy_repr as _colab_repr
    _colab_repr.get_shape = lambda obj: None
else:
    def patch_colab_repr():
        import google.colab._debugpy_repr as _colab_repr
        _colab_repr.get_shape = lambda obj: None
    importlib.import_module("google.colab._debugpy_repr")
    patch_colab_repr()

# ✅ Init Flask
app = Flask(__name__)
CORS(app)

# ✅ Load Models
llm = Llama(model_path="/content/drive/MyDrive/llama-2-7b-chat.Q4_K_M.gguf", n_ctx=4096)
whisper_model = whisper.load_model("base")

# ✅ Text Generation Route
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

# ✅ Whisper Transcription Route
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

# ✅ Ngrok tunnel and app run
public_url = ngrok.connect(5000)
print("Public ngrok URL:", public_url)

def run_app():
    app.run(host="0.0.0.0", port=5000)

threading.Thread(target=run_app).start()
