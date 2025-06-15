from flask import Flask, request, jsonify
from flask_cors import CORS
from pyngrok import ngrok
import os

# Simulated LLaMA response (replace with real model logic)
def llama_respond(prompt):
    return f"Echo: {prompt}"

app = Flask(__name__)
CORS(app)

@app.route("/ask", methods=["POST"])
def ask():
    try:
        data = request.get_json(force=True)
        prompt = data.get("prompt", "")
        if not prompt.strip():
            return jsonify({"error": "Prompt is empty"}), 400
        response_text = llama_respond(prompt)
        return jsonify({"response": response_text})
    except Exception as e:
        return jsonify({"error": "Invalid request", "details": str(e)}), 400

@app.route("/voice", methods=["POST"])
def voice():
    try:
        if 'audio' not in request.files:
            return jsonify({"error": "No audio file provided"}), 400

        audio_file = request.files['audio']
        audio_path = "temp_audio.wav"
        audio_file.save(audio_path)

        # Whisper speech-to-text
        import whisper
        model = whisper.load_model("base")
        result = model.transcribe(audio_path)
        transcript = result['text']

        os.remove(audio_path)
        return jsonify({"transcript": transcript})

    except Exception as e:
        return jsonify({"error": "Voice recognition failed", "details": str(e)}), 500

if __name__ == "__main__":
    port = 5000
    public_url = ngrok.connect(port)
    print(f"🚀 Ngrok tunnel open at: {public_url}")
    print("🌐 Visit the frontend and use this as the baseURL.")
    app.run(port=port)
