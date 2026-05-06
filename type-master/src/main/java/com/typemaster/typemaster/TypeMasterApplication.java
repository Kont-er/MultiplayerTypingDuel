package com.typemaster.typemaster;

import java.net.InetSocketAddress;

import com.typemaster.typemaster.API.ApiHandler;
import com.typemaster.typemaster.WebSocket.GameServer;
import com.typemaster.typemaster.controller.GameHandler;
import com.typemaster.typemaster.database.DatabaseSetup;

import com.sun.net.httpserver.HttpServer;


public class TypeMasterApplication {

    public static void main(String[] args) {
        try {
            // 1. Setup database
            DatabaseSetup.init();

            // 2. Start server
            HttpServer server = HttpServer.create(new InetSocketAddress(8080), 0);

            // 3. Route
            server.createContext("/", new GameHandler());
			server.createContext("/api/words", new ApiHandler());
            server.setExecutor(null);
            server.start();

            System.out.println("Server running at http://localhost:8080");

            GameServer server2 = new GameServer(8081);
            server2.start();
            System.out.println("Server2 running at http://localhost:8081");

        } catch (Exception e) {
            System.err.println("Failed to start server:");
            e.printStackTrace();
        }
    }
}
