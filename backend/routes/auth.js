const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const authenticateToken = require('../middleware/auth');

// 부모-자녀 매칭용 코드 생성: 알파벳 1자리(헷갈리는 O,I,L 제외) + 숫자 3자리
const LINK_CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ'; // O, I, L 제외 (23자)

function generateRawLinkCode() {
  const letter = LINK_CODE_LETTERS[Math.floor(Math.random() * LINK_CODE_LETTERS.length)];
  const digits = String(Math.floor(Math.random() * 1000)).padStart(3, '0');
  return `${letter}${digits}`;
}

// DB에서 중복 없는 코드가 나올 때까지 재시도 (23*1000=23,000가지라 150명 규모엔 충분)
async function generateUniqueLinkCode() {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateRawLinkCode();
    const existing = await pool.query('SELECT id FROM users WHERE link_code = $1', [code]);
    if (existing.rows.length === 0) return code;
  }
  throw new Error('링크 코드 생성 실패 (재시도 초과)');
}

// 회원가입
router.post('/register', async (req, res) => {
  try {
    const { username, password, grade } = req.body;

    // 유효성 검사
    if (!username || !password) {
      return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요' });
    }
    if (!grade) {
      return res.status(400).json({ error: '학년을 선택해주세요' });
    }
    if (username.length < 3) {
      return res.status(400).json({ error: '아이디는 3글자 이상이어야 합니다' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: '비밀번호는 4글자 이상이어야 합니다' });
    }

    // 중복 체크
    const existingUser = await pool.query(
      'SELECT id FROM users WHERE username = $1',
      [username]
    );
    if (existingUser.rows.length > 0) {
      return res.status(400).json({ error: '이미 사용 중인 아이디입니다' });
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);

    // 부모-자녀 매칭용 코드 생성 (가입 시 딱 1번만 생성되고 이후 고정됨)
    const linkCode = await generateUniqueLinkCode();

    // 사용자 생성 (grade, link_code 포함, 실명은 더 이상 수집하지 않음)
    const result = await pool.query(
      `INSERT INTO users (username, password_hash, grade, research_agreed, songi_count, link_code)
       VALUES ($1, $2, $3, true, 0, $4)
       RETURNING id, username, songi_count, link_code, created_at`,
      [username, hashedPassword, grade, linkCode]
    );

    const user = result.rows[0];

    // JWT 토큰 생성
    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: '회원가입 성공!',
      token,
      user: {
        id: user.id,
        username: user.username,
        songi_count: user.songi_count,
        link_code: user.link_code
      }
    });

  } catch (error) {
    console.error('회원가입 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 로그인
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요' });
    }

    const result = await pool.query(
      'SELECT id, username, password_hash, songi_count FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 잘못되었습니다' });
    }

    const user = result.rows[0];

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 잘못되었습니다' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: '로그인 성공!',
      token,
      user: {
        id: user.id,
        username: user.username,
        songi_count: user.songi_count
      }
    });

  } catch (error) {
    console.error('로그인 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 내 링크 코드 다시 보기 (재생성 없이 가입 시 저장된 값 그대로 반환)
router.get('/link-code', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const result = await pool.query('SELECT link_code FROM users WHERE id = $1', [userId]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    }
    res.json({ link_code: result.rows[0].link_code });
  } catch (error) {
    console.error('링크 코드 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
