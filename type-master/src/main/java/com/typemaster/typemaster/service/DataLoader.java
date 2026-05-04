package com.typemaster.typemaster.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.typemaster.typemaster.model.Word;
import com.typemaster.typemaster.repository.WordRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.InputStream;
import java.util.List;

@Configuration
public class DataLoader {

    @Bean
    CommandLineRunner loadData(WordRepository repo) {
        return args -> {
            ObjectMapper mapper = new ObjectMapper();
            InputStream is = getClass().getResourceAsStream("/data.json");

            List<Word> words = mapper.readValue(is, new TypeReference<>() {});
            repo.saveAll(words);
        };
    }
}