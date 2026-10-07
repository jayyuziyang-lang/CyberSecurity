package com.example.cybersec.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonAlias;
import com.fasterxml.jackson.annotation.JsonIgnore;
import lombok.Data;

@Data
@TableName("\"user\"")
public class User {

    @TableId(value = "id", type = IdType.AUTO)
    private Long id;

    private String username;

    private String nickname;

    @TableField("avatar_url")
    @JsonAlias("avatar_url")
    private String avatarUrl;

    private Integer points;

    @TableField("is_followed")
    private Integer isFollowed;

    @JsonIgnore
    private String password;

    // 0: student, 1: admin
    private Integer role;

    @TableField("is_authenticated")
    private Boolean isAuthenticated;
}
