package com.typemaster.typemaster.repository;

import com.typemaster.typemaster.model.Word;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WordRepository extends JpaRepository<Word, Long> {
}