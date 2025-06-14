import { useState } from 'react';

const speak = (text) => {
  const synth = window.speechSynthesis;
  const utter = new SpeechSynthesisUtterance(text);
  synth.speak(utter);
};

export default function App() {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);

  const sendMessage = async () => {
    const userText = input;
    setInput('');
    setMessages([...messages, { sender: 'user', text: userText }]);

    const res = await fetch('http://localhost:8000/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: userText }),
    });

    const data = await res.json();
    const reply = data.reply;
    setMessages((m) => [...m, { sender: 'ai', text: reply }]);
    speak(reply);
  };

  return (
    <div style={{ padding: 20, maxWidth: 600, margin: 'auto' }}>
      <h1>🧠 Steve AI</h1>
      <div>
        {messages.map((msg, i) => (
          <div key={i} style={{ marginBottom: 10 }}>
            <strong>{msg.sender === 'user' ? 'You' : 'Steve'}:</strong> {msg.text}
          </div>
        ))}
      </div>
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        placeholder="Ask me anything..."
        style={{ width: '100%', padding: 10, fontSize: 16 }}
      />
    </div>
  );
}
