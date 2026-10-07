package com.example.cybersec.task;

import com.example.cybersec.entity.News;
import com.example.cybersec.service.NewsService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.concurrent.ThreadLocalRandom;

@Component
public class NewsScheduleTask {

    private static final String[] ALERT_TOPICS = {
            "可疑流量激增",
            "钓鱼链接传播",
            "高危漏洞通告",
            "勒索软件活动",
            "异常登录行为"
    };

    @Autowired
    private NewsService newsService;

    @Scheduled(cron = "0 */10 * * * ?")
    public void publishRealtimeAlert() {
        int index = ThreadLocalRandom.current().nextInt(ALERT_TOPICS.length);
        int level = ThreadLocalRandom.current().nextInt(1, 6);

        News news = new News();
        news.setTitle("[实时预警] " + ALERT_TOPICS[index] + "（等级" + level + "）");
        news.setCategory("安全动态");
        news.setAuthor("预警中心");
        news.setContent("系统巡检发现" + ALERT_TOPICS[index] + "，请相关同学尽快核查并处理。");
        news.setCreateTime(LocalDateTime.now());

        newsService.save(news);
    }
}
