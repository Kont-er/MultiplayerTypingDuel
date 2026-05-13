import { useEffect, useMemo, useRef, useState } from "react";

export default function App() {
  // ---------------- GAME STATE ----------------
  const [words, setWords] = useState([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");

  // ---------------- MULTIPLAYER ----------------
  const [isConnected, setIsConnected] = useState(false);
  const [opponentProgress, setOpponentProgress] = useState(0);

  // your identity
  const [username, setUsername] = useState("");

  // opponent identity (optional display)
  const [opponentName, setOpponentName] = useState("");

  // ---------------- SYNC ----------------
  const [countdown, setCountdown] = useState(null);
  const [gameStarted, setGameStarted] = useState(false);
  const [startTime, setStartTime] = useState(null);

  // ---------------- RESULT ----------------
  const [gameFinished, setGameFinished] = useState(false);
  const [winner, setWinner] = useState(null);

  // ---------------- STATS ----------------
  const [wpm, setWpm] = useState(0);

  const socketRef = useRef(null);

  const WS_URL = "wss://type-masters-production.up.railway.app";

  const roomId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("room") || null;
  }, []);

  // ---------------- SOCKET ----------------
  useEffect(() => {
    if (!roomId) return;

    const socket = new WebSocket(`${WS_URL}/ws`);
    socketRef.current = socket;

    socket.onopen = () => {
      const name = prompt("Enter your username") || "Player";
      setUsername(name);

      socket.send(
        JSON.stringify({
          type: "JOIN",
          room: roomId,
          username: name,
        })
      );
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
          // server sends username + index
          if (msg.username !== username) {
            setOpponentProgress(msg.index);
            setOpponentName(msg.username);
          }
          break;

        case "GAME_OVER":
          setGameFinished(true);
          setWinner(msg.winner);
          break;
      }
    };

    socket.onclose = () => setIsConnected(false);

    return () => socket.close();
  }, [roomId, username]);

  // ---------------- INPUT ----------------
  const handleChange = (e) => {
    const value = e.target.value;
    setInput(value);

    if (!gameStarted || gameFinished) return;

    const currentWord = words[index];
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

  // ---------------- WPM ----------------
  useEffect(() => {
    if (!gameStarted || !startTime) return;

    const interval = setInterval(() => {
      const minutes = (Date.now() - startTime) / 60000;

      if (minutes > 0) {
        const charsTyped = words
          .slice(0, index)
          .reduce((acc, w) => acc + w.text.length, 0);

        setWpm(Math.round((charsTyped / 5) / minutes));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [gameStarted, startTime, index, words]);

  // ---------------- INVITE ----------------
  const createInvite = () => {
    const room = Math.random().toString(36).substring(2, 8);
    const link = `${window.location.origin}?room=${room}`;

    navigator.clipboard
      .writeText(link)
      .then(() => alert("Invite copied:\n" + link))
      .catch(() => alert("Failed to copy link"));
  };

  // ---------------- RESET ----------------
  const resetGame = () => {
    setIndex(0);
    setInput("");
    setOpponentProgress(0);
    setOpponentName("");
    setGameFinished(false);
    setGameStarted(false);
    setCountdown(null);
    setStartTime(null);
    setWpm(0);
  };

  const currentWord = words[index];

  // ---------------- UI ----------------
  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* HEADER */}
        <div style={styles.header}>
          <h1 style={styles.title}>⚡ Typing Duel</h1>

          <div style={styles.status}>
            <div
              style={{
                ...styles.dot,
                backgroundColor: isConnected ? "#22c55e" : "#ef4444",
              }}
            />
            <span>{isConnected ? "Opponent Connected" : "Waiting..."}</span>
          </div>
        </div>

        <button onClick={createInvite} style={styles.button}>
          Invite Friend
        </button>

        {roomId && (
          <p style={styles.room}>
            Room: <b>{roomId}</b>
          </p>
        )}

        {/* COUNTDOWN */}
        {countdown !== null && (
          <div style={styles.centerBlock}>
            <h1 style={styles.countdown}>{countdown}</h1>
          </div>
        )}

        {/* GAME OVER */}
        {gameFinished && (
          <div style={styles.card}>
            <h2>🎉 Game Over</h2>
            <p>
              Winner: <b>{winner}</b>
            </p>
            <button onClick={resetGame} style={styles.button}>
              Play Again
            </button>
          </div>
        )}

        {/* GAME */}
        {!gameFinished && gameStarted && currentWord && (
          <div style={styles.gameCard}>
            <div style={styles.statsRow}>
              <div>
                You: <b>{index}</b>
              </div>
              <div>
                WPM: <b>{wpm}</b>
              </div>
            </div>

            <div style={styles.progress}>
              You: {index} / {words.length} <br />
              {opponentName || "Opponent"}: {opponentProgress}
            </div>

            <div style={styles.wordBox}>{currentWord.text}</div>

            <input
              value={input}
              onChange={handleChange}
              autoFocus
              disabled={!gameStarted || gameFinished}
              style={styles.input}
            />
          </div>
        )}

        {/* WAITING */}
        {!gameStarted && countdown === null && !gameFinished && (
          <p style={styles.waiting}>Waiting for players...</p>
        )}
      </div>
    </div>
  );
}

/* ---------------- STYLES ---------------- */

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    background: "radial-gradient(circle at top, #1e293b, #0f172a)",
    fontFamily: "Arial",
    color: "#e2e8f0",
    padding: 20,
  },

  container: {
    width: "100%",
    maxWidth: 700,
    display: "flex",
    flexDirection: "column",
    gap: 20,
  },

  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },

  title: {
    fontSize: 28,
    margin: 0,
    color: "#38bdf8",
  },

  status: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    fontSize: 14,
    color: "#cbd5e1",
  },

  dot: {
    width: 10,
    height: 10,
    borderRadius: "50%",
  },

  button: {
    padding: "10px 14px",
    borderRadius: 10,
    border: "none",
    cursor: "pointer",
    background: "#6366f1",
    color: "white",
    fontWeight: "bold",
  },

  room: {
    color: "#94a3b8",
  },

  centerBlock: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    padding: 40,
  },

  countdown: {
    fontSize: 72,
    color: "#38bdf8",
  },

  card: {
    background: "#111827",
    padding: 20,
    borderRadius: 16,
    textAlign: "center",
    border: "1px solid #1f2937",
  },

  gameCard: {
    background: "#111827",
    padding: 24,
    borderRadius: 16,
    border: "1px solid #1f2937",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },

  statsRow: {
    display: "flex",
    justifyContent: "space-between",
    color: "#cbd5e1",
  },

  progress: {
    fontSize: 14,
    color: "#94a3b8",
  },

  wordBox: {
    fontSize: 36,
    textAlign: "center",
    color: "#38bdf8",
    fontWeight: "bold",
  },

  input: {
    fontSize: 18,
    padding: 12,
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#0b1220",
    color: "#e2e8f0",
    outline: "none",
  },

  waiting: {
    textAlign: "center",
    color: "#94a3b8",
  },
};