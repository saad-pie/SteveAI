import React, { useEffect, useState } from "react";

function App() {
  const [messages, setMessages] = useState(["Hi! I'm Steve. How can I help you?"]);
  const [input, setInput] = useState("");

  const speak = (text) => {
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-US";
    speechSynthesis.speak(utterance);
  };

  const handleSend = () => {
    if (input.trim() === "") return;
    const userMsg = `You: ${input}`;
    const reply = `Steve: I'm still learning to respond.`;
    setMessages((prev) => [...prev, userMsg, reply]);
    speak("I'm still learning to respond.");
    setInput("");
  };

  useEffect(() => {
    speak("Hi! I'm Steve. How can I help you?");
  }, []);

  return (
    <div style={{ fontFamily: "sans-serif", padding: "20px", maxWidth: "500px", margin: "auto" }}>
      <h1 style={{ textAlign: "center", color: "#00ccff" }}>Steve AI Assistant</h1>
      <div style={{ border: "1px solid #ccc", padding: "10px", borderRadius: "8px", minHeight: "200px", marginBottom: "10px", backgroundColor: "#111", color: "#eee", overflowY: "auto" }}>
        {messages.map((msg, idx) => (
          <p key={idx}>{msg}</p>
        ))}
      </div>
      <div style={{ display: "flex", gap: "10px" }}>
        <input
          type="text"
          placeholder="Type your message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          style={{ flexGrow: 1, padding: "10px", borderRadius: "5px", border: "1px solid #aaa" }}
        />
        <button onClick={handleSend} style={{ padding: "10px 20px", backgroundColor: "#00ccff", border: "none", borderRadius: "5px", color: "white", cursor: "pointer" }}>
          Send
        </button>
      </div>
    </div>
  );
}

export default App;
