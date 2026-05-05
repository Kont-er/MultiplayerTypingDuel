package com.typemaster.typemaster.database;

import java.sql.Connection;
import java.sql.Statement;

import com.typemaster.typemaster.service.DataLoader;

public class DatabaseSetup {
    public static void init() {
        String sql = """
            CREATE TABLE IF NOT EXISTS words (
                id BIGINT AUTO_INCREMENT PRIMARY KEY,
                text VARCHAR(255),
                difficulty VARCHAR(50)
            )
            """;

        try (Connection conn = Database.connect();
             Statement stmt = conn.createStatement()) {
            
            stmt.execute(sql);
            System.out.println("Database creation successfull");
            try {DataLoader.loadWords(conn);} catch (Exception e) {System.out.println("Database creampie failed!");}

        } catch (Exception e) {
            System.err.println("Database initialization failed:");
            e.printStackTrace();
        }
    }
}
