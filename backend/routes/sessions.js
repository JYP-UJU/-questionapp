const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');

// 관리자 확인 미들웨어 (admin.js와 동일한 패턴)
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

// 세션 시작 (앱 진입/로그인 시 호출)
router.post('/start', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;

    const result = await pool.query(
      `INSERT INTO user_sessions (user_id, started_at, last_active_at)
       VALUES ($1, NOW(), NOW())
       RETURNING id`,
      [userId]
    );

    res.json({ session_id: result.rows[0].id });

  } catch (error) {
    console.error('세션 시작 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 하트비트 (프론트에서 30초~1분마다 호출, "아직 보고 있어요" 신호)
router.post('/heartbeat', authenticateToken, async (req, res) => {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id가 필요합니다' });
    }

    await pool.query(
      `UPDATE user_sessions SET last_active_at = NOW() WHERE id = $1`,
      [session_id]
    );

    res.json({ ok: true });

  } catch (error) {
    console.error('하트비트 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 세션 종료 (탭 닫기/명시적 로그아웃 시 호출 - beacon 등으로)
router.post('/end', authenticateToken, async (req, res) => {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'session_id가 필요합니다' });
    }

    await pool.query(
      `UPDATE user_sessions SET ended_at = NOW(), last_active_at = NOW() WHERE id = $1`,
      [session_id]
    );

    res.json({ ok: true });

  } catch (error) {
    console.error('세션 종료 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 세션 종료 (sendBeacon 전용 - 탭 닫을 때는 커스텀 헤더를 못 붙이므로 인증 없이 session_id만으로 처리)
// session_id는 추측이 사실상 불가능한 내부 숫자이고, 여기서 할 수 있는 일은
// "이미 존재하는 세션의 종료시각 기록"뿐이라 위험도가 낮음
router.post('/end-beacon', async (req, res) => {
  try {
    let session_id = req.body?.session_id;
    // sendBeacon이 text/plain으로 보낼 경우 body-parser가 파싱 못 할 수 있어 대비
    if (!session_id && typeof req.body === 'string') {
      try { session_id = JSON.parse(req.body).session_id; } catch (e) {}
    }
    if (!session_id) {
      return res.status(400).json({ error: 'session_id가 필요합니다' });
    }

    await pool.query(
      `UPDATE user_sessions SET ended_at = NOW(), last_active_at = NOW() WHERE id = $1`,
      [session_id]
    );

    res.json({ ok: true });
  } catch (error) {
    console.error('세션 종료(beacon) 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// ===== 관리자용: 사용자별 세션(체류시간) 목록 조회 =====
// 하트비트가 30초~1분 간격이라는 전제 하에, last_active_at을 실질적 종료 시각으로 간주해
// (하트비트 없이 종료된 세션도 포함해) 체류시간 = last_active_at - started_at 으로 계산
router.get('/admin/list', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        s.id, s.user_id, u.username, s.started_at, s.last_active_at, s.ended_at,
        EXTRACT(EPOCH FROM (COALESCE(s.ended_at, s.last_active_at) - s.started_at)) AS duration_seconds
       FROM user_sessions s
       JOIN users u ON s.user_id = u.id
       ORDER BY s.started_at DESC
       LIMIT 500`
    );

    res.json({ sessions: result.rows });

  } catch (error) {
    console.error('세션 목록 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// ===== 관리자용: 사용자별 평균/누적 체류시간 요약 =====
router.get('/admin/summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        u.id AS user_id, u.username,
        COUNT(s.id) AS session_count,
        ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(s.ended_at, s.last_active_at) - s.started_at)))) AS avg_duration_seconds,
        ROUND(SUM(EXTRACT(EPOCH FROM (COALESCE(s.ended_at, s.last_active_at) - s.started_at)))) AS total_duration_seconds,
        MAX(s.started_at) AS last_visit
       FROM users u
       LEFT JOIN user_sessions s ON s.user_id = u.id
       GROUP BY u.id, u.username
       ORDER BY total_duration_seconds DESC NULLS LAST`
    );

    res.json({ summary: result.rows });

  } catch (error) {
    console.error('세션 요약 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
