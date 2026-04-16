const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const axios = require('axios');

// 내 정보 조회
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;

    const result = await pool.query(
      `SELECT 
        id,
        username,
        songi_count,
        is_admin,
        created_at,
        (SELECT COUNT(*) FROM user_questions WHERE user_id = $1) as question_count,
        (SELECT COUNT(*) FROM follow_up_questions WHERE user_id = $1) as followup_count
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    }

    const user = result.rows[0];

    res.json({
      user: {
        id: user.id,
        username: user.username,
        songi_count: user.songi_count,
        is_admin: user.is_admin || false,
        question_count: parseInt(user.question_count),
        followup_count: parseInt(user.followup_count),
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// ===== 프로필 상세 통계 조회 =====
router.get('/me/profile-stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;

    // 기본 정보
    const userResult = await pool.query(
      'SELECT id, username, songi_count, created_at FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    }
    const user = userResult.rows[0];

    // 만든 질문 수 (관련질문 제외)
    const myQuestionsResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM user_questions 
       WHERE user_id = $1 AND parent_question_id IS NULL AND related_seed_question_id IS NULL`,
      [userId]
    );

    // 관련질문 수
    const relatedQuestionsResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM user_questions 
       WHERE user_id = $1 AND (parent_question_id IS NOT NULL OR related_seed_question_id IS NOT NULL)`,
      [userId]
    );

    // 총 의견 수
    const opinionsResult = await pool.query(
      'SELECT COUNT(*) as cnt FROM question_opinions WHERE user_id = $1',
      [userId]
    );

    // 총 관심표시(좋아요) 수
    const reactionsResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM question_reactions 
       WHERE user_id = $1 AND reaction_type = 'like'`,
      [userId]
    );

    // 퀴즈 푼 횟수
    let quizCount = 0;
    try {
      const quizResult = await pool.query(
        'SELECT COUNT(DISTINCT created_at::date) as cnt FROM quiz_responses WHERE user_id = $1',
        [userId]
      );
      // 퀴즈는 제출 횟수로 카운트 (5문제 세트 기준)
      const quizTotal = await pool.query(
        'SELECT COUNT(*) as cnt FROM quiz_responses WHERE user_id = $1',
        [userId]
      );
      quizCount = Math.floor(parseInt(quizTotal.rows[0].cnt) / 5) || parseInt(quizTotal.rows[0].cnt);
    } catch (e) {
      quizCount = 0;
    }

    // 상품권 수령 내역 (songi_transactions에서 admin_deduct 또는 reward 타입)
    let rewards = [];
    try {
      const rewardsResult = await pool.query(
        `SELECT amount, description, created_at 
         FROM songi_transactions 
         WHERE user_id = $1 AND activity_type IN ('reward', 'coupon')
         ORDER BY created_at DESC`,
        [userId]
      );
      rewards = rewardsResult.rows;
    } catch (e) {
      rewards = [];
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        songi_count: user.songi_count,
        created_at: user.created_at
      },
      stats: {
        myQuestions: parseInt(myQuestionsResult.rows[0].cnt) || 0,
        relatedQuestions: parseInt(relatedQuestionsResult.rows[0].cnt) || 0,
        opinions: parseInt(opinionsResult.rows[0].cnt) || 0,
        reactions: parseInt(reactionsResult.rows[0].cnt) || 0,
        quizCount: quizCount
      },
      rewards: rewards
    });

  } catch (error) {
    console.error('프로필 통계 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 프로필 수정 (닉네임)
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: '닉네임을 입력해주세요' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: '닉네임은 3글자 이상이어야 합니다' });
    }

    // 중복 체크
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1 AND id != $2',
      [username, userId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: '이미 사용 중인 닉네임입니다' });
    }

    // 업데이트
    await pool.query(
      'UPDATE users SET username = $1 WHERE id = $2',
      [username, userId]
    );

    res.json({
      message: '닉네임이 변경되었습니다',
      username
    });

  } catch (error) {
    console.error('프로필 수정 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 비밀번호 변경
router.put('/me/password', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ error: '새 비밀번호는 4글자 이상이어야 합니다' });
    }

    // 현재 비밀번호 확인
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: '현재 비밀번호가 일치하지 않습니다' });
    }

    // 새 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 업데이트
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, userId]
    );

    res.json({ message: '비밀번호가 변경되었습니다' });

  } catch (error) {
    console.error('비밀번호 변경 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 회원탈퇴 (계정 삭제)
router.delete('/me', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.id || req.user.userId;

    await client.query('BEGIN');

    // 관련 데이터 삭제 (순서 중요 - FK 참조 순서)
    await client.query('DELETE FROM question_reactions WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM question_opinions WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM saved_questions WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM quiz_responses WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM user_questions WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    await client.query('COMMIT');

    res.json({ message: '계정이 삭제되었습니다' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('회원탈퇴 오류:', error);
    res.status(500).json({ error: '계정 삭제에 실패했습니다' });
  } finally {
    client.release();
  }
});

// 송이 내역 조회
router.get('/songi-history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;

    const result = await pool.query(
      `SELECT 
        st.id, st.amount, st.activity_type, st.description, 
        st.question_id, st.created_at,
        COALESCE(
          st.question_text,
          uq.title,
          sq.question
        ) as question_text
       FROM songi_transactions st
       LEFT JOIN user_questions uq ON st.question_id = uq.id 
         AND st.activity_type IN ('question', 'related', 'opinion', 'interest')
       LEFT JOIN seed_questions sq ON st.question_id = sq.id
         AND st.activity_type IN ('icebreaking', 'quiz', 'interest')
       WHERE st.user_id = $1
       ORDER BY st.created_at DESC
       LIMIT 200`,
      [userId]
    );

    const totalResult = await pool.query(
      'SELECT songi_count FROM users WHERE id = $1',
      [userId]
    );

    res.json({
      transactions: result.rows,
      total_songi: totalResult.rows[0]?.songi_count || 0
    });

  } catch (error) {
    console.error('송이 내역 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
