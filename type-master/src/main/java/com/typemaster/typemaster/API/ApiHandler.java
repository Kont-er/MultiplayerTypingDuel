package com.typemaster.typemaster.API;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.typemaster.typemaster.database.Database;
import com.typemaster.typemaster.model.Word;
import com.typemaster.typemaster.repository.WordRepository;

import java.io.OutputStream;
import java.sql.Connection;
import java.util.List;

public class ApiHandler implements HttpHandler {

    @Override
    public void handle(HttpExchange exchange) {
        try {
            if (!exchange.getRequestMethod().equalsIgnoreCase("GET")) {
                exchange.sendResponseHeaders(405, -1);
                return;
            }

            exchange.getResponseHeaders().add("Access-Control-Allow-Origin", "*");
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            
            Connection conn = Database.connect();

            List<Word> words = WordRepository.findAll(conn);

            String json = buildJson(words);

            byte[] response = json.getBytes();

            exchange.getResponseHeaders().set("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, response.length);

            OutputStream os = exchange.getResponseBody();
            os.write(response);
            os.close();

            conn.close();

        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private String buildJson(List<Word> words) {
    StringBuilder sb = new StringBuilder();
    sb.append("[");

    for (int i = 0; i < words.size(); i++) {

        Word w = words.get(i);

        sb.append("{")
          .append("\"text\":\"").append(w.getText()).append("\",")
          .append("\"difficulty\":\"").append(w.getDifficulty()).append("\"")
          .append("}");

        if (i < words.size() - 1) sb.append(",");
    }

    sb.append("]");
    return sb.toString();
}
}
