package com.example.cybersec.repository;

import com.example.cybersec.dto.AdminSummaryRow;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface AdminSummaryMapper {
    List<AdminSummaryRow> selectActivityCompetitionSummary();
}
