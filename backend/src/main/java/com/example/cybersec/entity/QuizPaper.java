package com.example.cybersec.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("quiz_paper")
public class QuizPaper {
    @TableId(type = IdType.AUTO)
    private Integer id;

    private String title;
}
