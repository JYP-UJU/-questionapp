const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const axios = require('axios');

// ===== 간단한 조사 제거 + 명사(어간) 빈도 기반 키워드 추출 =====
// 정식 형태소 분석기(Mecab 등)는 무거워서, 흔한 조사를 규칙 기반으로 떼어내는
// 가벼운 방식으로 대체함. 완벽하진 않지만 무거운 라이브러리 없이 Railway에서 잘 돌아감.
// 핵심 장점: 여기서 뽑은 "조사 뗀 어간"을 그대로 검색어로 쓰면, ILIKE 부분일치 검색이
// "동물은/동물이/동물의" 같은 원문 속 조사 붙은 형태를 전부 잡아냄 (동물 ⊂ 동물은 이므로).
const JOSA_SUFFIXES = [
  '으로부터', '에서부터', '이라서', '으로는', '에서는', '이라는', '이라도',
  '에게서', '한테서', '이에요', '예요',
  '에서', '에게', '한테', '으로', '이랑', '까지', '부터', '보다', '조차', '마저', '만큼', '처럼',
  '이나', '나요', '까요', '을까', '일까', '라서', '이라',
  '은', '는', '이', '가', '을', '를', '의', '에', '로', '와', '과', '도', '만', '요'
];
const STOPWORDS = new Set([
  '왜', '어떻게', '무엇', '뭐', '뭘', '어디', '언제', '누가', '얼마나', '어떤', '무슨',
  '때문', '그럼', '그리고', '근데', '그런데', '이런', '저런', '그런', '있을까', '있나',
  '했을까', '될까', '하는', '하나요', '거예요', '그게', '나는', '저는', '제가', '나도'
]);

function stripJosa(token) {
  for (const suf of JOSA_SUFFIXES) {
    if (token.length > suf.length + 1 && token.endsWith(suf)) {
      return token.slice(0, -suf.length);
    }
  }
  return token;
}

// texts: 문자열 배열 (질문 제목들 + 의견들). 상위 n개 명사(어간) 반환.
function extractTopKeywords(texts, n = 3) {
  const freq = new Map();
  for (const text of texts) {
    if (!text) continue;
    // 한글/영문/숫자가 아닌 문자(문장부호 등) 기준으로 토큰 분리
    const rawTokens = text.split(/[^가-힣a-zA-Z0-9]+/).filter(Boolean);
    for (const raw of rawTokens) {
      const stemmed = stripJosa(raw);
      if (stemmed.length < 2) continue; // 한 글자짜리는 의미 없는 경우가 많아 제외
      if (STOPWORDS.has(stemmed) || STOPWORDS.has(raw)) continue;
      freq.set(stemmed, (freq.get(stemmed) || 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([word]) => word);
}

// 내 정보 조회
router.get('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;

    const result = await pool.query(
      `SELECT 
        id,
        username,
        songi_count,
        is_admin,
        created_at,
        (SELECT COUNT(*) FROM user_questions WHERE user_id = $1) as question_count,
        (SELECT COUNT(*) FROM follow_up_questions WHERE user_id = $1) as followup_count
       FROM users
       WHERE id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    }

    const user = result.rows[0];

    res.json({
      user: {
        id: user.id,
        username: user.username,
        songi_count: user.songi_count,
        is_admin: user.is_admin || false,
        question_count: parseInt(user.question_count),
        followup_count: parseInt(user.followup_count),
        created_at: user.created_at
      }
    });

  } catch (error) {
    console.error('사용자 정보 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// ===== 프로필 상세 통계 조회 =====
router.get('/me/profile-stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;

    // 기본 정보
    const userResult = await pool.query(
      'SELECT id, username, songi_count, created_at FROM users WHERE id = $1',
      [userId]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: '사용자를 찾을 수 없습니다' });
    }
    const user = userResult.rows[0];

    // 만든 질문 수 (관련질문 제외)
    const myQuestionsResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM user_questions 
       WHERE user_id = $1 AND parent_question_id IS NULL AND related_seed_question_id IS NULL`,
      [userId]
    );

    // 관련질문 수
    const relatedQuestionsResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM user_questions 
       WHERE user_id = $1 AND (parent_question_id IS NOT NULL OR related_seed_question_id IS NOT NULL)`,
      [userId]
    );

    // 총 의견 수
    const opinionsResult = await pool.query(
      'SELECT COUNT(*) as cnt FROM question_opinions WHERE user_id = $1',
      [userId]
    );

    // 총 관심표시(좋아요) 수
    const reactionsResult = await pool.query(
      `SELECT COUNT(*) as cnt FROM question_reactions 
       WHERE user_id = $1 AND reaction_type = 'like'`,
      [userId]
    );

    // 퀴즈 푼 횟수
    let quizCount = 0;
    try {
      const quizResult = await pool.query(
        'SELECT COUNT(DISTINCT created_at::date) as cnt FROM quiz_responses WHERE user_id = $1',
        [userId]
      );
      // 퀴즈는 제출 횟수로 카운트 (5문제 세트 기준)
      const quizTotal = await pool.query(
        'SELECT COUNT(*) as cnt FROM quiz_responses WHERE user_id = $1',
        [userId]
      );
      quizCount = Math.floor(parseInt(quizTotal.rows[0].cnt) / 5) || parseInt(quizTotal.rows[0].cnt);
    } catch (e) {
      quizCount = 0;
    }

    // 상품권 수령 내역
    // 'reward_exchange' = 관리자가 상품권 지급 완료 처리할 때 남기는 기록 (현재 방식)
    // 'reward', 'coupon' = 예전 방식으로 남은 기록도 함께 보여줌
    let rewards = [];
    try {
      const rewardsResult = await pool.query(
        `SELECT amount, description, created_at 
         FROM songi_transactions 
         WHERE user_id = $1 AND activity_type IN ('reward_exchange', 'reward', 'coupon')
         ORDER BY created_at DESC`,
        [userId]
      );
      rewards = rewardsResult.rows;
    } catch (e) {
      rewards = [];
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        songi_count: user.songi_count,
        created_at: user.created_at
      },
      stats: {
        myQuestions: parseInt(myQuestionsResult.rows[0].cnt) || 0,
        relatedQuestions: parseInt(relatedQuestionsResult.rows[0].cnt) || 0,
        opinions: parseInt(opinionsResult.rows[0].cnt) || 0,
        reactions: parseInt(reactionsResult.rows[0].cnt) || 0,
        quizCount: quizCount
      },
      rewards: rewards
    });

  } catch (error) {
    console.error('프로필 통계 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 프로필 수정 (닉네임)
router.put('/me', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { username } = req.body;

    if (!username) {
      return res.status(400).json({ error: '닉네임을 입력해주세요' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: '닉네임은 3글자 이상이어야 합니다' });
    }

    // 중복 체크
    const existing = await pool.query(
      'SELECT id FROM users WHERE username = $1 AND id != $2',
      [username, userId]
    );

    if (existing.rows.length > 0) {
      return res.status(400).json({ error: '이미 사용 중인 닉네임입니다' });
    }

    // 업데이트
    await pool.query(
      'UPDATE users SET username = $1 WHERE id = $2',
      [username, userId]
    );

    res.json({
      message: '닉네임이 변경되었습니다',
      username
    });

  } catch (error) {
    console.error('프로필 수정 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 비밀번호 변경
router.put('/me/password', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: '현재 비밀번호와 새 비밀번호를 입력해주세요' });
    }

    if (newPassword.length < 4) {
      return res.status(400).json({ error: '새 비밀번호는 4글자 이상이어야 합니다' });
    }

    // 현재 비밀번호 확인
    const result = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [userId]
    );

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(currentPassword, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: '현재 비밀번호가 일치하지 않습니다' });
    }

    // 새 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // 업데이트
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hashedPassword, userId]
    );

    res.json({ message: '비밀번호가 변경되었습니다' });

  } catch (error) {
    console.error('비밀번호 변경 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 회원탈퇴 (계정 삭제)
router.delete('/me', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const userId = req.user.id || req.user.userId;

    await client.query('BEGIN');

    // 관련 데이터 삭제 (순서 중요 - FK 참조 순서)
    await client.query('DELETE FROM question_reactions WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM question_opinions WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM saved_questions WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM quiz_responses WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM user_questions WHERE user_id = $1', [userId]);
    await client.query('DELETE FROM users WHERE id = $1', [userId]);

    await client.query('COMMIT');

    res.json({ message: '계정이 삭제되었습니다' });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('회원탈퇴 오류:', error);
    res.status(500).json({ error: '계정 삭제에 실패했습니다' });
  } finally {
    client.release();
  }
});

// 송이 내역 조회
router.get('/songi-history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;

    const result = await pool.query(
      `SELECT 
        st.id, st.amount, st.activity_type, st.description, 
        st.question_id, st.created_at,
        COALESCE(
          st.question_text,
          uq.title,
          sq.question
        ) as question_text
       FROM songi_transactions st
       LEFT JOIN user_questions uq ON st.question_id = uq.id 
         AND st.activity_type IN ('question', 'related', 'opinion', 'interest')
       LEFT JOIN seed_questions sq ON st.question_id = sq.id
         AND st.activity_type IN ('icebreaking', 'quiz', 'interest')
       WHERE st.user_id = $1
       ORDER BY st.created_at DESC
       LIMIT 200`,
      [userId]
    );

    const totalResult = await pool.query(
      'SELECT songi_count FROM users WHERE id = $1',
      [userId]
    );

    res.json({
      transactions: result.rows,
      total_songi: totalResult.rows[0]?.songi_count || 0
    });

  } catch (error) {
    console.error('송이 내역 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// ===== AI 관심 키워드 (질문올림픽 성향 문구를 대체 - 워드클라우드 스타일) =====
// 캐시: profile_ai_keywords 테이블에 저장, 마지막 생성이 7일 넘었으면(또는 ?force=true) 재생성
router.get('/me/keywords', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const force = req.query.force === 'true';
    // period: 'recent'(기본, 최근 15일 - 주간일지용) | 'monthly'(최근 30일 - 월간일지용)
    const period = req.query.period === 'monthly' ? 'monthly' : 'recent';
    const daysBack = period === 'monthly' ? 30 : 15;

    // 1. 캐시 확인 (기간별로 따로 캐싱)
    const cached = await pool.query(
      'SELECT keywords, generated_at FROM profile_ai_keywords WHERE user_id = $1 AND period = $2',
      [userId, period]
    );
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const isFresh = cached.rows.length > 0 &&
      (Date.now() - new Date(cached.rows[0].generated_at).getTime()) < SEVEN_DAYS_MS;

    if (isFresh && !force) {
      return res.json({ ...cached.rows[0].keywords, generatedAt: cached.rows[0].generated_at, cached: true });
    }

    // 2. 재료 모으기: 고정 기간(15일 또는 30일) - 질문+관련질문 / 관심있음 / 남긴 의견, 네 범주를 하나로 합쳐서 사용
    //    기간을 매번 다르게 적응시키지 않고 고정 — 연구 데이터 해석 시 일관성 유지 목적
    const myQuestions = await pool.query(
      `SELECT title FROM user_questions
       WHERE user_id = $1 AND is_deleted = false AND created_at >= NOW() - ($2 || ' days')::interval
       ORDER BY created_at DESC LIMIT 40`,
      [userId, daysBack]
    );

    const likedResult = await pool.query(
      `SELECT COALESCE(uq.title, sq.question) as title
       FROM question_reactions qr
       LEFT JOIN user_questions uq ON qr.question_id = uq.id
         AND qr.question_type IN ('user_question', 'friend_question', 'user', 'my_question', 'related_question')
       LEFT JOIN seed_questions sq ON qr.question_id = sq.id
         AND qr.question_type IN ('seed', 'quiz', 'icebreaking', 'olympic')
       WHERE qr.user_id = $1 AND qr.reaction_type = 'like'
         AND qr.created_at >= NOW() - ($2 || ' days')::interval
       ORDER BY qr.created_at DESC LIMIT 40`,
      [userId, daysBack]
    );

    const opinionResult = await pool.query(
      `SELECT qo.opinion FROM question_opinions qo
       WHERE qo.user_id = $1 AND qo.created_at >= NOW() - ($2 || ' days')::interval
       ORDER BY qo.created_at DESC LIMIT 40`,
      [userId, daysBack]
    );

    const myTitles = myQuestions.rows.map(r => r.title).filter(Boolean);
    const likedTitles = likedResult.rows.map(r => r.title).filter(Boolean);
    const opinionTexts = opinionResult.rows.map(r => r.opinion).filter(Boolean);

    // 활동이 전혀 없으면 API 호출 없이 바로 안내 메시지
    if (myTitles.length === 0 && likedTitles.length === 0 && opinionTexts.length === 0) {
      const empty = { keywords: [], questions: [], insufficientData: true };
      return res.json({ ...empty, generatedAt: new Date().toISOString(), cached: false });
    }

    // 키워드는 AI가 아니라 빈도 기반으로 직접 계산 (검색이 확실히 되도록,
    // 그리고 AI 호출 비용/변동성 없이 빠르게)
    const keywords = extractTopKeywords([...myTitles, ...likedTitles, ...opinionTexts], 3);

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY가 설정되지 않았습니다');
      if (cached.rows.length > 0) {
        return res.json({ ...cached.rows[0].keywords, generatedAt: cached.rows[0].generated_at, cached: true, stale: true });
      }
      return res.status(500).json({ error: 'AI 질문 기능이 아직 설정되지 않았어요' });
    }

    // 3. Claude API 호출 — 이 관심사를 이어서 AI 챗봇에 그대로 복사해 물어볼 수 있는 질문 3개만 요청
    //    (키워드는 위에서 빈도 기반으로 이미 계산했으니 AI는 질문 생성에만 집중)
    const periodLabel = period === 'monthly' ? '30일' : '15일';
    const prompt = `다음은 한 학생이 과학 질문 앱에서 최근 ${periodLabel} 동안 활동한 기록입니다.

[학생이 쓴 질문/관련질문 제목]
${myTitles.length > 0 ? myTitles.map(t => `- ${t}`).join('\n') : '(없음)'}

[학생이 "관심있음"을 누른 질문 제목]
${likedTitles.length > 0 ? likedTitles.map(t => `- ${t}`).join('\n') : '(없음)'}

[학생이 남긴 의견]
${opinionTexts.length > 0 ? opinionTexts.map(t => `- ${t}`).join('\n') : '(없음)'}

이 관심사를 이어서 Claude/ChatGPT/Copilot 같은 AI 챗봇 채팅창에 그대로 복사해 붙여넣고 물어볼 수 있는 구체적인 질문 문장 3개를 만들어줘.
지켜야 할 것:
- "~에 끌리시네요", "~을 좋아하는 편이에요" 같은 성향 진단/평가 문구는 절대 쓰지 말 것
- 반드시 물음표로 끝나는, 학생이 실제로 궁금해서 AI에게 물어볼 법한 자연스러운 질문 문장일 것 (예: "탄산음료를 흔들면 왜 거품이 갑자기 넘칠까?")
- 학생이 이미 쓴 질문을 그대로 베끼지 말고, 그 관심사에서 한 걸음 더 들어가거나 옆으로 확장한 새로운 질문일 것
- 각 질문은 한 문장, 60자 이내

다른 설명 없이 반드시 아래 JSON 형식으로만 답해:
{"questions": ["...", "...", "..."]}`;

    let parsed;
    try {
      const aiRes = await axios.post(
        'https://api.anthropic.com/v1/messages',
        {
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 300,
          messages: [{ role: 'user', content: prompt }]
        },
        {
          headers: {
            'x-api-key': process.env.ANTHROPIC_API_KEY,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          }
        }
      );
      let text = aiRes.data.content?.[0]?.text || '{}';
      text = text.trim().replace(/^```json\s*|^```\s*|```$/g, '');
      parsed = JSON.parse(text);
    } catch (aiErr) {
      console.error('AI 질문 생성 오류:', aiErr.response?.data || aiErr.message);
      if (cached.rows.length > 0) {
        return res.json({ ...cached.rows[0].keywords, generatedAt: cached.rows[0].generated_at, cached: true, stale: true });
      }
      // AI 호출이 실패해도 키워드는 빈도 계산이라 이미 성공했으니, 질문만 빈 배열로 내려줌
      parsed = { questions: [] };
    }

    // keywords는 빈도 계산 결과로 덮어씀 (AI가 questions만 반환하므로)
    const result = { keywords, questions: parsed.questions || [], period };

    // 4. 캐시 저장 (upsert, 기간별로 따로)
    await pool.query(
      `INSERT INTO profile_ai_keywords (user_id, period, keywords, generated_at)
       VALUES ($1, $2, $3, NOW())
       ON CONFLICT (user_id, period) DO UPDATE SET keywords = $3, generated_at = NOW()`,
      [userId, period, JSON.stringify(result)]
    );

    res.json({ ...result, generatedAt: new Date().toISOString(), cached: false });

  } catch (error) {
    console.error('키워드 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// ===== AI 탐구 질문 복사/검색 클릭 로그 (연구용 - 실제로 검색까지 이어갔는지 확인) =====
router.post('/me/keyword-events', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const { eventType, target, questionText } = req.body;

    if (!eventType || !questionText) {
      return res.status(400).json({ error: 'eventType과 questionText가 필요합니다' });
    }
    if (!['copy', 'search_click'].includes(eventType)) {
      return res.status(400).json({ error: '알 수 없는 eventType입니다' });
    }
    if (eventType === 'search_click' && !['google', 'naver'].includes(target)) {
      return res.status(400).json({ error: '알 수 없는 target입니다' });
    }

    await pool.query(
      `INSERT INTO keyword_click_events (user_id, event_type, target, question_text)
       VALUES ($1, $2, $3, $4)`,
      [userId, eventType, target || null, questionText]
    );

    res.json({ ok: true });
  } catch (error) {
    // 로그 실패가 사용자 경험을 막으면 안 되니 조용히 실패 처리
    console.error('키워드 이벤트 기록 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
