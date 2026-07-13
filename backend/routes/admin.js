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

    if (type === 'all' || type === 'weekly_journal') {
      const q = await pool.query(`
        SELECT
          wr.id, wr.user_id, u.username,
          CONCAT(
            '궁금: ', COALESCE(wr.most_curious, ''),
            CASE WHEN wr.research_topic IS NOT NULL AND wr.research_topic != '' THEN CONCAT(' | 찾아봄: ', wr.research_topic) ELSE '' END,
            CASE WHEN wr.fun_friend_question IS NOT NULL AND wr.fun_friend_question != '' THEN CONCAT(' | 친구질문: ', wr.fun_friend_question) ELSE '' END,
            CASE WHEN wr.weekly_feeling IS NOT NULL AND wr.weekly_feeling != '' THEN CONCAT(' | 한마디: ', wr.weekly_feeling) ELSE '' END
          ) as content,
          'weekly_journal' as activity_type, wr.created_at,
          NULL as question_ref
        FROM weekly_reflections wr
        JOIN users u ON wr.user_id = u.id
        WHERE 1=1 ${userFilter}
      `);
      rows = [...rows, ...q.rows];
    }

    if (type === 'all' || type === 'monthly_journal') {
      const q = await pool.query(`
        SELECT
          mr.id, mr.user_id, u.username,
          CONCAT(
            '궁금: ', COALESCE(mr.most_curious, ''),
            CASE WHEN mr.research_topic IS NOT NULL AND mr.research_topic != '' THEN CONCAT(' | 찾아봄: ', mr.research_topic) ELSE '' END,
            CASE WHEN mr.monthly_feeling IS NOT NULL AND mr.monthly_feeling != '' THEN CONCAT(' | 한마디: ', mr.monthly_feeling) ELSE '' END
          ) as content,
          'monthly_journal' as activity_type, mr.created_at,
          NULL as question_ref
        FROM monthly_reflections mr
        JOIN users u ON mr.user_id = u.id
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

// ===== 활동 삭제 (질문/관련질문/의견/주간·월간일지) + 송이 회수 =====
router.delete('/activity', authenticateToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const { type, id } = req.query;
    await client.query('BEGIN');

    let ownerUserId = null;
    let reversedAmount = 0;

    if (type === 'question' || type === 'related') {
      const owner = await client.query('SELECT user_id FROM user_questions WHERE id = $1', [id]);
      if (owner.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: '해당 항목을 찾을 수 없습니다' });
      }
      ownerUserId = owner.rows[0].user_id;

      // question/related는 songi_transactions.question_id가 이 행의 id와 직접 일치함
      const tx = await client.query(
        `SELECT amount FROM songi_transactions
         WHERE question_id = $1 AND activity_type = $2 AND user_id = $3
         ORDER BY created_at DESC LIMIT 1`,
        [id, type, ownerUserId]
      );
      if (tx.rows.length > 0) reversedAmount = parseFloat(tx.rows[0].amount);

      await client.query('DELETE FROM user_questions WHERE id = $1', [id]);

    } else if (type === 'opinion') {
      const owner = await client.query('SELECT user_id, created_at FROM question_opinions WHERE id = $1', [id]);
      if (owner.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: '해당 항목을 찾을 수 없습니다' });
      }
      ownerUserId = owner.rows[0].user_id;

      // opinion은 songi_transactions.question_id에 "대상 질문 id"가 들어있어 직접 매칭이 안 됨
      // → 같은 사용자의 opinion 거래 중 생성 시각이 가장 가까운 것으로 매칭
      const tx = await client.query(
        `SELECT amount FROM songi_transactions
         WHERE user_id = $1 AND activity_type = 'opinion'
         ORDER BY ABS(EXTRACT(EPOCH FROM (created_at - $2::timestamp))) ASC
         LIMIT 1`,
        [ownerUserId, owner.rows[0].created_at]
      );
      if (tx.rows.length > 0) reversedAmount = parseFloat(tx.rows[0].amount);

      await client.query('DELETE FROM question_opinions WHERE id = $1', [id]);

    } else if (type === 'weekly_journal') {
      const owner = await client.query('SELECT user_id, created_at FROM weekly_reflections WHERE id = $1', [id]);
      if (owner.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: '해당 항목을 찾을 수 없습니다' });
      }
      ownerUserId = owner.rows[0].user_id;

      const tx = await client.query(
        `SELECT amount FROM songi_transactions
         WHERE user_id = $1 AND activity_type = 'weekly_journal'
         ORDER BY ABS(EXTRACT(EPOCH FROM (created_at - $2::timestamp))) ASC
         LIMIT 1`,
        [ownerUserId, owner.rows[0].created_at]
      );
      if (tx.rows.length > 0) reversedAmount = parseFloat(tx.rows[0].amount);

      await client.query('DELETE FROM weekly_reflections WHERE id = $1', [id]);

    } else if (type === 'monthly_journal') {
      const owner = await client.query('SELECT user_id, created_at FROM monthly_reflections WHERE id = $1', [id]);
      if (owner.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: '해당 항목을 찾을 수 없습니다' });
      }
      ownerUserId = owner.rows[0].user_id;

      const tx = await client.query(
        `SELECT amount FROM songi_transactions
         WHERE user_id = $1 AND activity_type = 'monthly_journal'
         ORDER BY ABS(EXTRACT(EPOCH FROM (created_at - $2::timestamp))) ASC
         LIMIT 1`,
        [ownerUserId, owner.rows[0].created_at]
      );
      if (tx.rows.length > 0) reversedAmount = parseFloat(tx.rows[0].amount);

      await client.query('DELETE FROM monthly_reflections WHERE id = $1', [id]);

    } else {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '삭제할 수 없는 타입입니다' });
    }

    // 지급됐던 만큼 정확히 송이 회수 (0 밑으로는 안 내려가게)
    if (ownerUserId && reversedAmount > 0) {
      await client.query(
        'UPDATE users SET songi_count = GREATEST(songi_count - $1, 0) WHERE id = $2',
        [reversedAmount, ownerUserId]
      );
      await client.query(
        `INSERT INTO songi_transactions (user_id, amount, activity_type, description)
         VALUES ($1, $2, 'admin_delete_reversal', $3)`,
        [ownerUserId, -reversedAmount, `관리자 삭제로 인한 회수 (${type})`]
      );
    }

    await client.query('COMMIT');
    res.json({
      message: reversedAmount > 0
        ? `삭제 완료! ${reversedAmount}송이도 함께 회수했어요`
        : '삭제 완료 (지급 기록을 찾지 못해 송이는 회수되지 않았어요)'
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('활동 삭제 오류:', err);
    res.status(500).json({ error: '서버 오류' });
  } finally {
    client.release();
  }
});

module.exports = router;
