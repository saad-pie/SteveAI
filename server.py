from flask import Flask, request, jsonify
from flask_cors import CORS
from llama_cpp import Llama

# Load LLaMA 2 model
llm = Llama(
    model_path="C:/Users/saad/llama2_models/llama-2-7b-chat.Q4_K_M.gguf",
    n_threads=8,
    n_batch=256,
    use_mmap=True,
    use_mlock=True
)

# Create Flask app and allow cross-origin requests
app = Flask(__name__)
CORS(app)

@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json()
    prompt = data.get("prompt", "").strip()
    memory = data.get("memory_context", "").strip()

    # Merge memory and prompt into a pseudo-session
    full_prompt = f"[Memory]\n{memory}\n\n[User]\n{prompt}"

    # Generate a chat completion
    response = llm.create_chat_completion(
        messages=[{"role": "user", "content": full_prompt}]
    )

    # Extract text from LLaMA's reply
    reply = response["choices"][0]["message"]["content"]

    # Append this exchange to memory for next time
    new_memory = memory + f"\nUser: {prompt}\nAI: {reply}"

    return jsonify({
        "response": reply,
        "memory_update": new_memory.strip()[-3000:]  # Keep memory size reasonable
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
