package com.example.cybersec.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class AdminSummaryVO {
    private Long newsId;
    private String newsTitle;
    private String category;
    private Integer registrationCount;
    private List<String> studentNicknames = new ArrayList<>();
}
