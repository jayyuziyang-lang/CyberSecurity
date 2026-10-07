package com.example.cybersec.common;

import lombok.Data;

@Data
public class ApiResponse<T> {
    private int code;      // 状态码，比如 200 表示成功，500 表示失败
    private String message; // 给前端看的提示信息
    private T data;         // 实际装载的数据（比如新闻列表、题目内容）

    // 快捷返回成功的静态方法
    public static <T> ApiResponse<T> success(T data) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setCode(200);
        response.setMessage("操作成功");
        response.setData(data);
        return response;
    }

    // 快捷返回失败的静态方法
    public static <T> ApiResponse<T> error(int code, String message) {
        ApiResponse<T> response = new ApiResponse<>();
        response.setCode(code);
        response.setMessage(message);
        response.setData(null);
        return response;
    }
}