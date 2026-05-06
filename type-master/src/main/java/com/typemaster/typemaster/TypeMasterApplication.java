package com.typemaster.typemaster;

import java.net.InetSocketAddress;

import com.typemaster.typemaster.API.ApiHandler;
import com.typemaster.typemaster.WebSocket.GameServer;
import com.typemaster.typemaster.controller.GameHandler;
import com.typemaster.typemaster.database.DatabaseSetup;

import com.sun.net.httpserver.HttpServer;

import io.javalin.Javalin;
import io.javalin.websocket.WsContext;
import com.typemaster.typemaster.database.Database;
import com.typemaster.typemaster.repository.WordRepository;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;


public class TypeMasterApplication {
// Room management
    private static final Map<String, List<WsContext>> rooms = new ConcurrentHashMap<>();
    private static final Map<WsContext, String> playerRoom = new ConcurrentHashMap<>();

    public static void main(String[] args) {
        // Use Railway's port
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));

        Javalin app = Javalin.create(config -> {
            config.bundledPlugins.enableCors(cors -> {
                cors.addRule(it -> it.anyHost());
            });
        }).start(port);

        // --- HTTP ROUTES ---
        app.get("/api/words", ctx -> {
            var conn = Database.connect();
            var words = WordRepository.findAll(conn);
            ctx.json(words.subList(0, Math.min(words.size(), 15)));
            conn.close();
        });

        // --- WEBSOCKET ROUTE ---
        app.ws("/ws", ws -> {
            ws.onConnect(ctx -> System.out.println("New Connection: " + ctx.sessionId()));

            ws.onMessage(ctx -> {
                // Using your existing simple parser logic (or Jackson)
                String message = ctx.message();
                Map<String, String> msg = simpleParse(message);
                String type = msg.get("type");

                if ("JOIN".equals(type)) {
                    String room = msg.get("room");
                    rooms.computeIfAbsent(room, k -> Collections.synchronizedList(new ArrayList<>())).add(ctx);
                    playerRoom.put(ctx, room);
                    
                    broadcast(room, "{\"type\":\"PLAYER_JOINED\",\"count\":" + rooms.get(room).size() + "}");
                }

                if ("PROGRESS".equals(type)) {
                    String room = playerRoom.get(ctx);
                    String index = msg.get("index");
                    broadcast(room, "{\"type\":\"PROGRESS\",\"index\":" + index + "}");
                }

                if ("FINISH".equals(type)) {
                    String room = playerRoom.get(ctx);
                    broadcast(room, "{\"type\":\"GAME_OVER\",\"winner\":\"Player " + ctx.sessionId().substring(0, 4) + "\"}");
                }
            });

            ws.onClose(ctx -> {
                String room = playerRoom.get(ctx);
                if (room != null) {
                    rooms.get(room).remove(ctx);
                    if (rooms.get(room).isEmpty()) rooms.remove(room);
                }
                playerRoom.remove(ctx);
            });
        });
    }

    private static void broadcast(String room, String message) {
        List<WsContext> players = rooms.get(room);
        if (players != null) {
            players.forEach(session -> {
                if (session.session.isOpen()) session.send(message);
            });
        }
    }

    // Your existing parser logic
    private static Map<String, String> simpleParse(String json) {
        Map<String, String> map = new HashMap<>();
        String clean = json.replace("{", "").replace("}", "").replace("\"", "");
        for (String part : clean.split(",")) {
            String[] kv = part.split(":");
            if (kv.length == 2) map.put(kv[0].trim(), kv[1].trim());
        }
        return map;
    }
}
