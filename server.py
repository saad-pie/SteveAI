from flask import Flask, request, jsonify
from flask_cors import CORS
from llama_cpp import Llama

llm = Llama(
    model_path="C:/Users/saad/llama2_models/llama-2-7b-chat.Q4_K_M.gguf",
    n_threads=8,
    n_batch=256,
    use_mmap=True,
    use_mlock=True
)

app = Flask(__name__)
CORS(app)

@app.route("/ask", methods=["POST"])
def ask():
    data = request.get_json()
    prompt = data.get("prompt", "")
    response = llm.create_chat_completion(messages=[{"role": "user", "content": prompt}])
    text = response["choices"][0]["message"]["content"]
    return jsonify({"response": text})

if __name__ == "__main__":
    app.run(port=5000)
