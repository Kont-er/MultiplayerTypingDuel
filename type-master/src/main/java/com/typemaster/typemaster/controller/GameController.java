package com.typemaster.typemaster.controller;

import com.typemaster.typemaster.model.Word;
import com.typemaster.typemaster.repository.WordRepository;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

import java.util.List;

@Controller
public class GameController {

    private final WordRepository repo;

    public GameController(WordRepository repo) {
        this.repo = repo;
    }

    @GetMapping("/")
    public String gamePage(Model model) {
        List<Word> words = repo.findAll();
        model.addAttribute("words", words);
        return "game";
    }
}