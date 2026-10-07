package com.example.cybersec;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@MapperScan("com.example.cybersec.repository") // 告诉 Spring 去哪里找你的 UserMapper
public class CybersecApplication {

    public static void main(String[] args) {
        SpringApplication.run(CybersecApplication.class, args);
    }

}
