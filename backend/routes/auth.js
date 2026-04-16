const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

// 회원가입
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // 유효성 검사
    if (!username || !password) {
      return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요' });
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

    // 사용자 생성
    const result = await pool.query(
      'INSERT INTO users (username, password_hash, songi_count) VALUES ($1, $2, 0) RETURNING id, username, songi_count, created_at',
      [username, hashedPassword]
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
        songi_count: user.songi_count
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

    // 유효성 검사
    if (!username || !password) {
      return res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요' });
    }

    // 사용자 찾기
    const result = await pool.query(
      'SELECT id, username, password_hash, songi_count FROM users WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 잘못되었습니다' });
    }

    const user = result.rows[0];

    // 비밀번호 확인
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: '아이디 또는 비밀번호가 잘못되었습니다' });
    }

    // JWT 토큰 생성
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

module.exports = router;