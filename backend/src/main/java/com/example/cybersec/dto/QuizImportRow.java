package com.example.cybersec.dto;

import com.alibaba.excel.annotation.ExcelProperty;
import lombok.Data;

@Data
public class QuizImportRow {
    @ExcelProperty("\u9898\u76ee")
    private String question;

    @ExcelProperty("\u9009\u9879A")
    private String optionA;

    @ExcelProperty("\u9009\u9879B")
    private String optionB;

    @ExcelProperty("\u9009\u9879C")
    private String optionC;

    @ExcelProperty("\u9009\u9879D")
    private String optionD;

    @ExcelProperty("\u6b63\u786e\u7b54\u6848")
    private String answer;

    @ExcelProperty("\u89e3\u6790")
    private String analysis;
}
