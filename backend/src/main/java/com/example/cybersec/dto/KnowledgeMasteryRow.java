package com.example.cybersec.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * 掌握度计算的输入行：某学生在一个知识点下的作答聚合结果。
 * 由 KnowledgePointMapper.selectMasteryRowsByUser 直接映射（列名用驼峰别名）。
 */
@Data
public class KnowledgeMasteryRow {

    private Long knowledgePointId;
    private String code;
    private String name;
    private String category;
    private String description;
    private Integer difficulty;

    /** 该知识点下有过作答记录的题目数 */
    private Integer attemptCount;

    /** 其中已答对的题目数 */
    private Integer correctCount;

    /** 其中尚未答对的题目数 */
    private Integer wrongCount;

    /** 累计答错次数（含同一题重复答错），用于错误频率维度 */
    private Integer errorCount;

    private LocalDateTime lastAnswerTime;

    // ---- 以下为计算后回填，不是 SQL 直接返回 ----
    private BigDecimal accuracy;
    private BigDecimal recentAccuracy;
    private BigDecimal mastery;
    private String level;
}
