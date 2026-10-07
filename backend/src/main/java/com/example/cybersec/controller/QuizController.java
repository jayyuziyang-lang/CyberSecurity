package com.example.cybersec.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.plugins.pagination.Page;
import com.alibaba.excel.EasyExcel;
import com.example.cybersec.common.ApiResponse;
import com.example.cybersec.entity.Quiz;
import com.example.cybersec.entity.QuizPaper;
import com.example.cybersec.entity.WrongSet;
import com.example.cybersec.listener.QuizExcelListener;
import com.example.cybersec.repository.QuizMapper;
import com.example.cybersec.repository.QuizPaperMapper;
import com.example.cybersec.repository.UserMapper;
import com.example.cybersec.repository.WrongSetMapper;
import com.example.cybersec.service.QuizService;
import com.example.cybersec.service.WechatFacade;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/quiz", "/api/admin/quiz"})
public class QuizController {

    @Autowired
    private QuizService quizService;

    @Autowired
    private UserMapper userMapper;

    @Autowired
    private QuizMapper quizMapper;

    @Autowired
    private QuizPaperMapper quizPaperMapper;

    @Autowired
    private WrongSetMapper wrongSetMapper;

    @Autowired
    private WechatFacade wechatFacade;

    @GetMapping("/all")
    public ApiResponse<List<Quiz>> getAllQuizzes() {
        return ApiResponse.success(quizService.list());
    }

    @PostMapping("/submit")
    public ApiResponse<?> submitQuiz(@RequestBody Map<String, Object> params) {
        if (params.containsKey("quizId")) {
            return submitSingleAnswer(params);
        }

        Long userId = parseLong(params.get("userId"));
        if (userId == null) {
            return ApiResponse.error(400, "userId is required");
        }

        int updated = userMapper.addPoints(userId, 20);
        if (updated <= 0) {
            return ApiResponse.error(500, "update points failed");
        }
        wechatFacade.sendMpNotification(userId, "\u4f5c\u4e1a\u5b8c\u6210\uff0c\u771f\u5b9e\u843d\u5e93\u79ef\u5206 +20 \u6210\u529f\uff01");
        return ApiResponse.success("points updated");
    }

    @DeleteMapping("/delete/{id}")
    public ApiResponse<String> deleteQuiz(@PathVariable Integer id) {
        Quiz existing = quizService.getById(id);
        if (existing == null) {
            return ApiResponse.error(404, "quiz not found");
        }
        boolean success = quizService.removeById(id);
        if (!success) {
            return ApiResponse.error(500, "delete quiz failed");
        }
        return ApiResponse.success("quiz deleted");
    }

    @PutMapping("/update")
    public ApiResponse<String> updateQuiz(@RequestBody Quiz quiz) {
        if (quiz.getId() == null) {
            return ApiResponse.error(400, "id is required");
        }
        Quiz existing = quizService.getById(quiz.getId());
        if (existing == null) {
            return ApiResponse.error(404, "quiz not found");
        }
        String validationMessage = validateQuizPayload(quiz);
        if (validationMessage != null) {
            return ApiResponse.error(400, validationMessage);
        }
        if (quiz.getPaperId() == null) {
            quiz.setPaperId(existing.getPaperId());
        }
        String paperValidation = validatePaperId(quiz.getPaperId());
        if (paperValidation != null) {
            return ApiResponse.error(400, paperValidation);
        }
        normalizeQuizFields(quiz);
        boolean success = quizService.updateById(quiz);
        if (!success) {
            return ApiResponse.error(500, "update quiz failed");
        }
        return ApiResponse.success("quiz updated");
    }

    @GetMapping("/list")
    public ApiResponse<Map<String, Object>> listQuiz(@RequestParam(defaultValue = "1") Long pageNum,
                                                      @RequestParam(defaultValue = "10") Long pageSize,
                                                      @RequestParam(required = false) String question,
                                                      @RequestParam(required = false) String answer,
                                                      @RequestParam(required = false) Integer paperId) {
        if (pageNum == null || pageNum < 1 || pageSize == null || pageSize < 1) {
            return ApiResponse.error(400, "pageNum and pageSize must be greater than 0");
        }
        LambdaQueryWrapper<Quiz> wrapper = new LambdaQueryWrapper<>();
        if (StringUtils.hasText(question)) {
            wrapper.like(Quiz::getQuestion, question.trim());
        }
        if (StringUtils.hasText(answer)) {
            wrapper.eq(Quiz::getAnswer, answer.trim());
        }
        if (paperId != null) {
            wrapper.eq(Quiz::getPaperId, paperId);
        }
        wrapper.orderByDesc(Quiz::getId);

        Page<Quiz> page = quizService.page(new Page<>(pageNum, pageSize), wrapper);
        Map<String, Object> data = new HashMap<>();
        data.put("records", page.getRecords());
        data.put("total", page.getTotal());
        data.put("pageNum", page.getCurrent());
        data.put("pageSize", page.getSize());
        data.put("pages", page.getPages());
        return ApiResponse.success(data);
    }

    @PostMapping("/add")
    public ApiResponse<String> addQuiz(@RequestBody Quiz quiz) {
        String validationMessage = validateQuizPayload(quiz);
        if (validationMessage != null) {
            return ApiResponse.error(400, validationMessage);
        }
        String paperValidation = validatePaperId(quiz.getPaperId());
        if (paperValidation != null) {
            return ApiResponse.error(400, paperValidation);
        }
        normalizeQuizFields(quiz);
        boolean success = quizService.save(quiz);
        if (!success) {
            return ApiResponse.error(500, "create quiz failed");
        }
        return ApiResponse.success("quiz created");
    }

    @PostMapping("/import")
    public ApiResponse<String> importQuizExcel(@RequestParam("file") MultipartFile file,
                                               @RequestParam("paperId") Integer paperId) {
        if (file == null || file.isEmpty()) {
            return ApiResponse.error(400, "file is required");
        }
        String paperValidation = validatePaperId(paperId);
        if (paperValidation != null) {
            return ApiResponse.error(400, paperValidation);
        }

        try {
            QuizExcelListener listener = new QuizExcelListener(quizMapper, paperId);
            EasyExcel.read(file.getInputStream(), com.example.cybersec.dto.QuizImportRow.class, listener)
                    .sheet()
                    .doRead();
            if (listener.getSuccessCount() <= 0) {
                return ApiResponse.error(400, "no valid rows");
            }
            return ApiResponse.success("imported: " + listener.getSuccessCount());
        } catch (IOException ex) {
            return ApiResponse.error(500, "failed to read excel");
        }
    }

    private ApiResponse<Map<String, Object>> submitSingleAnswer(Map<String, Object> params) {
        Long userId = parseLong(params.get("userId"));
        Integer quizId = parseInteger(params.get("quizId"));
        String selectedAnswer = params.get("selectedAnswer") == null ? "" : params.get("selectedAnswer").toString().trim();
        if (userId == null || quizId == null || !StringUtils.hasText(selectedAnswer)) {
            return ApiResponse.error(400, "userId, quizId and selectedAnswer are required");
        }

        Quiz quiz = quizService.getById(quizId);
        if (quiz == null || !StringUtils.hasText(quiz.getAnswer())) {
            return ApiResponse.error(404, "quiz not found");
        }

        String correctAnswer = quiz.getAnswer().trim();
        boolean correct = correctAnswer.equalsIgnoreCase(selectedAnswer);
        WrongSet existing = wrongSetMapper.selectOne(new LambdaQueryWrapper<WrongSet>()
                .eq(WrongSet::getUserId, userId)
                .eq(WrongSet::getQuizId, quizId)
                .last("limit 1"));

        LocalDateTime now = LocalDateTime.now();
        Integer errorCount;
        Long wrongId = null;

        // 与 WrongSetController.recordWrong 保持一致的语义：
        // 首次作答无论对错都落一行，否则「答对一道新题」这次作答会凭空消失，
        // 智能模块的作答题数会永远偏少、掌握度不会变化。
        if (existing == null) {
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
            int currentCount = existing.getErrorCount() == null ? 0 : existing.getErrorCount();
            existing.setErrorCount(currentCount + 1);
            existing.setSelectedAnswer(selectedAnswer);
            existing.setIsResolved(false);
            existing.setUpdatedAt(now);
            wrongSetMapper.updateById(existing);
            errorCount = existing.getErrorCount();
            wrongId = existing.getId();
        } else {
            existing.setSelectedAnswer(selectedAnswer);
            existing.setIsResolved(true);
            existing.setUpdatedAt(now);
            wrongSetMapper.updateById(existing);
            wrongId = existing.getId();
            errorCount = existing.getErrorCount() == null ? 0 : existing.getErrorCount();
        }

        Map<String, Object> result = new HashMap<>();
        result.put("correct", correct);
        result.put("quizId", quizId);
        result.put("wrongId", wrongId);
        result.put("errorCount", errorCount);
        result.put("isResolved", correct);
        result.put("correctAnswer", quiz.getAnswer());
        result.put("analysis", quiz.getAnalysis());
        return ApiResponse.success(result);
    }

    private String validateQuizPayload(Quiz quiz) {
        if (!StringUtils.hasText(quiz.getQuestion())) {
            return "question is required";
        }
        if (!StringUtils.hasText(quiz.getOptionA())
                || !StringUtils.hasText(quiz.getOptionB())
                || !StringUtils.hasText(quiz.getOptionC())
                || !StringUtils.hasText(quiz.getOptionD())) {
            return "all options are required";
        }
        if (!StringUtils.hasText(quiz.getAnswer())) {
            return "answer is required";
        }
        return null;
    }

    private void normalizeQuizFields(Quiz quiz) {
        quiz.setQuestion(quiz.getQuestion() == null ? null : quiz.getQuestion().trim());
        quiz.setOptionA(quiz.getOptionA() == null ? null : quiz.getOptionA().trim());
        quiz.setOptionB(quiz.getOptionB() == null ? null : quiz.getOptionB().trim());
        quiz.setOptionC(quiz.getOptionC() == null ? null : quiz.getOptionC().trim());
        quiz.setOptionD(quiz.getOptionD() == null ? null : quiz.getOptionD().trim());
        quiz.setAnswer(quiz.getAnswer() == null ? null : quiz.getAnswer().trim());
        quiz.setAnalysis(quiz.getAnalysis() == null ? null : quiz.getAnalysis().trim());
    }

    private String validatePaperId(Integer paperId) {
        if (paperId == null) {
            return "paperId is required";
        }
        QuizPaper paper = quizPaperMapper.selectById(paperId);
        if (paper == null) {
            return "paper not found";
        }
        return null;
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
