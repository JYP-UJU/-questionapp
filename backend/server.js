const express = require('express');
const cors = require('cors');
const compression = require('compression');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// 미들웨어
app.use(compression()); // 응답 gzip 압축 (DB 무관, 목록 로딩 속도 개선용)
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
const consentRoutes = require('./routes/consent');

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
app.use('/api/consent', consentRoutes);

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

// 연구 참여 동의서 6종 (public/consent 폴더에 넣어두면 /consent/파일명.html 로 접근 가능)
app.use('/consent', express.static(path.join(__dirname, 'public', 'consent')));

// 랜딩 페이지 + 안내 페이지 (public/landing 폴더에 넣어두면 /land/파일명.html 로 접근 가능)
app.use('/land', express.static(path.join(__dirname, 'public', 'landing')));

// 짧은 링크 별칭 (안내 문구/문자 발송 시 이 짧은 경로로 안내하세요)
app.get('/g', (req, res) => res.redirect('/land/muleumsongi-guide.html'));      // 안내 페이지
app.get('/l', (req, res) => res.redirect('/land/muleumsongi-landing.html'));    // 랜딩 페이지
app.get('/i', (req, res) => res.redirect('/land/muleumsongi-invite.html'));     // 초대장(카톡 발송용 링크 모음, 학부모용)
app.get('/ik', (req, res) => res.redirect('/land/muleumsongi-invite-kids.html')); // 초대장(초등학생 친구들에게 직접 말 거는 버전)
app.get('/c1', (req, res) => res.redirect('/consent/1_consent_minor.html'));               // 미성년자 동의
app.get('/c2', (req, res) => res.redirect('/consent/2_consent_minor_interview.html'));     // 미성년자 인터뷰 동의
app.get('/c3', (req, res) => res.redirect('/consent/3_consent_guardian.html' + (req.query.code ? ('?code=' + req.query.code) : ''))); // 보호자 동의
app.get('/c4', (req, res) => res.redirect('/consent/4_consent_guardian_interview.html' + (req.query.code ? ('?code=' + req.query.code) : ''))); // 보호자 인터뷰 동의
app.get('/c5', (req, res) => res.redirect('/consent/5_consent_adult.html'));               // 성인 동의
app.get('/c6', (req, res) => res.redirect('/consent/6_consent_adult_interview.html'));     // 성인 인터뷰 동의

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
