const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');

// 관리자 확인 미들웨어
const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    const result = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (!result.rows[0]?.is_admin) {
      return res.status(403).json({ error: '관리자 권한이 필요합니다' });
    }
    next();
  } catch (err) {
    res.status(500).json({ error: '서버 오류' });
  }
};

// ===== 전체 사용자 목록 + 활동 통계 =====
router.get('/users', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        u.id, u.username, u.songi_count, u.created_at, u.is_admin,
        (SELECT COUNT(*) FROM user_questions WHERE user_id = u.id AND parent_question_id IS NULL AND related_seed_question_id IS NULL) as question_count,
        (SELECT COUNT(*) FROM user_questions WHERE user_id = u.id AND (parent_question_id IS NOT NULL OR related_seed_question_id IS NOT NULL)) as related_count,
        (SELECT COUNT(*) FROM question_opinions WHERE user_id = u.id) as opinion_count,
        (SELECT COUNT(*) FROM question_reactions WHERE user_id = u.id AND reaction_type = 'like') as reaction_count,
        (SELECT COUNT(*) FROM quiz_responses WHERE user_id = u.id) as quiz_count,
        (SELECT MAX(created_at) FROM songi_transactions WHERE user_id = u.id) as last_active
      FROM users u
      ORDER BY u.created_at DESC
    `);
    res.json({ users: result.rows });
  } catch (err) {
    console.error('관리자 사용자 목록 오류:', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// ===== 전체 활동 피드 (정렬 가능) =====
router.get('/activities', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type = 'all', user_id, order = 'desc' } = req.query;
    const orderDir = order === 'asc' ? 'ASC' : 'DESC';
    const userFilter = user_id ? `AND u.id = ${parseInt(user_id)}` : '';

    let rows = [];

    if (type === 'all' || type === 'question') {
      const q = await pool.query(`
        SELECT 
          uq.id, uq.user_id, u.username, uq.title as content,
          'question' as activity_type, uq.created_at,
          NULL as question_ref
        FROM user_questions uq
        JOIN users u ON uq.user_id = u.id
        WHERE uq.parent_question_id IS NULL AND uq.related_seed_question_id IS NULL
        ${userFilter}
      `);
      rows = [...rows, ...q.rows];
    }

    if (type === 'all' || type === 'related') {
      const q = await pool.query(`
        SELECT 
          uq.id, uq.user_id, u.username, uq.title as content,
          'related' as activity_type, uq.created_at,
          COALESCE(uq.parent_question_id, uq.related_seed_question_id) as question_ref,
          COALESCE(pq.title, sq.question) as question_text
        FROM user_questions uq
        JOIN users u ON uq.user_id = u.id
        LEFT JOIN user_questions pq ON uq.parent_question_id = pq.id
        LEFT JOIN seed_questions sq ON uq.related_seed_question_id = sq.id
        WHERE uq.parent_question_id IS NOT NULL OR uq.related_seed_question_id IS NOT NULL
        ${userFilter}
      `);
      rows = [...rows, ...q.rows];
    }

    if (type === 'all' || type === 'opinion') {
      const q = await pool.query(`
        SELECT 
          qo.id, qo.user_id, u.username, qo.opinion as content,
          'opinion' as activity_type, qo.created_at,
          qo.question_id as question_ref,
          COALESCE(uq.title, sq.question) as question_text
        FROM question_opinions qo
        JOIN users u ON qo.user_id = u.id
        LEFT JOIN user_questions uq ON qo.question_id = uq.id AND qo.question_type IN ('user_question', 'friend_question', 'user')
        LEFT JOIN seed_questions sq ON qo.question_id = sq.id AND qo.question_type IN ('seed', 'quiz', 'icebreaking')
        WHERE 1=1 ${userFilter}
      `);
      rows = [...rows, ...q.rows];
    }

    if (type === 'all' || type === 'reaction') {
      const q = await pool.query(`
        SELECT 
          qr.id, qr.user_id, u.username, 
          CONCAT(CASE WHEN qr.reaction_type = 'like' THEN '관심있음' ELSE '관심없음' END) as content,
          'reaction' as activity_type, qr.created_at,
          qr.question_id as question_ref,
          COALESCE(uq.title, sq.question) as question_text
        FROM question_reactions qr
        JOIN users u ON qr.user_id = u.id
        LEFT JOIN user_questions uq ON qr.question_id = uq.id AND qr.question_type IN ('user_question', 'friend_question', 'user')
        LEFT JOIN seed_questions sq ON qr.question_id = sq.id AND qr.question_type IN ('seed', 'quiz', 'icebreaking')
        WHERE 1=1 ${userFilter}
      `);
      rows = [...rows, ...q.rows];
    }

    if (type === 'all' || type === 'quiz') {
      const q = await pool.query(`
        SELECT 
          qr.id, qr.user_id, u.username,
          CONCAT(
            CASE WHEN qr.is_correct THEN '정답' ELSE '오답' END,
            '|', qr.selected_option,
            '|', sq.correct_option
          ) as content,
          'quiz' as activity_type, qr.created_at,
          qr.question_id as question_ref,
          sq.question as question_text
        FROM quiz_responses qr
        JOIN users u ON qr.user_id = u.id
        JOIN seed_questions sq ON qr.question_id = sq.id
        WHERE 1=1 ${userFilter}
      `);
      rows = [...rows, ...q.rows];
    }

    // 시간순 정렬
    rows.sort((a, b) => {
      const diff = new Date(a.created_at) - new Date(b.created_at);
      return orderDir === 'DESC' ? -diff : diff;
    });

    res.json({ activities: rows.slice(0, 200) }); // 최대 200개
  } catch (err) {
    console.error('활동 피드 오류:', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

// ===== 송이 회수 =====
router.post('/deduct-songi', authenticateToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { userId, amount, reason } = req.body;
    await client.query('BEGIN');

    await client.query(
      'UPDATE users SET songi_count = songi_count - $1 WHERE id = $2',
      [amount, userId]
    );
    await client.query(
      `INSERT INTO songi_transactions (user_id, amount, activity_type, description)
       VALUES ($1, $2, 'admin_deduct', $3)`,
      [userId, -amount, reason || '관리자 회수']
    );

    await client.query('COMMIT');
    res.json({ message: `${amount}송이 회수 완료` });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: '서버 오류' });
  } finally {
    client.release();
  }
});

// ===== 활동 삭제 (질문/의견) =====
router.delete('/activity', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const { type, id } = req.query;

    if (type === 'question' || type === 'related') {
      await pool.query('DELETE FROM user_questions WHERE id = $1', [id]);
    } else if (type === 'opinion') {
      await pool.query('DELETE FROM question_opinions WHERE id = $1', [id]);
    } else {
      return res.status(400).json({ error: '삭제할 수 없는 타입입니다' });
    }

    res.json({ message: '삭제 완료' });
  } catch (err) {
    console.error('활동 삭제 오류:', err);
    res.status(500).json({ error: '서버 오류' });
  }
});

module.exports = router;
