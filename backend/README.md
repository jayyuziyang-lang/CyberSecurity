# wechat-cybersec-platform

网络安全科普答题平台 —— 微信小程序 + Spring Boot 后端。

> 说明：本 README 已于项目整理时重写。旧版本描述的是一个**更早的系统**
> （说登录用微信 `code` 换 session、说 `AuthController` 是空文件、
> 说用 `@Value` 读 `wx.appId`），这些都与当前代码不符，请以本文件和源码为准。

---

## 1. 项目结构

```text
CyberSecurity/
├─ backend/                    # Spring Boot 3.2.5 + Java 17 + MyBatis-Plus
│  └─ src/main/java/com/example/cybersec/
│     ├─ controller/           # 12 个 REST 控制器
│     ├─ service/ + impl/      # 业务层
│     ├─ repository/           # MyBatis-Plus Mapper
│     ├─ entity/               # 12 个实体（对应 12 张表）
│     ├─ dto/                  # 请求/响应对象
│     ├─ interceptor/          # 登录拦截器
│     ├─ listener/             # EasyExcel 导入监听器
│     ├─ task/                 # 定时任务
│     └─ config/               # MyBatis-Plus / WebMvc 配置
├─ frontend/                   # 微信小程序原生代码（19 个页面）
│  ├─ app.json / app.js / app.wxss
│  ├─ pages/                   # 业务页 + admin/ 管理页
│  ├─ utils/                   # request.js（统一带鉴权头）、util.js
│  └─ images/
├─ db/
│  ├─ schema.sql               # ★ 完整建表脚本（12 张表，幂等）
│  ├─ seed.sql                 # ★ 演示数据（账号/题库/资讯/错题/举报）
│  └─ legacy/                  # 历史增量脚本，仅作追溯，请勿执行
└─ tools/
   └─ verify_schema.ps1        # ★ 校验 DDL 是否覆盖代码引用的全部字段
```

> **关于 `db/legacy/`**：里面是最早的两个 `ALTER` 增量脚本，**请勿执行**。
> 它们只含 `ALTER` 语句，所修改的 `user` / `news` 表的 `CREATE` 从未存在于仓库中，
> 在新库上会直接报「表不存在」；且其中一个把 `wrong_set.quiz_id` 声明为 `INTEGER`，
> 与 `schema.sql` 的 `BIGINT` 冲突（两者都是 `IF NOT EXISTS`，先执行者胜出）。
> **全新环境只需执行 `db/schema.sql` + `db/seed.sql`。**

---

## 2. 环境要求

| 依赖 | 版本 | 说明 |
|---|---|---|
| JDK | 17 | 必须，Spring Boot 3.2.5 要求 |
| PostgreSQL | 14+ | 库名 `cybersec_db` |
| Maven | 3.8+ | 或使用项目自带 `mvnw` |
| 微信开发者工具 | 最新稳定版 | 运行 `frontend/` |
| Redis | 不需要 | 依赖里声明了但代码完全未使用 |

---

## 3. 快速启动

### 3.1 建库 + 灌演示数据

```bash
createdb -U postgres cybersec_db

psql -U postgres -d cybersec_db -f db/schema.sql
psql -U postgres -d cybersec_db -f db/seed.sql
```

校验 12 张表是否齐全：

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
-- 期望：knowledge_point, news, quiz, quiz_bank, quiz_knowledge, quiz_paper,
--       real_name_auth, registration, report, user, user_knowledge_mastery, wrong_set
```

### 3.2 改数据库密码

编辑 `backend/src/main/resources/application.yml`，把 `spring.datasource.password`
改成你本机的 postgres 密码（当前值为示例值）。

### 3.3 启动后端

```bash
cd backend

# Windows
.\mvnw.cmd spring-boot:run

# macOS / Linux
./mvnw spring-boot:run
```

若 `mvnw` 因网络无法下载 Maven，可改用本机已安装的 Maven：

```bash
mvn spring-boot:run
```

启动后监听 `http://localhost:8080`。

### 3.4 运行小程序

1. 微信开发者工具 → 导入项目 → 选择 `frontend/` 目录
2. AppID 填 `project.config.json` 里的值，或选「测试号」
3. 详情 → 本地设置 → 勾选 **不校验合法域名**（因为后端是 http://localhost）
4. 编译运行

### 3.5 演示账号

| 账号 | 密码 | 角色 | 状态 |
|---|---|---|---|
| `admin` | `admin123` | 管理员（role=1） | 已实名，可进管理端 |
| `student1` | `123456` | 学生 | 已实名，有错题记录 |
| `student2` | `123456` | 学生 | **未实名**，用于演示实名门禁 |
| `student3` ~ `student5` | `123456` | 学生 | 已实名，有积分排名 |

---

## 4. 功能清单

**学生端**

- 登录 / 注册（账号密码）
- 资讯：分类筛选、关键词搜索、详情、竞赛/活动报名
- 答题：按作业包作答，逐题提交，完成加分
- 错题本：记录错题、重做、答对自动移除
- **学习诊断报告（智能化）**：知识点掌握度可视化、薄弱点定位、个性化推荐练习
- 排行榜：积分 Top 10
- 个人信息修改、一键举报

**管理端**（`role=1` 可见）

- 发布资讯
- 题库管理：作业包增删、题目增删改、Excel 批量导入
- 举报审核 → 通过后自动转为系统公告
- 数据看板：报名明细、学习概览、高频错题

---

## 4.1 智能化模块：知识点掌握度诊断与个性化推荐

> 纯算法实现，**不依赖任何外部服务或大模型**，可完全离线运行。

### 数据模型

题目本身不带知识点，通过关联表把「题目」挂到「知识点」上：

```
quiz ──< quiz_knowledge >── knowledge_point
                                    │
wrong_set（作答记录）────────────────┘
                                    ↓
                        user_knowledge_mastery（派生：每个学生每个知识点的掌握度）
```

新增 3 张表：`knowledge_point`（知识点）、`quiz_knowledge`（多对多关联）、
`user_knowledge_mastery`（掌握度，可随时由作答记录重算）。
种子数据内置 8 个知识点、12 道题的映射关系。

### 算法一：掌握度（加权三维模型）

```
mastery = 100 × ( 0.5 × A + 0.3 × (1 − P) + 0.2 × R )

  A（正确率）  = 已答对题数 / 已作答题数
  P（错误频率）= min(1, 累计答错次数 / (2 × 已作答题数))
  R（近因）    = 最近 5 次作答的正确率（无记录时退化为 A）

冷启动保护：已作答题数 < 2 时，P 与 R 噪声过大，退化为纯正确率
```

**为什么不能只用正确率**（这是答辩最容易被问到的点）：

| 场景 | 只用正确率 | 本模型 | 说明 |
|---|---|---|---|
| 4 题全对，从未答错 | 100 | **100.00** | — |
| 4 题全对，但错了 6 次才答对 | 100 | **77.50** | 正确率字段完全一样，必须靠错误频率区分 |
| 2 对 2 错，最近 5 次全对 | 50 | **67.50** | 历史正确率一样，但"最近学会了" |
| 2 对 2 错，最近 5 次全错 | 50 | **47.50** | 对照组，反映"最近退步了" |

> 上表后两行就是**近因加权**的价值：历史正确率无法区分「先错后对」和「先对后错」，
> 加时间维度之后才能区分。

分级：`<60` 薄弱（WEAK） · `60~75` 合格（BASIC） · `≥75` 熟练（PROFICIENT）

### 算法二：薄弱点定位

按掌握度升序排列，并生成**可解释的推荐理由**，例如：

- 「该知识点下 3 道题全部未答对」
- 「该知识点共 2 题，尚有 1 题未答对（未掌握率 50%）」

诊断系统的说服力来自「能说清为什么」，所以理由与分数一起返回。

### 算法三：个性化推荐

```
1. 取出掌握度最低的知识点
2. 召回该知识点下的题目
3. 过滤掉该学生已经答对的题（不重复做会的题）
4. 若无候选（都答对了）→ 回退为该知识点全部题目做巩固
5. 冷启动（无任何作答记录）→ 按知识点难度升序推荐基础题
```

### 接口

| 方法 | 路径 | 说明 |
|---|---|---|
| GET | `/api/intelligent/knowledge-points` | 知识点列表 |
| GET | `/api/intelligent/diagnosis/{userId}` | 诊断报告（概览 + 每个知识点明细），**调用时先重算** |
| GET | `/api/intelligent/weak-points?userId=&limit=` | 薄弱知识点（含推荐理由） |
| GET | `/api/intelligent/recommend?userId=&knowledgePointId=&limit=` | 个性化推荐练习 |
| POST | `/api/intelligent/refresh/{userId}` | 手动触发重算 |

掌握度是**实时联动**的：学生每次答题（`/api/wrong-set/record`）或错题重做
（`/api/wrong-set/resolve`）后端都会自动重算，所以诊断页上的数字跟着答题行为变化。

### 小程序页面

| 页面 | 路径 | 入口 |
|---|---|---|
| 学习诊断报告 | `pages/intelligent/diagnosis` | 我的 → 学习诊断报告（智能） |
| 专项练习 | `pages/intelligent/practice` | 诊断页的「开始专项练习」/ 每个知识点的「针对练习」 |

### 自检工具

```bash
# 算法不变式验证（近因加权/错误频率/单调性/边界输入），并打印输入-输出对照表
node tools/verify_mastery_algorithm.js

# 小程序静态自检：页面文件完整性、JSON 合法性、JS 语法、WXML 事件绑定是否存在
node tools/validate_miniprogram.js
```

---

## 5. 数据库结构

12 张表，全部定义在 `db/schema.sql`（幂等，可重复执行）。其中 9 张是业务表，
3 张是智能化模块的知识点表（见 4.1 节）。

| 表 | 用途 | 关键约束 |
|---|---|---|
| `"user"` | 用户（含管理员） | `username` 唯一；`role` 0=学生 1=管理员 |
| `news` | 资讯/竞赛/活动/公告 | `category`、`is_competition` 建索引 |
| `quiz_paper` | 作业包 | — |
| `quiz` | 题目 | `paper_id` 建索引 |
| `quiz_bank` | Excel 导入缓冲表 | 当前代码未写入，保留结构 |
| `wrong_set` | 错题本 | **`(user_id, quiz_id)` 唯一**（代码假定一题一行） |
| `real_name_auth` | 实名认证记录 | **`user_id` 唯一** |
| `report` | 安全举报 | `status` 0=待审 1=已通过 |
| `registration` | 报名 | **`(news_id, user_id)` 唯一**，支撑 `ON CONFLICT` 去重 |
| `knowledge_point` | 知识点（智能化模块） | `code` 唯一 |
| `quiz_knowledge` | 题目 ↔ 知识点（智能化模块） | **`(quiz_id, knowledge_point_id)` 唯一** |
| `user_knowledge_mastery` | 学生知识点掌握度（智能化模块，派生数据） | **`(user_id, knowledge_point_id)` 唯一** |

**重要约定**

- `"user"` 是 PostgreSQL 保留字，必须双引号，与实体 `@TableName("\"user\"")` 对应。
- **不设置外键**：`ReportController` 在 `userId` 为空时会写入字面量 `0`，
  加外键会导致举报提交失败。
- 时间字段统一用 `create_time` / `created_at` / `updated_at`
  （历史上代码用的 `update_time`、`reg_time` 都指向不存在的字段，已修正）。

---

## 6. 数据库结构与代码一致性校验

改完实体或 DDL 后跑一下：

```powershell
powershell -ExecutionPolicy Bypass -File tools\verify_schema.ps1
```

它会从实体类推导出「代码需要的表 + 字段」，再解析 `db/schema.sql`，
逐个比对并打印缺失项；全部覆盖则退出码 0。

> 该脚本**必须保存为带 BOM 的 UTF-8**。Windows PowerShell 5.1 会把无 BOM 的
> UTF-8 按系统 ANSI（本机 GBK）读取，导致中文注释乱码并使脚本解析失败。

---

## 7. 当前状态与已知限制

本项目定位为**课程设计 / 毕业设计演示作品**，非生产系统。以下为有意保留或尚未处理的部分：

**安全相关（演示可接受，生产不可）**

1. 密码**明文存储**，登录时直接 `WHERE password = ?` 比对。
2. 登录返回的 `token` 是随机 UUID，**后端不存储也不校验**，前端仅当作「已登录」标记。
3. 身份靠请求头 `X-User-Id` 传递，**客户端可伪造**。
4. `LoginInterceptor` 在缺少/非法请求头时**放行**，因此 `/api/admin/**`
   在匿名状态下也可访问；管理端权限目前主要靠前端 `userRole` 判断。
5. 答题积分由前端调用 `POST /api/quiz/submit` 直接加 20 分，**服务端未判卷、无幂等**。
6. 实名认证仅校验身份证长度为 18 位，且身份证号**明文落库**。
   `frontend/pages/auth/verify.js` 中还有一段本地模拟认证的代码，
   其后半段的真实请求是**不可达的死代码**。
7. 微信相关能力是**模拟**的：`WechatFacade` 只打印日志，不会真正调用微信接口。

**其他**

8. `WechatFacade.java` 与两个配置文件里硬编码了 appId / appSecret；
   前端 `project.config.json` 的 appId 与后端配置**不一致**。
9. `application.yml` 中的 `wx.mp.*` 配置块缩进有误，被嵌到了
   `mybatis-plus.global-config.db-config` 下，且没有任何代码读取它。
10. `NewsScheduleTask` 每 10 分钟随机生成一条「实时预警」写入 `news` 表
    （每天 144 条假数据），演示时建议注释掉。
11. `NewsCrawlerServiceImpl` 是一份完整的 jsoup 实现，但**没有任何地方调用**；
    `/api/news/crawl` 接口直接返回 503。
12. 以下文件为空（0 字节）且无引用：`ResultCode`、`SecurityConfig`、
    `JwtAuthFilter`、`JwtTokenProvider`、`CurrentUser`、`WxConfig`、
    `RedisConfig`、`PlatformStore`、`application-dev.yml`。
13. 无全局异常处理器（`GlobalExceptionHandler` 为空文件），
    异常时返回 Spring 默认报文而非统一的 `ApiResponse`。
14. 前端所有请求地址硬编码为 `http://127.0.0.1:8080`（少数页面用 `localhost`），
    真机无法访问，只能开发者工具 + 勾选不校验合法域名运行。
15. `pages/wrong-set/index` 与 `pages/wrong-set/wrong-set` 是功能重复的两个页面；
    `pages/admin/report-manager/` 目录下的页面未被 `app.json` 注册（孤儿文件）。

### 7.1 两个「只有真跑才会暴露」的 bug（已修复）

这两个问题**静态审查、编译、字段比对统统发现不了**，
只有在真实 PostgreSQL + 真实 Spring Boot 上完整跑一遍才会现形。
记录在此，既是修复说明，也说明为什么"能编译"不等于"能跑"。

**① `SELECT DISTINCT` 与 `ORDER BY` 冲突 → 冷启动推荐直接 500**

`KnowledgePointMapper.selectBeginnerQuizzes` 原本写成：

```sql
SELECT DISTINCT q.id, ... FROM quiz q
JOIN quiz_knowledge qk ON qk.quiz_id = q.id
JOIN knowledge_point kp ON kp.id = qk.knowledge_point_id
ORDER BY kp.difficulty ASC, q.id      -- ← PostgreSQL 拒绝这一句
```

报错：`for SELECT DISTINCT, ORDER BY expressions must appear in select list`。
PostgreSQL 要求 `DISTINCT` 的排序表达式必须出现在结果集中，
而 `kp.difficulty` 不在 select 列表里。

**影响**：任何「已实名但没有任何作答记录」的学生，一进诊断页就 500 ——
而这恰恰是新用户第一次使用时的场景。

**修复**：改用 `GROUP BY q.id ... ORDER BY MIN(kp.difficulty)`，
既能对"一题挂在多个知识点上"去重，又能稳定按最容易的知识点排序。

**② 首次答对不落库，导致掌握度永远不动（最严重）**

`WrongSetController.recordWrong` 与 `QuizController.submitSingleAnswer`
（同一段逻辑被复制了两份）里原本是这样写的：

```java
if (!correct) {
    if (existing == null) { ...insert... }   // 答错 + 首次 → 落库
    else { ...update... }
} else {
    if (existing != null) { ...update... }   // 答对 + 非首次 → 更新
    else { errorCount = 0; }                 // ← 答对 + 首次：什么都不做！
}
```

也就是说：**学生第一次做某道题就答对时，这次作答被完全丢弃。**

后果是连锁的：智能模块用「作答题数」做分母算正确率，
作答题数永远偏少 → 学生答对一道新题后掌握度**纹丝不动** →
整个"智能化"最直观的卖点（诊断数字跟着答题实时变化）失效。

**修复**：首次作答无论对错都落一行，记为
`is_resolved = true / error_count = 0`。这样 `wrong_set` 实际承担了
「作答流水」的角色：

- `is_resolved = true` → 已掌握（不会出现在错题本，因为列表只查未解决）
- `error_count > 0` → 曾答错几次，供错误频率维度使用

实测：`密码安全` 掌握度 `0 → 50`（答对），
`SQL 注入` `0 → 15`（答错但样本数增加），诊断数字真正实时联动。

> **教训**：`wrong_set` 原本的语义只是「错题集」，
> 但智能化模块需要的是「作答流水」。两个需求共用一张表时，
> 必须明确它的语义到底属于哪一个，否则就会出现这种
> "代码读起来没问题、数据却静默丢失"的缺陷。
> 后续若要重构，建议把这张表改名为 `quiz_attempt`。

---

## 8. 接口概览

统一返回体 `ApiResponse<T>`：`{ code, message, data }`，`code=200` 为成功。

| 模块 | 路径前缀 | 主要接口 |
|---|---|---|
| 登录注册 | `/api/user` | `POST /login`、`POST /register` |
| 用户 | `/api/user` | `GET /info/{id}`、`GET /leaderboard`、`POST /update` |
| 资讯 | `/api/news` | `GET /list`、`GET /get/{id}`、`GET /search` |
| 作业包 | `/api/paper` | `GET /list`、`GET /quizzes/{paperId}` |
| 答题 | `/api/quiz` | `GET /all`、`POST /submit`、`POST /import` |
| 错题本 | `/api/wrong-set` | `GET /list`、`POST /record`、`POST /resolve` |
| 报名 | `/api/registration` | `POST /submit` |
| 举报 | `/api/report` | `POST /submit` |
| 实名认证 | `/api/auth` | `POST /verify` |
| 管理端 | `/api/admin/**` | 发布资讯、题库 CRUD、举报审核、`GET /summary`、`GET /dashboard/*` |

> 部分控制器同时映射了 `/api/xxx` 和 `/api/admin/xxx` 两个前缀
> （如 `QuizController`、`NewsController`、`QuizPaperController`），
> 两套路径指向同一批方法。

---

## 9. 构建与测试

```bash
cd backend

# 编译
mvn -DskipTests clean compile

# 打包
mvn -DskipTests clean package

# 测试（需要数据库可连）
mvn test
```

`src/test/java/com/example/cybersec/CybersecApplicationTests.java` 内的类名是
`WechatCybersecPlatformApplicationTests`（与文件名不一致，但**包名是正确的**）。
该测试为 `@SpringBootTest` 上下文加载测试，需要 PostgreSQL 已启动并完成建库。
