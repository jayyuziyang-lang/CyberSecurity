package com.example.cybersec.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.example.cybersec.entity.QuizBank;
import com.example.cybersec.repository.QuizBankMapper;
import com.example.cybersec.service.QuizBankService;
import org.springframework.stereotype.Service;

@Service
public class QuizBankServiceImpl extends ServiceImpl<QuizBankMapper, QuizBank> implements QuizBankService {
}
