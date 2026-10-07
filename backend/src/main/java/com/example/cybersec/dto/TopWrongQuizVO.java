package com.example.cybersec.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class TopWrongQuizVO {
    private Integer quizId;
    private String question;
    private Integer wrongCount;
    private BigDecimal wrongRate;
}
