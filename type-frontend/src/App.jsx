import { useEffect, useMemo, useRef, useState } from "react";

export default function App() {
  const [words, setWords] = useState([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);

  const [isConnected, setIsConnected] = useState(false);
  const [opponentProgress, setOpponentProgress] = useState(0);
  const [gameFinished, setGameFinished] = useState(false);

  const socketRef = useRef(null);

  // --- CONFIGURATION ---
  // Railway uses environment variables starting with VITE_
  // If they aren't found, we default to your local backend for development
  const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";
  const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8080";

  // room from URL
  const roomId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("room") || null;
  }, []);

  // load words
  useEffect(() => {
    console.log("Attempting to fetch from:", `${API_URL}/api/words`);
    
    fetch(`${API_URL}/api/words`)
      .then(res => {
        if (!res.ok) throw new Error(`Server responded with ${res.status}`);
        return res.json();
      })
      .then(data => {
        if (data.length === 0) {
           console.warn("Backend returned 0 words!");
        }
        setWords(data.slice(0, 5));
      })
      .catch(err => {
        console.error("Fetch error:", err);
        // Show the error on screen so you aren't stuck on "Loading..."
        setWords([{ text: "Error: Could not connect to backend", difficulty: "N/A" }]);
      });
}, [API_URL]);

  // WebSocket setup
  useEffect(() => {
    if (!roomId) return;

    console.log("Connecting to:", `${WS_URL}/ws`);
    const socket = new WebSocket(`${WS_URL}/ws`);
    socketRef.current = socket;

    socket.onopen = () => {
      console.log("WS connected");
      socket.send(JSON.stringify({
        type: "JOIN",
        room: roomId
      }));
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === "PLAYER_JOINED") {
        if (msg.count >= 2) {
          setIsConnected(true);
        }
      }

      if (msg.type === "PROGRESS") {
        setOpponentProgress(msg.index);
      }

      if (msg.type === "GAME_OVER") {
        setGameFinished(true);
        alert("Game Over! Winner: " + msg.winner);
      }
    };

    socket.onclose = () => {
      console.log("WS disconnected");
      setIsConnected(false);
    };

    return () => socket.close();
  }, [roomId, WS_URL]);

  // ... (rest of your typing and invite logic remains the same)
  const currentWord = words[index];

  const handleChange = (e) => {
    const value = e.target.value;
    setInput(value);

    if (!currentWord || gameFinished) return;

    if (value === currentWord.text) {
      const nextIndex = index + 1;
      setScore(prev => prev + 1);
      setInput("");

      socketRef.current?.send(JSON.stringify({
        type: "PROGRESS",
        index: nextIndex
      }));

      if (nextIndex >= words.length) {
        socketRef.current?.send(JSON.stringify({
          type: "FINISH"
        }));
        setGameFinished(true);
        return;
      }
      setIndex(nextIndex);
    }
  };

  const createInvite = () => {
    const room = Math.random().toString(36).substring(2, 8);
    const link = `${window.location.origin}?room=${room}`;
    navigator.clipboard.writeText(link);
    alert("Invite copied:\n" + link);
  };

  const resetGame = () => {
    setIndex(0);
    setScore(0);
    setInput("");
    setGameFinished(false);
    setOpponentProgress(0);
  };

  if (words.length === 0) return <h2>Loading words...</h2>;

  return (
    <div style={{ padding: 20, fontFamily: "Arial" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>Typing Duel</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
              width: 12, height: 12, borderRadius: "50%",
              backgroundColor: isConnected ? "green" : "red"
            }}
          />
          <span>{isConnected ? "Opponent Connected" : "Waiting..."}</span>
        </div>
      </div>

      <button onClick={createInvite}>Invite Friend</button>
      {roomId && <p>Room: <b>{roomId}</b></p>}

      {gameFinished && (
        <div style={{ padding: 20, background: "black", color: "white", marginTop: 20 }}>
          🎉 Game Over! <br />
          <button onClick={resetGame}>Play Again</button>
        </div>
      )}

      {!gameFinished && currentWord && (
        <>
          <h3>Score: {score}</h3>
          <p>Your Progress: {index} / {words.length}</p>
          <p>Opponent Progress: {opponentProgress}</p>
          <p>Difficulty: {currentWord.difficulty}</p>
          <h1 style={{ color: "blue" }}>{currentWord.text}</h1>
          <input value={input} onChange={handleChange} autoFocus style={{ fontSize: 20, padding: 10, width: 300 }} />
        </>
      )}
    </div>
  );
}