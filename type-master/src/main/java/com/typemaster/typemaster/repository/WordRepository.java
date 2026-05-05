package com.typemaster.typemaster.repository;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import java.sql.Statement;

public class WordRepository {

    public static void insert(Connection conn, String text, String difficulty) throws Exception {
        String sql = "INSERT INTO words (text, difficulty) VALUES (?, ?)";

        PreparedStatement ps = conn.prepareStatement(sql);
        ps.setString(1, text);
        ps.setString(2, difficulty);

        ps.executeUpdate();
        ps.close();
    }

    public static List<String> findAll(Connection conn) throws Exception {
        List<String> words = new ArrayList<>();

        String sql = "SELECT text FROM words";

        Statement stmt = conn.createStatement();
        ResultSet rs = stmt.executeQuery(sql);

        while (rs.next()) {
            words.add(rs.getString("text"));
        }

        rs.close();
        stmt.close();

        return words;
    }
}