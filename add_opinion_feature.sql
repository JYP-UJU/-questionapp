-- ============================================
-- 물음송이 DB 업데이트: 의견 기능 추가
-- 실행일: 2026-01-07
-- ============================================

-- 1. 질문에 대한 의견 테이블 생성
CREATE TABLE IF NOT EXISTS question_opinions (
  id SERIAL PRIMARY KEY,
  saved_question_id INTEGER REFERENCES saved_questions(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  opinion TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. saved_questions 테이블에 출처 정보 컬럼 추가
ALTER TABLE saved_questions 
ADD COLUMN IF NOT EXISTS source_type VARCHAR(50),  -- 'quiz', 'icebreaking', 'user_question', 'friend_question'
ADD COLUMN IF NOT EXISTS source_id INTEGER,
ADD COLUMN IF NOT EXISTS user_answer INTEGER;  -- 퀴즈일 경우 학생이 선택한 답

-- 3. 인덱스 추가 (성능 최적화)
CREATE INDEX IF NOT EXISTS idx_question_opinions_saved 
  ON question_opinions(saved_question_id);

CREATE INDEX IF NOT EXISTS idx_question_opinions_user 
  ON question_opinions(user_id);

CREATE INDEX IF NOT EXISTS idx_saved_questions_user 
  ON saved_questions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_saved_questions_source 
  ON saved_questions(source_type, source_id);

-- 4. 기존 데이터 업데이트 (퀴즈에서 저장한 질문들에 source_type 설정)
UPDATE saved_questions 
SET source_type = 'quiz', source_id = question_id
WHERE source_type IS NULL AND question_id IS NOT NULL;

-- 완료 메시지
SELECT 'DB 업데이트 완료! 의견 기능이 추가되었습니다.' AS message;
