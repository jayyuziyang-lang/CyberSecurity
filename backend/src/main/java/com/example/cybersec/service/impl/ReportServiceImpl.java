package com.example.cybersec.service.impl;

import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.example.cybersec.entity.News;
import com.example.cybersec.entity.Report;
import com.example.cybersec.repository.ReportMapper;
import com.example.cybersec.service.NewsService;
import com.example.cybersec.service.ReportService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDateTime;

@Service
public class ReportServiceImpl extends ServiceImpl<ReportMapper, Report> implements ReportService {

    private static final String SYSTEM_NOTICE_CATEGORY = "\u7cfb\u7edf\u516c\u544a";
    private static final Integer APPROVED_STATUS = 1;

    private final NewsService newsService;

    public ReportServiceImpl(NewsService newsService) {
        this.newsService = newsService;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean approveReportAndPublish(Long reportId) {
        Report report = this.getById(reportId);
        if (report == null) {
            return false;
        }
        if (APPROVED_STATUS.equals(report.getStatus())) {
            return true;
        }

        report.setStatus(APPROVED_STATUS);
        boolean updated = this.updateById(report);
        if (!updated) {
            return false;
        }

        News notice = new News();
        String reportTitle = StringUtils.hasText(report.getTitle()) ? report.getTitle().trim() : "Untitled report";
        String reportContent = StringUtils.hasText(report.getContent()) ? report.getContent().trim() : "No content";
        notice.setCategory(SYSTEM_NOTICE_CATEGORY);
        notice.setTitle("\u5b89\u5168\u4e3e\u62a5\uff1a" + reportTitle);
        notice.setContent("\u4e3e\u62a5\u6807\u9898\uff1a" + reportTitle + "\n\u4e3e\u62a5\u5185\u5bb9\uff1a" + reportContent);
        notice.setAuthor("\u7cfb\u7edf\u7ba1\u7406\u5458");
        notice.setIsCompetition(false);
        notice.setCreateTime(LocalDateTime.now());
        return newsService.save(notice);
    }
}
