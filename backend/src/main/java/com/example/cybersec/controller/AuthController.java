package com.example.cybersec.controller;

import com.example.cybersec.common.ApiResponse;
import com.example.cybersec.dto.AuthVerifyRequest;
import com.example.cybersec.entity.RealNameAuth;
import com.example.cybersec.entity.User;
import com.example.cybersec.repository.RealNameAuthMapper;
import com.example.cybersec.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private static final int ID_CARD_LENGTH = 18;

    private final UserService userService;
    private final RealNameAuthMapper realNameAuthMapper;

    public AuthController(UserService userService, RealNameAuthMapper realNameAuthMapper) {
        this.userService = userService;
        this.realNameAuthMapper = realNameAuthMapper;
    }

    @PostMapping("/verify")
    public ApiResponse<String> verify(@RequestBody AuthVerifyRequest request, HttpServletRequest servletRequest) {
        if (!StringUtils.hasText(request.getRealName()) || !StringUtils.hasText(request.getIdCard())) {
            return ApiResponse.error(400, "realName and idCard are required");
        }

        Long userId = request.getUserId();
        if (userId == null) {
            String userIdText = servletRequest.getHeader("X-User-Id");
            if (StringUtils.hasText(userIdText)) {
                try {
                    userId = Long.valueOf(userIdText);
                } catch (NumberFormatException ignored) {
                    userId = null;
                }
            }
        }
        if (userId == null) {
            return ApiResponse.error(400, "userId is required");
        }

        String realName = request.getRealName().trim();
        String idCard = request.getIdCard().trim();

        // Demo mode mock: skip any third-party ID verification and only check local rules.
        if (idCard.length() != ID_CARD_LENGTH) {
            return ApiResponse.error(400, "idCard must be 18 characters");
        }

        User user = userService.getById(userId);
        if (user == null) {
            return ApiResponse.error(404, "user not found");
        }

        RealNameAuth record = new RealNameAuth();
        record.setUserId(userId);
        record.setRealName(realName);
        record.setIdCard(idCard);
        record.setVerifiedAt(LocalDateTime.now());
        realNameAuthMapper.insert(record);

        user.setIsAuthenticated(true);
        userService.updateById(user);
        return ApiResponse.success("verified");
    }
}
