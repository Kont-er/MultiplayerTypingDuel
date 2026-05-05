package com.typemaster.typemaster;

import java.net.InetSocketAddress;

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

            server.setExecutor(null);
            server.start();

            System.out.println("Server running at http://localhost:8080");

        } catch (Exception e) {
            System.err.println("Failed to start server:");
            e.printStackTrace();
        }
    }
}
