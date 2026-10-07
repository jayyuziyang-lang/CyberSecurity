package com.example.cybersec.config;

import com.example.cybersec.interceptor.LoginInterceptor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
public class WebMvcConfig implements WebMvcConfigurer {

    private final LoginInterceptor loginInterceptor;

    public WebMvcConfig(LoginInterceptor loginInterceptor) {
        this.loginInterceptor = loginInterceptor;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(loginInterceptor)
                .addPathPatterns("/api/**")
                .excludePathPatterns(
                        "/api/auth/**"
                );
    }

    /**
     * 跨域配置。
     *
     * <p>微信小程序走 wx.request，不受浏览器同源策略约束，所以原先没有这段配置也能跑。
     * 但 {@code web-demo/} 里的网页版演示前端是另一个源（可能还是内网穿透域名），
     * 不加 CORS 浏览器会直接拦掉所有请求。
     *
     * <p>这里放开所有来源：本项目的定位是课程设计演示，
     * 且身份本身靠可伪造的 X-User-Id 头传递，加白名单并不会带来真实的安全收益，
     * 反而会在换穿透域名时反复失败。生产环境必须改成具体域名白名单。
     */
    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**")
                .allowedOriginPatterns("*")
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                .allowedHeaders("*")
                .allowCredentials(false)
                .maxAge(3600);
    }
}
