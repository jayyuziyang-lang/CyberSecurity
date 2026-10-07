package com.example.cybersec.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.cybersec.entity.Registration;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDateTime;

@Mapper
public interface RegistrationMapper extends BaseMapper<Registration> {

    @Insert("""
            INSERT INTO registration (news_id, user_id, create_time)
            VALUES (#{newsId}, #{userId}, #{createTime})
            ON CONFLICT (news_id, user_id) DO NOTHING
            """)
    int insertIfAbsent(@Param("newsId") Long newsId,
                       @Param("userId") Long userId,
                       @Param("createTime") LocalDateTime createTime);
}
