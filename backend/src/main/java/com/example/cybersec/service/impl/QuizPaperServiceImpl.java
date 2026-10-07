package com.example.cybersec.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.example.cybersec.entity.QuizPaper;
import com.example.cybersec.repository.QuizPaperMapper;
import com.example.cybersec.service.QuizPaperService;
import org.springframework.stereotype.Service;

@Service
public class QuizPaperServiceImpl extends ServiceImpl<QuizPaperMapper, QuizPaper> implements QuizPaperService {
}
