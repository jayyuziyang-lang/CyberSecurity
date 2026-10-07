package com.example.cybersec.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.cybersec.entity.User;
import org.apache.ibatis.annotations.Insert;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Options;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

/**
 * 用户表 Mapper 接口
 * 继承 BaseMapper 即可获得常用的增删改查功能
 */
@Mapper
public interface UserMapper extends BaseMapper<User> {
    @Insert("""
            INSERT INTO "user"
                (username, nickname, avatar_url, points, is_followed, password, role, is_authenticated)
            VALUES
                (#{username}, #{nickname}, #{avatarUrl}, #{points}, #{isFollowed}, #{password}, #{role}, #{isAuthenticated})
            """)
    @Options(useGeneratedKeys = true, keyProperty = "id", keyColumn = "id")
    int insertRegisteredUser(User user);

    @Update("""
            UPDATE "user"
            SET points = COALESCE(points, 0) + #{points}
            WHERE id = #{userId}
            """)
    int addPoints(@Param("userId") Long userId, @Param("points") Integer points);
}
