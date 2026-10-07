package com.example.cybersec.dto;

import lombok.Data;

@Data
public class AuthVerifyRequest {
    private Long userId;
    private String realName;
    private String idCard;
}
