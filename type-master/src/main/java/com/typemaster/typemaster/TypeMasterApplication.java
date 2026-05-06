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

    // --- PLAYER STATE ---
    static class Player {
        WsContext ctx;
        String name = "Anonymous";
        boolean ready = false;

        Player(WsContext ctx) {
            this.ctx = ctx;
        }
    }

    // --- ROOM STATE ---
    static class RoomState {
        List<Player> players = Collections.synchronizedList(new ArrayList<>());
        List<Word> words = new ArrayList<>();
        boolean started = false;
        boolean finished = false;
        long startTime = 0;
    }

    private static final Map<String, RoomState> rooms = new ConcurrentHashMap<>();
    private static final Map<WsContext, String> playerRoom = new ConcurrentHashMap<>();
    private static final Map<WsContext, Player> playerMap = new ConcurrentHashMap<>();

    public static void main(String[] args) {
        DatabaseSetup.init();

        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));

        Javalin app = Javalin.create(config -> {
            config.bundledPlugins.enableCors(cors -> {
                cors.addRule(it -> it.anyHost());
            });
        }).start(port);

        app.ws("/ws", ws -> {

            ws.onConnect(ctx -> {
                System.out.println("Connected: " + ctx.sessionId());
                playerMap.put(ctx, new Player(ctx));
            });

            ws.onMessage(ctx -> {
                Map<String, String> msg = simpleParse(ctx.message());
                String type = msg.get("type");

                // --- JOIN ---
                if ("JOIN".equals(type)) {
                    String roomId = msg.get("room");

                    RoomState room = rooms.computeIfAbsent(roomId, k -> new RoomState());
                    Player player = playerMap.get(ctx);

                    room.players.add(player);
                    playerRoom.put(ctx, roomId);

                    broadcastPlayers(roomId);
                }

                // --- SET NAME ---
                if ("PLAYER_NAME".equals(type)) {
                    Player player = playerMap.get(ctx);
                    player.name = msg.get("name");

                    String roomId = playerRoom.get(ctx);
                    broadcastPlayers(roomId);
                }

                // --- READY ---
                if ("READY".equals(type)) {
                    Player player = playerMap.get(ctx);
                    player.ready = true;

                    String roomId = playerRoom.get(ctx);
                    RoomState room = rooms.get(roomId);

                    broadcastPlayers(roomId);

                    // Check if all ready
                    if (room.players.size() >= 2 &&
                        room.players.stream().allMatch(p -> p.ready) &&
                        !room.started) {

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

                    if (index >= room.words.size()) {
                        room.finished = true;

                        Player winnerPlayer = playerMap.get(ctx);

                        broadcast(roomId,
                            "{\"type\":\"GAME_OVER\",\"winner\":\"" + winnerPlayer.name + "\"}");
                    }
                }
            });

            ws.onClose(ctx -> {
                String roomId = playerRoom.get(ctx);

                if (roomId != null) {
                    RoomState room = rooms.get(roomId);

                    if (room != null) {
                        room.players.removeIf(p -> p.ctx == ctx);

                        if (room.players.isEmpty()) {
                            rooms.remove(roomId);
                        } else {
                            broadcastPlayers(roomId);
                        }
                    }
                }

                playerRoom.remove(ctx);
                playerMap.remove(ctx);

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

            room.words = new ArrayList<>(
                allWords.subList(0, Math.min(15, allWords.size()))
            );

            String wordsJson = buildWordsJson(room.words);
            broadcast(roomId, "{\"type\":\"WORDS\",\"words\":" + wordsJson + "}");

            new Thread(() -> {
                try {
                    for (int i = 3; i >= 1; i--) {
                        broadcast(roomId, "{\"type\":\"COUNTDOWN\",\"value\":" + i + "}");
                        Thread.sleep(1000);
                    }

                    room.started = true;
                    room.startTime = System.currentTimeMillis();

                    broadcast(roomId,
                        "{\"type\":\"START\",\"startTime\":" + room.startTime + "}");

                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            }).start();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // --- BROADCAST PLAYERS ---
    private static void broadcastPlayers(String roomId) {
        RoomState room = rooms.get(roomId);
        if (room == null) return;

        StringBuilder sb = new StringBuilder("{\"type\":\"PLAYERS\",\"players\":[");

        for (int i = 0; i < room.players.size(); i++) {
            Player p = room.players.get(i);

            sb.append("{\"name\":\"")
              .append(p.name)
              .append("\",\"ready\":")
              .append(p.ready)
              .append("}");

            if (i < room.players.size() - 1) sb.append(",");
        }

        sb.append("]}");

        broadcast(roomId, sb.toString());
    }

    // --- BROADCAST ---
    private static void broadcast(String roomId, String message) {
        RoomState room = rooms.get(roomId);
        if (room == null) return;

        for (Player p : room.players) {
            if (p.ctx.session.isOpen()) {
                p.ctx.send(message);
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

    // --- SIMPLE PARSER ---
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

