package com.example.cybersec.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.example.cybersec.common.ApiResponse;
import com.example.cybersec.entity.News;
import com.example.cybersec.service.NewsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;

@RestController
@RequestMapping({"/api/news", "/api/admin/news"})
public class NewsController {

    private static final String ALL_CATEGORY = "\u5168\u90e8";

    @Autowired
    private NewsService newsService;

    @GetMapping("/list")
    public ApiResponse<List<News>> getNewsList(@RequestParam(required = false) String category) {
        LambdaQueryWrapper<News> wrapper = new LambdaQueryWrapper<>();
        String normalizedCategory = category == null ? null : category.trim();
        if (StringUtils.hasText(normalizedCategory) && !ALL_CATEGORY.equals(normalizedCategory)) {
            wrapper.eq(News::getCategory, normalizedCategory);
        }
        wrapper.orderByDesc(News::getCreateTime);
        return ApiResponse.success(newsService.list(wrapper));
    }

    @GetMapping("/get/{id}")
    public ApiResponse<News> getNewsDetail(@PathVariable Integer id) {
        News news = newsService.getById(id);
        if (news != null) {
            return ApiResponse.success(news);
        }
        return ApiResponse.error(404, "news not found");
    }

    @GetMapping("/search")
    public ApiResponse<List<News>> searchNews(@RequestParam String keyword) {
        List<News> results = newsService.list(new LambdaQueryWrapper<News>()
                .like(News::getTitle, keyword)
                .or()
                .like(News::getContent, keyword)
                .orderByDesc(News::getCreateTime));
        return ApiResponse.success(results);
    }

    @PostMapping({"/publish", "/add", "/save"})
    public ApiResponse<String> publishNews(@RequestBody News news) {
        if (!StringUtils.hasText(news.getTitle()) || !StringUtils.hasText(news.getContent())) {
            return ApiResponse.error(400, "title and content are required");
        }
        if (!StringUtils.hasText(news.getCategory())) {
            news.setCategory("\u5b89\u5168\u52a8\u6001");
        }
        if (news.getIsCompetition() == null) {
            news.setIsCompetition(false);
        }
        if (news.getCreateTime() == null) {
            news.setCreateTime(LocalDateTime.now());
        }
        if (!StringUtils.hasText(news.getAuthor())) {
            news.setAuthor("\u7cfb\u7edf\u7ba1\u7406\u5458");
        }
        boolean saved = newsService.save(news);
        if (saved) {
            return ApiResponse.success("published");
        }
        return ApiResponse.error(500, "publish failed");
    }

    @PostMapping("/crawl")
    public ApiResponse<String> crawlNews(@RequestParam(defaultValue = "secrss") String source,
                                         @RequestParam(defaultValue = "20") Integer limit) {
        return ApiResponse.error(503, "crawler disabled, using database data only");
    }
}
