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

    // ---------------- PLAYER ----------------
    static class Player {
        WsContext ctx;
        String username;
        int progress = 0;
        boolean ready = false;
    }

    // ---------------- ROOM ----------------
    static class RoomState {
        List<Player> players = Collections.synchronizedList(new ArrayList<>());
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

        Javalin app = Javalin.create(config ->
            config.bundledPlugins.enableCors(cors -> cors.addRule(it -> it.anyHost()))
        ).start(port);

        // ---------------- WORD API ----------------
        app.get("/api/words", ctx -> {
            var conn = Database.connect();
            var words = WordRepository.findAll(conn);
            ctx.json(words.subList(0, Math.min(words.size(), 15)));
            conn.close();
        });

        // ---------------- WEBSOCKET ----------------
        app.ws("/ws", ws -> {

            ws.onConnect(ctx ->
                System.out.println("Connected: " + ctx.sessionId())
            );

            ws.onMessage(ctx -> {

                Map<String, String> msg = simpleParse(ctx.message());
                String type = msg.get("type");

                // ================= JOIN =================
                if ("JOIN".equals(type)) {

                    String roomId = msg.get("room");
                    String username = msg.get("username");

                    RoomState room = rooms.computeIfAbsent(roomId, k -> new RoomState());

                    Player player = new Player();
                    player.ctx = ctx;
                    player.username = username;

                    room.players.add(player);
                    playerRoom.put(ctx, roomId);

                    broadcast(roomId,
                        "{\"type\":\"PLAYER_JOINED\",\"count\":" + room.players.size() + "}"
                    );
                }

                // ================= READY =================
                if ("READY".equals(type)) {

                    String roomId = playerRoom.get(ctx);
                    RoomState room = rooms.get(roomId);
                    if (room == null) return;

                    Player player = findPlayer(room, ctx);
                    if (player == null) return;

                    player.ready = true;

                    broadcast(roomId,
                        "{\"type\":\"PLAYER_READY\",\"username\":\"" +
                        player.username + "\"}"
                    );

                    if (allReady(room) && !room.started) {
                        startGame(roomId, room);
                    }
                }

                // ================= PROGRESS =================
                if ("PROGRESS".equals(type)) {

                    String roomId = playerRoom.get(ctx);
                    RoomState room = rooms.get(roomId);

                    if (room == null || room.finished || !room.started) return;

                    int index = Integer.parseInt(msg.get("index"));

                    Player player = findPlayer(room, ctx);
                    if (player == null) return;

                    player.progress = index;

                    // ---------------- WIN CONDITION ----------------
                    if (index >= room.words.size() && !room.finished) {
                        room.finished = true;

                        broadcast(roomId,
                            "{\"type\":\"GAME_OVER\",\"winner\":\"" +
                            player.username + " won\"}"
                        );
                        return;
                    }

                    // ---------------- FULL STATE SYNC ----------------
                    broadcast(roomId, buildState(room));
                }
            });

            ws.onClose(ctx -> {

                String roomId = playerRoom.get(ctx);

                if (roomId != null) {
                    RoomState room = rooms.get(roomId);

                    if (room != null) {
                        room.players.removeIf(p -> p.ctx.equals(ctx));

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

    // =========================================================
    // START GAME
    // =========================================================
    private static void startGame(String roomId, RoomState room) {
        try {
            var conn = Database.connect();
            List<Word> allWords = WordRepository.findAll(conn);
            conn.close();

            Collections.shuffle(allWords);

            room.words = new ArrayList<>(
                allWords.subList(0, Math.min(15, allWords.size()))
            );

            broadcast(roomId,
                "{\"type\":\"WORDS\",\"words\":" +
                buildWordsJson(room.words) + "}"
            );

            new Thread(() -> {
                try {
                    for (int i = 3; i >= 1; i--) {
                        broadcast(roomId,
                            "{\"type\":\"COUNTDOWN\",\"value\":" + i + "}"
                        );
                        Thread.sleep(1000);
                    }

                    room.started = true;
                    room.startTime = System.currentTimeMillis();

                    broadcast(roomId,
                        "{\"type\":\"START\",\"startTime\":" +
                        room.startTime + "}"
                    );

                    // initial state push
                    broadcast(roomId, buildState(room));

                } catch (InterruptedException e) {
                    e.printStackTrace();
                }
            }).start();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    // =========================================================
    // STATE BUILDER (CORE FEATURE)
    // =========================================================
    private static String buildState(RoomState room) {

        StringBuilder sb = new StringBuilder();

        sb.append("{\"type\":\"STATE\",\"players\":[");

        for (int i = 0; i < room.players.size(); i++) {
            Player p = room.players.get(i);

            sb.append("{")
              .append("\"username\":\"").append(p.username).append("\",")
              .append("\"progress\":").append(p.progress)
              .append("}");

            if (i < room.players.size() - 1) sb.append(",");
        }

        sb.append("],");
        sb.append("\"totalWords\":").append(room.words.size());
        sb.append("}");

        return sb.toString();
    }

    // =========================================================
    // HELPERS
    // =========================================================
    private static boolean allReady(RoomState room) {
        if (room.players.size() < 2) return false;

        for (Player p : room.players) {
            if (!p.ready) return false;
        }
        return true;
    }

    private static Player findPlayer(RoomState room, WsContext ctx) {
        for (Player p : room.players) {
            if (p.ctx.equals(ctx)) return p;
        }
        return null;
    }

    private static void broadcast(String roomId, String message) {
        RoomState room = rooms.get(roomId);
        if (room == null) return;

        for (Player p : room.players) {
            if (p.ctx.session.isOpen()) {
                p.ctx.send(message);
            }
        }
    }

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

    // =========================================================
    // SIMPLE JSON PARSER (keep for now, but replace later)
    // =========================================================
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