const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');

// 내 알림 목록 조회
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const result = await pool.query(
      `SELECT
         n.id,
         n.type,
         CASE
           WHEN u.id IS NOT NULL THEN REPLACE(n.message, '누군가', COALESCE(u.name, u.username))
           ELSE n.message
         END as message,
         n.related_question_id,
         n.is_read,
         n.created_at,
         u.id as actor_id,
         COALESCE(u.name, u.username) as actor_name
       FROM notifications n
       LEFT JOIN users u ON n.actor_id = u.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [userId]
    );
    res.json({ notifications: result.rows });
  } catch (err) {
    console.error('알림 조회 오류:', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 읽지 않은 알림 개수
router.get('/unread-count', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const result = await pool.query(
      'SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false',
      [userId]
    );
    res.json({ count: parseInt(result.rows[0].count) });
  } catch (err) {
    console.error('알림 카운트 오류:', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 알림 읽음 처리 (전체)
router.put('/read-all', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE user_id = $1',
      [userId]
    );
    res.json({ message: '모두 읽음 처리 완료' });
  } catch (err) {
    console.error('읽음 처리 오류:', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 알림 읽음 처리 (단건)
router.put('/:id/read', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    await pool.query(
      'UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2',
      [req.params.id, userId]
    );
    res.json({ message: '읽음 처리 완료' });
  } catch (err) {
    console.error('읽음 처리 오류:', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

module.exports = router;
