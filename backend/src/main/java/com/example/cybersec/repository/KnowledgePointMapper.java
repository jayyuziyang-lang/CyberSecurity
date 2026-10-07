package com.example.cybersec.repository;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.example.cybersec.dto.KnowledgeMasteryRow;
import com.example.cybersec.dto.RecentAttemptRow;
import com.example.cybersec.dto.WeakPointRow;
import com.example.cybersec.entity.KnowledgePoint;
import com.example.cybersec.entity.Quiz;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

import java.util.List;

/**
 * 知识点相关查询。
 *
 * <p>掌握度计算需要「某个学生、某个知识点下所有题目的作答情况」，
 * 这是一个三表联查（wrong_set × quiz_knowledge × knowledge_point），
 * 用注解 SQL 直接表达比在 Java 里拼装更清晰。
 */
@Mapper
public interface KnowledgePointMapper extends BaseMapper<KnowledgePoint> {

    /**
     * 取某个学生所有「有过作答记录」的知识点维度的作答统计。
     *
     * <p>统计口径：
     * <ul>
     *   <li>attemptCount = 该知识点下该学生的 wrong_set 行数（每题一行）</li>
     *   <li>correctCount = 其中 is_resolved = true 的行数</li>
     *   <li>wrongCount   = attemptCount - correctCount（尚未答对）</li>
     *   <li>errorCount   = 累计答错次数之和（含重复答错）</li>
     * </ul>
     * 同一题挂多个知识点时，该题会在每个知识点下各计一次，符合诊断直觉。
     */
    @Select("""
            SELECT kp.id                AS knowledgePointId,
                   kp.code              AS code,
                   kp.name              AS name,
                   kp.category          AS category,
                   kp.description       AS description,
                   kp.difficulty        AS difficulty,
                   COUNT(ws.id)::int    AS attemptCount,
                   COUNT(ws.id) FILTER (WHERE ws.is_resolved = TRUE)::int AS correctCount,
                   COUNT(ws.id) FILTER (WHERE ws.is_resolved IS NOT TRUE)::int AS wrongCount,
                   COALESCE(SUM(ws.error_count), 0)::int AS errorCount,
                   MAX(ws.updated_at)   AS lastAnswerTime
            FROM wrong_set ws
            JOIN quiz_knowledge qk ON qk.quiz_id = ws.quiz_id
            JOIN knowledge_point kp ON kp.id = qk.knowledge_point_id
            WHERE ws.user_id = #{userId}
            GROUP BY kp.id, kp.code, kp.name, kp.category, kp.description, kp.difficulty
            ORDER BY kp.sort_order, kp.id
            """)
    List<KnowledgeMasteryRow> selectMasteryRowsByUser(@Param("userId") Long userId);

    /**
     * 取该学生「最近 N 次」作答的对错序列，用于近因加权。
     * 按更新时间倒序，Java 侧只需前 N 条。
     */
    @Select("""
            SELECT qk.knowledge_point_id AS knowledgePointId,
                   ws.is_resolved         AS resolved
            FROM wrong_set ws
            JOIN quiz_knowledge qk ON qk.quiz_id = ws.quiz_id
            WHERE ws.user_id = #{userId}
            ORDER BY ws.updated_at DESC NULLS LAST, ws.id DESC
            """)
    List<RecentAttemptRow> selectRecentAttempts(@Param("userId") Long userId);

    /**
     * 薄弱知识点：按掌握度升序取前 N 个，且必须有过作答记录
     * （掌握度由 user_knowledge_mastery 提供）。
     */
    @Select("""
            SELECT kp.id          AS knowledgePointId,
                   kp.code        AS code,
                   kp.name        AS name,
                   kp.category    AS category,
                   kp.description AS description,
                   kp.difficulty  AS difficulty,
                   m.mastery      AS mastery,
                   m.level        AS level,
                   m.attempt_count AS attemptCount,
                   m.correct_count AS correctCount,
                   m.wrong_count   AS wrongCount,
                   m.accuracy      AS accuracy,
                   m.recent_accuracy AS recentAccuracy,
                   m.last_answer_time AS lastAnswerTime
            FROM user_knowledge_mastery m
            JOIN knowledge_point kp ON kp.id = m.knowledge_point_id
            WHERE m.user_id = #{userId}
              AND m.level = 'WEAK'
            ORDER BY m.mastery ASC, kp.sort_order ASC
            LIMIT #{limit}
            """)
    List<WeakPointRow> selectWeakPoints(@Param("userId") Long userId, @Param("limit") int limit);

    /**
     * 推荐练习：优先取薄弱知识点下「尚未答对」的题目。
     * 排除该学生已经答对（is_resolved = TRUE）的题。
     */
    @Select("""
            SELECT DISTINCT q.id, q.question, q.option_a, q.option_b, q.option_c, q.option_d,
                   q.answer, q.analysis, q.paper_id
            FROM quiz q
            JOIN quiz_knowledge qk ON qk.quiz_id = q.id
            WHERE qk.knowledge_point_id = #{knowledgePointId}
              AND NOT EXISTS (
                  SELECT 1 FROM wrong_set ws
                  WHERE ws.user_id = #{userId}
                    AND ws.quiz_id = q.id
                    AND ws.is_resolved = TRUE
              )
            ORDER BY q.id
            LIMIT #{limit}
            """)
    List<Quiz> selectPracticeQuizzes(@Param("userId") Long userId,
                                     @Param("knowledgePointId") Long knowledgePointId,
                                     @Param("limit") int limit);
    /**
     * 回退查询：该知识点下的全部题目（不考虑是否已答对）。
     * 当学生已把该知识点的题全部答对时，用它做「巩固复习」。
     */
    @Select("""
            SELECT DISTINCT q.id, q.question, q.option_a, q.option_b, q.option_c, q.option_d,
                   q.answer, q.analysis, q.paper_id
            FROM quiz q
            JOIN quiz_knowledge qk ON qk.quiz_id = q.id
            WHERE qk.knowledge_point_id = #{knowledgePointId}
            ORDER BY q.id
            LIMIT #{limit}
            """)
    List<Quiz> selectQuizzesByKnowledgePoint(@Param("knowledgePointId") Long knowledgePointId,
                                             @Param("limit") int limit);

    /** 该学生是否完全没有作答记录（用于给新用户兜底推荐） */
    @Select("""
            SELECT COUNT(*)::int FROM wrong_set WHERE user_id = #{userId}
            """)
    int countAttempts(@Param("userId") Long userId);

    /**
     * 新用户兜底：按知识点难度升序取基础题。
     *
     * <p>注意这里刻意【不用】SELECT DISTINCT：
     * PostgreSQL 要求 DISTINCT 的 ORDER BY 表达式必须出现在 SELECT 列表中，
     * 而这里要按 kp.difficulty 排序，该列不在结果集里。
     * 一道题可能挂在多个知识点上，用 MIN(kp.difficulty) 聚合 + GROUP BY q.id
     * 既能去重，又能稳定按「最容易的知识点」排序。
     */
    @Select("""
            SELECT q.id, q.question, q.option_a, q.option_b, q.option_c, q.option_d,
                   q.answer, q.analysis, q.paper_id
            FROM quiz q
            JOIN quiz_knowledge qk ON qk.quiz_id = q.id
            JOIN knowledge_point kp ON kp.id = qk.knowledge_point_id
            GROUP BY q.id, q.question, q.option_a, q.option_b, q.option_c, q.option_d,
                     q.answer, q.analysis, q.paper_id
            ORDER BY MIN(kp.difficulty) ASC, q.id
            LIMIT #{limit}
            """)
    List<Quiz> selectBeginnerQuizzes(@Param("limit") int limit);
}
