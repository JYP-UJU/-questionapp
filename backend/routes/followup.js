const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');

// 추가 질문(관련질문) 작성 + 5송이 지급
router.post('/', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { parentQuestionId, question } = req.body;
    const userId = req.user.id || req.user.userId;

    if (!parentQuestionId || !question) {
      return res.status(400).json({ error: '원본 질문과 내용을 입력해주세요' });
    }

    await client.query('BEGIN');

    // 관련질문 저장
    const result = await client.query(
      `INSERT INTO follow_up_questions (parent_question_id, user_id, question)
       VALUES ($1, $2, $3)
       RETURNING id, parent_question_id, question, created_at`,
      [parentQuestionId, userId, question]
    );
    const followUpQuestion = result.rows[0];

    // 5송이 지급
    await client.query(
      'UPDATE users SET songi_count = songi_count + 5 WHERE id = $1',
      [userId]
    );

    // 원본 질문 작성자 조회
    const parentResult = await client.query(
      'SELECT user_id, title FROM user_questions WHERE id = $1',
      [parentQuestionId]
    );
    const parent = parentResult.rows[0];

    // 작성자가 본인이 아닌 경우에만 알림 생성
    if (parent && parent.user_id !== userId) {
      await client.query(
        `INSERT INTO notifications (user_id, type, message, related_question_id)
         VALUES ($1, 'related', $2, $3)`,
        [
          parent.user_id,
          `내 질문 "${parent.title}"에 관련 질문이 달렸어요: "${question}"`,
          parentQuestionId
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
      message: '질문이 등록되었습니다! 5송이를 획득했어요 🌸',
      followUpQuestion,
      songi_count: userResult.rows[0].songi_count,
      songi_earned: 5
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('관련질문 작성 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  } finally {
    client.release();
  }
});

// 특정 질문의 관련질문 목록 조회
router.get('/:parentQuestionId', async (req, res) => {
  try {
    const { parentQuestionId } = req.params;
    const result = await pool.query(
      `SELECT fq.id, fq.question, fq.created_at, u.username
       FROM follow_up_questions fq
       JOIN users u ON fq.user_id = u.id
       WHERE fq.parent_question_id = $1
       ORDER BY fq.created_at ASC`,
      [parentQuestionId]
    );
    res.json({ followUpQuestions: result.rows });
  } catch (error) {
    console.error('관련질문 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 내가 작성한 관련질문 조회
router.get('/my/all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const result = await pool.query(
      `SELECT fq.id, fq.question, fq.created_at, fq.parent_question_id, uq.title as parent_title
       FROM follow_up_questions fq
       JOIN user_questions uq ON fq.parent_question_id = uq.id
       WHERE fq.user_id = $1
       ORDER BY fq.created_at DESC`,
      [userId]
    );
    res.json({ followUpQuestions: result.rows });
  } catch (error) {
    console.error('내 관련질문 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
