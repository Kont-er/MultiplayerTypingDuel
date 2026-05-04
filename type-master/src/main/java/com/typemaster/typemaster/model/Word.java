package com.typemaster.typemaster.model;
import jakarta.persistence.*;
import lombok.*;

@Entity
@Data
public class Word {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private long id;

    private String text;
    private String difficulty;
}
