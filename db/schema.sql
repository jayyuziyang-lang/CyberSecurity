-- =============================================================================
--  网络安全科普答题平台 —— 完整数据库结构（PostgreSQL）
-- -----------------------------------------------------------------------------
--  用法（全新数据库，一步到位）：
--      createdb -U postgres cybersec_db
--      psql -U postgres -d cybersec_db -f db/schema.sql
--      psql -U postgres -d cybersec_db -f db/seed.sql
--
--  说明：
--    * 本文件替代原先缺失的建表脚本。原 db/ 目录下只有两个 ALTER 语句文件，
--      且它们修改的 user / news 两张表的 CREATE 语句并不存在于仓库中，
--      导致换一台机器无法建库、项目无法启动。本文件补齐全部 9 张表。
--    * 全部语句均为幂等写法（IF NOT EXISTS），可重复执行。
--    * "user" 是 PostgreSQL 保留字，必须加双引号，与实体 @TableName("\"user\"") 对应。
--    * 不设置外键：ReportController 在 userId 为空时会写入字面量 0，
--      外键约束会导致举报提交失败；且 registration 依赖 ON CONFLICT 去重。
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. user —— 用户表
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "user" (
    id                BIGSERIAL    PRIMARY KEY,
    username          VARCHAR(64)  NOT NULL,
    password          VARCHAR(128),                            -- 明文存储，仅限课程设计演示
    nickname          VARCHAR(100),
    avatar_url        TEXT,
    points            INTEGER      NOT NULL DEFAULT 0,
    is_followed       INTEGER      NOT NULL DEFAULT 0,          -- 0 未关注 / 1 已关注
    role              INTEGER      NOT NULL DEFAULT 0,          -- 0 学生 / 1 管理员
    is_authenticated  BOOLEAN      NOT NULL DEFAULT FALSE,
    create_time       TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_user_username ON "user" (username);

-- -----------------------------------------------------------------------------
-- 2. news —— 资讯 / 竞赛 / 活动 / 公告
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS news (
    id              BIGSERIAL    PRIMARY KEY,
    title           VARCHAR(255) NOT NULL,
    content         TEXT,
    author          VARCHAR(64),
    cover_url       TEXT,
    category        VARCHAR(32),                                -- 竞赛信息/安全动态/系统公告/网络安全活动
    is_competition  BOOLEAN      NOT NULL DEFAULT FALSE,
    create_time     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_news_create_time    ON news (create_time DESC);
CREATE INDEX IF NOT EXISTS idx_news_category       ON news (category);
CREATE INDEX IF NOT EXISTS idx_news_is_competition ON news (is_competition);

-- -----------------------------------------------------------------------------
-- 3. quiz_paper —— 作业包（题目分组）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz_paper (
    id     BIGSERIAL    PRIMARY KEY,
    title  VARCHAR(200) NOT NULL
);

-- seed.sql 用 (SELECT id FROM quiz_paper WHERE title = ...) 做标量子查询，
-- 标题重复会触发 SQLSTATE 21000，因此必须唯一。
CREATE UNIQUE INDEX IF NOT EXISTS uk_quiz_paper_title ON quiz_paper (title);

-- -----------------------------------------------------------------------------
-- 4. quiz —— 作业包内的正式题目（学生实际作答的表）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz (
    id        BIGSERIAL PRIMARY KEY,
    question  TEXT      NOT NULL,
    option_a  TEXT,
    option_b  TEXT,
    option_c  TEXT,
    option_d  TEXT,
    answer    VARCHAR(16),
    analysis  TEXT,
    paper_id  BIGINT
);

CREATE INDEX IF NOT EXISTS idx_quiz_paper_id ON quiz (paper_id);

-- -----------------------------------------------------------------------------
-- 5. quiz_bank —— Excel 题库导入缓冲表
--    注：当前代码未写入该表（导入直接写 quiz），保留以保持结构完整。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz_bank (
    id        BIGSERIAL   PRIMARY KEY,
    question  TEXT        NOT NULL,
    option_a  TEXT,
    option_b  TEXT,
    option_c  TEXT,
    option_d  TEXT,
    answer    VARCHAR(16),
    analysis  TEXT,
    type      VARCHAR(64)
);

-- -----------------------------------------------------------------------------
-- 6. wrong_set —— 错题本
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS wrong_set (
    id              BIGSERIAL   PRIMARY KEY,
    user_id         BIGINT      NOT NULL,
    quiz_id         BIGINT      NOT NULL,
    selected_answer VARCHAR(16),
    error_count     INTEGER     NOT NULL DEFAULT 1,
    is_resolved     BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- 代码假定「一个学生对一道题最多一行」（selectOne + limit 1），必须靠唯一索引保证
CREATE UNIQUE INDEX IF NOT EXISTS uk_wrong_set_user_quiz ON wrong_set (user_id, quiz_id);
CREATE INDEX        IF NOT EXISTS idx_wrong_set_user_id   ON wrong_set (user_id);

-- -----------------------------------------------------------------------------
-- 7. real_name_auth —— 实名认证记录
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS real_name_auth (
    id          BIGSERIAL   PRIMARY KEY,
    user_id     BIGINT      NOT NULL,
    real_name   VARCHAR(64) NOT NULL,
    id_card     VARCHAR(32) NOT NULL,
    verified_at TIMESTAMP   NOT NULL DEFAULT NOW()
);

-- 注意：这里刻意【不】建 user_id 唯一索引。
--   AuthController.verify 每次调用都无条件 INSERT（无去重、无 upsert），
--   若加唯一索引，学生第二次点「实名认证」就会触发 SQLSTATE 23505 → HTTP 500。
--   加索引并不能修复幂等性缺陷，反而会制造一个 500。本表按「追加日志」语义使用，
--   允许同一用户存在多条认证记录（最后一条为准）。
CREATE INDEX IF NOT EXISTS idx_real_name_auth_user_id ON real_name_auth (user_id);

-- -----------------------------------------------------------------------------
-- 8. report —— 安全举报
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS report (
    id          BIGSERIAL    PRIMARY KEY,
    user_id     BIGINT,                                  -- 可为 0：ReportController 的默认值
    title       VARCHAR(255) NOT NULL,
    content     TEXT,
    images      TEXT,                                    -- JSON 数组字符串
    status      INTEGER      NOT NULL DEFAULT 0,         -- 0 待审核 / 1 已通过
    create_time TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_status ON report (status);

-- -----------------------------------------------------------------------------
-- 9. registration —— 活动 / 竞赛报名
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS registration (
    id          BIGSERIAL PRIMARY KEY,
    news_id     BIGINT    NOT NULL,
    user_id     BIGINT    NOT NULL,
    create_time TIMESTAMP NOT NULL DEFAULT NOW()
);

-- RegistrationMapper.insertIfAbsent 依赖 ON CONFLICT (news_id, user_id)
CREATE UNIQUE INDEX IF NOT EXISTS uk_registration_news_user ON registration (news_id, user_id);
CREATE INDEX        IF NOT EXISTS idx_registration_user_id  ON registration (user_id);

-- =============================================================================
--  智能化模块：知识点 / 掌握度诊断 / 个性化推荐
-- -----------------------------------------------------------------------------
--  设计思路：
--    * quiz 表保持不动（不破坏现有作业包流程），通过 quiz_knowledge 关联表
--      把「题目」挂到「知识点」上，一个知识点可覆盖多题，一题也可挂多个知识点。
--    * user_knowledge_mastery 保存每个学生每个知识点的掌握度（派生数据）。
--      冗余的 correct/wrong/attempt_count 是为了支持「最近 N 次作答」的
--      近因加权，否则每次计算都要全量重扫 wrong_set。
--    * 掌握度不是简单正确率，而是三维加权公式，详见 KnowledgeMasteryService。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 10. knowledge_point —— 知识点
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS knowledge_point (
    id          BIGSERIAL    PRIMARY KEY,
    code        VARCHAR(64)  NOT NULL,
    name        VARCHAR(100) NOT NULL,
    category    VARCHAR(64),
    description TEXT,
    difficulty  SMALLINT     NOT NULL DEFAULT 2,           -- 1 易 / 2 中 / 3 难
    sort_order  INTEGER      NOT NULL DEFAULT 0
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_knowledge_point_code ON knowledge_point (code);

-- -----------------------------------------------------------------------------
-- 11. quiz_knowledge —— 题目 ↔ 知识点（多对多）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS quiz_knowledge (
    id                 BIGSERIAL PRIMARY KEY,
    quiz_id            BIGINT    NOT NULL,
    knowledge_point_id BIGINT    NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_quiz_knowledge        ON quiz_knowledge (quiz_id, knowledge_point_id);
CREATE INDEX        IF NOT EXISTS idx_quiz_knowledge_point ON quiz_knowledge (knowledge_point_id);

-- -----------------------------------------------------------------------------
-- 12. user_knowledge_mastery —— 学生知识点掌握度（派生数据，可随时重算）
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_knowledge_mastery (
    id               BIGSERIAL      PRIMARY KEY,
    user_id          BIGINT         NOT NULL,
    knowledge_point_id BIGINT       NOT NULL,
    mastery          NUMERIC(5, 2)  NOT NULL DEFAULT 0,      -- 0 ~ 100
    level            VARCHAR(16),                            -- WEAK / BASIC / PROFICIENT
    correct_count    INTEGER        NOT NULL DEFAULT 0,
    wrong_count      INTEGER        NOT NULL DEFAULT 0,
    attempt_count    INTEGER        NOT NULL DEFAULT 0,
    accuracy         NUMERIC(5, 4)  NOT NULL DEFAULT 0,      -- 0 ~ 1
    recent_accuracy  NUMERIC(5, 4),                          -- 最近 5 次正确率
    last_answer_time TIMESTAMP,
    update_time      TIMESTAMP      NOT NULL DEFAULT NOW()
);

-- 一个学生一个知识点只有一行
CREATE UNIQUE INDEX IF NOT EXISTS uk_ukm_user_point ON user_knowledge_mastery (user_id, knowledge_point_id);
CREATE INDEX        IF NOT EXISTS idx_ukm_user       ON user_knowledge_mastery (user_id);

COMMIT;

-- =============================================================================
--  结构校验（可选）：确认 12 张表都已创建
-- -----------------------------------------------------------------------------
--  SELECT table_name FROM information_schema.tables
--  WHERE table_schema = 'public' ORDER BY table_name;
--  期望输出：knowledge_point, news, quiz, quiz_bank, quiz_knowledge, quiz_paper,
--            real_name_auth, registration, report, user, user_knowledge_mastery,
--            wrong_set
-- =============================================================================
