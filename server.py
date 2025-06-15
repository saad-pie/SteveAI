from flask import Flask, request, jsonify
from flask_cors import CORS
from llama_cpp import Llama
import tempfile
import os
import whisper

app = Flask(__name__)

# ✅ Apply CORS to the app globally (FOR ANY PATH)
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True, send_wildcard=True)


# Load LLaMA
llm = Llama(model_path="./models/llama-2.gguf", n_ctx=4096)
whisper_model = whisper.load_model("base")

@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json()
    prompt = data.get("prompt", "").strip()
    if not prompt:
        return jsonify({"error": "Empty prompt"}), 400

    try:
        output = llm(prompt, max_tokens=256, stop=["</s>"], echo=False)
        response_text = output["choices"][0]["text"].strip()
        return jsonify({"response": response_text})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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

if __name__ == "__main__":
    # Important: enable external access for ngrok
    app.run(host="0.0.0.0", port=5000)
