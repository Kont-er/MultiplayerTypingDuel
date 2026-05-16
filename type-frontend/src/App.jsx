import { useEffect, useMemo, useRef, useState } from "react";

export default function App() {
  // ---------------- CONNECTION ----------------
  const socketRef = useRef(null);
  const WS_URL = "wss://type-masters-production.up.railway.app";

  const roomId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("room") || null;
  }, []);

  // ---------------- PLAYER ----------------
  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // ---------------- GAME STATE ----------------
  const [gameStarted, setGameStarted] = useState(false);
  const [countdown, setCountdown] = useState(null);
  const [words, setWords] = useState([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");

  // ---------------- RACE STATE ----------------
  const [players, setPlayers] = useState([]);
  const [totalWords, setTotalWords] = useState(0);

  // ---------------- RESULT ----------------
  const [gameFinished, setGameFinished] = useState(false);
  const [winner, setWinner] = useState(null);

  // =========================================================
  // CONNECT SOCKET (AFTER JOIN)
  // =========================================================
  useEffect(() => {
    if (!joined || !roomId) return;

    const socket = new WebSocket(`${WS_URL}/ws`);
    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "JOIN",
          room: roomId,
          username,
        })
      );
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case "PLAYER_JOINED":
          break;

        case "PLAYER_READY":
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
          break;

        case "STATE":
          setPlayers(msg.players);
          setTotalWords(msg.totalWords);
          break;

        case "GAME_OVER":
          setGameFinished(true);
          setWinner(msg.winner);
          break;
      }
    };

    return () => socket.close();
  }, [joined, roomId, username]);

  // =========================================================
  // JOIN SCREEN
  // =========================================================
  if (!joined) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h2>Enter Username</h2>

          <input
            style={styles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Your name"
          />

          <button
            style={styles.button}
            disabled={!username.trim()}
            onClick={() => setJoined(true)}
          >
            Join Room
          </button>
        </div>
      </div>
    );
  }

  // =========================================================
  // READY SCREEN (LOBBY)
  // =========================================================
  if (!gameStarted && !gameFinished) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h2>Waiting Room</h2>

          <p>Room: {roomId}</p>

          <button
            style={{
              ...styles.button,
              background: isReady ? "#16a34a" : "#6366f1",
            }}
            onClick={() => {
              setIsReady(true);

              socketRef.current.send(
                JSON.stringify({
                  type: "READY",
                })
              );
            }}
          >
            {isReady ? "Ready ✔" : "Click Ready"}
          </button>

          <p style={{ marginTop: 10, color: "#94a3b8" }}>
            Waiting for other player...
          </p>

          {/* LOBBY PLAYERS */}
          <div style={{ marginTop: 20 }}>
            {players.map((p, i) => (
              <div key={i}>
                {p.username} {p.ready ? "✔ ready" : "⏳ not ready"}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // GAME OVER SCREEN
  // =========================================================
  if (gameFinished) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h2>Game Over</h2>
          <h3>{winner}</h3>

          <button onClick={() => window.location.reload()} style={styles.button}>
            Play Again
          </button>
        </div>
      </div>
    );
  }

  // =========================================================
  // GAME SCREEN
  // =========================================================
  const currentWord = words[index];

  const handleInput = (e) => {
    const value = e.target.value;
    setInput(value);

    if (!currentWord) return;

    if (value.trim().toLowerCase() === currentWord.text.toLowerCase()) {
      const nextIndex = index + 1;
      setIndex(nextIndex);
      setInput("");

      socketRef.current?.send(
        JSON.stringify({
          type: "PROGRESS",
          index: nextIndex,
        })
      );
    }
  };

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h2>⚡ Typing Race</h2>

        {countdown !== null && <h1>{countdown}</h1>}

        {/* ================= RACE BARS ================= */}
        <div style={{ width: "100%", marginBottom: 20 }}>
          {players.map((p, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>{p.username}</span>
                <span>
                  {p.progress} / {totalWords}
                </span>
              </div>

              <div style={styles.barBg}>
                <div
                  style={{
                    ...styles.barFill,
                    width: `${(p.progress / totalWords) * 100}%`,
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* ================= WORD ================= */}
        <div style={styles.word}>{currentWord?.text}</div>

        {/* ================= INPUT ================= */}
        <input
          style={styles.input}
          value={input}
          onChange={handleInput}
          disabled={!gameStarted}
        />
      </div>
    </div>
  );
}

/* ================= STYLES ================= */

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "#0f172a",
    color: "#e2e8f0",
    fontFamily: "Arial",
    padding: 20,
  },

  container: {
    width: "100%",
    maxWidth: 600,
  },

  card: {
    background: "#111827",
    padding: 20,
    borderRadius: 12,
    textAlign: "center",
  },

  button: {
    padding: "10px 14px",
    background: "#6366f1",
    color: "white",
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    marginTop: 10,
  },

  input: {
    width: "100%",
    padding: 12,
    fontSize: 18,
    marginTop: 20,
    borderRadius: 8,
    border: "1px solid #334155",
    background: "#0b1220",
    color: "white",
  },

  word: {
    fontSize: 36,
    textAlign: "center",
    margin: "20px 0",
    color: "#38bdf8",
  },

  barBg: {
    width: "100%",
    height: 12,
    background: "#1f2937",
    borderRadius: 999,
    overflow: "hidden",
  },

  barFill: {
    height: "100%",
    background: "#38bdf8",
    transition: "width 0.2s linear",
  },
};