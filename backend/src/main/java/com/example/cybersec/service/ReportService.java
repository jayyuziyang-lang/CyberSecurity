package com.example.cybersec.service;

import com.baomidou.mybatisplus.extension.service.IService;
import com.example.cybersec.entity.Report;

public interface ReportService extends IService<Report> {
    boolean approveReportAndPublish(Long reportId);
}
