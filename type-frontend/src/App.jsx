import { useEffect, useMemo, useRef, useState } from "react";

export default function App() {
  // ===== GAME STATE =====
  const [words, setWords] = useState([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");
  const [score, setScore] = useState(0);

  // ===== PLAYER =====
  const [nameInput, setNameInput] = useState("");
  const [name, setName] = useState(null);

  // ===== MULTIPLAYER =====
  const [players, setPlayers] = useState([]);
  const [isReady, setIsReady] = useState(false);

  const [countdown, setCountdown] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [winner, setWinner] = useState(null);

  const [wpm, setWpm] = useState(0);
  const [startTime, setStartTime] = useState(null);

  const socketRef = useRef(null);

  const API_URL = "https://type-masters-production.up.railway.app";
  const WS_URL = "wss://type-masters-production.up.railway.app";

  // ===== ROOM =====
  const roomId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("room") || null;
  }, []);

  const isMultiplayer = !!roomId;

  // ===== LOAD WORDS =====
  useEffect(() => {
    fetch(`${API_URL}/api/words`)
      .then(res => res.json())
      .then(data => {
        setWords(data.slice(0, 10));
      })
      .catch(() => {
        setWords([{ text: "backend error", difficulty: "N/A" }]);
      });
  }, []);

  // ===== WEBSOCKET (ONLY IF MULTIPLAYER) =====
  useEffect(() => {
    if (!isMultiplayer) return;

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

      if (msg.type === "PLAYERS") {
        setPlayers(msg.players);
      }

      if (msg.type === "COUNTDOWN") {
        setCountdown(msg.value);
      }

      if (msg.type === "START") {
        setCountdown(null);
        setGameStarted(true);
        setStartTime(msg.startTime);
      }

      if (msg.type === "GAME_OVER") {
        setGameFinished(true);
        setWinner(msg.winner);
      }
    };

    return () => socket.close();
  }, [isMultiplayer, roomId]);

  // ===== NAME JOIN =====
  const submitName = () => {
    if (!nameInput.trim()) return;

    setName(nameInput);

    socketRef.current?.send(JSON.stringify({
      type: "PLAYER_NAME",
      name: nameInput
    }));
  };

  // ===== READY =====
  const handleReady = () => {
    setIsReady(true);

    socketRef.current?.send(JSON.stringify({
      type: "READY"
    }));
  };

  // ===== TYPING LOGIC =====
  const handleChange = (e) => {
    const value = e.target.value;
    setInput(value);

    if (!words.length || gameFinished) return;

    const currentWord = words[index];

    if (value.trim().toLowerCase() === currentWord.text.toLowerCase()) {
      const next = index + 1;

      setScore(s => s + 1);
      setIndex(next);
      setInput("");

      socketRef.current?.send?.(JSON.stringify({
        type: "PROGRESS",
        index: next
      }));

      if (next >= words.length) {
        setGameFinished(true);
        setWinner(name || "You");
      }
    }
  };

  // ===== WPM =====
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

  // ===== INVITE LINK =====
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
    setCountdown(null);
    setGameStarted(false);
    setWinner(null);
  };

  // ===== UI =====
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

      {/* NAME */}
      {!name && (
        <div>
          <input
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Enter your name"
            style={{ padding: 10, fontSize: 16 }}
          />
          <button onClick={submitName} style={{ marginLeft: 10 }}>
            Join
          </button>
        </div>
      )}

      {/* LOBBY (ONLY MULTIPLAYER) */}
      {isMultiplayer && name && (
        <div style={{ marginTop: 20 }}>
          <button onClick={createInvite}>Invite Friend</button>

          <h3>Players</h3>
          <ul>
            {players.map((p, i) => (
              <li key={i}>
                {p.name} {p.ready ? "✅" : "⏳"}
              </li>
            ))}
          </ul>

          {!isReady && (
            <button onClick={handleReady}>Ready</button>
          )}
        </div>
      )}

      {/* COUNTDOWN */}
      {countdown !== null && (
        <h1 style={{ fontSize: 80, textAlign: "center" }}>
          {countdown}
        </h1>
      )}

      {/* GAME */}
      {gameStarted && !gameFinished && currentWord && (
        <>
          <h2>Score: {score} | WPM: {wpm}</h2>

          <h1 style={{ color: "#38bdf8" }}>
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
              color: "white",
              border: "none"
            }}
          />
        </>
      )}

      {/* SINGLE PLAYER MODE (auto start) */}
      {!isMultiplayer && name && !gameStarted && (
        <button onClick={() => setGameStarted(true)}>
          Start Game
        </button>
      )}

      {/* END */}
      {gameFinished && (
        <div>
          <h1>🏆 Winner: {winner}</h1>
          <button onClick={resetGame}>Restart</button>
        </div>
      )}
    </div>
  );
}