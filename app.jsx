import React, { useState } from 'react';

const App = () => {
  const [response, setResponse] = useState("");
  const synth = window.speechSynthesis;

  const handleAskSteve = async (e) => {
    e.preventDefault();
    const input = e.target.elements.userInput.value;

    // Simulated AI response
    const reply = `Hello! I'm Steve. You said: ${input}`;
    setResponse(reply);

    // Voice output
    const utter = new SpeechSynthesisUtterance(reply);
    synth.speak(utter);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4 flex flex-col items-center justify-center">
      <h1 className="text-4xl font-bold mb-6">Steve AI</h1>

      <form onSubmit={handleAskSteve} className="flex flex-col items-center gap-4 w-full max-w-md">
        <input
          name="userInput"
          className="w-full p-2 rounded bg-gray-800 text-white outline-none"
          placeholder="Talk to Steve..."
          autoComplete="off"
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 rounded px-4 py-2"
        >
          Ask
        </button>
      </form>

      <div className="mt-8 text-lg">{response}</div>
    </div>
  );
};

export default App;
