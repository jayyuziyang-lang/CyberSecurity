package com.example.cybersec.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.example.cybersec.common.ApiResponse;
import com.example.cybersec.entity.User;
import com.example.cybersec.repository.UserMapper;
import com.example.cybersec.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/user")
public class LoginController {

    @Autowired
    private UserService userService;

    @Autowired
    private UserMapper userMapper;

    @PostMapping("/login")
    public ApiResponse<Map<String, Object>> login(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");

        if (!StringUtils.hasText(username) || !StringUtils.hasText(password)) {
            return ApiResponse.error(400, "username and password are required");
        }

        User user = userService.getOne(new LambdaQueryWrapper<User>()
                .eq(User::getUsername, username)
                .eq(User::getPassword, password)
                .last("limit 1"));

        if (user == null) {
            return ApiResponse.error(401, "username or password is incorrect");
        }

        String token = UUID.randomUUID().toString().replace("-", "");

        Map<String, Object> userInfo = new HashMap<>();
        userInfo.put("id", user.getId());
        userInfo.put("username", user.getUsername());
        userInfo.put("nickname", user.getNickname());
        userInfo.put("avatarUrl", user.getAvatarUrl());
        userInfo.put("points", user.getPoints());
        userInfo.put("isFollowed", user.getIsFollowed());
        userInfo.put("role", user.getRole());
        userInfo.put("isAuthenticated", Boolean.TRUE.equals(user.getIsAuthenticated()));

        Map<String, Object> result = new HashMap<>();
        result.put("token", token);
        result.put("role", user.getRole());
        result.put("isAuthenticated", Boolean.TRUE.equals(user.getIsAuthenticated()));
        result.put("userInfo", userInfo);

        return ApiResponse.success(result);
    }

    @PostMapping("/register")
    public ApiResponse<String> register(@RequestBody Map<String, String> body) {
        String username = body.get("username");
        String password = body.get("password");

        if (!StringUtils.hasText(username) || !StringUtils.hasText(password)) {
            return ApiResponse.error(400, "username and password are required");
        }

        String normalizedUsername = username.trim();
        User existing = userService.getOne(new LambdaQueryWrapper<User>()
                .eq(User::getUsername, normalizedUsername)
                .last("limit 1"));
        if (existing != null) {
            return ApiResponse.error(409, "username already exists");
        }

        User user = new User();
        user.setUsername(normalizedUsername);
        user.setPassword(password.trim());
        user.setNickname(normalizedUsername);
        user.setAvatarUrl("/images/default-avatar.png");
        user.setPoints(0);
        user.setIsFollowed(0);
        user.setRole(0);
        user.setIsAuthenticated(false);

        int saved = userMapper.insertRegisteredUser(user);
        if (saved <= 0) {
            return ApiResponse.error(500, "register failed");
        }
        return ApiResponse.success("registered");
    }
}
