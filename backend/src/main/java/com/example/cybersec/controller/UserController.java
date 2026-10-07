package com.example.cybersec.controller;

import com.example.cybersec.common.ApiResponse;
import com.example.cybersec.entity.User;
import com.example.cybersec.service.UserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/user")
public class UserController {

    @Autowired
    private UserService userService;

    @GetMapping("/info/{id}")
    public ApiResponse<User> getUserInfo(@PathVariable Long id) {
        User user = userService.getById(id);
        if (user != null) {
            return ApiResponse.success(user);
        }
        return ApiResponse.error(404, "user not found");
    }

    @GetMapping("/leaderboard")
    public ApiResponse<List<User>> getLeaderboard() {
        List<User> list = userService.lambdaQuery()
                .orderByDesc(User::getPoints)
                .last("limit 10")
                .list();
        return ApiResponse.success(list);
    }

    @GetMapping("/simulate/follow/{id}")
    public ApiResponse<String> simulateFollow(@PathVariable Long id) {
        User user = userService.getById(id);
        if (user != null) {
            user.setIsFollowed(1);
            userService.updateById(user);
            return ApiResponse.success("followed");
        }
        return ApiResponse.error(404, "user not found");
    }

    @PostMapping("/update")
    public ApiResponse<User> updateUser(@RequestBody User payload) {
        if (payload.getId() == null) {
            return ApiResponse.error(400, "user id is required");
        }

        User existing = userService.getById(payload.getId());
        if (existing == null) {
            return ApiResponse.error(404, "user not found");
        }

        User updateModel = new User();
        updateModel.setId(payload.getId());
        if (StringUtils.hasText(payload.getNickname())) {
            updateModel.setNickname(payload.getNickname().trim());
        }
        if (StringUtils.hasText(payload.getAvatarUrl())) {
            updateModel.setAvatarUrl(payload.getAvatarUrl().trim());
        }

        boolean updated = userService.updateById(updateModel);
        if (!updated) {
            return ApiResponse.error(500, "update failed");
        }

        User latest = userService.getById(payload.getId());
        return ApiResponse.success(latest);
    }
}
