-- ============================================
-- 물음송이 AI 준비 (Railway Postgres에서 딱 한 번만 실행)
-- 순서: 1) 이 SQL 먼저 실행 → 2) 코드 git push
-- ============================================

-- 1. 사용자 테이블에 AI 여부 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_ai BOOLEAN DEFAULT FALSE;

-- 2. "물음송이 AI" 계정을 만든다.
--    password_hash 는 로그인할 수 없는 값(아무도 맞출 수 없는 문자열)이라 이 계정으로는 로그인이 안 된다.
--    ⚠️ users 테이블에 NOT NULL 컬럼이 더 있어서 오류가 나면, 그 컬럼도 같이 넣어야 한다 (오류 메시지 확인).
INSERT INTO users (username, password_hash, is_ai)
VALUES ('물음송이 AI', 'x-no-login-x', TRUE)
ON CONFLICT (username) DO UPDATE SET is_ai = TRUE;

-- 3. 확인
SELECT id, username, is_ai FROM users WHERE is_ai = TRUE;
