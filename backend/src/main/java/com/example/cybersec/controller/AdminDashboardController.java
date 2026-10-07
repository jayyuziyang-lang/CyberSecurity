package com.example.cybersec.controller;

import com.example.cybersec.common.ApiResponse;
import com.example.cybersec.dto.LearningOverviewVO;
import com.example.cybersec.dto.RegistrationFlatRow;
import com.example.cybersec.dto.RegistrationStudentVO;
import com.example.cybersec.dto.RegistrationSummaryVO;
import com.example.cybersec.dto.StudentOverviewVO;
import com.example.cybersec.repository.AdminDashboardMapper;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin/dashboard")
public class AdminDashboardController {

    private final AdminDashboardMapper adminDashboardMapper;

    public AdminDashboardController(AdminDashboardMapper adminDashboardMapper) {
        this.adminDashboardMapper = adminDashboardMapper;
    }

    @GetMapping("/registrations")
    public ApiResponse<List<RegistrationSummaryVO>> getRegistrationDetails() {
        List<RegistrationFlatRow> rows = adminDashboardMapper.selectRegistrationDetails();
        Map<Long, RegistrationSummaryVO> grouped = new LinkedHashMap<>();
        for (RegistrationFlatRow row : rows) {
            Long newsId = row.getNewsId();
            RegistrationSummaryVO summary = grouped.computeIfAbsent(newsId, key -> {
                RegistrationSummaryVO vo = new RegistrationSummaryVO();
                vo.setNewsId(newsId);
                vo.setNewsTitle(row.getNewsTitle());
                vo.setRegistrationCount(0);
                return vo;
            });

            RegistrationStudentVO student = new RegistrationStudentVO();
            student.setUserId(row.getUserId());
            student.setUsername(row.getUsername());
            student.setNickname(row.getNickname());
            student.setRegistrationTime(row.getRegistrationTime());
            summary.getStudents().add(student);
            summary.setRegistrationCount(summary.getStudents().size());
        }
        return ApiResponse.success(new ArrayList<>(grouped.values()));
    }

    @GetMapping("/learning-overview")
    public ApiResponse<LearningOverviewVO> getLearningOverview() {
        LearningOverviewVO vo = new LearningOverviewVO();
        StudentOverviewVO studentOverview = adminDashboardMapper.selectStudentOverview();
        if (studentOverview == null) {
            vo.setTotalStudents(0);
            vo.setAverageScore(BigDecimal.ZERO);
        } else {
            vo.setTotalStudents(studentOverview.getTotalStudents() == null ? 0 : studentOverview.getTotalStudents());
            vo.setAverageScore(studentOverview.getAverageScore() == null ? BigDecimal.ZERO : studentOverview.getAverageScore());
        }
        vo.setTopWrongQuizzes(adminDashboardMapper.selectTopWrongQuizzes());
        return ApiResponse.success(vo);
    }
}
