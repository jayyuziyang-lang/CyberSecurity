package com.example.cybersec.service.impl; // 注意这里的包名

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.example.cybersec.entity.News;
import com.example.cybersec.repository.NewsMapper;
import com.example.cybersec.service.NewsService;
import org.springframework.stereotype.Service;

@Service
public class NewsServiceImpl extends ServiceImpl<NewsMapper, News> implements NewsService {
    // 暂时空着没关系
}