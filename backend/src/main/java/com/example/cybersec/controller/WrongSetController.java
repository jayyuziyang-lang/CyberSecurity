package com.example.cybersec.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.example.cybersec.common.ApiResponse;
import com.example.cybersec.dto.WrongQuizItemVO;
import com.example.cybersec.entity.Quiz;
import com.example.cybersec.entity.User;
import com.example.cybersec.entity.WrongSet;
import com.example.cybersec.repository.WrongSetMapper;
import com.example.cybersec.service.KnowledgeMasteryService;
import com.example.cybersec.service.QuizService;
import com.example.cybersec.service.UserService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/wrong-set")
public class WrongSetController {

    private final WrongSetMapper wrongSetMapper;
    private final QuizService quizService;
    private final UserService userService;
    private final KnowledgeMasteryService knowledgeMasteryService;

    public WrongSetController(WrongSetMapper wrongSetMapper,
                              QuizService quizService,
                              UserService userService,
                              KnowledgeMasteryService knowledgeMasteryService) {
        this.wrongSetMapper = wrongSetMapper;
        this.quizService = quizService;
        this.userService = userService;
        this.knowledgeMasteryService = knowledgeMasteryService;
    }

    @GetMapping("/list")
    public ApiResponse<List<WrongQuizItemVO>> getWrongList(@RequestParam(required = false) Long userId,
                                                            HttpServletRequest request) {
        Long currentUserId = resolveUserId(userId, request);
        if (currentUserId == null) {
            return ApiResponse.error(400, "userId is required");
        }
        User user = userService.getById(currentUserId);
        if (user == null) {
            return ApiResponse.error(404, "user not found");
        }
        if (user.getRole() == null || user.getRole() != 0) {
            return ApiResponse.error(403, "only students can access wrong set");
        }
        return ApiResponse.success(wrongSetMapper.selectUnresolvedByUserId(currentUserId));
    }

    @PostMapping("/record")
    public ApiResponse<Map<String, Object>> recordWrong(@RequestBody Map<String, Object> body,
                                                         HttpServletRequest request) {
        Long userId = resolveUserId(parseLong(body.get("userId")), request);
        Integer quizId = parseInteger(body.get("quizId"));
        String selectedAnswer = body.get("selectedAnswer") == null ? "" : body.get("selectedAnswer").toString().trim();
        if (userId == null || quizId == null || !StringUtils.hasText(selectedAnswer)) {
            return ApiResponse.error(400, "userId, quizId and selectedAnswer are required");
        }

        Quiz quiz = quizService.getById(quizId);
        if (quiz == null || !StringUtils.hasText(quiz.getAnswer())) {
            return ApiResponse.error(404, "quiz not found");
        }

        boolean correct = quiz.getAnswer().trim().equalsIgnoreCase(selectedAnswer);
        WrongSet existing = wrongSetMapper.selectOne(new LambdaQueryWrapper<WrongSet>()
                .eq(WrongSet::getUserId, userId)
                .eq(WrongSet::getQuizId, quizId)
                .last("limit 1"));

        LocalDateTime now = LocalDateTime.now();
        Integer errorCount;
        Long wrongId = null;

        if (existing == null) {
            // 首次作答该题：无论对错都要落一行。
            //
            // 原先「答对且首次作答」是不写库的（只设 errorCount = 0 就返回），
            // 导致这次作答彻底消失：智能模块据此算出的「作答题数」永远偏少，
            // 学生答对一道新题后掌握度纹丝不动。现在把它记为
            // is_resolved = true / error_count = 0 的一行 —— 这样 wrong_set
            // 实际承担了「作答流水」的角色：
            //   is_resolved = true  → 已掌握（不出现在错题本，因为列表只查未解决）
            //   error_count > 0     → 曾答错几次，供错误频率维度使用
            WrongSet record = new WrongSet();
            record.setUserId(userId);
            record.setQuizId(quizId);
            record.setSelectedAnswer(selectedAnswer);
            record.setErrorCount(correct ? 0 : 1);
            record.setIsResolved(correct);
            record.setCreatedAt(now);
            record.setUpdatedAt(now);
            wrongSetMapper.insert(record);
            errorCount = record.getErrorCount();
            wrongId = record.getId();
        } else if (!correct) {
            // 又答错了：累加错误次数并重新标记为未掌握
            int currentCount = existing.getErrorCount() == null ? 0 : existing.getErrorCount();
            existing.setErrorCount(currentCount + 1);
            existing.setSelectedAnswer(selectedAnswer);
            existing.setIsResolved(false);
            existing.setUpdatedAt(now);
            wrongSetMapper.updateById(existing);
            errorCount = existing.getErrorCount();
            wrongId = existing.getId();
        } else {
            // 答对了：标记为已掌握（error_count 保留历史错误次数，供错误频率维度使用）
            existing.setSelectedAnswer(selectedAnswer);
            existing.setIsResolved(true);
            existing.setUpdatedAt(now);
            wrongSetMapper.updateById(existing);
            wrongId = existing.getId();
            errorCount = existing.getErrorCount() == null ? 0 : existing.getErrorCount();
        }

        // 作答数据变化后重算知识点掌握度（智能化模块的数据来源）
        knowledgeMasteryService.refreshMastery(userId);

        return ApiResponse.success(buildAnswerResult(correct, quiz, quizId, wrongId, errorCount));
    }

    @PostMapping("/resolve")
    public ApiResponse<Map<String, Object>> resolveWrong(@RequestBody Map<String, Object> body,
                                                          HttpServletRequest request) {
        Long wrongId = parseLong(body.get("wrongId"));
        Long userId = resolveUserId(parseLong(body.get("userId")), request);
        String selectedAnswer = body.get("selectedAnswer") == null ? "" : body.get("selectedAnswer").toString().trim();
        if (wrongId == null || userId == null || !StringUtils.hasText(selectedAnswer)) {
            return ApiResponse.error(400, "wrongId, userId and selectedAnswer are required");
        }

        WrongSet wrongSet = wrongSetMapper.selectOne(new LambdaQueryWrapper<WrongSet>()
                .eq(WrongSet::getId, wrongId)
                .eq(WrongSet::getUserId, userId)
                .last("limit 1"));
        if (wrongSet == null) {
            return ApiResponse.error(404, "wrong record not found");
        }

        Quiz quiz = quizService.getById(wrongSet.getQuizId());
        if (quiz == null || !StringUtils.hasText(quiz.getAnswer())) {
            return ApiResponse.error(404, "quiz not found");
        }

        boolean correct = quiz.getAnswer().trim().equalsIgnoreCase(selectedAnswer);
        Integer errorCount;
        if (correct) {
            wrongSet.setIsResolved(true);
            wrongSet.setSelectedAnswer(selectedAnswer);
            wrongSet.setUpdatedAt(LocalDateTime.now());
            wrongSetMapper.updateById(wrongSet);
            errorCount = wrongSet.getErrorCount() == null ? 0 : wrongSet.getErrorCount();
        } else {
            int currentCount = wrongSet.getErrorCount() == null ? 0 : wrongSet.getErrorCount();
            wrongSet.setErrorCount(currentCount + 1);
            wrongSet.setIsResolved(false);
            wrongSet.setSelectedAnswer(selectedAnswer);
            wrongSet.setUpdatedAt(LocalDateTime.now());
            wrongSetMapper.updateById(wrongSet);
            errorCount = wrongSet.getErrorCount();
        }

        // 错题重做会改变掌握度，需要重算
        knowledgeMasteryService.refreshMastery(userId);

        return ApiResponse.success(buildAnswerResult(correct, quiz, wrongSet.getQuizId(), wrongSet.getId(), errorCount));
    }

    private Map<String, Object> buildAnswerResult(boolean correct, Quiz quiz, Integer quizId, Long wrongId, Integer errorCount) {
        Map<String, Object> result = new java.util.HashMap<>();
        result.put("correct", correct);
        result.put("quizId", quizId);
        result.put("wrongId", wrongId);
        result.put("errorCount", errorCount);
        result.put("isResolved", correct);
        result.put("correctAnswer", quiz.getAnswer());
        result.put("analysis", quiz.getAnalysis());
        return result;
    }

    private Long resolveUserId(Long userId, HttpServletRequest request) {
        if (userId != null) {
            return userId;
        }
        String headerUserId = request.getHeader("X-User-Id");
        if (!StringUtils.hasText(headerUserId)) {
            return null;
        }
        try {
            return Long.valueOf(headerUserId);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Long parseLong(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return Long.valueOf(value.toString());
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private Integer parseInteger(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return Integer.valueOf(value.toString());
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
