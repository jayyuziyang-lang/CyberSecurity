-- =============================================================================
--  reset-demo.sql -- 把演示数据恢复到「初始状态」
-- -----------------------------------------------------------------------------
--  为什么需要它：
--      演示时你会现场答题来证明「掌握度实时联动」，但答完题数据就变了：
--      student1 的作答记录、掌握度、积分都被改动，下一次演示就不是同一个开场。
--      这个脚本让每次演示都从完全一致的状态开始。
--
--  ---------------------------------------------------------------------------
--  【重要】为什么这里用 DELETE 而不是 UPDATE 复位
--
--    一开始我写的是 `UPDATE "user" SET points=0, is_authenticated=FALSE`，
--    然后重跑 seed.sql 期望它把数据补回来 —— 结果把演示数据搞坏了：
--    所有用户变成 0 分、未实名，而 seed.sql 因为是幂等写法
--    （INSERT ... WHERE NOT EXISTS / ON CONFLICT DO NOTHING），
--    看到行已存在就什么都不做，于是数据再也回不来了。
--
--    正确做法：把「内容表」整个删掉，让 seed.sql 从零重建。
--    seed.sql 本来就设计成可重复执行，删干净再灌才是真正的工厂复位。
--
--  ---------------------------------------------------------------------------
--  删除并重建：用户、报名、举报、作答记录、掌握度、资讯、题目、知识点、作业包
--  不动：表结构（schema.sql 负责）
--
--  清空重建：用户、作答记录、掌握度、报名、举报、资讯、题目、知识点、作业包
--  也就是说：**恢复到刚跑完 schema.sql + seed.sql 的那个状态**
--
--  用法（推荐直接双击 reset-demo.bat）：
--      psql -U postgres -d cybersec_db -f db/reset-demo.sql
--      psql -U postgres -d cybersec_db -f db/seed.sql
-- =============================================================================

\echo '正在重置演示数据（清空 -> 稍后由 seed.sql 重建）...'

BEGIN;

-- TRUNCATE ... CASCADE 会自动处理外键/依赖顺序；
-- RESTART IDENTITY 让自增 id 从 1 重新开始，保证每次演示 id 完全一致。
TRUNCATE TABLE
    user_knowledge_mastery,
    wrong_set,
    registration,
    report,
    real_name_auth,
    quiz_knowledge,
    quiz,
    quiz_bank,
    quiz_paper,
    knowledge_point,
    news,
    "user"
RESTART IDENTITY CASCADE;

\echo '  - 已清空全部业务数据（含用户）'
\echo '  - 接下来由 seed.sql 从零重建'

COMMIT;

\echo ''
\echo '请接着执行 seed.sql：'
\echo '  psql -U postgres -d cybersec_db -f db/seed.sql'
\echo ''
