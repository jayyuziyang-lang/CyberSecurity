package com.example.cybersec.dto;

import lombok.Data;

/** 单次作答记录（用于近因加权：只看最近 N 次） */
@Data
public class RecentAttemptRow {

    private Long knowledgePointId;

    /** 该次作答最终是否已答对 */
    private Boolean resolved;
}
