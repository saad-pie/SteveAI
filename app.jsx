import React, { useEffect, useState } from "https://esm.sh/react";
import ReactDOM from "https://esm.sh/react-dom/client";

function SteveAI() {
  const [messages, setMessages] = useState(["Hi! I'm Steve. How can I help you?"]);
  const [input, setInput] = useState("");

  // Speech synthesis (voice output)
  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    speechSynthesis.speak(utterance);
  };

  // Handle message send
  const handleSend = () => {
    if (input.trim() === "") return;

    const userMsg = `You: ${input}`;
    const reply = `Steve: I'm still learning to respond.`; // Placeholder for AI logic

    setMessages((prev) => [...prev, userMsg, reply]);
    speak("I'm still learning to respond.");
    setInput("");
  };

  // Optional: trigger voice on page load
  useEffect(() => {
    speak("Hi! I'm Steve. How can I help you?");
  }, []);

  return (
    <div style={styles.container}>
      <h1 style={styles.heading}>Steve AI Assistant</h1>
      <div style={styles.chatBox}>
        {messages.map((msg, idx) => (
          <p key={idx} style={styles.message}>{msg}</p>
        ))}
      </div>
      <div style={styles.controls}>
        <input
          style={styles.input}
          type="text"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
        />
        <button style={styles.button} onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}

const styles = {
  container: {
    fontFamily: "sans-serif",
    padding: "20px",
    maxWidth: "500px",
    margin: "auto",
  },
  heading: {
    textAlign: "center",
    color: "#00ccff",
  },
  chatBox: {
    border: "1px solid #ccc",
    padding: "10px",
    borderRadius: "8px",
    minHeight: "200px",
    marginBottom: "10px",
    backgroundColor: "#111",
    color: "#eee",
    overflowY: "auto",
  },
  message: {
    margin: "5px 0",
  },
  controls: {
    display: "flex",
    gap: "10px",
  },
  input: {
    flexGrow: 1,
    padding: "10px",
    borderRadius: "5px",
    border: "1px solid #aaa",
  },
  button: {
    padding: "10px 20px",
    backgroundColor: "#00ccff",
    border: "none",
    borderRadius: "5px",
    color: "white",
    cursor: "pointer",
  },
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<SteveAI />);
