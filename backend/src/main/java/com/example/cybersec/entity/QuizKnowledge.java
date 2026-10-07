package com.example.cybersec.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * 题目 ↔ 知识点 关联（多对多）。
 */
@Data
@TableName("quiz_knowledge")
public class QuizKnowledge {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("quiz_id")
    private Long quizId;

    @TableField("knowledge_point_id")
    private Long knowledgePointId;
}
