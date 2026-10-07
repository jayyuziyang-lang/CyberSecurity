package com.example.cybersec.dto;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class RegistrationStudentVO {
    private Long userId;
    private String username;
    private String nickname;
    private LocalDateTime registrationTime;
}
