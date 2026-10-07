package com.example.cybersec.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.example.cybersec.entity.Quiz;
import com.example.cybersec.repository.QuizMapper;
import com.example.cybersec.service.QuizService;
import org.springframework.stereotype.Service;

@Service
public class QuizServiceImpl extends ServiceImpl<QuizMapper, Quiz> implements QuizService {
    // 这里暂时保持为空即可
}