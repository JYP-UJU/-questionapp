// routes/consent.js
// 동의서 제출을 기록하고, 미성년자 동의서는 보호자 전달용 인증코드를 발급합니다.
//
// [연결 방법]
// 1. 이 파일을 backend/routes/consent.js 로 저장하세요.
// 2. 아래 db 연결 부분(require('../db'))을 questions.js, users.js 등 기존 라우트 파일에서
//    쓰고 있는 db 연결 방식과 동일하게 맞춰주세요. 예를 들어 다른 파일에서
//    `const pool = require('../db');` 를 쓰고 있다면 그대로 두시면 됩니다.
//    만약 db 연결 모듈이 없고 각 라우트 파일마다 직접 pg.Pool을 만들고 있다면,
//    아래 주석 처리된 대체 코드를 사용하세요.
// 3. server.js에 아래 한 줄을 추가하세요:
//      app.use('/api/consent', require('./routes/consent'));

const express = require('express');
const router = express.Router();

const pool = require('../db');

// --- db 연결 모듈이 따로 없는 경우, 위 줄을 지우고 아래 주석을 해제해서 쓰세요 ---
// const { Pool } = require('pg');
// const pool = new Pool({
//   connectionString: process.env.DATABASE_URL,
//   ssl: { rejectUnauthorized: false }
// });

// 헷갈리기 쉬운 O/0, I/1/L 을 제외한 문자로 코드 생성 (예: A123)
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ';

function generateCode() {
  const letter = CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)];
  const digits = String(Math.floor(Math.random() * 900) + 100); // 100~999
  return letter + digits;
}

async function generateUniqueCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCode();
    const existing = await pool.query(
      'SELECT 1 FROM consent_submissions WHERE code = $1 LIMIT 1',
      [code]
    );
    if (existing.rowCount === 0) return code;
  }
  throw new Error('코드 생성에 반복적으로 실패했습니다.');
}

// 미성년자 동의서(1_consent_minor.html) 제출
// body: { checks: [boolean, boolean, boolean, boolean, boolean, boolean] } (6개 항목, 문항 순서대로)
router.post('/minor-submit', async (req, res) => {
  try {
    const { checks } = req.body;

    if (!Array.isArray(checks) || checks.length !== 6 || checks.some((c) => c !== true)) {
      return res.status(400).json({ error: '모든 동의 항목을 체크해야 제출할 수 있어요.' });
    }

    const code = await generateUniqueCode();

    await pool.query(
      `INSERT INTO consent_submissions (consent_type, code, checks)
       VALUES ($1, $2, $3)`,
      ['minor', code, JSON.stringify(checks)]
    );

    res.json({ code });
  } catch (err) {
    console.error('[consent] minor-submit error:', err);
    res.status(500).json({ error: '서버 오류로 처리하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
});

// 보호자 동의서(3_consent_guardian.html) 제출
// body: { code, checks: boolean[8], contact_name, contact_phone, contact_email, student_name }
// - code가 있으면 미성년자 동의서 제출 기록과 연결됩니다 (같은 code 값으로 조회 가능).
router.post('/guardian-submit', async (req, res) => {
  try {
    const { code, checks, contact_name, contact_phone, contact_email, student_name } = req.body;

    if (!Array.isArray(checks) || checks.length === 0 || checks.some((c) => c !== true)) {
      return res.status(400).json({ error: '모든 동의 항목을 체크해야 제출할 수 있어요.' });
    }

    await pool.query(
      `INSERT INTO consent_submissions
         (consent_type, code, checks, contact_name, contact_phone, contact_email, student_name)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      ['guardian', code || null, JSON.stringify(checks), contact_name || null, contact_phone || null, contact_email || null, student_name || null]
    );

    res.json({ ok: true });
  } catch (err) {
    console.error('[consent] guardian-submit error:', err);
    res.status(500).json({ error: '서버 오류로 처리하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
});

module.exports = router;
