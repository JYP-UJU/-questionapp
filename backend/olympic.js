const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');

// ── DB 테이블 초기화 ─────────────────────────────────────────────
// 서버 시작 시 테이블이 없으면 자동 생성
async function initTables() {
  await db.query(`
    CREATE TABLE IF NOT EXISTS olympic_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      winner_question_id INTEGER,
      winner_question_text TEXT,
      winner_subject VARCHAR(20),
      winner_type VARCHAR(20),
      songi_awarded INTEGER DEFAULT 5,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await db.query(`
    CREATE TABLE IF NOT EXISTS olympic_rounds (
      id SERIAL PRIMARY KEY,
      session_id INTEGER NOT NULL REFERENCES olympic_sessions(id) ON DELETE CASCADE,
      round_number INTEGER NOT NULL,       -- 0=8강, 1=4강, 2=결승
      round_label VARCHAR(20),             -- '8강','4강','결승'
      question_id INTEGER NOT NULL,
      question_text TEXT,
      subject VARCHAR(20),
      question_type VARCHAR(20),
      exposed BOOLEAN DEFAULT TRUE,        -- 노출됨 (항상 true)
      selected BOOLEAN DEFAULT FALSE,      -- 선택됨
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
}

initTables().catch(err => console.error('olympic 테이블 초기화 오류:', err));

// ── POST /api/olympic/complete ────────────────────────────────────
// 올림픽 완주 기록 저장 + 송이 지급
router.post('/complete', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  const { winnerId, winnerText, winnerSubject, winnerType, roundsData } = req.body;
  // roundsData: [
  //   { roundNumber: 0, roundLabel: '8강', questions: [{id, text, subject, type, selected}] },
  //   { roundNumber: 1, roundLabel: '4강', questions: [...] },
  //   { roundNumber: 2, roundLabel: '결승', questions: [...] },
  // ]

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // 1. 세션 생성
    const sessionResult = await client.query(
      `INSERT INTO olympic_sessions
        (user_id, winner_question_id, winner_question_text, winner_subject, winner_type, songi_awarded)
       VALUES ($1, $2, $3, $4, $5, 5)
       RETURNING id`,
      [userId, winnerId, winnerText, winnerSubject || null, winnerType || null]
    );
    const sessionId = sessionResult.rows[0].id;

    // 2. 라운드별 노출/선택 기록
    if (roundsData && Array.isArray(roundsData)) {
      for (const round of roundsData) {
        for (const q of round.questions) {
          await client.query(
            `INSERT INTO olympic_rounds
              (session_id, round_number, round_label, question_id, question_text, subject, question_type, exposed, selected)
             VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)`,
            [sessionId, round.roundNumber, round.roundLabel,
             q.id, q.text, q.subject || null, q.type || null, q.selected || false]
          );
        }
      }
    }

    // 3. 송이 지급 (+5)
    await client.query(
      `UPDATE users SET songi = COALESCE(songi, 0) + 5 WHERE id = $1`,
      [userId]
    );

    // 4. 송이 히스토리 기록 (테이블 있는 경우)
    try {
      await client.query(
        `INSERT INTO songi_history (user_id, amount, reason, created_at)
         VALUES ($1, 5, '질문올림픽 완주', NOW())`,
        [userId]
      );
    } catch (e) {
      // songi_history 테이블 없으면 무시
    }

    await client.query('COMMIT');

    // 5. 현재 송이 잔액 조회
    const userResult = await client.query(
      `SELECT songi FROM users WHERE id = $1`, [userId]
    );
    const currentSongi = userResult.rows[0]?.songi || 0;

    res.json({
      success: true,
      sessionId,
      songiAwarded: 5,
      currentSongi,
      message: '올림픽 완주 기록 저장 완료!'
    });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('olympic/complete 오류:', err);
    res.status(500).json({ error: '저장 중 오류가 발생했습니다' });
  } finally {
    client.release();
  }
});

// ── GET /api/olympic/stats ────────────────────────────────────────
// 질문별 노출/선택 통계 (관리자용)
router.get('/stats', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        question_id,
        question_text,
        subject,
        question_type,
        COUNT(*) AS exposed_count,
        SUM(CASE WHEN selected THEN 1 ELSE 0 END) AS selected_count,
        ROUND(
          SUM(CASE WHEN selected THEN 1 ELSE 0 END)::NUMERIC / COUNT(*) * 100, 1
        ) AS selection_rate
      FROM olympic_rounds
      GROUP BY question_id, question_text, subject, question_type
      ORDER BY selection_rate DESC
    `);
    res.json({ stats: result.rows });
  } catch (err) {
    console.error('olympic/stats 오류:', err);
    res.status(500).json({ error: '통계 조회 오류' });
  }
});

// ── GET /api/olympic/my-history ───────────────────────────────────
// 내 올림픽 기록 (프로필 성향 표시용)
router.get('/my-history', authenticateToken, async (req, res) => {
  const userId = req.user.id;
  try {
    const result = await db.query(`
      SELECT winner_subject, winner_type, COUNT(*) AS cnt
      FROM olympic_sessions
      WHERE user_id = $1
      GROUP BY winner_subject, winner_type
      ORDER BY cnt DESC
      LIMIT 1
    `, [userId]);

    const sessions = await db.query(`
      SELECT id, winner_question_text, winner_subject, winner_type, created_at
      FROM olympic_sessions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 5
    `, [userId]);

    res.json({
      topProfile: result.rows[0] || null,
      recentSessions: sessions.rows
    });
  } catch (err) {
    console.error('olympic/my-history 오류:', err);
    res.status(500).json({ error: '기록 조회 오류' });
  }
});

module.exports = router;
