from flask import Flask, request, jsonify
from flask_cors import CORS
from pyngrok import ngrok
import whisper
import os

app = Flask(__name__)
CORS(app)

# Load whisper once
whisper_model = whisper.load_model("base")

# Dummy LLaMA response function – replace with real model later
def llama_response(prompt):
    return f"🤖 Steve says: {prompt[::-1]}"  # Example logic: reverse text

@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json()
    prompt = data.get("prompt", "")
    if not prompt.strip():
        return jsonify({"error": "Empty prompt"}), 400
    response = llama_response(prompt)
    return jsonify({"response": response})

@app.route("/voice", methods=["POST"])
def voice():
    if 'audio' not in request.files:
        return jsonify({"error": "Missing audio"}), 400
    audio_file = request.files['audio']
    audio_path = "temp.wav"
    audio_file.save(audio_path)

    try:
        result = whisper_model.transcribe(audio_path)
        os.remove(audio_path)
        return jsonify({"transcript": result["text"]})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    port = 5000
    public_url = ngrok.connect(port)
    print(f"🚀 Ngrok Tunnel Public URL: {public_url}")
    print(f"📡 Server running on: http://127.0.0.1:{port}")
    app.run(host="0.0.0.0", port=port)
