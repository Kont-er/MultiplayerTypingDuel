package com.typemaster.typemaster.WebSocket;

import org.java_websocket.server.WebSocketServer;
import org.java_websocket.WebSocket;
import org.java_websocket.handshake.ClientHandshake;

import java.net.InetSocketAddress;
import java.util.*;

public class GameServer extends WebSocketServer {

    // roomId → players
    private final Map<String, List<WebSocket>> rooms = new HashMap<>();

    // player → room
    private final Map<WebSocket, String> playerRoom = new HashMap<>();

    public GameServer(int port) {
        super(new InetSocketAddress(port));
    }

    @Override
    public void onOpen(WebSocket conn, ClientHandshake handshake) {
        System.out.println("New connection: " + conn.getRemoteSocketAddress());
    }

    @Override
    public void onMessage(WebSocket conn, String message) {

        /*
         Expected JSON messages:

         JOIN ROOM:
         {"type":"JOIN","room":"abc123"}

         PROGRESS:
         {"type":"PROGRESS","index":5}

         FINISH:
         {"type":"FINISH"}
        */

        try {
            Map<String, Object> msg = parse(message);
            String type = (String) msg.get("type");

            if ("JOIN".equals(type)) {
                String room = (String) msg.get("room");

                rooms.putIfAbsent(room, new ArrayList<>());
                rooms.get(room).add(conn);
                playerRoom.put(conn, room);

                broadcast(room, "{\"type\":\"PLAYER_JOINED\",\"count\":" + rooms.get(room).size() + "}");
                System.out.println("Player joined room: " + room);
            }

            if ("PROGRESS".equals(type)) {
                String room = playerRoom.get(conn);
                int index = Integer.parseInt((String) msg.get("index"));

                broadcast(room,
                        "{\"type\":\"PROGRESS\",\"index\":" + index + "}"
                );
            }

            if ("FINISH".equals(type)) {
                String room = playerRoom.get(conn);

                broadcast(room,
                        "{\"type\":\"GAME_OVER\",\"winner\":\"" + conn.getRemoteSocketAddress() + "\"}"
                );

                System.out.println("Game finished in room: " + room);
            }

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void broadcast(String room, String message) {
        List<WebSocket> players = rooms.get(room);
        if (players == null) return;

        for (WebSocket ws : players) {
            ws.send(message);
        }
    }

    // very small JSON parser (keeps it simple, no Jackson)
    private Map<String, Object> parse(String json) {
        Map<String, Object> map = new HashMap<>();

        json = json.replace("{", "")
                   .replace("}", "")
                   .replace("\"", "");

        String[] parts = json.split(",");

        for (String part : parts) {
            String[] kv = part.split(":");
            map.put(kv[0], kv[1]);
        }

        return map;
    }

    @Override
    public void onClose(WebSocket conn, int code, String reason, boolean remote) {
        String room = playerRoom.get(conn);
        if (room != null && rooms.containsKey(room)) {
            rooms.get(room).remove(conn);
        }

        playerRoom.remove(conn);
        System.out.println("Connection closed");
    }

    @Override
    public void onError(WebSocket conn, Exception ex) {
        ex.printStackTrace();
    }

    @Override
    public void onStart() {
        System.out.println("WebSocket server started on port 8081");
    }
}
