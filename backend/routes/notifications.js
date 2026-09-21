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
         COALESCE(u.name, u.username) as actor_name,
         COALESCE(u.is_ai, FALSE) as actor_is_ai,
         op.id as opinion_id,
         LEFT(op.opinion, 150) as opinion_text,
         rq.id as related_id
       FROM notifications n
       LEFT JOIN users u ON n.actor_id = u.id
       LEFT JOIN LATERAL (
         SELECT qo.id, qo.opinion FROM question_opinions qo
         WHERE n.type = 'opinion'
           AND qo.question_id = n.related_question_id
           AND qo.user_id = n.actor_id
         ORDER BY qo.created_at DESC LIMIT 1
       ) op ON TRUE
       LEFT JOIN LATERAL (
         SELECT r.id FROM user_questions r
         WHERE n.type = 'related'
           AND r.parent_question_id = n.related_question_id
           AND r.user_id = n.actor_id
           AND r.is_deleted = false
         ORDER BY r.created_at DESC LIMIT 1
       ) rq ON TRUE
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT 50`,
      [userId]
    );

    // 이미 "도움이 됐어요"를 누른 의견 표시 (테이블이 아직 없어도 알림 목록은 정상 동작하도록 따로 조회)
    const rows = result.rows;
    let helpfulSet = new Set();
    const opinionIds = rows.map(r => r.opinion_id).filter(Boolean);
    if (opinionIds.length > 0) {
      try {
        const h = await pool.query(
          'SELECT opinion_id FROM opinion_helpful WHERE opinion_id = ANY($1::int[])',
          [opinionIds]
        );
        helpfulSet = new Set(h.rows.map(r => r.opinion_id));
      } catch (e) { /* 무시 */ }
    }
    // 관련질문 알림도 같은 방식으로 "도움이 됐어요" 표시 (related_helpful 테이블)
    let relatedHelpfulSet = new Set();
    const relatedIds = rows.map(r => r.related_id).filter(Boolean);
    if (relatedIds.length > 0) {
      try {
        const rh = await pool.query(
          'SELECT related_question_id FROM related_helpful WHERE related_question_id = ANY($1::int[])',
          [relatedIds]
        );
        relatedHelpfulSet = new Set(rh.rows.map(r => r.related_question_id));
      } catch (e) { /* 무시 */ }
    }
    rows.forEach(r => {
      r.helpful = r.opinion_id ? helpfulSet.has(r.opinion_id)
                : r.related_id ? relatedHelpfulSet.has(r.related_id)
                : false;
    });

    res.json({ notifications: rows });
  } catch (err) {
    console.error('알림 조회 오류:', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// 팝업용: after_id 이후에 새로 도착한 읽지 않은 알림만 (최대 5개)
// - after_id가 없으면 "기준선"만 잡아준다(현재 최대 id 반환, 알림 목록은 비어 있음)
//   → 접속 직후 예전 알림이 한꺼번에 팝업으로 쏟아지지 않게 하기 위함
router.get('/latest', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const afterId = parseInt(req.query.after_id, 10);

    if (Number.isNaN(afterId)) {
      const base = await pool.query(
        'SELECT COALESCE(MAX(id), 0) AS max_id FROM notifications WHERE user_id = $1',
        [userId]
      );
      return res.json({ max_id: parseInt(base.rows[0].max_id), notifications: [] });
    }

    const result = await pool.query(
      `SELECT
         n.id,
         n.type,
         CASE
           WHEN u.id IS NOT NULL THEN REPLACE(n.message, '누군가', COALESCE(u.name, u.username))
           ELSE n.message
         END as message,
         n.related_question_id,
         n.actor_id,
         n.created_at
       FROM notifications n
       LEFT JOIN users u ON n.actor_id = u.id
       WHERE n.user_id = $1 AND n.id > $2 AND n.is_read = false
       ORDER BY n.id ASC
       LIMIT 5`,
      [userId, afterId]
    );
    const maxId = result.rows.length ? result.rows[result.rows.length - 1].id : afterId;

    // 의견 알림이면 그 의견 앞부분을 팝업에 미리 보여준다.
    // 별도 조회로 분리해서, 이 부분이 실패해도 팝업 자체는 정상적으로 뜨게 한다.
    for (const row of result.rows) {
      if (row.type === 'opinion' && row.related_question_id && row.actor_id) {
        try {
          const op = await pool.query(
            `SELECT LEFT(opinion, 120) AS preview FROM question_opinions
             WHERE question_id = $1 AND user_id = $2
             ORDER BY created_at DESC LIMIT 1`,
            [row.related_question_id, row.actor_id]
          );
          row.preview = op.rows[0]?.preview || null;
        } catch (e) {
          row.preview = null;
        }
      }
    }
    res.json({ max_id: maxId, notifications: result.rows });
  } catch (err) {
    console.error('최신 알림 조회 오류:', err);
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
