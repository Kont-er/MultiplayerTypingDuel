import { useEffect, useMemo, useRef, useState } from "react";

export default function App() {
  // --- GAME STATE ---
  const [words, setWords] = useState([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);

  // --- MULTIPLAYER STATE ---
  const [isConnected, setIsConnected] = useState(false);
  const [opponentProgress, setOpponentProgress] = useState(0);

  // --- SYNC STATE ---
  const [countdown, setCountdown] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [startTime, setStartTime] = useState(null);

  // --- RESULT STATE ---
  const [gameFinished, setGameFinished] = useState(false);
  const [winner, setWinner] = useState(null);

  // --- STATS ---
  const [wpm, setWpm] = useState(0);

  const socketRef = useRef(null);

  const WS_URL = "wss://type-masters-production.up.railway.app";

  // room from URL
  const roomId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("room") || null;
  }, []);

  // --- WEBSOCKET SETUP ---
  useEffect(() => {
    if (!roomId) return;

    const socket = new WebSocket(`${WS_URL}/ws`);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({
        type: "JOIN",
        room: roomId
      }));
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "PLAYER_JOINED":
          if (msg.count >= 2) setIsConnected(true);
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

        default:
          break;
      }
    };

    socket.onclose = () => {
      setIsConnected(false);
    };

    return () => socket.close();
  }, [roomId]);

  // --- TYPING HANDLER ---
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

      if (socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(JSON.stringify({
          type: "PROGRESS",
          index: nextIndex
        }));
      }
    }
  };

  // --- WPM CALCULATION ---
  useEffect(() => {
    if (!gameStarted || !startTime) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const minutes = (now - startTime) / 60000;

      if (minutes > 0) {
        const charsTyped = words
          .slice(0, index)
          .reduce((acc, w) => acc + w.text.length, 0);

        const calculatedWPM = Math.round((charsTyped / 5) / minutes);
        setWpm(calculatedWPM);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameStarted, startTime, index, words]);

  // --- INVITE ---
  const createInvite = () => {
    const room = Math.random().toString(36).substring(2, 8);
    const link = `${window.location.origin}?room=${room}`;

    navigator.clipboard.writeText(link)
      .then(() => alert("Invite copied:\n" + link))
      .catch(() => alert("Failed to copy link"));
  };

  // --- RESET ---
  const resetGame = () => {
    setIndex(0);
    setScore(0);
    setInput("");
    setGameFinished(false);
    setOpponentProgress(0);
    setGameStarted(false);
    setCountdown(null);
    setStartTime(null);
    setWpm(0);
  };

  const currentWord = words[index];

  return (
    <div style={{
      padding: 20,
      fontFamily: "Arial",
      background: "#0f172a",
      color: "#e2e8f0",
      minHeight: "100vh"
    }}>
      {/* HEADER */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        <h1>Typing Duel</h1>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 12,
            height: 12,
            borderRadius: "50%",
            backgroundColor: isConnected ? "#22c55e" : "#ef4444"
          }} />
          <span>{isConnected ? "Opponent Connected" : "Waiting..."}</span>
        </div>
      </div>

      <button onClick={createInvite}>Invite Friend</button>
      {roomId && <p>Room: <b>{roomId}</b></p>}

      {/* COUNTDOWN */}
      {countdown !== null && (
        <h1 style={{ fontSize: 60, textAlign: "center" }}>
          {countdown}
        </h1>
      )}

      {/* GAME OVER */}
      {gameFinished && (
        <div style={{
          padding: 20,
          background: "#020617",
          marginTop: 20
        }}>
          🎉 Game Over! <br />
          Winner: {winner} <br />
          <button onClick={resetGame}>Play Again</button>
        </div>
      )}

      {/* GAME */}
      {!gameFinished && gameStarted && currentWord && (
        <>
          <h3>Score: {score}</h3>
          <h3>WPM: {wpm}</h3>

          <p>Your Progress: {index} / {words.length}</p>
          <p>Opponent Progress: {opponentProgress}</p>
          <p>Difficulty: {currentWord.difficulty}</p>

          <h1 style={{ color: "#38bdf8" }}>
            {currentWord.text}
          </h1>

          <input
            value={input}
            onChange={handleChange}
            autoFocus
            disabled={!gameStarted || gameFinished}
            style={{
              fontSize: 20,
              padding: 10,
              width: 300,
              background: "#1e293b",
              color: "#e2e8f0",
              border: "1px solid #334155"
            }}
          />
        </>
      )}

      {/* WAITING STATE */}
      {!gameStarted && countdown === null && !gameFinished && (
        <p style={{ marginTop: 20 }}>
          Waiting for players...
        </p>
      )}
    </div>
  );
}

