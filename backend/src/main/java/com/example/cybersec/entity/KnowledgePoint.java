package com.example.cybersec.entity;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableField;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableName;
import lombok.Data;

/**
 * 知识点。
 *
 * <p>智能化模块的基础数据结构：题目通过 quiz_knowledge 关联表挂到知识点上，
 * 学生的作答结果再聚合成每个知识点的掌握度，从而把「错了几道题」升级为
 * 「哪个知识点没掌握」。
 */
@Data
@TableName("knowledge_point")
public class KnowledgePoint {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 业务编码，如 KP01，便于种子数据与文档引用 */
    private String code;

    private String name;

    /** 所属分类，如「身份认证」「Web 安全」 */
    private String category;

    private String description;

    /** 1 易 / 2 中 / 3 难，用于推荐时优先推基础知识点 */
    private Integer difficulty;

    @TableField("sort_order")
    private Integer sortOrder;
}
