package com.example.cybersec.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class RegistrationSummaryVO {
    private Long newsId;
    private String newsTitle;
    private Integer registrationCount;
    private List<RegistrationStudentVO> students = new ArrayList<>();
}
