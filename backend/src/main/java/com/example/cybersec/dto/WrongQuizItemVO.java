package com.example.cybersec.dto;

import lombok.Data;

@Data
public class WrongQuizItemVO {
    private Long wrongId;
    private Integer quizId;
    private Integer errorCount;
    private String question;
    private String optionA;
    private String optionB;
    private String optionC;
    private String optionD;
    private String answer;
    private String analysis;
}
