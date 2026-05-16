package com.typemaster.typemaster;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.javalin.Javalin;
import io.javalin.websocket.WsContext;

import java.util.*;
import java.util.concurrent.*;

public class TypeMasterApplication {

    // =========================================================
    // MODELS
    // =========================================================

    static class Player {
        WsContext ctx;
        String username;
        int progress = 0;
        boolean ready = false;
    }

    static class RoomState {
        List<Player> players = Collections.synchronizedList(new ArrayList<>());
        List<Map<String, String>> words = new ArrayList<>();
        boolean started = false;
        boolean finished = false;
        long startTime = 0;
    }

    // =========================================================
    // GLOBAL STATE
    // =========================================================

    static final Map<String, RoomState> rooms = new ConcurrentHashMap<>();
    static final Map<WsContext, String> playerRoom = new ConcurrentHashMap<>();

    static final ObjectMapper mapper = new ObjectMapper();
    static final ScheduledExecutorService scheduler = Executors.newScheduledThreadPool(4);

    // =========================================================
    // MAIN
    // =========================================================

    public static void main(String[] args) {

        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));

        Javalin app = Javalin.create(config ->
                config.bundledPlugins.enableCors(cors -> cors.addRule(it -> it.anyHost()))
        ).start(port);

        // =====================================================
        // CREATE ROOM (INVITE LINK SYSTEM)
        // =====================================================

        app.post("/api/create-room", ctx -> {
            String roomId = UUID.randomUUID().toString().substring(0, 6).toUpperCase();

            rooms.put(roomId, new RoomState());

            ctx.json(Map.of("roomId", roomId));
        });

        // =====================================================
        // WEBSOCKET
        // =====================================================

        app.ws("/ws", ws -> {

            ws.onConnect(ctx ->
                    System.out.println("Connected: " + ctx.sessionId())
            );

            ws.onMessage(ctx -> {

                Map<String, Object> msg;

                try {
                    msg = mapper.readValue(ctx.message(), Map.class);
                } catch (Exception e) {
                    sendError(ctx, "Invalid JSON");
                    return;
                }

                String type = (String) msg.get("type");

                // =================================================
                // JOIN ROOM
                // =================================================

                if ("JOIN".equals(type)) {

                    String roomId = (String) msg.get("room");
                    String username = ((String) msg.get("username")).trim();

                    if (username.length() > 20) username = username.substring(0, 20);

                    RoomState room = rooms.get(roomId);

                    if (room == null) {
                        sendError(ctx, "Room not found");
                        return;
                    }

                    Player player = new Player();
                    player.ctx = ctx;
                    player.username = username;

                    room.players.add(player);
                    playerRoom.put(ctx, roomId);

                    broadcastLobby(roomId);
                }

                // =================================================
                // READY
                // =================================================

                if ("READY".equals(type)) {

                    String roomId = playerRoom.get(ctx);
                    RoomState room = rooms.get(roomId);

                    if (room == null) return;

                    Player player = findPlayer(room, ctx);
                    if (player == null) return;

                    player.ready = true;

                    broadcastLobby(roomId);

                    if (allReady(room) && !room.started) {
                        startGame(roomId, room);
                    }
                }

                // =================================================
                // PROGRESS (ANTI-CHEAT BASIC VALIDATION)
                // =================================================

                if ("PROGRESS".equals(type)) {

                    String roomId = playerRoom.get(ctx);
                    RoomState room = rooms.get(roomId);

                    if (room == null || room.finished || !room.started) return;

                    Player player = findPlayer(room, ctx);
                    if (player == null) return;

                    int index = ((Number) msg.get("index")).intValue();

                    // simple anti-cheat: only allow +1 step
                    if (index != player.progress + 1) {
                        return;
                    }

                    player.progress = index;

                    // WIN CONDITION
                    if (index >= room.words.size()) {
                        room.finished = true;

                        broadcast(roomId, Map.of(
                                "type", "GAME_OVER",
                                "winner", player.username + " won"
                        ));

                        return;
                    }

                    broadcastState(roomId, room);
                }
            });

            // =====================================================
            // DISCONNECT
            // =====================================================

            ws.onClose(ctx -> {

                String roomId = playerRoom.get(ctx);

                if (roomId != null) {
                    RoomState room = rooms.get(roomId);

                    if (room != null) {
                        room.players.removeIf(p -> p.ctx.equals(ctx));

                        broadcastLobby(roomId);

                        if (room.players.isEmpty()) {
                            rooms.remove(roomId);
                        }
                    }
                }

                playerRoom.remove(ctx);
            });
        });
    }

    // =========================================================
    // START GAME
    // =========================================================

    static void startGame(String roomId, RoomState room) {

        // fake word generator (replace with DB if needed)
        room.words = generateWords(15);

        broadcast(roomId, Map.of(
                "type", "WORDS",
                "words", room.words
        ));

        scheduler.schedule(() -> {

            room.started = true;
            room.startTime = System.currentTimeMillis();

            broadcast(roomId, Map.of(
                    "type", "START",
                    "startTime", room.startTime
            ));

            broadcastState(roomId, room);

        }, 3, TimeUnit.SECONDS);

        // countdown
        for (int i = 3; i >= 1; i--) {
            int value = i;
            scheduler.schedule(() -> {
                broadcast(roomId, Map.of(
                        "type", "COUNTDOWN",
                        "value", value
                ));
            }, (3 - i), TimeUnit.SECONDS);
        }
    }

    // =========================================================
    // STATE
    // =========================================================

    static void broadcastState(String roomId, RoomState room) {

        List<Map<String, Object>> players = new ArrayList<>();

        synchronized (room.players) {
            for (Player p : room.players) {
                players.add(Map.of(
                        "username", p.username,
                        "progress", p.progress,
                        "ready", p.ready
                ));
            }
        }

        broadcast(roomId, Map.of(
                "type", "STATE",
                "players", players,
                "totalWords", room.words.size()
        ));
    }

    // =========================================================
    // LOBBY
    // =========================================================

    static void broadcastLobby(String roomId) {

        RoomState room = rooms.get(roomId);
        if (room == null) return;

        List<Map<String, Object>> players = new ArrayList<>();

        synchronized (room.players) {
            for (Player p : room.players) {
                players.add(Map.of(
                        "username", p.username,
                        "ready", p.ready
                ));
            }
        }

        broadcast(roomId, Map.of(
                "type", "LOBBY",
                "players", players
        ));
    }

    // =========================================================
    // BROADCAST
    // =========================================================

    static void broadcast(String roomId, Object msg) {

        RoomState room = rooms.get(roomId);
        if (room == null) return;

        String json;

        try {
            json = mapper.writeValueAsString(msg);
        } catch (Exception e) {
            return;
        }

        for (Player p : room.players) {
            try {
                if (p.ctx.session.isOpen()) {
                    p.ctx.send(json);
                }
            } catch (Exception ignored) {}
        }
    }

    // =========================================================
    // HELPERS
    // =========================================================

    static Player findPlayer(RoomState room, WsContext ctx) {
        for (Player p : room.players) {
            if (p.ctx.equals(ctx)) return p;
        }
        return null;
    }

    static boolean allReady(RoomState room) {
        if (room.players.size() < 1) return false;

        for (Player p : room.players) {
            if (!p.ready) return false;
        }

        return true;
    }

    static void sendError(WsContext ctx, String message) {
        try {
            ctx.send(mapper.writeValueAsString(Map.of(
                    "type", "ERROR",
                    "message", message
            )));
        } catch (Exception ignored) {}
    }

    // =========================================================
    // WORD GENERATOR (REPLACE WITH DB IF YOU WANT)
    // =========================================================

    static List<Map<String, String>> generateWords(int n) {

        String[] sample = {
                "apple", "banana", "rocket", "keyboard", "java",
                "spring", "socket", "browser", "cloud", "fast",
                "react", "server", "network", "game", "speed"
        };

        List<Map<String, String>> words = new ArrayList<>();

        Random r = new Random();

        for (int i = 0; i < n; i++) {
            String w = sample[r.nextInt(sample.length)];

            words.add(Map.of(
                    "text", w,
                    "difficulty", "easy"
            ));
        }

        return words;
    }
}