const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const bcrypt = require('bcryptjs');
const axios = require('axios');

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

    // 1. 캐시 확인
    const cached = await pool.query(
      'SELECT keywords, generated_at FROM profile_ai_keywords WHERE user_id = $1',
      [userId]
    );
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const isFresh = cached.rows.length > 0 &&
      (Date.now() - new Date(cached.rows[0].generated_at).getTime()) < SEVEN_DAYS_MS;

    if (isFresh && !force) {
      return res.json({ ...cached.rows[0].keywords, generatedAt: cached.rows[0].generated_at, cached: true });
    }

    // 2. 재료 모으기: 내가 쓴 질문 제목들 + 관심있음 누른 질문 제목들
    const myQuestions = await pool.query(
      `SELECT title FROM user_questions WHERE user_id = $1 AND is_deleted = false ORDER BY created_at DESC LIMIT 60`,
      [userId]
    );

    const likedResult = await pool.query(
      `SELECT COALESCE(uq.title, sq.question) as title
       FROM question_reactions qr
       LEFT JOIN user_questions uq ON qr.question_id = uq.id
         AND qr.question_type IN ('user_question', 'friend_question', 'user', 'my_question', 'related_question')
       LEFT JOIN seed_questions sq ON qr.question_id = sq.id
         AND qr.question_type IN ('seed', 'quiz', 'icebreaking')
       WHERE qr.user_id = $1 AND qr.reaction_type = 'like'
       ORDER BY qr.created_at DESC LIMIT 60`,
      [userId]
    );

    const myTitles = myQuestions.rows.map(r => r.title).filter(Boolean);
    const likedTitles = likedResult.rows.map(r => r.title).filter(Boolean);

    // 활동이 거의 없으면 API 호출 없이 바로 안내 메시지
    if (myTitles.length === 0 && likedTitles.length === 0) {
      const empty = { overall: [], questions: [], liked: [], insufficientData: true };
      return res.json({ ...empty, generatedAt: new Date().toISOString(), cached: false });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      console.error('ANTHROPIC_API_KEY가 설정되지 않았습니다');
      // 키가 없으면 예전 캐시라도 있으면 그거라도 반환, 없으면 에러
      if (cached.rows.length > 0) {
        return res.json({ ...cached.rows[0].keywords, generatedAt: cached.rows[0].generated_at, cached: true, stale: true });
      }
      return res.status(500).json({ error: 'AI 키워드 기능이 아직 설정되지 않았어요' });
    }

    // 3. Claude API 호출
    const prompt = `다음은 한 학생이 과학 질문 앱에서 활동한 기록입니다.

[학생이 직접 쓴 질문 제목들]
${myTitles.length > 0 ? myTitles.map(t => `- ${t}`).join('\n') : '(없음)'}

[학생이 "관심있음"을 누른 질문 제목들]
${likedTitles.length > 0 ? likedTitles.map(t => `- ${t}`).join('\n') : '(없음)'}

각 목록에서 이 학생의 관심사를 대표하는 자연스러운 한국어 키워드(단어 또는 아주 짧은 구, 각 8자 이내)를 3개씩 뽑아줘. 특정 교과 분류명(물리/화학/생물/지구과학 등)이 아니라 실제 흥미로운 주제나 개념 단위로 뽑아줘. 두 목록을 합친 전체 활동에서 대표 키워드 3개도 "overall"로 뽑아줘. 목록이 비어있으면 해당 배열은 빈 배열로 둬.

다른 설명 없이 반드시 아래 JSON 형식으로만 답해:
{"overall": ["...", "...", "..."], "questions": ["...", "...", "..."], "liked": ["...", "...", "..."]}`;

    let keywords;
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
      keywords = JSON.parse(text);
    } catch (aiErr) {
      console.error('AI 키워드 생성 오류:', aiErr.response?.data || aiErr.message);
      // 실패 시 예전 캐시라도 있으면 그거 반환
      if (cached.rows.length > 0) {
        return res.json({ ...cached.rows[0].keywords, generatedAt: cached.rows[0].generated_at, cached: true, stale: true });
      }
      return res.status(500).json({ error: 'AI 키워드 생성에 실패했어요' });
    }

    // 4. 캐시 저장 (upsert)
    await pool.query(
      `INSERT INTO profile_ai_keywords (user_id, keywords, generated_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (user_id) DO UPDATE SET keywords = $2, generated_at = NOW()`,
      [userId, JSON.stringify(keywords)]
    );

    res.json({ ...keywords, generatedAt: new Date().toISOString(), cached: false });

  } catch (error) {
    console.error('키워드 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;
