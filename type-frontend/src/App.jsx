
import { useEffect, useMemo, useRef, useState } from "react";

export default function App() {
  const [words, setWords] = useState([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);

  const [players, setPlayers] = useState([]);
  const [name, setName] = useState("");
  const [isReady, setIsReady] = useState(false);

  const [isConnected, setIsConnected] = useState(false);
  const [opponentProgress, setOpponentProgress] = useState(0);

  const [countdown, setCountdown] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [startTime, setStartTime] = useState(null);

  const [gameFinished, setGameFinished] = useState(false);
  const [winner, setWinner] = useState(null);

  const [wpm, setWpm] = useState(0);

  const socketRef = useRef(null);
  const WS_URL = "wss://type-masters-production.up.railway.app";

  const roomId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("room") || null;
  }, []);

  // --- WS ---
  useEffect(() => {
    if (!roomId) return;

    const socket = new WebSocket(`${WS_URL}/ws`);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "JOIN", room: roomId }));
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "PLAYERS":
          setPlayers(msg.players);
          setIsConnected(msg.players.length >= 2);
          break;

        case "WORDS":
          setWords(msg.words);
          break;

        case "COUNTDOWN":
          setCountdown(msg.value);
          break;

        case "START":
          setCountdown(null);
          setGameStarted(true);
          setStartTime(msg.startTime);
          break;

        case "PROGRESS":
          setOpponentProgress(msg.index);
          break;

        case "GAME_OVER":
          setGameFinished(true);
          setWinner(msg.winner);
          break;
      }
    };

    return () => socket.close();
  }, [roomId]);

  // --- SEND NAME ---
  const submitName = () => {
    if (!name.trim()) return;

    socketRef.current?.send(JSON.stringify({
      type: "PLAYER_NAME",
      name
    }));
  };

  // --- READY ---
  const handleReady = () => {
    setIsReady(true);

    socketRef.current?.send(JSON.stringify({
      type: "READY"
    }));
  };

  // --- TYPING ---
  const handleChange = (e) => {
    const value = e.target.value;
    setInput(value);

    if (!gameStarted || gameFinished) return;

    const currentWord = words[index];
    if (!currentWord) return;

    if (value.trim().toLowerCase() === currentWord.text.toLowerCase()) {
      const nextIndex = index + 1;

      setIndex(nextIndex);
      setScore(prev => prev + 1);
      setInput("");

      socketRef.current?.send(JSON.stringify({
        type: "PROGRESS",
        index: nextIndex
      }));
    }
  };

  // --- WPM ---
  useEffect(() => {
    if (!gameStarted || !startTime) return;

    const interval = setInterval(() => {
      const minutes = (Date.now() - startTime) / 60000;

      if (minutes > 0) {
        const chars = words
          .slice(0, index)
          .reduce((acc, w) => acc + w.text.length, 0);

        setWpm(Math.round((chars / 5) / minutes));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameStarted, startTime, index, words]);

  const currentWord = words[index];

  return (
    <div style={{
      width: "100vw",
      height: "100vh",
      margin: 0,
      padding: 20,
      boxSizing: "border-box",
      background: "#020617",
      color: "#f8fafc",
      fontFamily: "Arial"
    }}>

      <h1 style={{ color: "#facc15" }}>Typing Duel</h1>

      {/* NAME INPUT */}
      {!name && (
        <div>
          <input
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button onClick={submitName}>Join</button>
        </div>
      )}

      {/* PLAYER TABLE */}
      <table style={{ marginTop: 20, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>Name</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p, i) => (
            <tr key={i}>
              <td>{p.name}</td>
              <td>{p.ready ? "✅ Ready" : "⏳ Waiting"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* READY BUTTON */}
      {name && !isReady && (
        <button onClick={handleReady} style={{ marginTop: 20 }}>
          Ready
        </button>
      )}

      {/* COUNTDOWN */}
      {countdown !== null && (
        <h1 style={{ fontSize: 80, textAlign: "center" }}>{countdown}</h1>
      )}

      {/* GAME */}
      {gameStarted && !gameFinished && currentWord && (
        <>
          <h2>Score: {score} | WPM: {wpm}</h2>
          <h3>{index} / {words.length}</h3>

          <h1 style={{ color: "#38bdf8", fontSize: 48 }}>
            {currentWord.text}
          </h1>

          <input
            value={input}
            onChange={handleChange}
            autoFocus
            style={{
              fontSize: 24,
              padding: 10,
              width: 400,
              background: "#1e293b",
              color: "white"
            }}
          />
        </>
      )}

      {/* GAME OVER */}
      {gameFinished && (
        <h1>🏆 Winner: {winner}</h1>
      )}
    </div>
  );
}

