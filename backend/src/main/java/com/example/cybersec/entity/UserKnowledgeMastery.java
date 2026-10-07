package com.example.cybersec.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 学生知识点掌握度（派生数据，可由作答记录随时重算）。
 *
 * <p>冗余保存 correctCount / wrongCount / attemptCount，是为了支持
 * 「最近 N 次作答」的近因加权；否则每次计算都要全量重扫作答流水。
 */
@Data
@TableName("user_knowledge_mastery")
public class UserKnowledgeMastery {

    @TableId(type = IdType.AUTO)
    private Long id;

    @TableField("user_id")
    private Long userId;

    @TableField("knowledge_point_id")
    private Long knowledgePointId;

    /** 综合掌握度 0 ~ 100 */
    private BigDecimal mastery;

    /** WEAK / BASIC / PROFICIENT */
    private String level;

    @TableField("correct_count")
    private Integer correctCount;

    @TableField("wrong_count")
    private Integer wrongCount;

    @TableField("attempt_count")
    private Integer attemptCount;

    /** 历史正确率 0 ~ 1 */
    private BigDecimal accuracy;

    /** 最近 5 次作答正确率 0 ~ 1，样本不足时为 null */
    @TableField("recent_accuracy")
    private BigDecimal recentAccuracy;

    @TableField("last_answer_time")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private LocalDateTime lastAnswerTime;

    @TableField("update_time")
    @JsonFormat(pattern = "yyyy-MM-dd HH:mm:ss", timezone = "GMT+8")
    private LocalDateTime updateTime;
}
