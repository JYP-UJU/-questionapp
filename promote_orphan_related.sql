-- 부모 질문이 이미 삭제된 관련질문을 한 칸 위로 올려서 다시 보이게 함.
-- 부모-자식이 여러 겹으로 삭제된 경우를 위해, "UPDATE 0"이 나올 때까지 반복 실행하세요.
UPDATE user_questions c
SET parent_question_id = p.parent_question_id,
    related_seed_question_id = COALESCE(c.related_seed_question_id, p.related_seed_question_id)
FROM user_questions p
WHERE c.parent_question_id = p.id
  AND p.is_deleted = true
  AND c.is_deleted = false;
