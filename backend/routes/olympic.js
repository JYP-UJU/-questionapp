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

// ── GET /api/olympic/questions ───────────────────────────────────
// 16강용 질문 16개를 검토 완료(final_reviewed)된 것 중에서 랜덤으로 가져오기
router.get('/questions', authenticateToken, async (req, res) => {
  try {
    const result = await db.query(`
      SELECT id, question AS text, category AS subject
      FROM seed_questions
      WHERE review_stage = 'final_reviewed'
      ORDER BY RANDOM()
      LIMIT 16
    `);

    if (result.rows.length < 16) {
      return res.status(404).json({
        message: '검토 완료된 질문이 16개 미만이라 올림픽을 시작할 수 없습니다',
        available: result.rows.length,
      });
    }

    res.json({ questions: result.rows });
  } catch (error) {
    console.error('올림픽 질문 조회 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  }
});

// ── POST /api/olympic/complete ────────────────────────────────────
// 올림픽 완주 기록 저장 + 송이 지급
router.post('/complete', authenticateToken, async (req, res) => {
  const userId = req.user?.userId || req.user?.id;
  const { winnerId, winnerText, winnerSubject, winnerType, roundsData } = req.body;
  // roundsData: [
  //   { roundNumber: 0, roundLabel: '8강', questions: [{id, text, subject, type, selected}] },
  //   { roundNumber: 1, roundLabel: '4강', questions: [...] },
  //   { roundNumber: 2, roundLabel: '결승', questions: [...] },
  // ]

  try {
    // 1. 세션 생성
    const sessionResult = await db.query(
      `INSERT INTO olympic_sessions
        (user_id, winner_question_id, winner_question_text, winner_subject, winner_type, songi_awarded)
       VALUES ($1, $2, $3, $4, $5, 5)
       RETURNING id`,
      [userId, winnerId, winnerText, winnerSubject || null, winnerType || null]
    );
    const sessionId = sessionResult.rows[0].id;
    console.log('세션 저장 완료, sessionId:', sessionId);

    // 2. 라운드별 노출/선택 기록
    if (roundsData && Array.isArray(roundsData)) {
      for (const round of roundsData) {
        for (const q of round.questions) {
          await db.query(
            `INSERT INTO olympic_rounds
              (session_id, round_number, round_label, question_id, question_text, subject, question_type, exposed, selected)
             VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)`,
            [sessionId, round.roundNumber, round.roundLabel,
             q.id, q.text, q.subject || null, q.type || null, q.selected || false]
          );
        }
      }
    }

    // 3. 4강 선택 질문 → saved_questions 자동 저장
    if (roundsData && Array.isArray(roundsData)) {
      const semifinalRound = roundsData.find(r => r.roundNumber === 1); // 4강
      if (semifinalRound) {
        const selectedQs = semifinalRound.questions.filter(q => q.selected);
        for (const q of selectedQs) {
          // 중복 저장 방지
          const exists = await db.query(
            `SELECT id FROM saved_questions WHERE user_id = $1 AND question_id = $2 AND source_type = 'olympic'`,
            [userId, q.id]
          );
          if (exists.rows.length === 0) {
            await db.query(
              `INSERT INTO saved_questions (user_id, question_id, question_type, source_type, source_id)
               VALUES ($1, $2, 'olympic', 'olympic', $3)`,
              [userId, q.id, sessionId]
            );
          }
        }
      }
    }

    // 4. 송이 지급 (+5)
    await db.query(
      `UPDATE users SET songi_count = COALESCE(songi_count, 0) + 5 WHERE id = $1`,
      [userId]
    );

    // 4. 현재 송이 잔액 조회
    const userResult = await db.query(
      `SELECT songi_count FROM users WHERE id = $1`, [userId]
    );
    const currentSongi = userResult.rows[0]?.songi_count || 0;

    res.json({
      success: true,
      sessionId,
      songiAwarded: 5,
      currentSongi,
      message: '올림픽 완주 기록 저장 완료!'
    });

  } catch (err) {
    console.error('olympic/complete 오류:', err);
    res.status(500).json({ error: '저장 중 오류가 발생했습니다' });
  }
});

// ── GET /api/olympic/question-scores ─────────────────────────────
// 특정 질문들의 가중치 기반 점수 및 전체 순위 조회
// query: ?ids=1,2,3,4
router.get('/question-scores', authenticateToken, async (req, res) => {
  try {
    const { ids } = req.query;
    const questionIds = ids ? ids.split(',').map(Number).filter(Boolean) : [];

    // 전체 질문 점수 집계 (가중치: 결승=1000, 4강=100, 8강=10, 16강=1)
    const allScores = await db.query(`
      SELECT
        question_id,
        question_text,
        SUM(
          CASE round_number
            WHEN 3 THEN 1000
            WHEN 2 THEN 100
            WHEN 1 THEN 10
            WHEN 0 THEN 1
            ELSE 1
          END
        ) AS total_score,
        COUNT(DISTINCT session_id) AS participant_count,
        SUM(CASE WHEN selected THEN 1 ELSE 0 END) AS selected_count
      FROM olympic_rounds
      WHERE selected = TRUE
      GROUP BY question_id, question_text
      ORDER BY total_score DESC
    `);

    // 전체 순위 매기기
    const ranked = allScores.rows.map((row, i) => ({
      questionId: row.question_id,
      questionText: row.question_text,
      totalScore: parseInt(row.total_score),
      participantCount: parseInt(row.participant_count),
      selectedCount: parseInt(row.selected_count),
      rank: i + 1,
    }));

    // 요청한 질문들만 필터
    const requested = questionIds.length > 0
      ? ranked.filter(r => questionIds.includes(r.questionId))
      : ranked;

    // 전체 참여자 수 (세션 수)
    const totalSessions = await db.query(
      `SELECT COUNT(DISTINCT session_id) AS cnt FROM olympic_rounds`
    );
    const totalParticipants = parseInt(totalSessions.rows[0]?.cnt || 0);

    res.json({
      scores: requested,
      totalParticipants,
      totalRanked: ranked.length,
    });

  } catch (err) {
    console.error('olympic/question-scores 오류:', err);
    res.status(500).json({ error: '점수 조회 오류' });
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
  const userId = req.user?.userId || req.user?.id;
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
