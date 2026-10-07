package com.example.cybersec.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Data
public class LearningOverviewVO {
    private Integer totalStudents;
    private BigDecimal averageScore;
    private List<TopWrongQuizVO> topWrongQuizzes = new ArrayList<>();
}
