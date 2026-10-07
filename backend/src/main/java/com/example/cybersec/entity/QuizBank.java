package com.example.cybersec.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

@Data
@TableName("quiz_bank")
public class QuizBank {
    @TableId(type = IdType.AUTO)
    private Long id;

    private String question;

    @TableField("option_a")
    private String optionA;

    @TableField("option_b")
    private String optionB;

    @TableField("option_c")
    private String optionC;

    @TableField("option_d")
    private String optionD;

    private String answer;

    private String analysis;
}
