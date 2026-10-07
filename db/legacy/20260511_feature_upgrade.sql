-- 1) user table: real-name auth flag
ALTER TABLE "user"
    ADD COLUMN IF NOT EXISTS is_authenticated BOOLEAN DEFAULT FALSE;

-- 2) real-name auth records
CREATE TABLE IF NOT EXISTS real_name_auth (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    real_name VARCHAR(64) NOT NULL,
    id_card VARCHAR(32) NOT NULL,
    verified_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 3) quiz bank for excel import
CREATE TABLE IF NOT EXISTS quiz_bank (
    id BIGSERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    option_a TEXT,
    option_b TEXT,
    option_c TEXT,
    option_d TEXT,
    answer VARCHAR(8),
    analysis TEXT,
    type VARCHAR(64)
);

-- 4) wrong set for redo workflow
CREATE TABLE IF NOT EXISTS wrong_set (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL,
    quiz_id INTEGER NOT NULL,
    selected_answer VARCHAR(8),
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- 5) news table: competition marker
ALTER TABLE news
    ADD COLUMN IF NOT EXISTS is_competition BOOLEAN DEFAULT FALSE;

-- 6) registration table for activity/competition sign-up
CREATE TABLE IF NOT EXISTS registration (
    id BIGSERIAL PRIMARY KEY,
    news_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    create_time TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uk_registration_news_user
    ON registration(news_id, user_id);
