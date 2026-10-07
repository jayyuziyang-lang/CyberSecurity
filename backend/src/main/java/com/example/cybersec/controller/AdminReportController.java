package com.example.cybersec.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.example.cybersec.common.ApiResponse;
import com.example.cybersec.entity.Report;
import com.example.cybersec.service.ReportService;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/admin/report")
public class AdminReportController {

    private final ReportService reportService;

    public AdminReportController(ReportService reportService) {
        this.reportService = reportService;
    }

    @GetMapping("/pending")
    public ApiResponse<List<Report>> pendingReports() {
        List<Report> list = reportService.list(new LambdaQueryWrapper<Report>()
                .and(wrapper -> wrapper.eq(Report::getStatus, 0).or().isNull(Report::getStatus))
                .orderByDesc(Report::getCreateTime));
        return ApiResponse.success(list);
    }

    @PostMapping("/approve/{id}")
    public ApiResponse<String> approveReport(@PathVariable Long id) {
        Report report = reportService.getById(id);
        if (report == null) {
            return ApiResponse.error(404, "report not found");
        }
        if (Integer.valueOf(1).equals(report.getStatus())) {
            return ApiResponse.success("report already approved");
        }

        boolean success = reportService.approveReportAndPublish(id);
        if (success) {
            return ApiResponse.success("report approved and announcement published");
        }
        return ApiResponse.error(500, "approve report failed");
    }
}
