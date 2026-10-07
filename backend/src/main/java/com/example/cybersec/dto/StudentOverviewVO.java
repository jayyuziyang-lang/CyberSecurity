package com.example.cybersec.dto;

import lombok.Data;

import java.math.BigDecimal;

@Data
public class StudentOverviewVO {
    private Integer totalStudents;
    private BigDecimal averageScore;
}
