const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const axios = require('axios');

// 전체 사용자 랭킹 (질문 개수 순)
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        u.id,
        u.username,
        COUNT(uq.id) as question_count,
        u.songi_count
       FROM users u
       LEFT JOIN user_questions uq ON u.id = uq.user_id
       GROUP BY u.id, u.username, u.songi_count
       HAVING COUNT(uq.id) > 0
       ORDER BY question_count DESC, u.created_at ASC
       LIMIT 100`
    );

    // 순위 매기기
    const rankings = result.rows.map((user, index) => ({
      rank: index + 1,
      username: user.username,
      question_count: parseInt(user.question_count),
      songi_count: user.songi_count,
      medal: index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null
    }));

    res.json({ rankings });

  } catch (error) {
    console.error('랭킹 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 상위 3명만 조회 (금은동)
router.get('/top3', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        u.id,
        u.username,
        COUNT(uq.id) as question_count
       FROM users u
       LEFT JOIN user_questions uq ON u.id = uq.user_id
       GROUP BY u.id, u.username
       HAVING COUNT(uq.id) > 0
       ORDER BY question_count DESC, u.created_at ASC
       LIMIT 3`
    );

    const top3 = result.rows.map((user, index) => ({
      rank: index + 1,
      username: user.username,
      question_count: parseInt(user.question_count),
      medal: index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'
    }));

    res.json({ top3 });

  } catch (error) {
    console.error('Top 3 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;