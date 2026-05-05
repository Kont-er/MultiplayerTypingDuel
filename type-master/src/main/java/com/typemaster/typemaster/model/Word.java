package com.typemaster.typemaster.model;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Data
public class Word {
    private String text;
    private String difficulty;

    public Word(String text, String difficulty) {
        this.text = text;
        this.difficulty = difficulty;
    }

    public String getText() {
        return text;
    }

    public String getDifficulty() {
        return difficulty;
    }
}