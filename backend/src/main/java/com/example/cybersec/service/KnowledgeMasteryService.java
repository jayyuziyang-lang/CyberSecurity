package com.example.cybersec.service;

import com.example.cybersec.dto.WeakPointRow;
import com.example.cybersec.entity.Quiz;

import java.util.List;

/**
 * 知识点掌握度诊断与个性化推荐。
 *
 * <p>算法说明（可直接用于论文/答辩）见 {@link impl.KnowledgeMasteryServiceImpl} 的类注释。
 */
public interface KnowledgeMasteryService {

    /**
     * 重算并落库某学生的全部知识点掌握度。
     *
     * @return 本次实际写入/更新的知识点数量
     */
    int refreshMastery(Long userId);

    /** 诊断概览：平均掌握度、薄弱知识点、强项知识点 */
    MasteryOverview getOverview(Long userId);

    /** 读取薄弱知识点（带推荐理由） */
    List<WeakPointRow> getWeakPoints(Long userId, int limit);

    /**
     * 针对某个知识点推荐练习题。
     * 优先返回该知识点下「尚未答对」的题；若已全部答对则回退到该知识点全部题目。
     */
    List<Quiz> recommendPractice(Long userId, Long knowledgePointId, int limit);

    /**
     * 冷启动推荐：学生尚无任何作答记录时，按知识点难度升序推荐基础题。
     */
    List<Quiz> recommendForBeginner(int limit);

    /** 诊断概览数据结构 */
    class MasteryOverview {
        private int pointCount;
        private double averageMastery;
        private int weakCount;
        private int basicCount;
        private int proficientCount;
        private String overallLevel;
        private String summary;

        public int getPointCount() { return pointCount; }
        public void setPointCount(int pointCount) { this.pointCount = pointCount; }

        public double getAverageMastery() { return averageMastery; }
        public void setAverageMastery(double averageMastery) { this.averageMastery = averageMastery; }

        public int getWeakCount() { return weakCount; }
        public void setWeakCount(int weakCount) { this.weakCount = weakCount; }

        public int getBasicCount() { return basicCount; }
        public void setBasicCount(int basicCount) { this.basicCount = basicCount; }

        public int getProficientCount() { return proficientCount; }
        public void setProficientCount(int proficientCount) { this.proficientCount = proficientCount; }

        public String getOverallLevel() { return overallLevel; }
        public void setOverallLevel(String overallLevel) { this.overallLevel = overallLevel; }

        public String getSummary() { return summary; }
        public void setSummary(String summary) { this.summary = summary; }
    }
}
