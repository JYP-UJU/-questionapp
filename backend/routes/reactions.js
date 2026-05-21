const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');

// 좋아요/싫어요 추가 + 1송이 지급
router.post('/', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { questionId, reactionType } = req.body;
    const userId = req.user.id || req.user.userId;

    if (!questionId || !reactionType) {
      return res.status(400).json({ error: '질문과 반응 타입을 입력해주세요' });
    }
    if (reactionType !== 'like' && reactionType !== 'dislike') {
      return res.status(400).json({ error: '반응 타입은 like 또는 dislike여야 합니다' });
    }

    await client.query('BEGIN');

    // 중복 체크
    const existing = await client.query(
      'SELECT id FROM question_reactions WHERE question_id = $1 AND user_id = $2 AND reaction_type = $3',
      [questionId, userId, reactionType]
    );
    if (existing.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '이미 반응한 타입입니다' });
    }

    // 반응 저장
    await client.query(
      'INSERT INTO question_reactions (question_id, user_id, reaction_type) VALUES ($1, $2, $3)',
      [questionId, userId, reactionType]
    );

    // 질문 카운트 업데이트
    const countField = reactionType === 'like' ? 'likes_count' : 'dislikes_count';
    await client.query(
      `UPDATE user_questions SET ${countField} = ${countField} + 1 WHERE id = $1`,
      [questionId]
    );

    // 1송이 지급
    await client.query(
      'UPDATE users SET songi_count = songi_count + 1 WHERE id = $1',
      [userId]
    );

    // 질문 작성자 조회
    const questionResult = await client.query(
      'SELECT user_id, title, likes_count, dislikes_count FROM user_questions WHERE id = $1',
      [questionId]
    );
    const question = questionResult.rows[0];

    // 작성자가 본인이 아닌 경우에만 알림 생성
    if (question && question.user_id !== userId) {
      const reactionLabel = reactionType === 'like' ? '관심있음' : '관심없음';
      await client.query(
        `INSERT INTO notifications (user_id, type, message, related_question_id)
         VALUES ($1, 'reaction', $2, $3)`,
        [
          question.user_id,
          `내 질문 "${question.title}"에 누군가 ${reactionLabel}을 눌렀어요.`,
          questionId
        ]
      );
    }

    // 송이 개수 조회
    const userResult = await client.query(
      'SELECT songi_count FROM users WHERE id = $1',
      [userId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: `${reactionType === 'like' ? '관심있음' : '관심없음'}! 1송이를 획득했어요 🌸`,
      songi_count: userResult.rows[0].songi_count,
      songi_earned: 1,
      question_stats: {
        likes_count: question.likes_count,
        dislikes_count: question.dislikes_count
      }
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('반응 추가 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  } finally {
    client.release();
  }
});

// 내가 누른 반응 조회
router.get('/my/:questionId', authenticateToken, async (req, res) => {
  try {
    const { questionId } = req.params;
    const userId = req.user.id || req.user.userId;
    const result = await pool.query(
      'SELECT reaction_type FROM question_reactions WHERE question_id = $1 AND user_id = $2',
      [questionId, userId]
    );
    const reactions = result.rows.map(row => row.reaction_type);
    res.json({
      reactions,
      hasLiked: reactions.includes('like'),
      hasDisliked: reactions.includes('dislike')
    });
  } catch (error) {
    console.error('반응 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
