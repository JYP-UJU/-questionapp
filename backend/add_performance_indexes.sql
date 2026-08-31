-- ============================================
-- 물음송이 DB 업데이트: 성능 인덱스 추가
-- 목적: 질문 목록(/with-status)과 내활동(/saved) 조회가
--       데이터가 쌓일수록 점점 느려지는 문제 완화
-- ============================================

-- 관련질문 개수/최신 관련질문 조회 시 매 행마다 전체 스캔되던 컬럼
CREATE INDEX IF NOT EXISTS idx_user_questions_parent
  ON user_questions(parent_question_id)
  WHERE is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_user_questions_related_seed
  ON user_questions(related_seed_question_id)
  WHERE is_deleted = false;

-- 의견 개수/최신 의견 조회 시 쓰이는 컬럼 조합
CREATE INDEX IF NOT EXISTS idx_question_opinions_question
  ON question_opinions(question_id, question_type);

-- 좋아요/싫어요 여부 조회 시 쓰이는 컬럼 조합
CREATE INDEX IF NOT EXISTS idx_question_reactions_lookup
  ON question_reactions(question_id, question_type, user_id, reaction_type);

-- 담기 여부(is_saved) 조회 시 쓰이는 컬럼 조합
CREATE INDEX IF NOT EXISTS idx_saved_questions_question
  ON saved_questions(question_id, question_type, user_id);

SELECT '성능 인덱스 추가 완료!' AS message;
