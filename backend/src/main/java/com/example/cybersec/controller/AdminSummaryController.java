package com.example.cybersec.controller;

import com.example.cybersec.common.ApiResponse;
import com.example.cybersec.dto.AdminSummaryRow;
import com.example.cybersec.dto.AdminSummaryVO;
import com.example.cybersec.repository.AdminSummaryMapper;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/admin")
public class AdminSummaryController {

    private final AdminSummaryMapper adminSummaryMapper;

    public AdminSummaryController(AdminSummaryMapper adminSummaryMapper) {
        this.adminSummaryMapper = adminSummaryMapper;
    }

    @GetMapping("/summary")
    public ApiResponse<List<AdminSummaryVO>> getSummary() {
        List<AdminSummaryRow> rows = adminSummaryMapper.selectActivityCompetitionSummary();
        List<AdminSummaryVO> data = new ArrayList<>();
        for (AdminSummaryRow row : rows) {
            AdminSummaryVO vo = new AdminSummaryVO();
            vo.setNewsId(row.getNewsId());
            vo.setNewsTitle(row.getNewsTitle());
            vo.setCategory(row.getCategory());
            vo.setRegistrationCount(row.getRegistrationCount() == null ? 0 : row.getRegistrationCount());
            if (StringUtils.hasText(row.getStudentNicknames())) {
                vo.setStudentNicknames(Arrays.stream(row.getStudentNicknames().split(","))
                        .filter(StringUtils::hasText)
                        .map(String::trim)
                        .collect(Collectors.toList()));
            }
            data.add(vo);
        }
        return ApiResponse.success(data);
    }
}
