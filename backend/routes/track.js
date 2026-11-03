const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');

// ===== 로그인 전 방문 기록 (익명) =====
// 저장하는 것: 화면 이름, 브라우저 임의 번호(anon_id), 유입 출처, 기기/브라우저 종류,
//             IP를 해시한 값(되돌릴 수 없음), 머문 시간, 스크롤 깊이, 누른 링크
// 저장하지 않는 것: 이름, 연락처, 원본 IP
// ⚠️ DB에 page_visits 테이블이 필요함 (add_page_visits.sql)

const SALT = process.env.VISIT_HASH_SALT || process.env.JWT_SECRET || 'muleumsongi-visit';
const BOT_RE = /bot|crawl|spider|slurp|facebookexternalhit|kakaotalk-scrap|preview|headless|lighthouse|monitor|curl|wget|python|node-fetch/i;
const ID_RE = /^[A-Za-z0-9]{8,40}$/;

const requireAdmin = async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    const r = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (!r.rows[0]?.is_admin) return res.status(403).json({ error: '관리자 권한이 필요합니다' });
    next();
  } catch (e) { res.status(500).json({ error: '서버 오류' }); }
};

const clean = (v, n) => (typeof v === 'string' ? v.slice(0, n) : null);

const classifyBrowser = (ua) => {
  if (/KAKAOTALK/i.test(ua)) return '카카오톡';
  if (/NAVER|whale/i.test(ua)) return '네이버';
  if (/Instagram/i.test(ua)) return '인스타그램';
  if (/FBAN|FBAV/i.test(ua)) return '페이스북';
  if (/Line\//i.test(ua)) return '라인';
  if (/SamsungBrowser/i.test(ua)) return '삼성인터넷';
  if (/Edg\//i.test(ua)) return '엣지';
  if (/CriOS|Chrome/i.test(ua)) return '크롬';
  if (/Safari/i.test(ua)) return '사파리';
  return '기타';
};

const ipHash = (req) => {
  const raw = ((req.headers['x-forwarded-for'] || req.socket.remoteAddress || '') + '').split(',')[0].trim();
  if (!raw) return null;
  return crypto.createHmac('sha256', SALT).update(raw).digest('hex').slice(0, 16);
};

// 화면을 열었을 때
router.post('/visit', async (req, res) => {
  try {
    const ua = req.headers['user-agent'] || '';
    if (BOT_RE.test(ua)) return res.json({ ok: true });
    const b = req.body || {};
    if (!ID_RE.test(b.visit_id || '') || !ID_RE.test(b.anon_id || '')) return res.json({ ok: false });
    const page = clean(b.page, 60);
    if (!page) return res.json({ ok: false });

    await pool.query(
      `INSERT INTO page_visits (visit_id, anon_id, page, src, referrer_host, browser, device, ip_hash)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (visit_id) DO NOTHING`,
      [
        b.visit_id, b.anon_id, page, clean(b.src, 40), clean(b.referrer_host, 120),
        classifyBrowser(ua), /Mobi|Android|iPhone|iPad/i.test(ua) ? 'mobile' : 'desktop', ipHash(req),
      ]
    );
    res.json({ ok: true });
  } catch (e) {
    console.error('방문 기록 오류:', e.message);
    res.json({ ok: false });
  }
});

// 화면을 떠나거나 숨길 때 (머문 시간, 스크롤)
router.post('/leave', async (req, res) => {
  try {
    let b = req.body || {};
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
    if (!ID_RE.test(b.visit_id || '')) return res.json({ ok: false });
    const sec = Math.max(0, Math.min(parseInt(b.duration_seconds) || 0, 6 * 3600));
    const scroll = Math.max(0, Math.min(parseInt(b.max_scroll_pct) || 0, 100));
    await pool.query(
      `UPDATE page_visits
       SET duration_seconds = GREATEST(COALESCE(duration_seconds,0), $2),
           max_scroll_pct = GREATEST(COALESCE(max_scroll_pct,0), $3)
       WHERE visit_id = $1`,
      [b.visit_id, sec, scroll]
    );
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false }); }
});

// 링크를 눌렀을 때 (어디로 넘어가려 했는지)
router.post('/click', async (req, res) => {
  try {
    let b = req.body || {};
    if (typeof b === 'string') { try { b = JSON.parse(b); } catch (e) { b = {}; } }
    const target = clean(b.target, 60);
    if (!ID_RE.test(b.visit_id || '') || !target) return res.json({ ok: false });
    await pool.query(
      `UPDATE page_visits
       SET clicks = CASE
         WHEN clicks IS NULL OR clicks = '' THEN $2
         WHEN position($2 IN clicks) > 0 THEN clicks
         ELSE LEFT(clicks || ',' || $2, 300) END
       WHERE visit_id = $1`,
      [b.visit_id, target]
    );
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false }); }
});

// ===== 관리자용 요약 =====
router.get('/admin/summary', authenticateToken, requireAdmin, async (req, res) => {
  try {
    const days = Math.max(1, Math.min(parseInt(req.query.days) || 7, 90));
    const pages = await pool.query(
      `SELECT page,
              COUNT(*)::int AS views,
              COUNT(DISTINCT anon_id)::int AS visitors,
              COUNT(DISTINCT ip_hash)::int AS ip_visitors,
              ROUND(AVG(NULLIF(duration_seconds,0)))::int AS avg_seconds,
              ROUND(AVG(max_scroll_pct))::int AS avg_scroll,
              (COUNT(*) FILTER (WHERE device = 'mobile'))::int AS mobile,
              (COUNT(*) FILTER (WHERE clicks IS NOT NULL AND clicks <> ''))::int AS clicked,
              (COUNT(*) FILTER (WHERE COALESCE(duration_seconds,0) < 5))::int AS bounced
       FROM page_visits
       WHERE started_at > NOW() - make_interval(days => $1::int)
       GROUP BY page ORDER BY views DESC`, [days]);
    const browsers = await pool.query(
      `SELECT browser AS name, COUNT(DISTINCT anon_id)::int AS n FROM page_visits
       WHERE started_at > NOW() - make_interval(days => $1::int) GROUP BY browser ORDER BY n DESC`, [days]);
    const sources = await pool.query(
      `SELECT COALESCE(NULLIF(src,''), NULLIF(referrer_host,''), '(직접/알 수 없음)') AS name,
              COUNT(DISTINCT anon_id)::int AS n
       FROM page_visits WHERE started_at > NOW() - make_interval(days => $1::int)
       GROUP BY 1 ORDER BY n DESC LIMIT 10`, [days]);
    const total = await pool.query(
      `SELECT COUNT(DISTINCT anon_id)::int AS visitors, COUNT(DISTINCT ip_hash)::int AS ip_visitors
       FROM page_visits WHERE started_at > NOW() - make_interval(days => $1::int)`, [days]);
    res.json({ days, pages: pages.rows, browsers: browsers.rows, sources: sources.rows, total: total.rows[0] });
  } catch (e) {
    console.error('방문 요약 오류:', e);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
