package com.example.cybersec.dto;

import lombok.Data;

@Data
public class AdminSummaryRow {
    private Long newsId;
    private String newsTitle;
    private String category;
    private Integer registrationCount;
    private String studentNicknames;
}
