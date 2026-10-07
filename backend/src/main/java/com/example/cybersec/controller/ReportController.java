package com.example.cybersec.controller;

import com.example.cybersec.common.ApiResponse;
import com.example.cybersec.entity.Report;
import com.example.cybersec.service.ReportService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;

@RestController
@RequestMapping("/api/report")
public class ReportController {

    @Autowired
    private ReportService reportService;

    @PostMapping("/submit")
    public ApiResponse<String> submitReport(@RequestBody Report report) {
        if (!StringUtils.hasText(report.getTitle()) || !StringUtils.hasText(report.getContent())) {
            return ApiResponse.error(400, "title and content are required");
        }

        if (report.getUserId() == null) {
            report.setUserId(0L);
        }
        if (!StringUtils.hasText(report.getImages())) {
            report.setImages("[]");
        }
        if (report.getCreateTime() == null) {
            report.setCreateTime(LocalDateTime.now());
        }
        if (report.getStatus() == null) {
            report.setStatus(0);
        }

        boolean success = reportService.save(report);
        if (success) {
            return ApiResponse.success("report submitted");
        }
        return ApiResponse.error(500, "report submit failed");
    }

}
