package com.example.cybersec.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.cybersec.entity.Quiz;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface QuizMapper extends BaseMapper<Quiz> {

    @Insert({
            "<script>",
            "INSERT INTO quiz(question, option_a, option_b, option_c, option_d, answer, analysis, paper_id) VALUES",
            "<foreach collection='list' item='item' separator=','>",
            "(#{item.question}, #{item.optionA}, #{item.optionB}, #{item.optionC}, #{item.optionD}, #{item.answer}, #{item.analysis}, #{item.paperId})",
            "</foreach>",
            "</script>"
    })
    int insertQuizBatch(@Param("list") List<Quiz> list);
}
