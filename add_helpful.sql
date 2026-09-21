-- ============================================
-- "도움이 됐어요" 버튼 + 의견 열람 알림 준비 (Railway Postgres에서 딱 한 번만 실행)
-- 순서: 1) 이 SQL 먼저 실행 → 2) 코드 git push
-- (실행 전에 push해도 화면은 멀쩡하고, 이 두 기능만 조용히 동작하지 않음)
-- ============================================

-- 질문 주인이 "도움이 됐어요"를 누른 기록 (의견 하나당 한 번)
CREATE TABLE IF NOT EXISTS opinion_helpful (
  id SERIAL PRIMARY KEY,
  opinion_id INTEGER NOT NULL REFERENCES question_opinions(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (opinion_id, user_id)
);

-- 질문 주인이 의견을 열어 본 기록 (의견 하나당 한 번만 "봤어요" 알림)
CREATE TABLE IF NOT EXISTS opinion_views (
  id SERIAL PRIMARY KEY,
  opinion_id INTEGER NOT NULL REFERENCES question_opinions(id) ON DELETE CASCADE,
  viewer_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (opinion_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_opinion_helpful_opinion ON opinion_helpful(opinion_id);

-- 확인 (두 줄이 나오면 성공)
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('opinion_helpful', 'opinion_views');
