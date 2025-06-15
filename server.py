from flask import Flask, request, jsonify
from flask_cors import CORS
from llama_cpp import Llama
import threading

app = Flask(__name__)
CORS(app)

llm = Llama(
    model_path="/content/drive/MyDrive/llama/llama-2-7b-chat.Q4_K_M.gguf",
    n_threads=8,
    n_batch=256,
    use_mmap=True,
    use_mlock=True
)

@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json()
    prompt = data.get("prompt", "").strip()
    memory = data.get("memory_context", "").strip()
    full_prompt = f"[Memory]\n{memory}\n\n[User]\n{prompt}"
    response = llm.create_chat_completion(
        messages=[{"role": "user", "content": full_prompt}]
    )
    reply = response["choices"][0]["message"]["content"]
    new_memory = memory + f"\nUser: {prompt}\nAI: {reply}"
    return jsonify({
        "response": reply,
        "memory_update": new_memory.strip()[-3000:]
    })

# Run Flask in a background thread
def run_flask():
    app.run(host='0.0.0.0', port=5000)

threading.Thread(target=run_flask).start()
