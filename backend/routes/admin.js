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
        WHERE (uq.parent_question_id IS NOT NULL OR uq.related_seed_question_id IS NOT NULL)
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

// ===== 계정 + 모든 활동 완전 삭제 (되돌릴 수 없음! 테스트 계정 정리용) =====
// users.id를 참조하는 모든 테이블에서 이 사용자의 행을 지운 뒤 계정 자체를 삭제함.
// 이 사용자가 쓴 질문/관련질문(user_questions)에 다른 사람이 단 관련질문(자식)은
// 지우지 않고 parent_question_id만 NULL로 끊어서 그 사람의 데이터는 보존함.
router.delete('/users/:id', authenticateToken, requireAdmin, async (req, res) => {
  const client = await pool.connect();
  try {
    const targetId = parseInt(req.params.id);
    const { confirmUsername } = req.body;
    const requesterId = req.user.id || req.user.userId;

    if (targetId === requesterId) {
      return res.status(400).json({ error: '본인 계정은 이 기능으로 삭제할 수 없어요' });
    }

    await client.query('BEGIN');

    const userRes = await client.query(
      'SELECT id, username, is_admin FROM users WHERE id = $1 FOR UPDATE',
      [targetId]
    );
    if (userRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    }
    const targetUser = userRes.rows[0];

    // 프론트에서 정확한 username을 입력받아 넘겨야만 실행됨 (오삭제 방지)
    if (!confirmUsername || confirmUsername !== targetUser.username) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '확인 문구(아이디)가 일치하지 않습니다' });
    }

    // 관리자 계정은 이 기능으로 삭제 불가 (안전장치 - 필요하면 DB에서 직접)
    if (targetUser.is_admin) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: '관리자 계정은 이 기능으로 삭제할 수 없습니다' });
    }

    // 이 사용자가 작성한 질문 + 관련질문 id 전부 (user_questions 테이블은 둘 다 포함)
    const qRes = await client.query('SELECT id FROM user_questions WHERE user_id = $1', [targetId]);
    const questionIds = qRes.rows.map(r => r.id);

    if (questionIds.length > 0) {
      // 남이 이 질문들에 단 관련질문(자식)은 삭제하지 않고 부모 연결만 끊어서 보존
      await client.query(
        `UPDATE user_questions SET parent_question_id = NULL WHERE parent_question_id = ANY($1::int[])`,
        [questionIds]
      );

      // user_questions 테이블을 가리키는 question_type 값들 (seed_questions 쪽과 id가 겹치지 않도록 타입 제한)
      const userQuestionTypes = ['user_question', 'friend_question', 'user', 'my_question', 'related_question', 'quiz_related', 'icebreaking_related'];

      await client.query(
        `DELETE FROM question_opinions WHERE question_id = ANY($1::int[]) AND question_type = ANY($2::text[])`,
        [questionIds, userQuestionTypes]
      );
      await client.query(
        `DELETE FROM question_reactions WHERE question_id = ANY($1::int[]) AND question_type = ANY($2::text[])`,
        [questionIds, userQuestionTypes]
      );
      await client.query(
        `DELETE FROM saved_questions WHERE question_id = ANY($1::int[]) AND question_type = ANY($2::text[])`,
        [questionIds, userQuestionTypes]
      );
      await client.query(
        `DELETE FROM notifications WHERE related_question_id = ANY($1::int[])`,
        [questionIds]
      );
    }

    // 이 사용자 본인의 활동 기록 전부 삭제 (users.id를 참조하는 모든 테이블 - pgAdmin 조회 결과 기준)
    await client.query('DELETE FROM follow_up_questions WHERE user_id = $1', [targetId]);
    await client.query('DELETE FROM icebreaking_reactions WHERE user_id = $1', [targetId]);
    await client.query('DELETE FROM icebreaking_responses WHERE user_id = $1', [targetId]);
    await client.query('DELETE FROM interest_responses WHERE user_id = $1', [targetId]);
    await client.query('DELETE FROM monthly_reflections WHERE user_id = $1', [targetId]);
    await client.query('DELETE FROM notifications WHERE user_id = $1 OR actor_id = $1', [targetId]);
    await client.query('DELETE FROM question_interests WHERE user_id = $1', [targetId]);
    await client.query('DELETE FROM question_opinions WHERE user_id = $1', [targetId]);
    await client.query('DELETE FROM question_reactions WHERE user_id = $1', [targetId]);
    await client.query('DELETE FROM quiz_responses WHERE user_id = $1', [targetId]);
    await client.query('DELETE FROM reward_claims WHERE user_id = $1', [targetId]);
    await client.query('DELETE FROM saved_questions WHERE user_id = $1', [targetId]);
    await client.query('DELETE FROM songi_transactions WHERE user_id = $1', [targetId]);
    await client.query('DELETE FROM user_sessions WHERE user_id = $1', [targetId]);
    await client.query('DELETE FROM weekly_reflections WHERE user_id = $1', [targetId]);

    // 본인이 쓴 질문/관련질문 삭제 (남의 자식 연결은 위에서 이미 끊었음)
    await client.query('DELETE FROM user_questions WHERE user_id = $1', [targetId]);

    // 마지막으로 계정 자체 삭제
    await client.query('DELETE FROM users WHERE id = $1', [targetId]);

    await client.query('COMMIT');
    res.json({
      message: `'${targetUser.username}' 계정과 모든 활동 기록이 삭제되었습니다`,
      deletedQuestionCount: questionIds.length
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('사용자 완전 삭제 오류:', err);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  } finally {
    client.release();
  }
});

module.exports = router;
