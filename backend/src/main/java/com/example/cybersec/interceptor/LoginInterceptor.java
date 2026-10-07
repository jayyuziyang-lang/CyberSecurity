package com.example.cybersec.interceptor;

import com.example.cybersec.common.ApiResponse;
import com.example.cybersec.entity.User;
import com.example.cybersec.service.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.HandlerInterceptor;

@Component
public class LoginInterceptor implements HandlerInterceptor {

    private final UserService userService;
    private final ObjectMapper objectMapper;

    public LoginInterceptor(UserService userService, ObjectMapper objectMapper) {
        this.userService = userService;
        this.objectMapper = objectMapper;
    }

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        if (!(handler instanceof HandlerMethod)) {
            return true;
        }

        String userIdText = request.getHeader("X-User-Id");
        if (!StringUtils.hasText(userIdText)) {
            return true;
        }

        Long userId;
        try {
            userId = Long.valueOf(userIdText);
        } catch (NumberFormatException ex) {
            return true;
        }

        User user = userService.getById(userId);
        if (user == null) {
            return true;
        }

        Integer role = user.getRole();
        if (role != null && role == 1) {
            return true;
        }

        if (role != null && role == 0 && !Boolean.TRUE.equals(user.getIsAuthenticated())) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write(objectMapper.writeValueAsString(ApiResponse.error(403, "forbidden")));
            return false;
        }
        return true;
    }
}
