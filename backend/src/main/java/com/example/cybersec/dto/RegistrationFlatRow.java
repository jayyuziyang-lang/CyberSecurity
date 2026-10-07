package com.example.cybersec.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class RegistrationFlatRow {
    private Long registrationId;
    private Long newsId;
    private String newsTitle;
    private Long userId;
    private String username;
    private String nickname;
    private LocalDateTime registrationTime;
}
