package com.example.cybersec.controller;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.example.cybersec.common.ApiResponse;
import com.example.cybersec.entity.Quiz;
import com.example.cybersec.entity.QuizPaper;
import com.example.cybersec.service.QuizPaperService;
import com.example.cybersec.service.QuizService;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping({"/api/paper", "/api/admin/paper"})
public class QuizPaperController {

    private final QuizPaperService quizPaperService;
    private final QuizService quizService;

    public QuizPaperController(QuizPaperService quizPaperService, QuizService quizService) {
        this.quizPaperService = quizPaperService;
        this.quizService = quizService;
    }

    @GetMapping("/list")
    public ApiResponse<List<QuizPaper>> listPapers() {
        List<QuizPaper> papers = quizPaperService.list(new LambdaQueryWrapper<QuizPaper>().orderByDesc(QuizPaper::getId));
        return ApiResponse.success(papers);
    }

    @GetMapping("/get/{id}")
    public ApiResponse<QuizPaper> getPaper(@PathVariable Integer id) {
        QuizPaper paper = quizPaperService.getById(id);
        if (paper == null) {
            return ApiResponse.error(404, "paper not found");
        }
        return ApiResponse.success(paper);
    }

    @PostMapping("/add")
    public ApiResponse<String> addPaper(@RequestBody QuizPaper paper) {
        if (paper == null || !StringUtils.hasText(paper.getTitle())) {
            return ApiResponse.error(400, "title is required");
        }
        paper.setTitle(paper.getTitle().trim());
        boolean saved = quizPaperService.save(paper);
        if (!saved) {
            return ApiResponse.error(500, "create paper failed");
        }
        return ApiResponse.success("paper created");
    }

    @PutMapping("/update")
    public ApiResponse<String> updatePaper(@RequestBody QuizPaper paper) {
        if (paper == null || paper.getId() == null) {
            return ApiResponse.error(400, "id is required");
        }
        if (!StringUtils.hasText(paper.getTitle())) {
            return ApiResponse.error(400, "title is required");
        }

        QuizPaper existing = quizPaperService.getById(paper.getId());
        if (existing == null) {
            return ApiResponse.error(404, "paper not found");
        }

        paper.setTitle(paper.getTitle().trim());
        boolean updated = quizPaperService.updateById(paper);
        if (!updated) {
            return ApiResponse.error(500, "update paper failed");
        }
        return ApiResponse.success("paper updated");
    }

    @DeleteMapping("/delete/{id}")
    public ApiResponse<String> deletePaper(@PathVariable Integer id) {
        QuizPaper existing = quizPaperService.getById(id);
        if (existing == null) {
            return ApiResponse.error(404, "paper not found");
        }
        boolean deleted = quizPaperService.removeById(id);
        if (!deleted) {
            return ApiResponse.error(500, "delete paper failed");
        }
        return ApiResponse.success("paper deleted");
    }

    @GetMapping("/quizzes/{paperId}")
    public ApiResponse<List<Quiz>> listQuizzesByPaper(@PathVariable Integer paperId) {
        QuizPaper paper = quizPaperService.getById(paperId);
        if (paper == null) {
            return ApiResponse.error(404, "paper not found");
        }
        List<Quiz> quizzes = quizService.list(new LambdaQueryWrapper<Quiz>()
                .eq(Quiz::getPaperId, paperId)
                .orderByDesc(Quiz::getId));
        return ApiResponse.success(quizzes);
    }
}
