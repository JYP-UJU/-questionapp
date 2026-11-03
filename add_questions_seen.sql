-- 새 질문 빨간 뱃지용: "질문들" 화면을 마지막으로 본 시각
-- git push 전에 Railway Postgres에서 한 번 실행하세요.
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_questions_seen_at TIMESTAMPTZ;
