const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// 미들웨어
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 라우트
const authRoutes = require('./routes/auth');
const questionsRoutes = require('./routes/questions');
const reactionsRoutes = require('./routes/reactions');
const followupRoutes = require('./routes/followup');
const rankingRoutes = require('./routes/ranking');
const usersRoutes = require('./routes/users');
const quizRoutes = require('./routes/quiz');
const savedRoutes = require('./routes/saved');
const reportsRoutes = require('./routes/reports');
const adminRoutes = require('./routes/admin');
const olympicRoutes = require('./routes/olympic');
const notificationsRoutes = require('./routes/notifications');
const sessionsRoutes = require('./routes/sessions');

app.use('/api/auth', authRoutes);
app.use('/api/questions', questionsRoutes);
app.use('/api/reactions', reactionsRoutes);
app.use('/api/followup', followupRoutes);
app.use('/api/ranking', rankingRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/quiz', quizRoutes);
app.use('/api/saved', savedRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/olympic', olympicRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/sessions', sessionsRoutes);

// 기본 라우트
app.get('/', (req, res) => {
  res.json({
    message: '물음송이 API 서버 🌸',
    version: '2.0.0',
    endpoints: {
      auth: '/api/auth',
      questions: '/api/questions',
      reactions: '/api/reactions',
      followup: '/api/followup',
      ranking: '/api/ranking',
      users: '/api/users',
      quiz: '/api/quiz',
      saved: '/api/saved',
      olympic: '/api/olympic'
    }
  });
});
const path = require('path');

app.get('/consent/student', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'student_info.html'));
});

app.get('/consent/parent', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'parent_consent.html'));
});

// 404 에러 핸들링
app.use((req, res) => {
  res.status(404).json({ error: '요청한 엔드포인트를 찾을 수 없습니다' });
});

// 에러 핸들링 미들웨어
app.use((err, req, res, next) => {
  console.error('서버 에러:', err);
  res.status(500).json({ error: '서버 내부 오류가 발생했습니다' });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`🚀 물음송이 서버가 포트 ${PORT}에서 실행 중입니다`);
  console.log(`📡 API: http://localhost:${PORT}`);
  console.log(`🌸 물음송이 v2.0.0`);
});

module.exports = app;
