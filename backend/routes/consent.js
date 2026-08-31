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
const nodemailer = require('nodemailer');

const pool = require('../db');

// --- 이메일 발송 설정 (Gmail 앱 비밀번호 사용) ---
// Railway 환경변수에 GMAIL_USER, GMAIL_APP_PASSWORD 등록 필요
const mailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD
  }
});

// 보호자 동의서(3_consent_guardian.html)의 8개 항목 원문 (이메일에 그대로 인용)
const GUARDIAN_CONSENT_ITEMS = [
  '나는 이 설명서를 읽었으며, 연구의 목적과 절차에 대해 충분히 이해하였습니다.',
  '나는 위험과 이득에 관하여 설명을 들었으며, 나의 질문에 만족할 만한 답변을 얻었습니다.',
  '나는 자녀의 연구 참여에 자발적으로 동의합니다.',
  '나는 연구 과정에서 수집된 자녀의 정보를 현행 법률과 목포대학교 생명윤리심의위원회 규정이 허용하는 범위 내에서 연구자가 수집하고 처리하는 데 동의합니다.',
  '나는 담당 연구자, 목포대학교 생명윤리심의위원회가 연구의 실태 조사를 위해 필요한 경우 연구 자료를 열람할 수 있음에 동의합니다.',
  '나는 언제라도 자녀의 연구 참여를 철회할 수 있고, 이러한 결정이 어떠한 불이익도 되지 않을 것임을 이해합니다.',
  '나는 연구 종료 후 3년간 자료가 보관된 후 안전하게 폐기될 것임을 알고 있습니다.',
  '나는 연구 참여 도중 발생할 수 있는 피해 및 분쟁 시 연구책임자(que.jypark@gmail.com)에게 연락할 수 있음을 알고 있습니다.'
];

// 제출된 동의서 내용을 텍스트로 정리해서 보호자 이메일로 발송
// 발송 실패해도 던지지 않고 콘솔에만 남김 (동의서 저장 자체를 막으면 안 되므로)
async function sendGuardianConfirmationEmail({ to, contact_name, student_name, contact_phone, checks }) {
  if (!to) return;
  if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
    console.error('[consent] GMAIL_USER/GMAIL_APP_PASSWORD 환경변수가 설정되지 않아 이메일을 보내지 못했습니다.');
    return;
  }

  const now = new Date();
  const dateStr = `${now.getFullYear()}. ${now.getMonth() + 1}. ${now.getDate()}.`;

  const itemsText = GUARDIAN_CONSENT_ITEMS
    .map((text, i) => `${i + 1}. [${checks[i] ? '동의함' : '미동의'}] ${text}`)
    .join('\n');

  const bodyText =
`${contact_name} 보호자님, 물음송이 연구 참여 동의서 제출이 확인되었습니다.

■ 제출 정보
- 자녀 성명: ${student_name || '-'}
- 보호자 연락처: ${contact_phone || '-'}
- 제출 일시: ${dateStr}

■ 동의 항목 (연구대상자 동의서)
${itemsText}

이 이메일은 제출하신 동의서 사본으로, 보관용으로 저장해 두시기 바랍니다.
문의사항은 연구책임자(박지영, que.jypark@gmail.com)에게 연락해 주세요.

- 물음송이 연구팀 -`;

  try {
    await mailTransporter.sendMail({
      from: `"물음송이 연구팀" <${process.env.GMAIL_USER}>`,
      to,
      subject: '[물음송이] 보호자 동의서 제출 확인',
      text: bodyText
    });
  } catch (err) {
    console.error('[consent] 확인 이메일 발송 실패:', err.message);
  }
}

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

    // 확인 이메일 발송 (실패해도 제출 자체는 성공으로 응답)
    sendGuardianConfirmationEmail({
      to: contact_email,
      contact_name,
      student_name,
      contact_phone,
      checks
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('[consent] guardian-submit error:', err);
    res.status(500).json({ error: '서버 오류로 처리하지 못했어요. 잠시 후 다시 시도해 주세요.' });
  }
});

module.exports = router;
