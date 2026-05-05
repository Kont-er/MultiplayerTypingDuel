package com.typemaster.typemaster.controller;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;

import java.io.OutputStream;
import java.sql.Connection;
import java.util.List;

import com.typemaster.typemaster.database.Database;
import com.typemaster.typemaster.repository.WordRepository;

import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public class GameHandler implements HttpHandler {

    @Override
    public void handle(HttpExchange exchange) {
        try {
            // Only allow GET requests
            if (!exchange.getRequestMethod().equalsIgnoreCase("GET")) {
                exchange.sendResponseHeaders(405, -1); // Method Not Allowed
                return;
            }

            // Connect to database
            Connection conn = Database.connect();

            // Fetch words
            List<String> words = WordRepository.findAll(conn);

            // Load HTML template
            String template = loadHtmlTemplate();

            // Pick a word (basic logic)
            String word = words.isEmpty() ? "no words" : words.get(0);

            // Inject word into template
            String html = renderHtml(template, word);

            // Send response
            byte[] responseBytes = html.getBytes(StandardCharsets.UTF_8);

            exchange.getResponseHeaders().set("Content-Type", "text/html; charset=UTF-8");
            exchange.sendResponseHeaders(200, responseBytes.length);

            OutputStream os = exchange.getResponseBody();
            os.write(responseBytes);
            os.close();

            conn.close();

        } catch (Exception e) {
            e.printStackTrace();
            sendError(exchange);
        }
    }

    // 🔹 Load HTML file from resources
    private String loadHtmlTemplate() throws Exception {
        InputStream is = getClass()
                .getClassLoader()
                .getResourceAsStream("game.html");

        if (is == null) {
            throw new RuntimeException("game.html not found in resources");
        }

        return new String(is.readAllBytes(), StandardCharsets.UTF_8);
    }

    // 🔹 Replace placeholder with actual data
    private String renderHtml(String template, String word) {
        return template.replace("{{word}}", word);
    }

    // 🔹 Simple error response
    private void sendError(HttpExchange exchange) {
        try {
            String error = "<h1>500 Internal Server Error</h1>";
            exchange.sendResponseHeaders(500, error.length());

            OutputStream os = exchange.getResponseBody();
            os.write(error.getBytes());
            os.close();

        } catch (Exception ex) {
            ex.printStackTrace();
        }
    }
}