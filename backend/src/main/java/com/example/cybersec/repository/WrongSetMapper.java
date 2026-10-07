package com.example.cybersec.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.cybersec.dto.WrongQuizItemVO;
import com.example.cybersec.entity.WrongSet;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

@Mapper
public interface WrongSetMapper extends BaseMapper<WrongSet> {

    @Select("""
            SELECT ws.id AS wrongId,
                   ws.quiz_id AS quizId,
                   COALESCE(ws.error_count, 1) AS errorCount,
                   q.question AS question,
                   q.option_a AS optionA,
                   q.option_b AS optionB,
                   q.option_c AS optionC,
                   q.option_d AS optionD,
                   q.answer AS answer,
                   q.analysis AS analysis
            FROM wrong_set ws
            JOIN quiz q ON ws.quiz_id = q.id
            WHERE ws.user_id = #{userId}
              AND COALESCE(ws.is_resolved, false) = false
            ORDER BY ws.id DESC
            """)
    List<WrongQuizItemVO> selectUnresolvedByUserId(@Param("userId") Long userId);
}
