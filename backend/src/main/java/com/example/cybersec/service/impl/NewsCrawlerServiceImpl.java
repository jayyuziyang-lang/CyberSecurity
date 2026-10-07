package com.example.cybersec.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.example.cybersec.entity.News;
import com.example.cybersec.service.NewsCrawlerService;
import com.example.cybersec.service.NewsService;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Service
public class NewsCrawlerServiceImpl implements NewsCrawlerService {

    private static final String SOURCE_CTFHUB = "ctfhub";
    private static final String CTFHUB_URL = "https://www.ctfhub.com/";
    private static final String SECRSS_URL = "https://www.secrss.com/";
    private static final String CATEGORY_COMPETITION = "\u7ade\u8d5b\u4fe1\u606f";
    private static final String CATEGORY_ACTIVITY = "\u7f51\u7edc\u5b89\u5168\u6d3b\u52a8";
    private static final String CATEGORY_SECURITY = "\u5b89\u5168\u52a8\u6001";
    private static final String KEYWORD_COMPETITION = "\u7ade\u8d5b";
    private static final String KEYWORD_ACTIVITY = "\u6d3b\u52a8";
    private static final String KEYWORD_LECTURE = "\u8bb2\u5ea7";

    private final NewsService newsService;

    public NewsCrawlerServiceImpl(NewsService newsService) {
        this.newsService = newsService;
    }

    @Override
    public int crawl(String source, int limit) {
        String target = SOURCE_CTFHUB.equalsIgnoreCase(source) ? CTFHUB_URL : SECRSS_URL;
        int max = limit <= 0 ? 20 : Math.min(limit, 100);
        try {
            Document doc = Jsoup.connect(target)
                    .userAgent("Mozilla/5.0")
                    .timeout(10000)
                    .get();
            List<CrawlItem> items = extractItems(doc, target, max);
            return saveItems(items);
        } catch (Exception ex) {
            return 0;
        }
    }

    private List<CrawlItem> extractItems(Document doc, String baseUrl, int max) {
        List<CrawlItem> result = new ArrayList<>();
        Elements blocks = doc.select("article, li, .item, .post, .news-item, .list-item");
        if (blocks.isEmpty()) {
            blocks = doc.select("a[href]");
        }

        for (Element block : blocks) {
            Element linkEle = block.selectFirst("a[href]");
            if (linkEle == null) {
                continue;
            }
            String title = cleanText(linkEle.text());
            if (!StringUtils.hasText(title) || title.length() < 4) {
                continue;
            }
            String link = linkEle.absUrl("href");
            if (!StringUtils.hasText(link)) {
                link = linkEle.attr("href");
                if (StringUtils.hasText(link) && !link.startsWith("http")) {
                    link = baseUrl + (link.startsWith("/") ? link.substring(1) : link);
                }
            }

            String cover = "";
            Element img = block.selectFirst("img");
            if (img != null) {
                cover = img.absUrl("src");
                if (!StringUtils.hasText(cover)) {
                    cover = img.absUrl("data-src");
                }
            }

            CrawlItem item = new CrawlItem();
            item.title = title;
            item.link = link;
            item.cover = cover;
            result.add(item);
            if (result.size() >= max) {
                break;
            }
        }
        return result;
    }

    private int saveItems(List<CrawlItem> items) {
        int inserted = 0;
        for (CrawlItem item : items) {
            News exists = newsService.getOne(new LambdaQueryWrapper<News>()
                    .eq(News::getTitle, item.title)
                    .last("limit 1"));
            if (exists != null) {
                continue;
            }

            News news = new News();
            news.setTitle(item.title);
            news.setCoverUrl(item.cover);
            news.setContent(item.link);
            news.setAuthor("crawler");
            news.setCategory(matchCategory(item.title));
            news.setIsCompetition(CATEGORY_COMPETITION.equals(news.getCategory()));
            news.setCreateTime(LocalDateTime.now());
            boolean ok = newsService.save(news);
            if (ok) {
                inserted++;
            }
        }
        return inserted;
    }

    private String matchCategory(String title) {
        if (!StringUtils.hasText(title)) {
            return CATEGORY_SECURITY;
        }
        String text = title.toLowerCase();
        if (text.contains(KEYWORD_COMPETITION) || text.contains("ctf")) {
            return CATEGORY_COMPETITION;
        }
        if (text.contains(KEYWORD_ACTIVITY) || text.contains(KEYWORD_LECTURE)) {
            return CATEGORY_ACTIVITY;
        }
        return CATEGORY_SECURITY;
    }

    private String cleanText(String text) {
        return text == null ? "" : text.replaceAll("\\s+", " ").trim();
    }

    private static class CrawlItem {
        private String title;
        private String cover;
        private String link;
    }
}
