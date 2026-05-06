package com.typemaster.typemaster.repository;

import com.typemaster.typemaster.model.Word;
import org.junit.jupiter.api.*;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.Statement;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class WordRepositoryTest {

    private Connection conn;

    @BeforeEach
    void setUp() throws Exception {
        conn = DriverManager.getConnection("jdbc:h2:mem:testdb;DB_CLOSE_DELAY=-1");

        // Create table
        try (Statement stmt = conn.createStatement()) {
            stmt.execute("""
                CREATE TABLE words (
                    text VARCHAR(255),
                    difficulty VARCHAR(50)
                )
            """);
        }
    }

    @AfterEach
    void tearDown() throws Exception {
        conn.close();
    }

    @Test
    void testInsertAndFindAll() throws Exception {
        // Insert word
        WordRepository.insert(conn, "hello", "easy");

        // Fetch all words
        List<Word> words = WordRepository.findAll(conn);

        // Assertions
        assertEquals(1, words.size());
        assertEquals("hello", words.get(0).getText());
        assertEquals("easy", words.get(0).getDifficulty());
    }

}