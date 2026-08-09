const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');

// ===== 주간 리포트 데이터 생성 (실시간 집계) =====
router.get('/weekly', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    
    // 주차 계산: week 파라미터 없으면 이번 주
    let weekStart, weekEnd;
    
    if (req.query.start && req.query.end) {
      weekStart = req.query.start;
      weekEnd = req.query.end;
    } else {
      // 이번 주 월요일 ~ 일요일
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=일, 1=월, ...
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      monday.setHours(0, 0, 0, 0);
      
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      
      weekStart = monday.toISOString();
      weekEnd = sunday.toISOString();
    }

    // 1. 만든 질문 수
    const questionsResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM user_questions 
       WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3
       AND parent_question_id IS NULL AND related_seed_question_id IS NULL`,
      [userId, weekStart, weekEnd]
    );

    // 2. 남긴 의견 수
    const opinionsResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM question_opinions 
       WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [userId, weekStart, weekEnd]
    );

    // 3. 반응(좋아요/싫어요) 수
    const reactionsResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM question_reactions 
       WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [userId, weekStart, weekEnd]
    );
// 3-1. 이번 주 만든 질문 목록
const questionsListResult = await pool.query(
  `SELECT id, title, created_at,
    COALESCE(likes_count, 0) as likes,
    (SELECT COUNT(*) FROM question_opinions 
     WHERE question_id = uq.id 
     AND question_type IN ('user_question', 'user', 'my_question', 'friend_question')) as opinion_count
   FROM user_questions uq
   WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3
   AND parent_question_id IS NULL AND related_seed_question_id IS NULL
   ORDER BY created_at DESC`,
  [userId, weekStart, weekEnd]
);

// 3-2. 이번 주 남긴 의견 목록
const opinionsListResult = await pool.query(
  `SELECT qo.opinion as content, qo.created_at,
    COALESCE(uq.title, sq.question) as question_title
   FROM question_opinions qo
   LEFT JOIN user_questions uq ON qo.question_id = uq.id AND qo.question_type IN ('user_question', 'friend_question', 'user')
   LEFT JOIN seed_questions sq ON qo.question_id = sq.id AND qo.question_type IN ('seed', 'quiz', 'icebreaking')
   WHERE qo.user_id = $1 AND qo.created_at >= $2 AND qo.created_at <= $3
   ORDER BY qo.created_at DESC`,
  [userId, weekStart, weekEnd]
);
// 3-3. 좋아요/싫어요 목록
    const reactionsListResult = await pool.query(
      `SELECT qr.reaction_type,
        COALESCE(uq.title, sq.question) as question_title
       FROM question_reactions qr
       LEFT JOIN user_questions uq ON qr.question_id = uq.id AND qr.question_type IN ('user_question', 'friend_question', 'user')
       LEFT JOIN seed_questions sq ON qr.question_id = sq.id AND qr.question_type IN ('seed', 'quiz', 'icebreaking')
       WHERE qr.user_id = $1 AND qr.created_at >= $2 AND qr.created_at <= $3
       ORDER BY qr.created_at DESC`,
      [userId, weekStart, weekEnd]
    );

    // 3-4. 관련질문 목록
    const relatedListResult = await pool.query(
      `SELECT uq.id, uq.title, uq.created_at,
        COALESCE(pq.title, sq.question) as parent_title
       FROM user_questions uq
       LEFT JOIN user_questions pq ON uq.parent_question_id = pq.id
       LEFT JOIN seed_questions sq ON uq.related_seed_question_id = sq.id
       WHERE uq.user_id = $1 
       AND (uq.parent_question_id IS NOT NULL OR uq.related_seed_question_id IS NOT NULL)
       AND uq.created_at >= $2 AND uq.created_at <= $3
       ORDER BY uq.created_at DESC`,
      [userId, weekStart, weekEnd]
    );

    // 저장한 질문 항목 제거됨

    // 3-6. 퀴즈 완료 목록
    const quizListResult = await pool.query(
      `SELECT sq.question, qr.is_correct, qr.created_at
       FROM quiz_responses qr
       JOIN seed_questions sq ON qr.question_id = sq.id
       WHERE qr.user_id = $1 AND qr.created_at >= $2 AND qr.created_at <= $3
       ORDER BY qr.created_at DESC`,
      [userId, weekStart, weekEnd]
    );

    // 저장한 질문 수 제거됨

    // 5. 퀴즈 완료 수 (5문제 = 1회)
    let quizCount = 0;
    try {
      const quizResult = await pool.query(
        `SELECT COUNT(*) as cnt FROM quiz_responses 
         WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3`,
        [userId, weekStart, weekEnd]
      );
      quizCount = Math.floor(parseInt(quizResult.rows[0].cnt) / 5);
    } catch (e) {
      quizCount = 0;
    }

    // 6. 관련질문 수 (parent_question_id가 있는 질문)
    const relatedResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM user_questions 
       WHERE user_id = $1 
       AND (parent_question_id IS NOT NULL OR related_seed_question_id IS NOT NULL)
       AND created_at >= $2 AND created_at <= $3`,
      [userId, weekStart, weekEnd]
    );

    // 7. 이번 주 내 인기 질문 TOP 3
    const topQuestionsResult = await pool.query(
      `SELECT uq.id, uq.title, 
        COALESCE(uq.likes_count, 0) as likes,
        (SELECT COUNT(*) FROM question_opinions 
         WHERE question_id = uq.id 
         AND question_type IN ('user_question', 'user', 'my_question', 'friend_question')) as opinion_count
       FROM user_questions uq
       WHERE uq.user_id = $1 AND uq.created_at >= $2 AND uq.created_at <= $3
         AND uq.parent_question_id IS NULL AND uq.related_seed_question_id IS NULL
       ORDER BY COALESCE(uq.likes_count, 0) + 
         (SELECT COUNT(*) FROM question_opinions 
          WHERE question_id = uq.id 
          AND question_type IN ('user_question', 'user', 'my_question', 'friend_question')) DESC
       LIMIT 3`,
      [userId, weekStart, weekEnd]
    );

    // 8. 요일별 활동 (만든 질문 기준)
    const dailyResult = await pool.query(
      `SELECT EXTRACT(DOW FROM created_at) as day_of_week, COUNT(*) as cnt
       FROM user_questions
       WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3
       GROUP BY EXTRACT(DOW FROM created_at)
       ORDER BY day_of_week`,
      [userId, weekStart, weekEnd]
    );

    // 9. 지난 주 비교 데이터
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(weekEnd);
    prevWeekEnd.setDate(prevWeekEnd.getDate() - 7);

    const prevQuestionsResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM user_questions 
       WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [userId, prevWeekStart.toISOString(), prevWeekEnd.toISOString()]
    );

    const prevOpinionsResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM question_opinions 
       WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3`,
      [userId, prevWeekStart.toISOString(), prevWeekEnd.toISOString()]
    );

    // 10. 이번 주 돌아보기 응답 확인
    const reflectionResult = await pool.query(
      `SELECT * FROM weekly_reflections 
       WHERE user_id = $1 AND week_start = $2::date`,
      [userId, weekStart]
    );

    // 사용자 정보
    const userResult = await pool.query(
      'SELECT username, songi_count FROM users WHERE id = $1',
      [userId]
    );

    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dailyActivity = dailyResult.rows.map(r => ({
      day: dayNames[parseInt(r.day_of_week)],
      count: parseInt(r.cnt)
    }));

    // 가장 활발한 요일
    const mostActiveDay = dailyActivity.length > 0 
      ? dailyActivity.reduce((a, b) => a.count > b.count ? a : b).day + '요일'
      : null;

    res.json({
      period: {
        start: weekStart,
        end: weekEnd,
        label: formatWeekLabel(weekStart, weekEnd)
      },
      user: userResult.rows[0],
      stats: {
        questionsCreated: parseInt(questionsResult.rows[0].cnt),
        opinionsGiven: parseInt(opinionsResult.rows[0].cnt),
        reactionsGiven: parseInt(reactionsResult.rows[0].cnt),
        quizCompleted: quizCount,
        relatedQuestions: parseInt(relatedResult.rows[0].cnt),
      },
      lists: {
        questions: questionsListResult.rows,
        opinions: opinionsListResult.rows,
        reactions: reactionsListResult.rows,
        related: relatedListResult.rows,
        quiz: quizListResult.rows,
      },
      comparison: {
        prevQuestions: parseInt(prevQuestionsResult.rows[0].cnt),
        prevOpinions: parseInt(prevOpinionsResult.rows[0].cnt),
      },
      highlights: {
        topQuestions: topQuestionsResult.rows,
        mostActiveDay,
        dailyActivity
      },
      reflection: reflectionResult.rows.length > 0 ? reflectionResult.rows[0] : null
    });

  } catch (error) {
    console.error('주간 리포트 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// ===== 주간 돌아보기 저장 =====
router.post('/weekly/reflection', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { weekStart, mostCurious, didResearch, researchTopic, researchNote, funFriendQuestion, weeklyFeeling } = req.body;

    // 이미 작성했는지 확인
    const existing = await pool.query(
      'SELECT id, most_curious_question_id FROM weekly_reflections WHERE user_id = $1 AND week_start = $2::date',
      [userId, weekStart]
    );

    // "가장 궁금했던 것"을 실제 만든질문으로도 등록/동기화
    // (most_curious_question_id로 연결해두고, 재저장 시엔 새로 만들지 않고 제목만 갱신)
    let mostCuriousQuestionId = existing.rows[0]?.most_curious_question_id || null;
    const trimmedMostCurious = (mostCurious || '').trim();

    if (trimmedMostCurious) {
      if (mostCuriousQuestionId) {
        await pool.query(
          `UPDATE user_questions SET title = $1 WHERE id = $2 AND user_id = $3`,
          [trimmedMostCurious, mostCuriousQuestionId, userId]
        );
      } else {
        // 추가 송이 없이 질문만 생성 (송이는 주간일지 완료 보상에 이미 포함됨)
        const created = await pool.query(
          `INSERT INTO user_questions (user_id, title) VALUES ($1, $2) RETURNING id`,
          [userId, trimmedMostCurious]
        );
        mostCuriousQuestionId = created.rows[0].id;
      }
    }

    if (existing.rows.length > 0) {
      // 업데이트
      await pool.query(
        `UPDATE weekly_reflections SET 
          most_curious = $1, did_research = $2, research_topic = $3, 
          research_note = $4, fun_friend_question = $5, weekly_feeling = $6,
          most_curious_question_id = $7, updated_at = NOW()
         WHERE user_id = $8 AND week_start = $9::date`,
        [mostCurious, didResearch, researchTopic, researchNote, funFriendQuestion, weeklyFeeling, mostCuriousQuestionId, userId, weekStart]
      );
    } else {
      // 새로 삽입
      await pool.query(
        `INSERT INTO weekly_reflections 
          (user_id, week_start, most_curious, did_research, research_topic, research_note, fun_friend_question, weekly_feeling, most_curious_question_id)
         VALUES ($1, $2::date, $3, $4, $5, $6, $7, $8, $9)`,
        [userId, weekStart, mostCurious, didResearch, researchTopic, researchNote, funFriendQuestion, weeklyFeeling, mostCuriousQuestionId]
      );

      // 주간 일지 완료 시 새 점수 구조:
      // Q1(mostCurious, 항상 필수) = 3점
      // Q2(찾아본 활동 선택, didResearch/researchTopic) = 선택 시 +2점
      // Q3(funFriendQuestion) 또는 Q4(weeklyFeeling) 중 하나라도 채우면 +2점 (중복 없음)
      const hasResearchSelection = didResearch === true || (researchTopic && String(researchTopic).trim() !== '');
      const hasQ3OrQ4 =
        (funFriendQuestion && String(funFriendQuestion).trim() !== '') ||
        (weeklyFeeling && String(weeklyFeeling).trim() !== '');

      const weeklySongiEarned = 3 + (hasResearchSelection ? 2 : 0) + (hasQ3OrQ4 ? 2 : 0);

      await pool.query(
        'UPDATE users SET songi_count = songi_count + $1 WHERE id = $2',
        [weeklySongiEarned, userId]
      );

      // songi_transactions 기록
      await pool.query(
        `INSERT INTO songi_transactions (user_id, amount, activity_type, description)
         VALUES ($1, $2, 'weekly_journal', '주간 일지 완료')`,
        [userId, weeklySongiEarned]
      );
    }

    res.json({
      message: existing.rows.length > 0
        ? '주간 돌아보기가 수정되었어요! 🌸'
        : (() => {
            const hasResearch = didResearch === true || (researchTopic && String(researchTopic).trim() !== '');
            const hasQ3OrQ4 =
              (funFriendQuestion && String(funFriendQuestion).trim() !== '') ||
              (weeklyFeeling && String(weeklyFeeling).trim() !== '');
            const earned = 3 + (hasResearch ? 2 : 0) + (hasQ3OrQ4 ? 2 : 0);
            return `주간 돌아보기가 저장되었어요! +${earned}송이 획득 🌸`;
          })()
    });

  } catch (error) {
    console.error('주간 돌아보기 저장 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 주차 라벨 포맷
function formatWeekLabel(start, end) {
  const s = new Date(start);
  const e = new Date(end);
  return `${s.getMonth() + 1}/${s.getDate()} ~ ${e.getMonth() + 1}/${e.getDate()}`;
}

// ===== 월간 리포트 데이터 =====
router.get('/monthly', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;

    let monthStart, monthEnd;
    if (req.query.start && req.query.end) {
      monthStart = req.query.start;
      monthEnd = req.query.end;
    } else {
      const now = new Date();
      const first = new Date(now.getFullYear(), now.getMonth(), 1);
      first.setHours(0, 0, 0, 0);
      const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      last.setHours(23, 59, 59, 999);
      monthStart = first.toISOString();
      monthEnd = last.toISOString();
    }

    const [questionsResult, opinionsResult, reactionsResult, savedResult, relatedResult, topQuestionsResult, opinionsListResult, reactionsListResult, reflectionResult, userResult] = await Promise.all([
      pool.query(`SELECT COUNT(*) as cnt FROM user_questions WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3 AND parent_question_id IS NULL AND related_seed_question_id IS NULL`, [userId, monthStart, monthEnd]),
      pool.query(`SELECT COUNT(*) as cnt FROM question_opinions WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3`, [userId, monthStart, monthEnd]),
      pool.query(`SELECT COUNT(*) as cnt FROM question_reactions WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3`, [userId, monthStart, monthEnd]),
      pool.query(`SELECT COUNT(*) as cnt FROM saved_questions WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3`, [userId, monthStart, monthEnd]),
      pool.query(`SELECT COUNT(*) as cnt FROM user_questions WHERE user_id = $1 AND (parent_question_id IS NOT NULL OR related_seed_question_id IS NOT NULL) AND created_at >= $2 AND created_at <= $3`, [userId, monthStart, monthEnd]),
      pool.query(`SELECT uq.id, uq.title, COALESCE(uq.likes_count, 0) as likes, (SELECT COUNT(*) FROM question_opinions WHERE question_id = uq.id AND question_type IN ('user_question', 'user', 'my_question', 'friend_question')) as opinion_count FROM user_questions uq WHERE uq.user_id = $1 AND uq.created_at >= $2 AND uq.created_at <= $3 AND uq.parent_question_id IS NULL AND uq.related_seed_question_id IS NULL ORDER BY COALESCE(uq.likes_count, 0) + (SELECT COUNT(*) FROM question_opinions WHERE question_id = uq.id AND question_type IN ('user_question', 'user', 'my_question', 'friend_question')) DESC LIMIT 3`, [userId, monthStart, monthEnd]),
      pool.query(`SELECT qo.opinion as content, qo.created_at, COALESCE(uq.title, sq.question) as question_title FROM question_opinions qo LEFT JOIN user_questions uq ON qo.question_id = uq.id AND qo.question_type IN ('user_question', 'friend_question', 'user') LEFT JOIN seed_questions sq ON qo.question_id = sq.id AND qo.question_type IN ('seed', 'quiz', 'icebreaking') WHERE qo.user_id = $1 AND qo.created_at >= $2 AND qo.created_at <= $3 ORDER BY qo.created_at DESC`, [userId, monthStart, monthEnd]),
      pool.query(`SELECT COALESCE(uq.title, sq.question) as question_title, qr.reaction_type FROM question_reactions qr LEFT JOIN user_questions uq ON qr.question_id = uq.id AND qr.question_type IN ('user_question', 'friend_question', 'user') LEFT JOIN seed_questions sq ON qr.question_id = sq.id AND qr.question_type IN ('seed', 'quiz', 'icebreaking') WHERE qr.user_id = $1 AND qr.created_at >= $2 AND qr.created_at <= $3 ORDER BY qr.created_at DESC`, [userId, monthStart, monthEnd]),
      pool.query(`SELECT * FROM monthly_reflections WHERE user_id = $1 AND month_start = $2::date`, [userId, monthStart]),
      pool.query(`SELECT username, songi_count FROM users WHERE id = $1`, [userId])
    ]);

    // 관련질문 목록 별도 조회 (parent_title 포함)
    const relatedListResult = await pool.query(
      `SELECT uq.id, uq.title, uq.created_at, COALESCE(pq.title, sq.question) as parent_title
       FROM user_questions uq
       LEFT JOIN user_questions pq ON uq.parent_question_id = pq.id
       LEFT JOIN seed_questions sq ON uq.related_seed_question_id = sq.id
       WHERE uq.user_id = $1 AND (uq.parent_question_id IS NOT NULL OR uq.related_seed_question_id IS NOT NULL)
       AND uq.created_at >= $2 AND uq.created_at <= $3
       ORDER BY uq.created_at DESC`,
      [userId, monthStart, monthEnd]
    );

    // 저장한 질문 목록 제거됨

    let quizCount = 0;
    try {
      const qr = await pool.query(`SELECT COUNT(*) as cnt FROM quiz_responses WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3`, [userId, monthStart, monthEnd]);
      quizCount = Math.floor(parseInt(qr.rows[0].cnt) / 5) || parseInt(qr.rows[0].cnt);
    } catch(e) { quizCount = 0; }

    res.json({
      period: { start: monthStart, end: monthEnd, label: new Date(monthStart).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', timeZone: 'Asia/Seoul' }) },
      user: userResult.rows[0],
      stats: {
        questionsCreated: parseInt(questionsResult.rows[0].cnt),
        opinionsGiven: parseInt(opinionsResult.rows[0].cnt),
        reactionsGiven: parseInt(reactionsResult.rows[0].cnt),
        quizCompleted: quizCount,
        relatedQuestions: parseInt(relatedResult.rows[0].cnt),
      },
      lists: {
        questions: topQuestionsResult.rows,
        opinions: opinionsListResult.rows.map(r => ({ content: r.content, question_title: r.question_title })),
        related: relatedListResult.rows,
        reactions: reactionsListResult.rows,
      },
      highlights: { topQuestions: topQuestionsResult.rows },
      reflection: reflectionResult.rows.length > 0 ? reflectionResult.rows[0] : null
    });

  } catch (error) {
    console.error('월간 리포트 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// ===== 월간 돌아보기 저장 =====
router.post('/monthly/reflection', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { monthStart, mostCurious, didResearch, researchTopic, researchNote, monthlyFeeling } = req.body;

    const existing = await pool.query(
      'SELECT id FROM monthly_reflections WHERE user_id = $1 AND month_start = $2::date',
      [userId, monthStart]
    );

    if (existing.rows.length > 0) {
      await pool.query(
        `UPDATE monthly_reflections SET most_curious=$1, did_research=$2, research_topic=$3, research_note=$4, monthly_feeling=$5, updated_at=NOW() WHERE user_id=$6 AND month_start=$7::date`,
        [mostCurious, didResearch, researchTopic, researchNote, monthlyFeeling, userId, monthStart]
      );
    } else {
      await pool.query(
        `INSERT INTO monthly_reflections (user_id, month_start, most_curious, did_research, research_topic, research_note, monthly_feeling) VALUES ($1, $2::date, $3, $4, $5, $6, $7)`,
        [userId, monthStart, mostCurious, didResearch, researchTopic, researchNote, monthlyFeeling]
      );
      // 월간 일지 완료 시 새 점수 구조 (주간과 동일한 원리):
      // Q1(mostCurious, 항상 필수) = 3점
      // 연구 선택(didResearch/researchTopic) = 선택 시 +2점
      // monthlyFeeling 채우면 +2점 (월간엔 funFriendQuestion 필드가 없어서 이 하나만 체크)
      const monthlyHasResearch = didResearch === true || (researchTopic && String(researchTopic).trim() !== '');
      const monthlyHasFeeling = monthlyFeeling && String(monthlyFeeling).trim() !== '';
      const monthlySongiEarned = 3 + (monthlyHasResearch ? 2 : 0) + (monthlyHasFeeling ? 2 : 0);

      await pool.query('UPDATE users SET songi_count = songi_count + $1 WHERE id = $2', [monthlySongiEarned, userId]);
      await pool.query(
        `INSERT INTO songi_transactions (user_id, amount, activity_type, description) VALUES ($1, $2, 'monthly_journal', '월간 일지 완료')`,
        [userId, monthlySongiEarned]
      );
    }

    res.json({
      message: existing.rows.length > 0
        ? '월간 돌아보기가 수정되었어요! 🌸'
        : (() => {
            const hasResearch = didResearch === true || (researchTopic && String(researchTopic).trim() !== '');
            const hasFeeling = monthlyFeeling && String(monthlyFeeling).trim() !== '';
            const earned = 3 + (hasResearch ? 2 : 0) + (hasFeeling ? 2 : 0);
            return `월간 돌아보기가 저장되었어요! +${earned}송이 획득 🌸`;
          })()
    });
  } catch (error) {
    console.error('월간 돌아보기 저장 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// ===== 상품권 교환 자격 판정 =====
// 규칙: (1) 누적 송이가 교환 기준(200) 이상
//       (2) 지금까지 쓴 일지(주간+월간 합쳐서)가 누적 2개 이상 (시점 상관없음)
router.get('/exchange-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const EXCHANGE_THRESHOLD = 200;
    const MIN_JOURNAL_COUNT = 2;

    // 지금까지 쓴 일지 개수 (주간 + 월간 합산, 기간 제한 없음)
    const journalResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM songi_transactions
       WHERE user_id = $1 AND activity_type IN ('weekly_journal', 'monthly_journal')`,
      [userId]
    );
    const journalCount = parseInt(journalResult.rows[0].cnt);

    // 누적(현재 보유) 송이
    const userResult = await pool.query('SELECT songi_count FROM users WHERE id = $1', [userId]);
    const lifetimeSongi = parseFloat(userResult.rows[0]?.songi_count || 0);

    const hasSongi = lifetimeSongi >= EXCHANGE_THRESHOLD;
    const hasJournals = journalCount >= MIN_JOURNAL_COUNT;
    const eligible = hasSongi && hasJournals;

    res.json({
      eligible,
      lifetimeSongi,
      threshold: EXCHANGE_THRESHOLD,
      songiNeeded: Math.max(0, EXCHANGE_THRESHOLD - lifetimeSongi),
      journalCount,
      minJournalCount: MIN_JOURNAL_COUNT
    });
  } catch (error) {
    console.error('교환 자격 판정 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// ===== 상품권 신청 (이름/전화번호 제출) =====
router.post('/claim-reward', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { name, phone } = req.body;

    if (!name || !name.trim() || !phone || !phone.trim()) {
      return res.status(400).json({ error: '이름과 휴대폰 번호를 모두 입력해주세요' });
    }

    const userResult = await pool.query('SELECT username, songi_count FROM users WHERE id = $1', [userId]);
    const user = userResult.rows[0];

    const insertResult = await pool.query(
      `INSERT INTO reward_claims (user_id, name, phone, songi_at_claim, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING id, created_at`,
      [userId, name.trim(), phone.trim(), user?.songi_count || 0]
    );

    // 관리자 전원에게 알림
    try {
      const admins = await pool.query('SELECT id FROM users WHERE is_admin = true');
      for (const admin of admins.rows) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, message, is_read)
           VALUES ($1, 'reward_claim', $2, false)`,
          [admin.id, `${user?.username || '누군가'}님이 상품권 교환을 신청했어요 🎫`]
        );
      }
    } catch (notifyErr) {
      console.error('상품권 신청 알림 생성 오류:', notifyErr);
    }

    res.status(201).json({
      message: '상품권 교환 신청이 접수되었어요! 선생님이 곧 연락드릴게요',
      claim: insertResult.rows[0]
    });
  } catch (error) {
    console.error('상품권 신청 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// ===== 관리자용: 상품권 신청 목록 =====
router.get('/reward-claims', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const adminCheck = await pool.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (!adminCheck.rows[0]?.is_admin) {
      return res.status(403).json({ error: '관리자 권한이 필요합니다' });
    }

    const result = await pool.query(
      `SELECT rc.id, rc.user_id, u.username, rc.name, rc.phone,
              rc.songi_at_claim, rc.status, rc.created_at, rc.completed_at
       FROM reward_claims rc
       JOIN users u ON rc.user_id = u.id
       ORDER BY rc.status ASC, rc.created_at DESC`
    );

    res.json({ claims: result.rows });
  } catch (error) {
    console.error('상품권 신청 목록 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// ===== 관리자용: 상품권 지급 완료 처리 =====
// 상태 변경 + 송이 차감 + 거래기록 + 학생 알림을 한 트랜잭션으로 처리
router.put('/reward-claims/:id/complete', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  let released = false;
  const releaseOnce = () => { if (!released) { released = true; client.release(); } };
  let targetUserId = null;
  try {
    const userId = req.user.id || req.user.userId;
    const adminCheck = await client.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
    if (!adminCheck.rows[0]?.is_admin) {
      releaseOnce();
      return res.status(403).json({ error: '관리자 권한이 필요합니다' });
    }

    const EXCHANGE_THRESHOLD = 200;

    await client.query('BEGIN');

    // 중복 차감 방지: 행을 잠그고 이미 completed인지 확인
    const claimResult = await client.query(
      `SELECT id, user_id, status FROM reward_claims WHERE id = $1 FOR UPDATE`,
      [req.params.id]
    );
    if (claimResult.rows.length === 0) {
      await client.query('ROLLBACK');
      releaseOnce();
      return res.status(404).json({ error: '신청 내역을 찾을 수 없습니다' });
    }

    const claim = claimResult.rows[0];
    if (claim.status === 'completed') {
      await client.query('ROLLBACK');
      releaseOnce();
      return res.status(400).json({ error: '이미 지급 완료 처리된 신청이에요' });
    }
    targetUserId = claim.user_id;

    // 1) 신청 상태를 완료로
    await client.query(
      `UPDATE reward_claims SET status = 'completed', completed_at = NOW() WHERE id = $1`,
      [claim.id]
    );

    // 2) 송이 차감 (0 밑으로는 안 내려가게)
    await client.query(
      `UPDATE users SET songi_count = GREATEST(songi_count - $1, 0) WHERE id = $2`,
      [EXCHANGE_THRESHOLD, targetUserId]
    );

    // 3) 거래 기록 — 프로필 '상품권 내역'에 표시될 근거
    await client.query(
      `INSERT INTO songi_transactions (user_id, amount, activity_type, description)
       VALUES ($1, $2, 'reward_exchange', $3)`,
      [targetUserId, -EXCHANGE_THRESHOLD, '1,000원 상품권 수령 🎫']
    );

    await client.query('COMMIT');
    releaseOnce();

    // 4) 학생에게 알림 (실패해도 지급 처리는 그대로 유지)
    try {
      await pool.query(
        `INSERT INTO notifications (user_id, type, message, is_read)
         VALUES ($1, 'reward_completed', $2, false)`,
        [targetUserId, '상품권이 전달되었어요! 200송이가 사용되었어요 🎫']
      );
    } catch (notifyErr) {
      console.error('상품권 지급 알림 생성 오류:', notifyErr);
    }

    return res.json({ message: `지급 완료! ${EXCHANGE_THRESHOLD}송이를 차감했어요` });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (e) { /* 이미 종료된 경우 무시 */ }
    releaseOnce();
    console.error('상품권 지급 완료 처리 오류:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// ===== 이주의 영웅 TOP 3 (start/end 쿼리로 특정 주차 지정 가능, 없으면 이번 주) =====
router.get('/weekly-leaderboard', authenticateToken, async (req, res) => {
  try {
    let weekStart, weekEnd;
    if (req.query.start && req.query.end) {
      weekStart = req.query.start;
      weekEnd = req.query.end;
    } else {
      const now = new Date();
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      weekStart = monday.toISOString();
      weekEnd = sunday.toISOString();
    }

    const result = await pool.query(
      `SELECT COALESCE(u.name, u.username) as display_name, SUM(st.amount) as total
       FROM songi_transactions st
       JOIN users u ON st.user_id = u.id
       WHERE st.amount > 0 AND st.created_at >= $1 AND st.created_at <= $2
       GROUP BY u.id, u.username, u.name
       ORDER BY total DESC
       LIMIT 3`,
      [weekStart, weekEnd]
    );

    res.json({
      leaderboard: result.rows.map(r => ({ name: r.display_name, songi: parseFloat(r.total) }))
    });
  } catch (error) {
    console.error('주간 영웅 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// ===== 이달의 영웅 TOP 3 (start/end 쿼리로 특정 월 지정 가능, 없으면 이번 달) =====
router.get('/monthly-leaderboard', authenticateToken, async (req, res) => {
  try {
    let monthStart, monthEnd;
    if (req.query.start && req.query.end) {
      monthStart = req.query.start;
      monthEnd = req.query.end;
    } else {
      const now = new Date();
      monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).toISOString();
    }

    const result = await pool.query(
      `SELECT COALESCE(u.name, u.username) as display_name, SUM(st.amount) as total
       FROM songi_transactions st
       JOIN users u ON st.user_id = u.id
       WHERE st.amount > 0 AND st.created_at >= $1 AND st.created_at <= $2
       GROUP BY u.id, u.username, u.name
       ORDER BY total DESC
       LIMIT 3`,
      [monthStart, monthEnd]
    );

    res.json({
      leaderboard: result.rows.map(r => ({ name: r.display_name, songi: parseFloat(r.total) }))
    });
  } catch (error) {
    console.error('월간 영웅 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// ===== 주간/월간 일지 작성 여부 확인 (하단 네비 뱃지용, 가벼운 조회 전용) =====
// weekStart, monthStart는 프론트엔드가 로컬 시간 기준으로 계산해서 넘겨줌
// (서버에서 직접 "오늘"을 계산하면 타임존 어긋남 위험이 있어 피함)
router.get('/reflection-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { weekStart, monthStart } = req.query;

    if (!weekStart || !monthStart) {
      return res.status(400).json({ message: 'weekStart, monthStart가 필요합니다' });
    }

    const [weeklyResult, monthlyResult] = await Promise.all([
      pool.query('SELECT id FROM weekly_reflections WHERE user_id = $1 AND week_start = $2::date', [userId, weekStart]),
      pool.query('SELECT id FROM monthly_reflections WHERE user_id = $1 AND month_start = $2::date', [userId, monthStart])
    ]);

    res.json({
      weeklyDone: weeklyResult.rows.length > 0,
      monthlyDone: monthlyResult.rows.length > 0
    });
  } catch (error) {
    console.error('일지 작성 상태 조회 오류:', error);
    res.status(500).json({ message: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
