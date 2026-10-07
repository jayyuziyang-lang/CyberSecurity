-- =============================================================================
--  网络安全科普答题平台 —— 演示种子数据（PostgreSQL）
-- -----------------------------------------------------------------------------
--  前置：先执行 db/schema.sql
--  用法：psql -U postgres -d cybersec_db -f db/seed.sql
--
--  说明：
--    * 全部使用 WHERE NOT EXISTS 幂等写法，可重复执行而不会产生重复数据。
--    * 默认管理员账号：admin / admin123  （role=1，已实名，可进入管理端）
--    * 默认学生账号：  student1 / 123456  （role=0，已实名）
--                      student2 / 123456  （role=0，未实名，用于演示实名门禁）
--    * 密码为明文，与后端 LoginController 的比对方式一致，仅用于课程设计演示。
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. 用户
-- -----------------------------------------------------------------------------
INSERT INTO "user" (username, password, nickname, avatar_url, points, is_followed, role, is_authenticated)
SELECT v.username, v.password, v.nickname, v.avatar_url, v.points, v.is_followed, v.role, v.is_authenticated
FROM (VALUES
    ('admin',    'admin123', '系统管理员',  '/images/default-avatar.png', 0,   0, 1, TRUE),
    ('student1', '123456',   '安全小卫士',  '/images/default-avatar.png', 180, 1, 0, TRUE),
    ('student2', '123456',   '网络萌新',    '/images/default-avatar.png', 120, 0, 0, FALSE),
    ('student3', '123456',   '白帽小张',    '/images/default-avatar.png', 240, 1, 0, TRUE),
    ('student4', '123456',   '信安小刘',    '/images/default-avatar.png', 90,  0, 0, TRUE),
    ('student5', '123456',   '密码学小王',  '/images/default-avatar.png', 300, 0, 0, TRUE)
) AS v(username, password, nickname, avatar_url, points, is_followed, role, is_authenticated)
WHERE NOT EXISTS (SELECT 1 FROM "user" u WHERE u.username = v.username);

-- 管理员积分设为 0，避免出现在排行榜里干扰演示
UPDATE "user" SET points = 0 WHERE username = 'admin';

-- -----------------------------------------------------------------------------
-- 2. 作业包（题目分组）
-- -----------------------------------------------------------------------------
INSERT INTO quiz_paper (title)
SELECT v.title
FROM (VALUES
    ('网络安全基础入门'),
    ('常见网络攻击与防范'),
    ('个人信息保护与密码安全')
) AS v(title)
WHERE NOT EXISTS (SELECT 1 FROM quiz_paper p WHERE p.title = v.title);

-- -----------------------------------------------------------------------------
-- 3. 题目（学生实际作答的 quiz 表）
--    答案统一大写字母；analysis 用于错题本回看解析。
-- -----------------------------------------------------------------------------
INSERT INTO quiz (question, option_a, option_b, option_c, option_d, answer, analysis, paper_id)
SELECT v.question, v.option_a, v.option_b, v.option_c, v.option_d, v.answer, v.analysis,
       (SELECT id FROM quiz_paper WHERE title = v.paper_title)
FROM (VALUES
    -- 作业包一：网络安全基础入门
    ('以下哪种密码强度最高？', '123456', 'password', 'MyDog2010', 'X7#kL9@qZ2!', 'D',
     '长度足够且混合大小写字母、数字、符号的密码强度最高。', '网络安全基础入门'),
    ('什么是“钓鱼网站”？', '提供免费WiFi的网站', '伪装成正规网站骗取账号密码的假网站', '网速很慢的网站', '被黑客攻击过的网站', 'B',
     '钓鱼网站通过仿冒正规页面诱导用户输入账号密码等敏感信息。', '网络安全基础入门'),
    ('HTTP 与 HTTPS 的主要区别是什么？', 'HTTPS 速度更快', 'HTTPS 对传输数据做了加密', 'HTTP 更安全', '两者没有区别', 'B',
     'HTTPS 在 HTTP 基础上加入 TLS/SSL 加密，防止传输内容被窃听篡改。', '网络安全基础入门'),
    ('收到自称“客服”要求提供短信验证码的电话，正确做法是？', '直接告知验证码', '先告知再挂断', '挂断并通过官方渠道核实', '把验证码发到群里确认', 'C',
     '短信验证码等同于临时密码，任何人索要都应拒绝，并通过官方渠道核实。', '网络安全基础入门'),

    -- 作业包二：常见网络攻击与防范
    ('SQL 注入攻击的核心原理是？', '让数据库服务器宕机', '把恶意 SQL 语句拼进输入参数并被数据库执行', '破解数据库密码', '窃取数据库备份文件', 'B',
     '当程序把用户输入直接拼接进 SQL 语句时，攻击者可构造输入改变原语句语义。', '常见网络攻击与防范'),
    ('防范 SQL 注入最有效的手段是？', '过滤单引号', '隐藏数据库报错', '使用参数化查询（预编译语句）', '限制输入长度', 'C',
     '参数化查询把 SQL 结构与数据分离，使输入无法改变语句语义，是根本性防护。', '常见网络攻击与防范'),
    ('DDoS 攻击的主要目的是？', '窃取用户数据', '消耗目标资源使其无法正常提供服务', '篡改网页内容', '植入病毒', 'B',
     'DDoS 通过大量分布式流量耗尽带宽或连接资源，导致服务不可用。', '常见网络攻击与防范'),
    ('发现电脑中了勒索病毒，最不应该做的是？', '立即断网', '向安全机构求助', '支付赎金', '保留现场并上报', 'C',
     '支付赎金不保证能恢复数据，还会助长犯罪，且可能被二次勒索。', '常见网络攻击与防范'),

    -- 作业包三：个人信息保护与密码安全
    ('以下哪种做法最容易导致个人信息泄露？', '定期修改密码', '在公共电脑上勾选“记住密码”', '开启二次验证', '使用密码管理器', 'B',
     '公共电脑上的“记住密码”会把凭据留在本地，极易被他人获取。', '个人信息保护与密码安全'),
    ('“撞库攻击”指的是？', '用暴力方式猜密码', '用已泄露的账号密码去批量尝试登录其他网站', '攻击数据库服务器', '伪造网站证书', 'B',
     '很多人在不同网站使用同一套密码，一处泄露后攻击者即可批量尝试其他平台。', '个人信息保护与密码安全'),
    ('关于身份证号等敏感信息，正确的做法是？', '随意发到微信群', '在不明网站填写', '仅在必要场合通过官方渠道提供', '写进公开简历', 'C',
     '敏感个人信息应遵循最小必要原则，只在可信官方渠道按需提供。', '个人信息保护与密码安全'),
    ('开启双因素认证（2FA）的作用是？', '让密码更复杂', '即使密码泄露，攻击者仍难以登录', '加快登录速度', '替代密码', 'B',
     '双因素认证要求同时提供密码和第二种凭证，显著提高账号安全性。', '个人信息保护与密码安全')
) AS v(question, option_a, option_b, option_c, option_d, answer, analysis, paper_title)
WHERE NOT EXISTS (SELECT 1 FROM quiz q WHERE q.question = v.question);

-- -----------------------------------------------------------------------------
-- 4. 资讯 / 竞赛 / 活动 / 公告
--    is_competition 决定新闻详情页是否出现「立即报名」按钮。
-- -----------------------------------------------------------------------------
INSERT INTO news (title, content, author, cover_url, category, is_competition, create_time)
SELECT v.title, v.content, v.author, '', v.category, v.is_competition, NOW() - (v.days_ago || ' days')::INTERVAL
FROM (VALUES
    ('2026 年校园网络安全知识竞赛开始报名',
     '为提升全校同学的网络安全意识，现举办网络安全知识竞赛。比赛采用线上答题形式，题目涵盖密码安全、钓鱼识别、数据保护等内容。请有意参赛的同学在资讯详情页点击「立即报名」。',
     '系统管理员', '竞赛信息', TRUE, 1),
    ('网络安全宣传周活动通知',
     '本周为校园网络安全宣传周，将在图书馆报告厅举办三场专题讲座，内容包括《个人信息保护法》解读、常见网络诈骗手法剖析、安全编码实践。欢迎各年级同学参加。',
     '系统管理员', '网络安全活动', FALSE, 2),
    ('警惕：近期出现仿冒教务系统的钓鱼页面',
     '近期监测到有仿冒我校教务系统的钓鱼页面，通过短信链接诱导同学输入学号与密码。请注意：学校不会通过短信索要密码，请勿点击陌生链接。如已填写，请立即修改密码并联系信息中心。',
     '安全预警中心', '安全动态', FALSE, 3),
    ('关于近期校园网异常流量的说明',
     '部分宿舍区出现异常流量，经排查为某软件自动更新所致，非安全事件，已处理完毕，网络现已恢复正常。',
     '系统管理员', '系统公告', FALSE, 4),
    ('常见弱口令自查指南',
     '请同学们自查是否使用以下弱口令：123456、password、qwerty、生日、学号后六位等。建议使用 12 位以上、混合大小写字母与符号的密码，并为不同网站设置不同密码。',
     '安全预警中心', '安全动态', FALSE, 5),
    ('信息安全 CTF 校内选拔赛报名',
     '面向全校学生的 CTF 校内选拔赛即将开始，赛题方向包括 Web 安全、逆向工程、密码学与杂项。优胜者将代表学校参加省级比赛。请在资讯详情页报名。',
     '系统管理员', '竞赛信息', TRUE, 6)
) AS v(title, content, author, category, is_competition, days_ago)
WHERE NOT EXISTS (SELECT 1 FROM news n WHERE n.title = v.title);

-- -----------------------------------------------------------------------------
-- 5. 报名记录 + 错题记录（用于让管理端看板 / 错题本有数据可展示）
-- -----------------------------------------------------------------------------

-- 让 student1 / student3 报名两个竞赛类资讯
INSERT INTO registration (news_id, user_id, create_time)
SELECT n.id, u.id, NOW() - INTERVAL '1 day'
FROM news n
CROSS JOIN "user" u
WHERE n.category = '竞赛信息'
  AND u.username IN ('student1', 'student3')
ON CONFLICT (news_id, user_id) DO NOTHING;

-- 给 student1 制造两道错题，用于演示错题本与「高频错题」看板
INSERT INTO wrong_set (user_id, quiz_id, selected_answer, error_count, is_resolved, created_at, updated_at)
SELECT u.id, q.id, v.selected_answer, v.error_count, FALSE, NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'
FROM (VALUES
    ('以下哪种密码强度最高？', 'B', 2),
    ('防范 SQL 注入最有效的手段是？', 'A', 1)
) AS v(question, selected_answer, error_count)
JOIN quiz q ON q.question = v.question
CROSS JOIN "user" u
WHERE u.username = 'student1'
ON CONFLICT (user_id, quiz_id) DO NOTHING;

-- 再给 student1 一条「已答对」的记录。
--
-- 为什么需要它：wrong_set 实际承担的是「作答流水」的角色
-- （is_resolved=true 表示已掌握，不出现在错题本里）。
-- 如果 student1 只有错题，演示开场算出来的掌握度就是清一色的 0.00，
-- 看起来像坏了、也讲不出层次。加上这条之后：
--     密码安全 → 2 题作答、1 对 1 错 → 50.00 分（薄弱）
--     SQL 注入 → 1 题作答、0 对 1 错 →  0.00 分（薄弱）
-- 平均 25.00 分，既有对比又能体现算法在算东西。
INSERT INTO wrong_set (user_id, quiz_id, selected_answer, error_count, is_resolved, created_at, updated_at)
SELECT u.id, q.id, 'B', 0, TRUE, NOW() - INTERVAL '2 day', NOW() - INTERVAL '2 day'
FROM quiz q
CROSS JOIN "user" u
WHERE q.question = '“撞库攻击”指的是？'
  AND u.username = 'student1'
ON CONFLICT (user_id, quiz_id) DO NOTHING;

-- 给 student3 也制造一道错题，使看板统计更真实
INSERT INTO wrong_set (user_id, quiz_id, selected_answer, error_count, is_resolved, created_at, updated_at)
SELECT u.id, q.id, 'C', 1, FALSE, NOW() - INTERVAL '2 day', NOW() - INTERVAL '2 day'
FROM quiz q
CROSS JOIN "user" u
WHERE q.question = '防范 SQL 注入最有效的手段是？'
  AND u.username = 'student3'
ON CONFLICT (user_id, quiz_id) DO NOTHING;

-- 一条待审核举报，用于演示「举报审核 → 自动转为系统公告」闭环
INSERT INTO report (user_id, title, content, images, status, create_time)
SELECT u.id,
       '钓鱼网站举报',
       '收到一条短信，链接指向仿冒的教务系统页面，界面与真实系统几乎一致，已截图保存。',
       '[]',
       0,
       NOW() - INTERVAL '3 hours'
FROM "user" u
WHERE u.username = 'student2'
  AND NOT EXISTS (SELECT 1 FROM report r WHERE r.title = '钓鱼网站举报');

COMMIT;

-- =============================================================================
--  智能化模块数据：知识点 + 知识点↔题目映射
-- -----------------------------------------------------------------------------
--  8 个知识点，覆盖现有 12 道题。
--  掌握度诊断与推荐练习完全基于这两张表，纯算法、不依赖任何外部服务。
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 6. 知识点
-- -----------------------------------------------------------------------------
INSERT INTO knowledge_point (code, name, category, description, difficulty, sort_order)
SELECT v.code, v.name, v.category, v.description, v.difficulty, v.sort_order
FROM (VALUES
    ('KP01', '密码安全',     '身份认证',
     '口令强度、口令复用、暴力破解与撞库攻击的识别与防护', 1, 1),
    ('KP02', '钓鱼识别',     '社会工程',
     '仿冒网站、钓鱼短信、冒充客服等社会工程手法的识别', 1, 2),
    ('KP03', '数据传输安全', '通信安全',
     'HTTP 与 HTTPS 的差异、加密传输与会话安全', 1, 3),
    ('KP04', '验证码保护',   '身份认证',
     '短信/动态验证码的安全边界，以及索要验证码的诈骗特征', 1, 4),
    ('KP05', 'SQL 注入',     'Web 安全',
     'SQL 注入的成因、利用方式与参数化查询等根本性防护', 3, 5),
    ('KP06', 'DDoS 攻击',    '网络攻击',
     '分布式拒绝服务攻击的原理与影响', 2, 6),
    ('KP07', '勒索软件',     '恶意代码',
     '勒索软件的处置原则与应急响应', 2, 7),
    ('KP08', '个人信息保护', '数据安全',
     '敏感个人信息的收集、存储、使用与最小必要原则', 2, 8)
) AS v(code, name, category, description, difficulty, sort_order)
WHERE NOT EXISTS (SELECT 1 FROM knowledge_point k WHERE k.code = v.code);

-- -----------------------------------------------------------------------------
-- 7. 题目 ↔ 知识点映射（按题干精确匹配）
-- -----------------------------------------------------------------------------
INSERT INTO quiz_knowledge (quiz_id, knowledge_point_id)
SELECT q.id, k.id
FROM (VALUES
    ('以下哪种密码强度最高？',                              'KP01'),
    ('“撞库攻击”指的是？',                                  'KP01'),
    ('开启双因素认证（2FA）的作用是？',                     'KP01'),
    ('什么是“钓鱼网站”？',                                  'KP02'),
    ('收到自称“客服”要求提供短信验证码的电话，正确做法是？', 'KP04'),
    ('HTTP 与 HTTPS 的主要区别是什么？',                    'KP03'),
    ('SQL 注入攻击的核心原理是？',                          'KP05'),
    ('防范 SQL 注入最有效的手段是？',                       'KP05'),
    ('DDoS 攻击的主要目的是？',                             'KP06'),
    ('发现电脑中了勒索病毒，最不应该做的是？',              'KP07'),
    ('以下哪种做法最容易导致个人信息泄露？',                'KP08'),
    ('关于身份证号等敏感信息，正确的做法是？',              'KP08')
) AS m(question, kp_code)
JOIN quiz q            ON q.question = m.question
JOIN knowledge_point k ON k.code     = m.kp_code
ON CONFLICT (quiz_id, knowledge_point_id) DO NOTHING;

COMMIT;

-- =============================================================================
--  数据校验（可选）
-- -----------------------------------------------------------------------------
--  SELECT 'user' AS t, COUNT(*) FROM "user"
--  UNION ALL SELECT 'quiz_paper', COUNT(*) FROM quiz_paper
--  UNION ALL SELECT 'quiz', COUNT(*) FROM quiz
--  UNION ALL SELECT 'news', COUNT(*) FROM news
--  UNION ALL SELECT 'registration', COUNT(*) FROM registration
--  UNION ALL SELECT 'wrong_set', COUNT(*) FROM wrong_set
--  UNION ALL SELECT 'report', COUNT(*) FROM report
--  UNION ALL SELECT 'knowledge_point', COUNT(*) FROM knowledge_point
--  UNION ALL SELECT 'quiz_knowledge', COUNT(*) FROM quiz_knowledge;
--  期望：user=6, quiz_paper=3, quiz=12, news=6, registration=4, wrong_set=3,
--        report=1, knowledge_point=8, quiz_knowledge=12
-- =============================================================================
