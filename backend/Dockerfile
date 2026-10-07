# =============================================================================
#  后端 Dockerfile —— 多阶段构建
# -----------------------------------------------------------------------------
#  为什么用多阶段：
#    第一阶段用 Maven 镜像编译，第二阶段只把 jar 拷进 JRE 镜像。
#    最终镜像 ~200MB 而不是 ~600MB，部署更快、平台免费额度更耐用。
#
#  本地构建测试：
#      docker build -t cybersec-backend ./backend
#      docker run -p 8080:8080 -e SPRING_DATASOURCE_URL=... cybersec-backend
#
#  Railway / Render / Koyeb 都能直接识别这个文件，无需额外配置。
# =============================================================================

# ---------- 阶段 1：编译 ----------
FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /build

# 先只拷 pom.xml 并预热依赖。
# 这样只要 pom 没变，改 Java 代码不会重新下载全部依赖 —— 构建从几分钟降到几十秒。
COPY pom.xml .
RUN mvn -B -q dependency:go-offline

# 再拷源码编译
COPY src ./src
RUN mvn -B -DskipTests clean package

# ---------- 阶段 2：运行 ----------
FROM eclipse-temurin:17-jre

# 时区设成中国，否则日志时间和你本地对不上，排查问题很别扭
ENV TZ=Asia/Shanghai
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

# eclipse-temurin 的 JRE 镜像里没有 curl，而下面的 HEALTHCHECK 需要它。
# 不装的话健康检查永远失败，平台会把容器判定为不健康并反复重启。
RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/*

# 用非 root 用户跑，是个基本的安全习惯
RUN useradd -m -u 10001 appuser
WORKDIR /app
COPY --from=build /build/target/*.jar app.jar
RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

# 容器内存限制通常很小（免费额度 512MB），必须限制 JVM 堆，
# 否则 JVM 会按宿主机内存去要，容易被平台 OOM Kill。
ENV JAVA_OPTS="-XX:MaxRAMPercentage=70 -XX:+UseSerialGC -Djava.security.egd=file:/dev/./urandom"

# 健康检查：平台据此判断服务是否就绪
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -fsS http://127.0.0.1:${PORT:-8080}/api/news/list || exit 1

ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar app.jar"]
