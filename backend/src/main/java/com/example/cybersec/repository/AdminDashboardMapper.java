package com.example.cybersec.repository;

import com.example.cybersec.dto.RegistrationFlatRow;
import com.example.cybersec.dto.StudentOverviewVO;
import com.example.cybersec.dto.TopWrongQuizVO;
import org.apache.ibatis.annotations.Mapper;

import java.util.List;

@Mapper
public interface AdminDashboardMapper {

    List<RegistrationFlatRow> selectRegistrationDetails();

    StudentOverviewVO selectStudentOverview();

    List<TopWrongQuizVO> selectTopWrongQuizzes();
}
