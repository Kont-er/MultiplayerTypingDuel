
import { useEffect, useMemo, useRef, useState } from "react";

export default function App() {
  // =========================================================
  // CONFIG
  // =========================================================

  const API_URL = "https://type-masters-production.up.railway.app";
  const WS_URL = "wss://type-masters-production.up.railway.app";

  // =========================================================
  // SOCKET
  // =========================================================

  const socketRef = useRef(null);

  // =========================================================
  // ROOM
  // =========================================================

  const roomId = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("room") || null;
  }, []);

  // =========================================================
  // MODE
  // =========================================================

  const [mode, setMode] = useState(null); // single | multi

  // =========================================================
  // PLAYER
  // =========================================================

  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // =========================================================
  // GAME
  // =========================================================

  const [gameStarted, setGameStarted] = useState(false);
  const [gameFinished, setGameFinished] = useState(false);
  const [winner, setWinner] = useState(null);

  // =========================================================
  // WORDS
  // =========================================================

  const [words, setWords] = useState([]);
  const [index, setIndex] = useState(0);
  const [input, setInput] = useState("");

  // =========================================================
  // COUNTDOWN
  // =========================================================

  const [countdown, setCountdown] = useState(null);

  // =========================================================
  // PLAYERS
  // =========================================================

  const [players, setPlayers] = useState([]);
  const [totalWords, setTotalWords] = useState(0);

  // =========================================================
  // AUTO DETECT MULTIPLAYER
  // =========================================================

  useEffect(() => {
    if (roomId) {
      setMode("multi");
    }
  }, [roomId]);

  // =========================================================
  // SINGLEPLAYER START
  // =========================================================

  const startSingleplayer = async () => {
    try {
      const res = await fetch(`${API_URL}/api/words`);
      const data = await res.json();

      setWords(data);
      setTotalWords(data.length);

      setPlayers([
        {
          username: "You",
          progress: 0,
        },
      ]);

      setCountdown(3);

      let count = 3;

      const interval = setInterval(() => {
        count--;

        if (count === 0) {
          clearInterval(interval);
          setCountdown(null);
          setGameStarted(true);
          return;
        }

        setCountdown(count);
      }, 1000);
    } catch (err) {
      console.error(err);
      alert("Failed to start singleplayer game");
    }
  };

  // =========================================================
  // CONNECT SOCKET
  // =========================================================

  useEffect(() => {
    if (!joined || mode !== "multi" || !roomId) {
      return;
    }

    const socket = new WebSocket(`${WS_URL}/ws`);

    socketRef.current = socket;

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "JOIN",
          room: roomId,
          username: username.trim().slice(0, 20),
        })
      );
    };

    socket.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        // =====================================================
        // LOBBY
        // =====================================================

        case "LOBBY":
          setPlayers(msg.players || []);
          break;

        // =====================================================
        // WORDS
        // =====================================================

        case "WORDS":
          setWords(msg.words || []);
          break;

        // =====================================================
        // COUNTDOWN
        // =====================================================

        case "COUNTDOWN":
          setCountdown(msg.value);
          break;

        // =====================================================
        // START
        // =====================================================

        case "START":
          setCountdown(null);
          setGameStarted(true);
          break;

        // =====================================================
        // STATE
        // =====================================================

        case "STATE":
          setPlayers(msg.players || []);
          setTotalWords(msg.totalWords || 0);
          break;

        // =====================================================
        // GAME OVER
        // =====================================================

        case "GAME_OVER":
          setGameFinished(true);
          setWinner(msg.winner);
          break;

        // =====================================================
        // ERROR
        // =====================================================

        case "ERROR":
          alert(msg.message || "Something went wrong");
          break;

        default:
          break;
      }
    };

    socket.onerror = () => {
      alert("Connection error");
    };

    socket.onclose = () => {
      console.log("Disconnected from server");
    };

    return () => {
      socket.close();
    };
  }, [joined, roomId, username, mode]);

  // =========================================================
  // CREATE MULTIPLAYER ROOM
  // =========================================================

  const createRoom = async () => {
    try {
      const res = await fetch(`${API_URL}/api/create-room`, {
        method: "POST",
      });

      const data = await res.json();

      window.location.href = `/?room=${data.roomId}`;
    } catch (err) {
      console.error(err);
      alert("Failed to create room");
    }
  };

  // =========================================================
  // HANDLE READY
  // =========================================================

  const handleReady = () => {
    if (isReady) return;

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          type: "READY",
        })
      );

      setIsReady(true);
    }
  };

  // =========================================================
  // HANDLE INPUT
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

      // =====================================================
      // SINGLEPLAYER
      // =====================================================

      if (mode === "single") {
        setPlayers([
          {
            username: "You",
            progress: nextIndex,
          },
        ]);

        if (nextIndex >= words.length) {
          setGameFinished(true);
          setWinner("You won!");
        }

        return;
      }

      // =====================================================
      // MULTIPLAYER
      // =====================================================

      socketRef.current?.send(
        JSON.stringify({
          type: "PROGRESS",
          index: nextIndex,
        })
      );
    }
  };

  // =========================================================
  // MAIN MENU
  // =========================================================

  if (!mode) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h1 style={{ marginBottom: 30 }}>⚡ TypeMaster</h1>

          <button
            style={styles.button}
            onClick={() => {
              setMode("single");
              setJoined(true);
              startSingleplayer();
            }}
          >
            Singleplayer
          </button>

          <button
            style={{
              ...styles.button,
              marginTop: 14,
            }}
            onClick={createRoom}
          >
            Multiplayer
          </button>
        </div>
      </div>
    );
  }

  // =========================================================
  // USERNAME SCREEN
  // =========================================================

  if (mode === "multi" && !joined) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h2>Join Multiplayer Room</h2>

          <p style={{ color: "#94a3b8" }}>Room: {roomId}</p>

          <input
            style={styles.input}
            placeholder="Enter username"
            value={username}
            maxLength={20}
            onChange={(e) => setUsername(e.target.value)}
          />

          <button
            style={styles.button}
            disabled={!username.trim()}
            onClick={() => {
              setJoined(true);
            }}
          >
            Join Lobby
          </button>
        </div>
      </div>
    );
  }

  // =========================================================
  // LOBBY
  // =========================================================

  if (mode === "multi" && !gameStarted && !gameFinished) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h1>⚡ Multiplayer Lobby</h1>

          <p style={{ color: "#94a3b8" }}>Room: {roomId}</p>

          {/* ================================================= */}
          {/* INVITE LINK */}
          {/* ================================================= */}

          <div style={{ marginTop: 20 }}>
            <p>Invite Link</p>

            <div style={styles.linkBox}>{window.location.href}</div>

            <button
              style={{
                ...styles.button,
                marginTop: 12,
              }}
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
              }}
            >
              Copy Invite Link
            </button>
          </div>

          {/* ================================================= */}
          {/* READY BUTTON */}
          {/* ================================================= */}

          <button
            style={{
              ...styles.button,
              marginTop: 24,
              background: isReady ? "#16a34a" : "#6366f1",
            }}
            disabled={isReady}
            onClick={handleReady}
          >
            {isReady ? "Ready ✔" : "Click Ready"}
          </button>

          {/* ================================================= */}
          {/* PLAYERS */}
          {/* ================================================= */}

          <div style={{ marginTop: 30, textAlign: "left" }}>
            <h3>Players</h3>

            {players.length === 0 && (
              <p style={{ color: "#94a3b8" }}>Waiting for players...</p>
            )}

            {players.map((p, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "8px 0",
                  borderBottom: "1px solid #1e293b",
                }}
              >
                <span>{p.username}</span>

                <span>
                  {p.ready ? "✔ Ready" : "⏳ Not Ready"}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // GAME OVER
  // =========================================================

  if (gameFinished) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h1>🏁 Game Over</h1>

          <h2 style={{ marginTop: 20 }}>{winner}</h2>

          <button
            style={{
              ...styles.button,
              marginTop: 20,
            }}
            onClick={() => {
              window.location.href = "/";
            }}
          >
            Play Again
          </button>
        </div>
      </div>
    );
  }

  // =========================================================
  // GAME SCREEN
  // =========================================================

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        <h1 style={{ textAlign: "center" }}>⚡ TypeMaster</h1>

        {/* ================================================= */}
        {/* COUNTDOWN */}
        {/* ================================================= */}

        {countdown !== null && (
          <div style={styles.countdown}>{countdown}</div>
        )}

        {/* ================================================= */}
        {/* PROGRESS BARS */}
        {/* ================================================= */}

        <div style={{ marginTop: 30 }}>
          {players.map((p, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 6,
                }}
              >
                <span>{p.username}</span>

                <span>
                  {p.progress || 0} / {totalWords}
                </span>
              </div>

              <div style={styles.barBg}>
                <div
                  style={{
                    ...styles.barFill,
                    width: totalWords
                      ? `${((p.progress || 0) / totalWords) * 100}%`
                      : "0%",
                  }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* ================================================= */}
        {/* CURRENT WORD */}
        {/* ================================================= */}

        <div style={styles.word}>{currentWord?.text}</div>

        {/* ================================================= */}
        {/* INPUT */}
        {/* ================================================= */}

        <input
          autoFocus
          style={styles.input}
          value={input}
          onChange={handleInput}
          disabled={!gameStarted}
          placeholder="Type here..."
        />
      </div>
    </div>
  );
}

// =========================================================
// STYLES
// =========================================================

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
    maxWidth: 700,
  },

  card: {
    width: "100%",
    maxWidth: 500,
    background: "#111827",
    padding: 30,
    borderRadius: 16,
    textAlign: "center",
    boxShadow: "0 10px 30px rgba(0,0,0,0.3)",
  },

  button: {
    width: "100%",
    padding: "12px 16px",
    border: "none",
    borderRadius: 10,
    background: "#6366f1",
    color: "white",
    fontSize: 16,
    cursor: "pointer",
    transition: "0.2s",
  },

  input: {
    width: "100%",
    padding: 14,
    marginTop: 20,
    borderRadius: 10,
    border: "1px solid #334155",
    background: "#0b1220",
    color: "white",
    fontSize: 18,
    outline: "none",
    boxSizing: "border-box",
  },

  word: {
    fontSize: 42,
    textAlign: "center",
    marginTop: 40,
    marginBottom: 20,
    color: "#38bdf8",
    fontWeight: "bold",
  },

  countdown: {
    textAlign: "center",
    fontSize: 72,
    marginTop: 20,
    fontWeight: "bold",
    color: "#facc15",
  },

  barBg: {
    width: "100%",
    height: 14,
    background: "#1f2937",
    borderRadius: 999,
    overflow: "hidden",
  },

  barFill: {
    height: "100%",
    background: "#38bdf8",
    transition: "width 0.15s linear",
  },

  linkBox: {
    marginTop: 10,
    background: "#0b1220",
    padding: 12,
    borderRadius: 8,
    border: "1px solid #334155",
    wordBreak: "break-all",
    color: "#94a3b8",
    fontSize: 14,
  },
};

