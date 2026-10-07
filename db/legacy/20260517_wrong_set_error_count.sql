ALTER TABLE wrong_set
    ADD COLUMN IF NOT EXISTS error_count INTEGER NOT NULL DEFAULT 1;

UPDATE wrong_set
SET error_count = 1
WHERE error_count IS NULL;
