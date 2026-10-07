package com.example.cybersec.dto;

import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/** 薄弱知识点（掌握度低的知识点），用于诊断结果展示与推荐练习入口 */
@Data
public class WeakPointRow {

    private Long knowledgePointId;
    private String code;
    private String name;
    private String category;
    private String description;
    private Integer difficulty;

    private BigDecimal mastery;
    private String level;
    private Integer attemptCount;
    private Integer correctCount;
    private Integer wrongCount;
    private BigDecimal accuracy;
    private BigDecimal recentAccuracy;

    private LocalDateTime lastAnswerTime;

    /** 「最需要练习」的原因说明，由服务层生成 */
    private String reason;
}
