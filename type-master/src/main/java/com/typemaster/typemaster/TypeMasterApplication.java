package com.typemaster.typemaster;

import io.javalin.Javalin;
import io.javalin.websocket.WsContext;

import com.typemaster.typemaster.database.DatabaseSetup;
import com.typemaster.typemaster.database.Database;
import com.typemaster.typemaster.repository.WordRepository;
import com.typemaster.typemaster.model.Word;

import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

public class TypeMasterApplication {

    // --- ROOM STATE ---
    static class RoomState {
        List<WsContext> players = Collections.synchronizedList(new ArrayList<>());
        List<Word> words = new ArrayList<>();
        boolean started = false;
        boolean finished = false;
        long startTime = 0;
    }

    private static final Map<String, RoomState> rooms = new ConcurrentHashMap<>();
    private static final Map<WsContext, String> playerRoom = new ConcurrentHashMap<>();

    public static void main(String[] args) {
        DatabaseSetup.init();

        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));

        Javalin app = Javalin.create(config -> {
            config.bundledPlugins.enableCors(cors -> {
                cors.addRule(it -> it.anyHost());
            });
        }).start(port);

        // --- OPTIONAL HTTP ROUTE ---
        app.get("/api/words", ctx -> {
            var conn = Database.connect();
            var words = WordRepository.findAll(conn);
            ctx.json(words.subList(0, Math.min(words.size(), 15)));
            conn.close();
        });

        // --- WEBSOCKET ---
        app.ws("/ws", ws -> {

            ws.onConnect(ctx -> {
                System.out.println("New Connection: " + ctx.sessionId());
            });

            ws.onMessage(ctx -> {
                Map<String, String> msg = simpleParse(ctx.message());
                String type = msg.get("type");

                // --- JOIN ---
                if ("JOIN".equals(type)) {
                    String roomId = msg.get("room");

                    RoomState room = rooms.computeIfAbsent(roomId, k -> new RoomState());
                    room.players.add(ctx);
                    playerRoom.put(ctx, roomId);

                    broadcast(roomId, "{\"type\":\"PLAYER_JOINED\",\"count\":" + room.players.size() + "}");

                    if (room.players.size() == 2 && !room.started) {
                        startGame(roomId, room);
                    }
                }

                // --- PROGRESS ---
                if ("PROGRESS".equals(type)) {
                    String roomId = playerRoom.get(ctx);
                    RoomState room = rooms.get(roomId);

                    if (room == null || !room.started || room.finished) return;

                    int index = Integer.parseInt(msg.get("index"));

                    broadcast(roomId, "{\"type\":\"PROGRESS\",\"index\":" + index + "}");

                    // --- WIN CONDITION ---
                    if (index >= room.words.size()) {
                        room.finished = true;

                        String winner = "Player " + ctx.sessionId().substring(0, 4);

                        broadcast(roomId, "{\"type\":\"GAME_OVER\",\"winner\":\"" + winner + "\"}");
                    }
                }
            });

            ws.onClose(ctx -> {
                String roomId = playerRoom.get(ctx);

                if (roomId != null) {
                    RoomState room = rooms.get(roomId);

                    if (room != null) {
                        room.players.remove(ctx);

                        if (room.players.isEmpty()) {
                            rooms.remove(roomId);
                        }
                    }
                }

                playerRoom.remove(ctx);
                System.out.println("Disconnected: " + ctx.sessionId());
            });
        });
    }

    // --- START GAME ---
    private static void startGame(String roomId, RoomState room) {
        try {
            var conn = Database.connect();
            List<Word> allWords = WordRepository.findAll(conn);
            conn.close();

            Collections.shuffle(allWords);

            // Take 15 words
            room.words = allWords.subList(0, Math.min(15, allWords.size()));

            // Send words
            String wordsJson = buildWordsJson(room.words);
            broadcast(roomId, "{\"type\":\"WORDS\",\"words\":" + wordsJson + "}");

            // Countdown
            new Thread(() -> {
                try {
                    for (int i = 3; i >= 1; i--) {
                        broadcast(roomId, "{\"type\":\"COUNTDOWN\",\"value\":" + i + "}");
                        Thread.sleep(1000);
                    }

                    room.started = true;
                    room.startTime = System.currentTimeMillis();

                    broadcast(roomId, "{\"type\":\"START\",\"startTime\":" + room.startTime + "}");

                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            }).start();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // --- BROADCAST ---
    private static void broadcast(String roomId, String message) {
        RoomState room = rooms.get(roomId);
        if (room == null) return;

        for (WsContext player : room.players) {
            if (player.session.isOpen()) {
                player.send(message);
            }
        }
    }

    // --- BUILD WORDS JSON ---
    private static String buildWordsJson(List<Word> words) {
        StringBuilder sb = new StringBuilder("[");

        for (int i = 0; i < words.size(); i++) {
            Word w = words.get(i);

            sb.append("{\"text\":\"")
              .append(w.getText())
              .append("\",\"difficulty\":\"")
              .append(w.getDifficulty())
              .append("\"}");

            if (i < words.size() - 1) sb.append(",");
        }

        sb.append("]");
        return sb.toString();
    }

    // --- SIMPLE JSON PARSER ---
    private static Map<String, String> simpleParse(String json) {
        Map<String, String> map = new HashMap<>();

        String clean = json
                .replace("{", "")
                .replace("}", "")
                .replace("\"", "");

        for (String part : clean.split(",")) {
            String[] kv = part.split(":");
            if (kv.length == 2) {
                map.put(kv[0].trim(), kv[1].trim());
            }
        }

        return map;
    }
}

