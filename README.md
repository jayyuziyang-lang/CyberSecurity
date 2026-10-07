# 网络安全科普答题平台（微信小程序 + Spring Boot）

一个面向校园网络安全科普的答题学习平台：资讯浏览、作业包答题、错题本、
**知识点掌握度诊断与个性化推荐**、活动报名、安全举报、管理端看板。

> 定位：**课程设计 / 毕业设计作品**，用于演示与答辩，非生产系统。
> 已知限制与有意的简化见 [backend/README.md](backend/README.md) 第 7 节。

---

## 目录结构

```text
CyberSecurity/
├─ backend/            Spring Boot 3.2.5 + Java 17 + MyBatis-Plus
│  ├─ src/main/java/   86 个源文件，57 个 REST 接口
│  ├─ src/main/resources/  application.yml + MyBatis XML
│  ├─ mvnw / mvnw.cmd  自带 Maven Wrapper（无需预装 Maven）
│  └─ README.md        ★ 详细的安装、启动、接口与算法说明
├─ frontend/           微信小程序原生代码（21 个页面）
│  ├─ pages/intelligent/   ★ 智能化模块：诊断报告 + 专项练习
│  ├─ utils/config.js  后端地址统一配置（改一处即可换环境）
│  └─ app.json
├─ db/
│  ├─ schema.sql       ★ 完整建表脚本（12 张表，幂等，可重复执行）
│  ├─ seed.sql         ★ 演示数据（账号 / 题库 / 资讯 / 错题 / 知识点）
│  └─ legacy/          历史增量脚本，请勿执行（原因见目录内 README.txt）
├─ web-demo/           ★ 网页演示版（客户零安装，浏览器直接打开）
│  ├─ index.html      单页应用：智能诊断 / 资讯 / 答题 / 排行榜
│  ├─ serve_demo.js   静态服务 + /api 反向代理（Node，只用内置模块）
│  ├─ serve_demo.py   同上（Python 版，没装 Node 时用）
│  ├─ mock-server.js  假后端，仅用于没数据库时联调前端
│  ├─ css/style.css
│  └─ js/api.js + js/app.js
├─ start-demo.bat      ★ 双击这个就能启动（推荐）
├─ start-demo.ps1      启动脚本本体（被 bat 调用，也可单独运行）
├─ docs/
│  ├─ 远程演示手册.md   ★ 异地远程演示的完整操作手册
│  ├─ 项目分析与落地方案.md
│  └─ 智能化模块-小程序预览版.html
├─ tools/
│  ├─ verify_schema.ps1            校验 DDL 覆盖代码引用的全部字段
│  ├─ validate_miniprogram.js      小程序静态自检（结构 / JSON / JS / 事件绑定）
│  ├─ verify_mastery_algorithm.js  掌握度算法不变式验证
│  ├─ fix_ps1_encoding.ps1        修复 .ps1 编码（PowerShell 5.1 需要 BOM）
│  └─ pack.ps1                     一键打包并复核
└─ README.md           本文件
```

---

## 最快的方式：双击一下就行

**双击 `start-demo.bat`**，剩下的它全包了：

1. 检查 Java / Node / Maven
2. 准备 PostgreSQL —— 本机有就用，没有就自动下载免安装版（约 300MB，只需一次）
3. 第一次运行时自动建库 + 灌演示数据
4. 启动后端（:8080）
5. 启动网页演示版（:8081，含 `/api` 反向代理）
6. 自动打开浏览器

**实测**：全新环境（从零下载 PostgreSQL + 建库 + 灌数据 + 起服务）约 3-7 分钟；
之后每次启动只要 **约 25 秒**。

关掉那个黑窗口即结束演示（后端和网页会停，数据库保持运行以便下次秒启）。

> 想确认脚本本身没问题，可以跑一次自检（自动跑完并关闭，不需要人守着）：
> ```powershell
> powershell -ExecutionPolicy Bypass -File start-demo.ps1 -SelfTest
> ```

### 环境要求（一键脚本会自动处理大部分）

| 依赖 | 是否必须自己装 | 说明 |
|---|---|---|
| JDK 17 | ✅ 必须 | 脚本会检测并给出安装命令 |
| Node.js 或 Python | ✅ 必须其一 | 用于起网页服务；Windows 上一般都有 Node |
| PostgreSQL | ❌ **不用** | 没有就自动下载免安装版，放在 `C:\Users\<用户名>\pgsql-portable` |
| Maven | ❌ 不用 | 项目自带 `mvnw`，脚本会用 |

> ⚠️ **免安装版 PostgreSQL 不能放在含中文的路径下。**
> 它的 `initdb` 遇到中文路径会报
> `FATAL: invalid byte sequence for encoding "UTF8": 0xd6 0xdc`
> （`0xd6 0xdc` 是 GBK 的「中」字）。所以脚本刻意把它装在
> `C:\Users\<用户名>\pgsql-portable`，**而不是项目目录里**（项目路径常含中文）。
> 这也是为什么包里没有捆绑 PostgreSQL —— 既避免踩坑，又能让包体保持在 1MB 以内。

---

## 手动启动（想自己控制每一步时用）

### 第 1 步：建库并灌入演示数据

需要本机已安装并启动 **PostgreSQL**（14+；**16 最稳，17 在中文路径下有问题**）。

```bash
createdb -U postgres cybersec_db

psql -U postgres -d cybersec_db -f db/schema.sql
psql -U postgres -d cybersec_db -f db/seed.sql
```

确认 12 张表都建好了：

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' ORDER BY table_name;
```

期望输出：`knowledge_point, news, quiz, quiz_bank, quiz_knowledge, quiz_paper,`
`real_name_auth, registration, report, user, user_knowledge_mastery, wrong_set`

### 第 2 步：启动后端

先把 `backend/src/main/resources/application.yml` 里的
`spring.datasource.password` 改成你自己的 postgres 密码，然后：

```bash
cd backend

# Windows
mvnw.cmd spring-boot:run

# macOS / Linux
./mvnw spring-boot:run
```

启动后监听 `http://localhost:8080`。

> 若 `mvnw` 因网络问题无法自动下载 Maven，就用本机已装的 `mvn spring-boot:run`。

### 第 3 步：运行小程序

1. 打开**微信开发者工具** → 导入项目 → 选择 `frontend/` 目录
2. AppID 用 `project.config.json` 里的值，或直接选「测试号」
3. 右上角**详情 → 本地设置 → 勾选「不校验合法域名」**
   （因为后端是 `http://localhost`，未勾选会被小程序拦截）
4. 编译运行

---

## 演示账号

| 账号 | 密码 | 角色 | 用途 |
|---|---|---|---|
| `admin` | `admin123` | 管理员 | 可进管理端：发布资讯 / 题库管理 / 举报审核 / 数据看板 |
| `student1` | `123456` | 学生 | **已实名、有错题记录**，演示诊断报告用这个 |
| `student2` | `123456` | 学生 | 未实名，演示实名门禁 |
| `student3` ~ `student5` | `123456` | 学生 | 有积分，演示排行榜 |

---

## 智能化模块怎么演示

这是本项目在"答题练习"之上增加的**学习诊断与个性化推荐**能力，
纯算法实现，**不依赖任何外部服务或大模型，可完全离线运行**。

**演示路径：**

1. 用 `student1 / 123456` 登录
2. 底部「我的」→ **学习诊断报告（智能）**
3. 页面从上到下依次是：
   - **综合掌握度**：平均分 + 薄弱/合格/熟练的知识点数量分布
   - **智能推荐**：自动定位最薄弱的知识点，一键开始专项练习
   - **知识点明细**：按掌握度**由弱到强**排列，带进度条与分级配色
4. 点任意知识点的「针对练习」→ 答题 → 看即时判卷与解析
5. **返回诊断页，掌握度数字已经变了** —— 诊断是实时联动的

**算法核心**（详见 [backend/README.md](backend/README.md) 第 4.1 节）：

```
mastery = 100 × ( 0.5×A + 0.3×(1−P) + 0.2×R )

  A 正确率  = 已答对 / 已作答
  P 错误频率 = min(1, 累计答错次数 / (2×已作答))
  R 近因    = 最近 5 次作答的正确率
```

不只统计正确率的理由（答辩常被追问）：

| 场景 | 只用正确率 | 本模型 |
|---|---|---|
| 4 题全对，从未答错 | 100 | 100.00 |
| 4 题全对，但错了 6 次才答对 | 100 | **77.50** |
| 2 对 2 错，最近 5 次**全对** | 50 | **67.50** |
| 2 对 2 错，最近 5 次**全错** | 50 | **47.50** |

后两行说明**近因维度**的价值：历史正确率一样，只有加时间维度才能区分
「先错后对」和「先对后错」。

---

## 交付前自检

```bash
cd CyberSecurity

# 后端能否编译打包
cd backend && mvnw.cmd -DskipTests clean package

# 数据库结构是否覆盖代码引用的每个字段
powershell -ExecutionPolicy Bypass -File tools/verify_schema.ps1

# 小程序结构 / JSON / JS 语法 / WXML 事件绑定
node tools/validate_miniprogram.js

# 掌握度算法的边界与不变式（近因加权 / 错误频率 / 单调性）
node tools/verify_mastery_algorithm.js
```

四个脚本都以退出码 0 表示通过。

`tools/pack.ps1` 会把上面四步串起来：清理生成物 → 打包 → **重新解压到临时目录**
→ 在干净副本上跑完整校验，验证「别人拿到这个 zip 能跑」而不是「我本机能跑」。

---

## 环境要求

| 依赖 | 版本 | 必需 |
|---|---|---|
| JDK | 17 | ✅ |
| PostgreSQL | 14+ | ✅ |
| Maven | 3.8+ | 可选（用自带 `mvnw` 即可） |
| 微信开发者工具 | 最新稳定版 | ✅（运行小程序） |
| Node.js | 14+ | 可选（仅自检脚本用） |
| Redis | — | ❌ 不需要（依赖里声明了但代码未使用） |

---

## 已知限制

本项目是**演示作品**，以下为有意保留的简化，生产环境不可照搬：

1. 密码**明文存储**，登录时直接比对
2. 登录返回的 token 后端不校验，身份靠请求头 `X-User-Id` 传递（**客户端可伪造**）
3. `LoginInterceptor` 在缺少请求头时**放行**，管理端权限主要靠前端判断
4. 答题积分由前端调用接口直接 +20，服务端未判卷、无幂等
5. 实名认证仅校验身份证长度，且身份证号明文落库
6. 微信相关能力是模拟的（`WechatFacade` 只打印日志）
7. 前端请求地址默认 `http://127.0.0.1:8080`，真机需改 `utils/config.js` 并配 HTTPS 域名

完整清单与逐条说明见 [backend/README.md](backend/README.md) 第 7 节。
