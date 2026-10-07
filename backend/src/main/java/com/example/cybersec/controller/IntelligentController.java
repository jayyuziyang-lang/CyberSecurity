package com.example.cybersec.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.example.cybersec.common.ApiResponse;
import com.example.cybersec.dto.WeakPointRow;
import com.example.cybersec.entity.KnowledgePoint;
import com.example.cybersec.entity.Quiz;
import com.example.cybersec.entity.UserKnowledgeMastery;
import com.example.cybersec.repository.KnowledgePointMapper;
import com.example.cybersec.repository.UserKnowledgeMasteryMapper;
import com.example.cybersec.service.KnowledgeMasteryService;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 智能化模块接口：知识点掌握度诊断与个性化推荐练习。
 *
 * <p>全部为纯算法实现，不依赖任何外部服务/大模型，可离线运行。
 *
 * <pre>
 *   GET  /api/intelligent/knowledge-points          知识点列表
 *   GET  /api/intelligent/diagnosis/{userId}        诊断报告（概览 + 每知识点掌握度）
 *   GET  /api/intelligent/weak-points               薄弱知识点
 *   GET  /api/intelligent/recommend                 个性化推荐练习
 *   POST /api/intelligent/refresh/{userId}          手动重算掌握度
 * </pre>
 */
@RestController
@RequestMapping("/api/intelligent")
public class IntelligentController {

    private static final int DEFAULT_LIMIT = 5;

    private final KnowledgeMasteryService masteryService;
    private final KnowledgePointMapper knowledgePointMapper;
    private final UserKnowledgeMasteryMapper masteryMapper;

    public IntelligentController(KnowledgeMasteryService masteryService,
                                 KnowledgePointMapper knowledgePointMapper,
                                 UserKnowledgeMasteryMapper masteryMapper) {
        this.masteryService = masteryService;
        this.knowledgePointMapper = knowledgePointMapper;
        this.masteryMapper = masteryMapper;
    }

    /** 知识点列表（含分类、难度），供前端渲染知识图谱 */
    @GetMapping("/knowledge-points")
    public ApiResponse<List<KnowledgePoint>> listKnowledgePoints() {
        List<KnowledgePoint> points = knowledgePointMapper.selectList(
                new LambdaQueryWrapper<KnowledgePoint>()
                        .orderByAsc(KnowledgePoint::getSortOrder)
                        .orderByAsc(KnowledgePoint::getId));
        return ApiResponse.success(points);
    }

    /**
     * 诊断报告：整体概览 + 每个知识点的掌握度明细。
     * 每次调用都会先按最新作答记录重算，保证演示时数据实时。
     */
    @GetMapping("/diagnosis/{userId}")
    public ApiResponse<Map<String, Object>> diagnosis(@PathVariable Long userId) {
        masteryService.refreshMastery(userId);

        List<UserKnowledgeMastery> masteries = masteryMapper.selectList(
                new LambdaQueryWrapper<UserKnowledgeMastery>()
                        .eq(UserKnowledgeMastery::getUserId, userId));

        // 知识点字典，用于补齐名称/分类
        Map<Long, KnowledgePoint> pointMap = new HashMap<>();
        for (KnowledgePoint p : knowledgePointMapper.selectList(null)) {
            pointMap.put(p.getId(), p);
        }

        List<Map<String, Object>> items = new ArrayList<>();
        for (UserKnowledgeMastery m : masteries) {
            KnowledgePoint point = pointMap.get(m.getKnowledgePointId());
            if (point == null) {
                continue;
            }
            Map<String, Object> item = new HashMap<>();
            item.put("knowledgePointId", point.getId());
            item.put("code", point.getCode());
            item.put("name", point.getName());
            item.put("category", point.getCategory());
            item.put("description", point.getDescription());
            item.put("difficulty", point.getDifficulty());
            item.put("mastery", m.getMastery());
            item.put("level", m.getLevel());
            item.put("attemptCount", m.getAttemptCount());
            item.put("correctCount", m.getCorrectCount());
            item.put("wrongCount", m.getWrongCount());
            item.put("accuracy", m.getAccuracy());
            item.put("recentAccuracy", m.getRecentAccuracy());
            item.put("lastAnswerTime", m.getLastAnswerTime());
            items.add(item);
        }

        // 掌握度升序：最薄弱的排最前，前端直接顺序渲染即可
        items.sort((a, b) -> Double.compare(toDouble(a.get("mastery")), toDouble(b.get("mastery"))));

        Map<String, Object> result = new HashMap<>();
        result.put("overview", masteryService.getOverview(userId));
        result.put("items", items);
        return ApiResponse.success(result);
    }

    /** 薄弱知识点（带推荐理由） */
    @GetMapping("/weak-points")
    public ApiResponse<List<WeakPointRow>> weakPoints(@RequestParam Long userId,
                                                      @RequestParam(required = false, defaultValue = "3") Integer limit) {
        return ApiResponse.success(masteryService.getWeakPoints(userId, limit == null ? 3 : limit));
    }

    /**
     * 个性化推荐练习。
     * <ul>
     *   <li>传 knowledgePointId → 该知识点下的专项练习</li>
     *   <li>不传 → 自动取最薄弱的知识点做推荐；若无作答记录则走冷启动基础题</li>
     * </ul>
     */
    @GetMapping("/recommend")
    public ApiResponse<Map<String, Object>> recommend(@RequestParam Long userId,
                                                      @RequestParam(required = false) Long knowledgePointId,
                                                      @RequestParam(required = false) Integer limit) {
        int size = limit == null ? DEFAULT_LIMIT : limit;

        String strategy;
        String pointName = null;
        List<Quiz> quizzes;

        if (knowledgePointId != null) {
            strategy = "指定知识点专项练习";
            KnowledgePoint point = knowledgePointMapper.selectById(knowledgePointId);
            pointName = point == null ? null : point.getName();
            quizzes = masteryService.recommendPractice(userId, knowledgePointId, size);
        } else {
            masteryService.refreshMastery(userId);
            List<WeakPointRow> weak = masteryService.getWeakPoints(userId, 1);
            if (weak.isEmpty()) {
                strategy = "冷启动推荐：按知识点难度推荐基础题";
                quizzes = masteryService.recommendForBeginner(size);
            } else {
                WeakPointRow target = weak.get(0);
                strategy = "优先推荐最薄弱知识点";
                pointName = target.getName();
                knowledgePointId = target.getKnowledgePointId();
                quizzes = masteryService.recommendPractice(userId, knowledgePointId, size);
            }
        }

        Map<String, Object> result = new HashMap<>();
        result.put("strategy", strategy);
        result.put("knowledgePointId", knowledgePointId);
        result.put("knowledgePointName", pointName);
        result.put("quizzes", quizzes);
        return ApiResponse.success(result);
    }

    /** 手动触发重算（学生对错题重做后，前端可主动刷新诊断） */
    @PostMapping("/refresh/{userId}")
    public ApiResponse<Map<String, Object>> refresh(@PathVariable Long userId) {
        int affected = masteryService.refreshMastery(userId);
        Map<String, Object> data = new HashMap<>();
        data.put("refreshedKnowledgePoints", affected);
        return ApiResponse.success(data);
    }

    private static double toDouble(Object value) {
        if (value == null) {
            return 0.0;
        }
        if (value instanceof Number number) {
            return number.doubleValue();
        }
        if (!StringUtils.hasText(value.toString())) {
            return 0.0;
        }
        try {
            return Double.parseDouble(value.toString());
        } catch (NumberFormatException ex) {
            return 0.0;
        }
    }
}
