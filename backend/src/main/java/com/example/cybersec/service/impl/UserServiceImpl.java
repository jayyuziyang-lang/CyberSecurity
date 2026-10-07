package com.example.cybersec.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.example.cybersec.entity.User;
import com.example.cybersec.repository.UserMapper;
import com.example.cybersec.service.UserService;
import org.springframework.stereotype.Service;

/**
 * UserService 实现类
 */
@Service
public class UserServiceImpl extends ServiceImpl<UserMapper, User> implements UserService {
    // 这里是真正写登录逻辑、查库代码的地方
}