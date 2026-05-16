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

  const [mode, setMode] = useState(null); // "single" | "multi"

  // =========================================================
  // PLAYER
  // =========================================================

  const [username, setUsername] = useState("");
  const [joined, setJoined] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // =========================================================
  // GAME STATE
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
  // AUTO-DETECT MULTIPLAYER MODE
  // =========================================================

  useEffect(() => {
    if (roomId) setMode("multi");
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

      setPlayers([{ username: "You", progress: 0 }]);

      setIndex(0);
      setInput("");
      setGameFinished(false);
      setWinner(null);
      setCountdown(3);
      setGameStarted(false);

      let count = 3;

      const interval = setInterval(() => {
        count--;

        if (count <= 0) {
          clearInterval(interval);
          setCountdown(null);
          setGameStarted(true);
          return;
        }

        setCountdown(count);
      }, 1000);

    } catch (err) {
      console.error(err);
      alert("Failed to start singleplayer");
    }
  };

  // =========================================================
  // MULTIPLAYER SOCKET
  // =========================================================

  useEffect(() => {
    if (!joined || mode !== "multi" || !roomId) return;

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
        case "LOBBY":
          setPlayers(msg.players || []);
          break;

        case "WORDS":
          setWords(msg.words || []);
          break;

        case "COUNTDOWN":
          setCountdown(msg.value);
          break;

        case "START":
          setCountdown(null);
          setGameStarted(true);
          break;

        case "STATE":
          setPlayers(msg.players || []);
          setTotalWords(msg.totalWords || 0);
          break;

        case "GAME_OVER":
          setGameFinished(true);
          setWinner(msg.winner);
          break;

        case "ERROR":
          alert(msg.message);
          break;
      }
    };

    return () => socket.close();
  }, [joined, mode, roomId, username]);

  // =========================================================
  // CREATE ROOM
  // =========================================================

  const createRoom = async () => {
    const res = await fetch(`${API_URL}/api/create-room`, {
      method: "POST",
    });

    const data = await res.json();
    window.location.href = `/?room=${data.roomId}`;
  };

  // =========================================================
  // READY BUTTON
  // =========================================================

  const handleReady = () => {
    if (isReady) return;

    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({ type: "READY" })
      );

      setIsReady(true);
    }
  };

  // =========================================================
  // WORD HANDLING
  // =========================================================

  const currentWord = gameStarted ? words[index] : null;

  const handleInput = (e) => {
    const value = e.target.value;
    setInput(value);

    if (!currentWord) return;

    if (value.trim().toLowerCase() === currentWord.text.toLowerCase()) {
      const nextIndex = index + 1;
      setIndex(nextIndex);
      setInput("");

      // SINGLEPLAYER LOGIC
      if (mode === "single") {
        setPlayers([{ username: "You", progress: nextIndex }]);

        if (nextIndex >= words.length) {
          setGameFinished(true);
          setWinner("You won!");
        }

        return;
      }

      // MULTIPLAYER LOGIC
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
          <h1>⚡ TypeMaster</h1>

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
            style={{ ...styles.button, marginTop: 10 }}
            onClick={createRoom}
          >
            Multiplayer
          </button>
        </div>
      </div>
    );
  }

  // =========================================================
  // USERNAME (MULTIPLAYER)
  // =========================================================

  if (mode === "multi" && !joined) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <h2>Enter Username</h2>

          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={styles.input}
          />

          <button
            disabled={!username.trim()}
            onClick={() => setJoined(true)}
            style={styles.button}
          >
            Join
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
          <h2>Lobby</h2>

          <div style={styles.linkBox}>
            {window.location.href}
          </div>

          <button
            onClick={() =>
              navigator.clipboard.writeText(window.location.href)
            }
            style={styles.button}
          >
            Copy Invite
          </button>

          <button
            onClick={handleReady}
            disabled={isReady}
            style={styles.button}
          >
            {isReady ? "Ready ✔" : "Ready Up"}
          </button>

          <div>
            {players.map((p, i) => (
              <div key={i}>
                {p.username} {p.ready ? "✔" : "⏳"}
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
          <h2>{winner}</h2>

          <button
            onClick={() => (window.location.href = "/")}
            style={styles.button}
          >
            Restart
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

        {countdown !== null && <h1>{countdown}</h1>}

        <div>
          {players.map((p, i) => (
            <div key={i}>
              {p.username} {p.progress}/{totalWords}
            </div>
          ))}
        </div>

        <h1>{currentWord?.text}</h1>

        <input
          value={input}
          onChange={handleInput}
          disabled={!gameStarted}
          style={styles.input}
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
    color: "white",
  },

  card: {
    padding: 20,
    background: "#111",
    borderRadius: 10,
    textAlign: "center",
  },

  button: {
    padding: 10,
    marginTop: 10,
    background: "#6366f1",
    color: "white",
    border: "none",
    borderRadius: 6,
    cursor: "pointer",
    width: "100%",
  },

  input: {
    padding: 10,
    marginTop: 10,
    width: "100%",
  },

  container: {
    width: 600,
  },

  linkBox: {
    background: "#222",
    padding: 10,
    marginTop: 10,
    fontSize: 12,
    wordBreak: "break-all",
  },
};