package com.example.cybersec.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.example.cybersec.dto.KnowledgeMasteryRow;
import com.example.cybersec.dto.RecentAttemptRow;
import com.example.cybersec.dto.WeakPointRow;
import com.example.cybersec.entity.Quiz;
import com.example.cybersec.entity.UserKnowledgeMastery;
import com.example.cybersec.repository.KnowledgePointMapper;
import com.example.cybersec.repository.UserKnowledgeMasteryMapper;
import com.example.cybersec.service.KnowledgeMasteryService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 掌握度诊断与推荐的核心实现。
 *
 * <h2>算法一：知识点掌握度（加权三维模型）</h2>
 * <pre>
 *   mastery = 100 × ( 0.5 × A + 0.3 × (1 − P) + 0.2 × R )
 *
 *   A（正确率维度）  = correctCount / attemptCount              ∈ [0,1]
 *   P（错误频率维度）= min(1, totalErrors / (2 × attemptCount))  ∈ [0,1]，越接近 1 越差
 *   R（近因维度）    = 最近 5 次作答的正确率；无记录时退化为 A
 * </pre>
 *
 * <p>三个权重的取值理由：
 * <ul>
 *   <li><b>正确率 0.5</b>：最直接的掌握证据，占主导。</li>
 *   <li><b>错误频率 0.3</b>：区分「一次就懂」与「反复踩坑」。
 *       同一题错 3 次和错 1 次，正确率字段是一样的，必须单独度量，
 *       否则频繁出错的学生会被高估。分母用 2×attemptCount，
 *       即「平均每题错 2 次」视为该维度最差。</li>
 *   <li><b>近因 0.2</b>：反映「最近是否学会了」。一个学生早期全错、最近全对，
 *       应当比早期全对、最近全错的人掌握得更好，而历史正确率无法区分二者。</li>
 * </ul>
 *
 * <p>冷启动（作答样本不足 2 题）时，错误频率与近因维度噪声过大，
 * 退化为纯正确率，并在返回结果中标注样本量，避免"做一题就下结论"。
 *
 * <h2>算法二：薄弱知识点定位</h2>
 * 掌握度 &lt; 60 记为 WEAK，60~75 为 BASIC，≥75 为 PROFICIENT。
 * 薄弱点按掌握度升序排列，并生成可解释的推荐理由（如"错题率 100%"、"反复答错 3 次"）。
 *
 * <h2>算法三：个性化推荐</h2>
 * 见 {@link #recommendPractice}：基于薄弱知识点召回候选题，
 * 过滤掉已答对的题（不重复做会的题），并按知识点难度升序排列（先补基础）。
 */
@Service
public class KnowledgeMasteryServiceImpl implements KnowledgeMasteryService {

    /** 各维度权重，合计必须为 1.0 */
    private static final double W_ACCURACY = 0.5;
    private static final double W_ERROR_FREQUENCY = 0.3;
    private static final double W_RECENCY = 0.2;

    /** 近因窗口：只看最近 N 次作答 */
    private static final int RECENT_WINDOW = 5;

    /** 样本量少于该值时走冷启动简化公式 */
    private static final int MIN_SAMPLE = 2;

    /** 合计答错次数达到「2 × 题目数」时，错误频率维度记为最差 */
    private static final double ERROR_FREQUENCY_SCALE = 2.0;

    private static final double WEAK_THRESHOLD = 60.0;
    private static final double PROFICIENT_THRESHOLD = 75.0;

    public static final String LEVEL_WEAK = "WEAK";
    public static final String LEVEL_BASIC = "BASIC";
    public static final String LEVEL_PROFICIENT = "PROFICIENT";

    private final KnowledgePointMapper knowledgePointMapper;
    private final UserKnowledgeMasteryMapper masteryMapper;

    public KnowledgeMasteryServiceImpl(KnowledgePointMapper knowledgePointMapper,
                                       UserKnowledgeMasteryMapper masteryMapper) {
        this.knowledgePointMapper = knowledgePointMapper;
        this.masteryMapper = masteryMapper;
    }

    // ------------------------------------------------------------------
    // 掌握度计算
    // ------------------------------------------------------------------

    @Override
    @Transactional(rollbackFor = Exception.class)
    public int refreshMastery(Long userId) {
        List<KnowledgeMasteryRow> rows = knowledgePointMapper.selectMasteryRowsByUser(userId);
        if (rows == null || rows.isEmpty()) {
            return 0;
        }

        // 近因维度：把「最近 N 次作答」按知识点分组
        Map<Long, List<Boolean>> recentByPoint = new HashMap<>();
        for (RecentAttemptRow attempt : knowledgePointMapper.selectRecentAttempts(userId)) {
            if (attempt == null || attempt.getKnowledgePointId() == null) {
                continue;
            }
            recentByPoint
                    .computeIfAbsent(attempt.getKnowledgePointId(), k -> new ArrayList<>())
                    .add(Boolean.TRUE.equals(attempt.getResolved()));
        }

        int affected = 0;
        for (KnowledgeMasteryRow row : rows) {
            calculate(row, recentByPoint.get(row.getKnowledgePointId()));
            upsert(userId, row);
            affected++;
        }
        return affected;
    }

    /**
     * 对单行统计结果套用加权公式，并把 A / P / R 三个中间量回填到 row 上，
     * 便于接口把「为什么是这个分数」一并返回给前端。
     */
    private void calculate(KnowledgeMasteryRow row, List<Boolean> recentAttempts) {
        int attempts = row.getAttemptCount() == null ? 0 : row.getAttemptCount();
        int correct = row.getCorrectCount() == null ? 0 : row.getCorrectCount();
        int errors = row.getErrorCount() == null ? 0 : row.getErrorCount();

        double accuracy = attempts == 0 ? 0.0 : (double) correct / attempts;
        row.setAccuracy(scale4(accuracy));

        if (attempts < MIN_SAMPLE) {
            // 冷启动：样本太少，错误频率/近因维度不可靠，退化为纯正确率
            row.setRecentAccuracy(null);
            row.setMastery(scale2(100.0 * accuracy));
        } else {
            double errorFrequency = Math.min(1.0, errors / (ERROR_FREQUENCY_SCALE * attempts));
            Double recency = recentAccuracy(recentAttempts);
            double effectiveRecency = recency == null ? accuracy : recency;

            double mastery = 100.0 * (W_ACCURACY * accuracy
                    + W_ERROR_FREQUENCY * (1.0 - errorFrequency)
                    + W_RECENCY * effectiveRecency);

            row.setRecentAccuracy(recency == null ? null : scale4(recency));
            row.setMastery(scale2(clamp(mastery, 0.0, 100.0)));
        }

        row.setLevel(levelOf(row.getMastery().doubleValue()));
    }

    /** 最近 N 次作答的正确率；无记录返回 null 表示"无近期证据" */
    private Double recentAccuracy(List<Boolean> attempts) {
        if (attempts == null || attempts.isEmpty()) {
            return null;
        }
        // selectRecentAttempts 已按时间倒序返回，这里取前 RECENT_WINDOW 条
        int n = Math.min(RECENT_WINDOW, attempts.size());
        int correct = 0;
        for (int i = 0; i < n; i++) {
            if (Boolean.TRUE.equals(attempts.get(i))) {
                correct++;
            }
        }
        return (double) correct / n;
    }

    private String levelOf(double mastery) {
        if (mastery < WEAK_THRESHOLD) {
            return LEVEL_WEAK;
        }
        return mastery < PROFICIENT_THRESHOLD ? LEVEL_BASIC : LEVEL_PROFICIENT;
    }

    /** 一个学生一个知识点只有一行，存在则更新，不存在则插入 */
    private void upsert(Long userId, KnowledgeMasteryRow row) {
        UserKnowledgeMastery existing = masteryMapper.selectOne(
                new LambdaQueryWrapper<UserKnowledgeMastery>()
                        .eq(UserKnowledgeMastery::getUserId, userId)
                        .eq(UserKnowledgeMastery::getKnowledgePointId, row.getKnowledgePointId())
                        .last("limit 1"));

        UserKnowledgeMastery entity = existing == null ? new UserKnowledgeMastery() : existing;
        entity.setUserId(userId);
        entity.setKnowledgePointId(row.getKnowledgePointId());
        entity.setMastery(row.getMastery());
        entity.setLevel(row.getLevel());
        entity.setCorrectCount(row.getCorrectCount());
        entity.setWrongCount(row.getWrongCount());
        entity.setAttemptCount(row.getAttemptCount());
        entity.setAccuracy(row.getAccuracy());
        entity.setRecentAccuracy(row.getRecentAccuracy());
        entity.setLastAnswerTime(row.getLastAnswerTime());
        entity.setUpdateTime(LocalDateTime.now());

        if (existing == null) {
            masteryMapper.insert(entity);
        } else {
            masteryMapper.updateById(entity);
        }
    }

    // ------------------------------------------------------------------
    // 诊断概览与薄弱点
    // ------------------------------------------------------------------

    @Override
    public MasteryOverview getOverview(Long userId) {
        List<UserKnowledgeMastery> all = masteryMapper.selectList(
                new LambdaQueryWrapper<UserKnowledgeMastery>()
                        .eq(UserKnowledgeMastery::getUserId, userId));

        MasteryOverview overview = new MasteryOverview();
        overview.setPointCount(all.size());

        if (all.isEmpty()) {
            overview.setAverageMastery(0.0);
            overview.setWeakCount(0);
            overview.setBasicCount(0);
            overview.setProficientCount(0);
            overview.setOverallLevel(LEVEL_WEAK);
            overview.setSummary("还没有答题记录，先去完成一次作业包，系统就能生成你的知识点诊断报告。");
            return overview;
        }

        double sum = 0;
        int weak = 0;
        int basic = 0;
        int proficient = 0;
        for (UserKnowledgeMastery m : all) {
            double v = m.getMastery() == null ? 0.0 : m.getMastery().doubleValue();
            sum += v;
            if (LEVEL_WEAK.equals(m.getLevel())) {
                weak++;
            } else if (LEVEL_PROFICIENT.equals(m.getLevel())) {
                proficient++;
            } else {
                basic++;
            }
        }

        double average = sum / all.size();
        overview.setAverageMastery(scale2(average).doubleValue());
        overview.setWeakCount(weak);
        overview.setBasicCount(basic);
        overview.setProficientCount(proficient);
        overview.setOverallLevel(levelOf(average));
        overview.setSummary(buildSummary(average, weak, all.size()));
        return overview;
    }

    private String buildSummary(double average, int weakCount, int total) {
        String levelText;
        if (average < WEAK_THRESHOLD) {
            levelText = "整体基础较薄弱";
        } else if (average < PROFICIENT_THRESHOLD) {
            levelText = "整体掌握情况中等";
        } else {
            levelText = "整体掌握情况良好";
        }
        if (weakCount == 0) {
            return levelText + "，覆盖的 " + total + " 个知识点目前没有明显短板，建议继续拓展新知识点。";
        }
        return levelText + "，覆盖 " + total + " 个知识点，其中 " + weakCount
                + " 个低于 60 分，建议优先针对薄弱知识点做专项练习。";
    }

    @Override
    public List<WeakPointRow> getWeakPoints(Long userId, int limit) {
        List<WeakPointRow> weak = knowledgePointMapper.selectWeakPoints(userId, limit);
        for (WeakPointRow row : weak) {
            row.setReason(buildReason(row));
        }
        return weak;
    }

    /** 生成可解释的推荐理由——诊断系统的说服力来自"能说清为什么" */
    private String buildReason(WeakPointRow row) {
        int attempts = row.getAttemptCount() == null ? 0 : row.getAttemptCount();
        int wrong = row.getWrongCount() == null ? 0 : row.getWrongCount();
        if (attempts > 0 && wrong >= attempts) {
            return "该知识点下 " + attempts + " 道题全部未答对";
        }
        if (attempts > 0) {
            int rate = (int) Math.round(wrong * 100.0 / attempts);
            return "该知识点共 " + attempts + " 题，尚有 " + wrong + " 题未答对（未掌握率 " + rate + "%）";
        }
        return "该知识点掌握度偏低，建议巩固";
    }

    // ------------------------------------------------------------------
    // 推荐
    // ------------------------------------------------------------------

    @Override
    public List<Quiz> recommendPractice(Long userId, Long knowledgePointId, int limit) {
        int size = limit <= 0 ? 5 : Math.min(limit, 20);

        // 1) 优先：薄弱知识点下还没答对的题（避免重复做已经会的题）
        List<Quiz> pending = knowledgePointMapper.selectPracticeQuizzes(userId, knowledgePointId, size);
        if (pending != null && !pending.isEmpty()) {
            return pending;
        }

        // 2) 回退：该知识点下所有题（可能都已经答对了，那就再巩固一遍）
        List<Quiz> fallback = knowledgePointMapper.selectQuizzesByKnowledgePoint(knowledgePointId, size);
        return fallback == null ? new ArrayList<>() : fallback;
    }

    @Override
    public List<Quiz> recommendForBeginner(int limit) {
        int size = limit <= 0 ? 5 : Math.min(limit, 20);
        List<Quiz> quizzes = knowledgePointMapper.selectBeginnerQuizzes(size);
        return quizzes == null ? new ArrayList<>() : quizzes;
    }

    // ------------------------------------------------------------------
    // 工具方法
    // ------------------------------------------------------------------

    private static double clamp(double v, double min, double max) {
        return Math.max(min, Math.min(max, v));
    }

    private static BigDecimal scale2(double v) {
        return BigDecimal.valueOf(v).setScale(2, RoundingMode.HALF_UP);
    }

    private static BigDecimal scale4(double v) {
        return BigDecimal.valueOf(v).setScale(4, RoundingMode.HALF_UP);
    }
}
