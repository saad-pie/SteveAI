from flask import Flask, request, jsonify
from flask_cors import CORS
from llama_cpp import Llama

# Load LLaMA 2 model (update path if using in Colab)
llm = Llama(
    model_path="C:/Users/saad/llama2_models/llama-2-7b-chat.Q4_K_M.gguf",
    n_threads=8,
    n_batch=256,
    use_mmap=True,
    use_mlock=True,
    chat_format="llama-2"
)

app = Flask(__name__)
CORS(app)  # Enable Cross-Origin Resource Sharing

@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json()
    prompt = data.get("prompt", "").strip()
    memory = data.get("memory_context", "").strip()

    # Combine memory and prompt as pseudo-dialogue
    full_prompt = f"[Memory]\n{memory}\n\n[User]\n{prompt}"

    # Run inference
    response = llm.create_chat_completion(
        messages=[
            {"role": "system", "content": "You are Steve AI, a helpful assistant."},
            {"role": "user", "content": full_prompt}
        ],
        max_tokens=300,
        temperature=0.7,
    )

    reply = response["choices"][0]["message"]["content"]

    # Add new interaction to memory (limit memory size to last ~3000 chars)
    new_memory = f"{memory}\nUser: {prompt}\nAI: {reply}"
    trimmed_memory = new_memory[-3000:]

    return jsonify({
        "response": reply.strip(),
        "memory_update": trimmed_memory
    })

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
