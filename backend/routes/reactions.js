const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const axios = require('axios');

// 좋아요/싫어요 추가 + 1송이 지급
router.post('/', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { questionId, reactionType } = req.body; // reactionType: 'like' 또는 'dislike'
    const userId = req.user.id || req.user.userId;

    if (!questionId || !reactionType) {
      return res.status(400).json({ error: '질문과 반응 타입을 입력해주세요' });
    }

    if (reactionType !== 'like' && reactionType !== 'dislike') {
      return res.status(400).json({ error: '반응 타입은 like 또는 dislike여야 합니다' });
    }

    await client.query('BEGIN');

    // 중복 체크 (같은 반응을 이미 했는지)
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

    // 질문의 좋아요/싫어요 카운트 업데이트
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

    // 업데이트된 송이 개수 조회
    const userResult = await client.query(
      'SELECT songi_count FROM users WHERE id = $1',
      [userId]
    );

    // 업데이트된 질문 카운트 조회
    const questionResult = await client.query(
      'SELECT likes_count, dislikes_count FROM user_questions WHERE id = $1',
      [questionId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: `${reactionType === 'like' ? '좋아요' : '싫어요'}를 눌렀습니다! 1송이를 획득했어요 🌸`,
      songi_count: userResult.rows[0].songi_count,
      songi_earned: 1,
      question_stats: questionResult.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('반응 추가 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  } finally {
    client.release();
  }
});

// 내가 누른 반응 조회 (특정 질문에 대해)
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