package com.example.cybersec.listener;

import com.alibaba.excel.context.AnalysisContext;
import com.alibaba.excel.event.AnalysisEventListener;
import com.example.cybersec.dto.QuizImportRow;
import com.example.cybersec.entity.Quiz;
import com.example.cybersec.repository.QuizMapper;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

public class QuizExcelListener extends AnalysisEventListener<QuizImportRow> {

    private static final int BATCH_COUNT = 200;

    private final QuizMapper quizMapper;
    private final Integer paperId;
    private final List<Quiz> cacheList = new ArrayList<>(BATCH_COUNT);
    private int successCount = 0;

    public QuizExcelListener(QuizMapper quizMapper, Integer paperId) {
        this.quizMapper = quizMapper;
        this.paperId = paperId;
    }

    @Override
    public void invoke(QuizImportRow data, AnalysisContext context) {
        if (data == null || !StringUtils.hasText(data.getQuestion())) {
            return;
        }

        Quiz quiz = new Quiz();
        quiz.setQuestion(trim(data.getQuestion()));
        quiz.setOptionA(trim(data.getOptionA()));
        quiz.setOptionB(trim(data.getOptionB()));
        quiz.setOptionC(trim(data.getOptionC()));
        quiz.setOptionD(trim(data.getOptionD()));
        quiz.setAnswer(trim(data.getAnswer()));
        quiz.setAnalysis(trim(data.getAnalysis()));
        quiz.setPaperId(paperId);
        cacheList.add(quiz);

        if (cacheList.size() >= BATCH_COUNT) {
            saveData();
        }
    }

    @Override
    public void doAfterAllAnalysed(AnalysisContext context) {
        saveData();
    }

    public int getSuccessCount() {
        return successCount;
    }

    private void saveData() {
        if (cacheList.isEmpty()) {
            return;
        }
        quizMapper.insertQuizBatch(cacheList);
        successCount += cacheList.size();
        cacheList.clear();
    }

    private String trim(String value) {
        return value == null ? null : value.trim();
    }
}
