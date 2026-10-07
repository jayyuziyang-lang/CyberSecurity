package com.example.cybersec.controller;

import com.example.cybersec.common.ApiResponse;
import com.example.cybersec.dto.RegistrationSubmitRequest;
import com.example.cybersec.entity.News;
import com.example.cybersec.entity.User;
import com.example.cybersec.repository.RegistrationMapper;
import com.example.cybersec.service.NewsService;
import com.example.cybersec.service.UserService;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/registration")
public class RegistrationController {

    private final RegistrationMapper registrationMapper;
    private final UserService userService;
    private final NewsService newsService;

    public RegistrationController(RegistrationMapper registrationMapper, UserService userService, NewsService newsService) {
        this.registrationMapper = registrationMapper;
        this.userService = userService;
        this.newsService = newsService;
    }

    @PostMapping("/submit")
    public ApiResponse<String> submit(@RequestBody RegistrationSubmitRequest request) {
        if (request.getNewsId() == null || request.getUserId() == null) {
            return ApiResponse.error(400, "newsId and userId are required");
        }

        User user = userService.getById(request.getUserId());
        if (user == null) {
            return ApiResponse.error(404, "user not found");
        }
        if (user.getRole() == null || user.getRole() != 0) {
            return ApiResponse.error(403, "only students can register");
        }

        News news = newsService.getById(request.getNewsId());
        if (news == null || !StringUtils.hasText(news.getTitle())) {
            return ApiResponse.error(404, "news/activity not found");
        }

        int inserted = registrationMapper.insertIfAbsent(
                request.getNewsId(),
                request.getUserId(),
                LocalDateTime.now());
        return ApiResponse.success(inserted > 0 ? "registered" : "already registered");
    }
}
