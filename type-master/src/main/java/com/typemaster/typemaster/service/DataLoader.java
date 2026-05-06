package com.typemaster.typemaster.service;

import com.typemaster.typemaster.repository.WordRepository;


import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.sql.Connection;

public class DataLoader {

    public static void loadWords(Connection conn) throws Exception {

        InputStream is = DataLoader.class
                .getClassLoader()
                .getResourceAsStream("data.json");

        if (is == null) {
            throw new RuntimeException("data.json not found");
        }

        String json = new String(is.readAllBytes(), StandardCharsets.UTF_8);

        // Remove outer brackets
        json = json.trim();
        json = json.substring(1, json.length() - 1);

        // Split objects (VERY naive but works for your format)
        String[] objects = json.split("\\},\\s*\\{");

        for (String obj : objects) {

            obj = obj.replace("{", "").replace("}", "");

            String[] fields = obj.split(",");

            String text = "";
            String difficulty = "";

            for (String field : fields) {
                String[] keyValue = field.split(":");

                String key = keyValue[0].replace("\"", "").trim();
                String value = keyValue[1].replace("\"", "").trim();

                if (key.equals("text")) {
                    text = value;
                } else if (key.equals("difficulty")) {
                    difficulty = value;
                }
            }

            WordRepository.insert(conn, text, difficulty);
        }

        System.out.println("JSON loaded manually (raw parser)");
    }
}