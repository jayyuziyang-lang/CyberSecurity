历史增量脚本（仅供追溯开发过程，请勿执行）
=========================================================

这两个文件是最早的 ALTER 增量脚本，存在两个问题：

1. 它们修改表 user / news，但这两张表的 CREATE 语句从未存在于仓库中，
   全新数据库上执行会直接报 "relation does not exist"。
2. 20260511_feature_upgrade.sql 把 wrong_set.quiz_id 声明为 INTEGER，
   而 schema.sql 声明为 BIGINT。两者都是 CREATE TABLE IF NOT EXISTS，
   谁先执行谁生效 —— 会导致 quiz_id 类型不确定（int4 vs int8）。

全新环境请只执行：
    psql -d cybersec_db -f db/schema.sql
    psql -d cybersec_db -f db/seed.sql

故将这两个文件移入 legacy/ 目录，避免误执行。
