const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const axios = require('axios');

// Unsplash API로 썸네일 검색
async function getThumbnail(query) {
  try {
    const response = await axios.get('https://api.unsplash.com/search/photos', {
      params: {
        query: query,
        per_page: 1,
        orientation: 'landscape'
      },
      headers: {
        Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}`
      }
    });

    if (response.data.results.length > 0) {
      return response.data.results[0].urls.small;
    }
    return null;
  } catch (error) {
    console.error('Unsplash API 오류:', error.message);
    return null;
  }
}

// ===== 고정 경로 먼저 (/:id 보다 앞에 와야 함) =====

// 질문 작성 + 5송이 지급
router.post('/', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { title, content, thumbnail_url, parent_question_id } = req.body;
    const userId = req.user.id || req.user.userId;

    if (!title) {
      return res.status(400).json({ error: '질문 내용을 입력해주세요' });
    }

    await client.query('BEGIN');

    // 피드백 메시지용 신호 계산 (등록 전 기존 질문들과 비교)
    // 1) 비슷한 질문이 몇 개나 이미 있는지 (키워드 단위 매칭, /with-status 검색과 같은 방식)
    const titleTokens = [...new Set(
      (title || '').split(/[\s,.?!]+/).filter(t => t.length >= 2)
    )].map(t => `%${t}%`);

    let matchCount = 0;
    if (titleTokens.length > 0) {
      const matchResult = await client.query(
        `SELECT COUNT(*) FROM user_questions
         WHERE is_deleted = false
           AND (title ILIKE ANY($1::text[]) OR content ILIKE ANY($1::text[]))`,
        [titleTokens]
      );
      matchCount = parseInt(matchResult.rows[0].count, 10) || 0;
    }

    // 2) 질문 문장 자체의 유형 (빈도와 무관하게 키워드만으로 판단)
    // "왜"/"어떻게" 같은 키워드는 오탐이 많아서(그냥 흔한 말버릇인 경우가 대부분) 뺐음.
    // "만약/라면"(가정형)과 이유 칸을 채웠는지(관찰형)만 판단.
    let typeTag = null;
    if (/만약|라면/.test(title)) typeTag = 'whatif';
    else if (content && content.trim().length > 0) typeTag = 'observation';

    // 질문 저장 (관련질문인 경우 parent_question_id 포함)
    const result = await client.query(
      `INSERT INTO user_questions (user_id, title, content, thumbnail_url, parent_question_id)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, title, content, thumbnail_url, parent_question_id, created_at`,
      [userId, title, content, thumbnail_url, parent_question_id || null]
    );

    const question = result.rows[0];

    // 5송이 지급 (관리자 계정은 제외)
    const grantResult = await client.query(
      'UPDATE users SET songi_count = songi_count + 5 WHERE id = $1 AND is_admin IS NOT TRUE',
      [userId]
    );
    const songiGranted = grantResult.rowCount > 0;

    // songi_transactions 기록 (관리자는 0송이로 남겨서 활동 이력은 유지)
    await client.query(
      `INSERT INTO songi_transactions (user_id, amount, activity_type, description, question_id, question_text)
       VALUES ($1, $2, 'question', $3, $4, $5)`,
      [userId, songiGranted ? 5 : 0, '질문 작성', question.id, title]
    );

    // 업데이트된 송이 개수 조회
    const userResult = await client.query(
      'SELECT songi_count FROM users WHERE id = $1',
      [userId]
    );

    // 지금까지 이 사용자가 올린 (최상위) 질문 총 개수 - 신규 사용자 활동 안내 노출 여부 판단용
    // (관리자 페이지의 question_count 집계와 동일 기준: 관련질문/시드 제외)
    const myQuestionCountResult = await client.query(
      `SELECT COUNT(*) FROM user_questions
       WHERE user_id = $1 AND parent_question_id IS NULL AND related_seed_question_id IS NULL`,
      [userId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: songiGranted ? '질문이 등록되었습니다! 5송이를 획득했어요 🌸' : '질문이 등록되었습니다!',
      question,
      songi_count: userResult.rows[0].songi_count,
      songi_earned: songiGranted ? 5 : 0,
      feedback: { matchCount, typeTag },
      myQuestionCount: parseInt(myQuestionCountResult.rows[0].count, 10) || 0
    });

    // 물음송이 AI: 응답을 보낸 뒤 뒤에서 조용히 의견을 만든다 (기다리지 않음, 실패해도 무시됨)
    // 최상위 질문에만 달고, ANTHROPIC_API_KEY 가 없으면 아무 일도 하지 않는다.
    if (!parent_question_id) {
      require('../services/aiOpinion').respondToQuestion({
        id: question.id,
        title: question.title,
        content: question.content,
        user_id: userId
      });
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('질문 작성 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  } finally {
    client.release();
  }
});

// 썸네일 생성 (Unsplash)
router.post('/thumbnail', authenticateToken, async (req, res) => {
  try {
    const { query } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: '검색어를 입력해주세요' });
    }

    const thumbnailUrl = await getThumbnail(query);

    if (!thumbnailUrl) {
      return res.status(404).json({ error: '썸네일을 찾을 수 없습니다' });
    }

    res.json({ thumbnail_url: thumbnailUrl });

  } catch (error) {
    console.error('썸네일 생성 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// ⭐ 질문 목록 조회 (사용자 질문 + 반응 있는 퀴즈 통합, 최신 활동 기준 정렬)
router.get('/with-status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const offset = parseInt(req.query.offset) || 0;
    // sort: 'engagement'(기본, 관심있음+관심없음+의견+관련질문 합산 점수 높은 순 → 그 안에서 최신 활동순)
    //       'random' (완전 랜덤 셔플)
    //       'recent' (최신 활동순 - 인기 가중치 없이 순수 최신순)
    const sortParam = req.query.sort;
    const sort = sortParam === 'random' ? 'random' : sortParam === 'recent' ? 'recent' : 'engagement';
    const engagementExpr = `(
      COALESCE(q.likes_count,0) + COALESCE(q.dislikes_count,0)
      + (SELECT COUNT(*) FROM question_opinions WHERE question_id = q.id AND question_type = q.question_source)
      + (CASE
           WHEN q.question_source = 'user_question' THEN
             (SELECT COUNT(*) FROM user_questions WHERE parent_question_id = q.id AND is_deleted = false)
           ELSE
             COALESCE((SELECT related_count FROM seed_questions WHERE id = q.id), 0)
         END)
    )`;
    const orderClause = sort === 'random'
      ? 'RANDOM()'
      : sort === 'recent'
      ? 'q.latest_activity DESC'
      : `${engagementExpr} DESC, q.latest_activity DESC`;
    const search = (req.query.search || '').trim();
    // 검색어를 단어 단위로 쪼개서 하나라도 포함되면 걸리게 (AI가 만든 키워드는
    // 질문 제목에 그대로 안 박혀있는 "개념어"인 경우가 많아서, 전체 구문 일치보다
    // 단어 단위 매칭이 실제로 관련 있는 질문을 더 잘 찾아줌)
    const searchTokens = search
      ? [...new Set(search.split(/[\s,]+/).filter(Boolean))].map(t => `%${t}%`)
      : null;

    const result = await pool.query(
      `SELECT
        q.id,
        q.title,
        q.content,
        q.thumbnail_url,
        q.likes_count,
        q.dislikes_count,
        q.created_at,
        q.question_source,
        q.user_id,
        q.username,
        q.latest_activity,
        (q.user_id = $1) as is_mine,
        -- 의견 수
        (SELECT COUNT(*) FROM question_opinions
         WHERE question_id = q.id AND question_type = q.question_source) as opinion_count,
        -- 관련질문 수
        CASE
          WHEN q.question_source = 'user_question' THEN
            (SELECT COUNT(*) FROM user_questions WHERE parent_question_id = q.id AND is_deleted = false)
          ELSE
            COALESCE((SELECT related_count FROM seed_questions WHERE id = q.id), 0)
        END as related_count,
        -- 저장 여부
        EXISTS(SELECT 1 FROM saved_questions
          WHERE question_type = q.question_source AND question_id = q.id AND user_id = $2) as is_saved,
        -- 반응
        EXISTS(SELECT 1 FROM question_reactions
          WHERE question_id = q.id AND user_id = $3 AND reaction_type = 'like'
          AND question_type = q.question_source) as user_liked,
        EXISTS(SELECT 1 FROM question_reactions
          WHERE question_id = q.id AND user_id = $4 AND reaction_type = 'dislike'
          AND question_type = q.question_source) as user_disliked,
        -- 최신 의견 미리보기
        (SELECT json_build_object('id', op.id, 'username', u2.username, 'opinion', op.opinion)
         FROM question_opinions op
         JOIN users u2 ON op.user_id = u2.id
         WHERE op.question_id = q.id AND op.question_type = q.question_source
         ORDER BY op.created_at DESC LIMIT 1) as latest_opinion,
        -- 최신 관련질문 미리보기
        CASE
          WHEN q.question_source = 'user_question' THEN
            (SELECT json_build_object('username', u3.username, 'title', rq.title)
             FROM user_questions rq
             JOIN users u3 ON rq.user_id = u3.id
             WHERE rq.parent_question_id = q.id AND rq.is_deleted = false
             ORDER BY rq.created_at DESC LIMIT 1)
          ELSE
            (SELECT json_build_object('username', u3.username, 'title', rq.title)
             FROM user_questions rq
             JOIN users u3 ON rq.user_id = u3.id
             WHERE rq.related_seed_question_id = q.id AND rq.is_deleted = false
             ORDER BY rq.created_at DESC LIMIT 1)
        END as latest_related
       FROM (
         -- 사용자 질문
         SELECT
           uq.id,
           uq.title,
           uq.content,
           uq.thumbnail_url,
           uq.likes_count,
           uq.dislikes_count,
           uq.created_at,
           'user_question' as question_source,
           uq.user_id,
           u.username,
           GREATEST(
             uq.created_at,
             COALESCE((SELECT MAX(created_at) FROM question_opinions WHERE question_id = uq.id AND question_type = 'user_question'), uq.created_at),
             COALESCE((SELECT MAX(created_at) FROM user_questions WHERE parent_question_id = uq.id AND is_deleted = false), uq.created_at),
             COALESCE((SELECT MAX(created_at) FROM question_reactions WHERE question_id = uq.id AND question_type = 'user_question'), uq.created_at)
           ) as latest_activity
         FROM user_questions uq
         JOIN users u ON uq.user_id = u.id
         WHERE uq.parent_question_id IS NULL AND uq.related_seed_question_id IS NULL AND uq.is_deleted = false

         UNION ALL

         -- 퀴즈/씨드 질문 (의견 또는 관련질문이 있는 것만)
         SELECT
           sq.id,
           sq.question as title,
           sq.category as content,
           NULL as thumbnail_url,
           COALESCE(sq.likes_count, 0) as likes_count,
           COALESCE(sq.dislikes_count, 0) as dislikes_count,
           NOW() as created_at,
           'quiz' as question_source,
           NULL as user_id,
           '퀴즈' as username,
           GREATEST(
             COALESCE((SELECT MAX(created_at) FROM question_opinions WHERE question_id = sq.id AND question_type IN ('quiz', 'seed', 'icebreaking', 'olympic')), TIMESTAMP '1970-01-01'),
             COALESCE((SELECT MAX(created_at) FROM user_questions WHERE related_seed_question_id = sq.id AND is_deleted = false), TIMESTAMP '1970-01-01'),
             COALESCE((SELECT MAX(created_at) FROM question_reactions WHERE question_id = sq.id AND question_type IN ('quiz', 'seed', 'icebreaking', 'olympic')), TIMESTAMP '1970-01-01')
           ) as latest_activity
         FROM seed_questions sq
         WHERE
           EXISTS(SELECT 1 FROM question_opinions WHERE question_id = sq.id AND question_type IN ('quiz', 'seed', 'icebreaking', 'olympic'))
           OR EXISTS(SELECT 1 FROM user_questions WHERE related_seed_question_id = sq.id AND is_deleted = false)
           OR EXISTS(SELECT 1 FROM question_reactions WHERE question_id = sq.id AND question_type IN ('quiz', 'seed', 'icebreaking', 'olympic'))
       ) q
       WHERE $7::text[] IS NULL
          OR q.title ILIKE ANY($7::text[])
          OR q.content ILIKE ANY($7::text[])
          -- 의견(댓글) 텍스트 안에 검색어가 있어도 걸리게
          OR EXISTS (
               SELECT 1 FROM question_opinions qo
               WHERE qo.question_id = q.id AND qo.question_type = q.question_source
                 AND qo.opinion ILIKE ANY($7::text[])
             )
          -- 이 질문에 달린 관련질문 제목 안에 검색어가 있어도 걸리게
          OR (
               q.question_source = 'user_question' AND EXISTS (
                 SELECT 1 FROM user_questions rq
                 WHERE rq.parent_question_id = q.id AND rq.is_deleted = false
                   AND rq.title ILIKE ANY($7::text[])
               )
             )
          OR (
               q.question_source = 'quiz' AND EXISTS (
                 SELECT 1 FROM user_questions rq
                 WHERE rq.related_seed_question_id = q.id AND rq.is_deleted = false
                   AND rq.title ILIKE ANY($7::text[])
               )
             )
       ORDER BY ${orderClause}
       LIMIT $5 OFFSET $6`,
      [userId, userId, userId, userId, limit, offset, searchTokens]
    );

    // 전체 개수도 함께 반환 (프론트에서 "더보기" 버튼 표시 여부 판단용)
    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM (
         SELECT uq.id, uq.title, uq.content, 'user_question' as question_source
         FROM user_questions uq
         WHERE uq.parent_question_id IS NULL AND uq.related_seed_question_id IS NULL AND uq.is_deleted = false

         UNION ALL

         SELECT sq.id, sq.question as title, sq.category as content, 'quiz' as question_source
         FROM seed_questions sq
         WHERE
           EXISTS(SELECT 1 FROM question_opinions WHERE question_id = sq.id AND question_type IN ('quiz', 'seed', 'icebreaking', 'olympic'))
           OR EXISTS(SELECT 1 FROM user_questions WHERE related_seed_question_id = sq.id AND is_deleted = false)
           OR EXISTS(SELECT 1 FROM question_reactions WHERE question_id = sq.id AND question_type IN ('quiz', 'seed', 'icebreaking', 'olympic'))
       ) t
       WHERE $1::text[] IS NULL
          OR t.title ILIKE ANY($1::text[])
          OR t.content ILIKE ANY($1::text[])
          OR EXISTS (
               SELECT 1 FROM question_opinions qo
               WHERE qo.question_id = t.id AND qo.question_type = t.question_source
                 AND qo.opinion ILIKE ANY($1::text[])
             )
          OR (
               t.question_source = 'user_question' AND EXISTS (
                 SELECT 1 FROM user_questions rq
                 WHERE rq.parent_question_id = t.id AND rq.is_deleted = false
                   AND rq.title ILIKE ANY($1::text[])
               )
             )
          OR (
               t.question_source = 'quiz' AND EXISTS (
                 SELECT 1 FROM user_questions rq
                 WHERE rq.related_seed_question_id = t.id AND rq.is_deleted = false
                   AND rq.title ILIKE ANY($1::text[])
               )
             )`,
      [searchTokens]
    );
    const total = parseInt(countResult.rows[0].total);

    // user_reaction 필드 통일
    const questions = result.rows.map(q => ({
      ...q,
      user_reaction: q.user_liked ? 'like' : q.user_disliked ? 'dislike' : null,
      is_quiz: q.question_source === 'quiz',
    }));

    res.json({ questions, total, limit, offset });

  } catch (error) {
    console.error('질문 목록 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 내 질문 목록
router.get('/my', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user.userId;

    const result = await pool.query(
      `SELECT 
        id, 
        title, 
        content, 
        thumbnail_url,
        likes_count,
        dislikes_count,
        created_at
       FROM user_questions
       WHERE user_id = $1 AND is_deleted = false
       ORDER BY created_at DESC`,
      [userId]
    );

    res.json({ questions: result.rows });

  } catch (error) {
    console.error('내 질문 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 전체 질문 목록 (최신순/인기순)
router.get('/', async (req, res) => {
  try {
    const { sort = 'latest' } = req.query;

    let orderBy = 'uq.created_at DESC';
    if (sort === 'popular') {
      orderBy = 'uq.likes_count DESC, uq.created_at DESC';
    }

    const result = await pool.query(
      `SELECT 
        uq.id, 
        uq.title, 
        uq.content, 
        uq.thumbnail_url,
        uq.likes_count,
        uq.dislikes_count,
        uq.created_at,
        u.username,
        (SELECT COUNT(*) FROM user_questions WHERE parent_question_id = uq.id AND is_deleted = false) as comment_count
       FROM user_questions uq
       JOIN users u ON uq.user_id = u.id
       WHERE uq.is_deleted = false
       ORDER BY ${orderBy}
       LIMIT 100`
    );

    res.json({ questions: result.rows });

  } catch (error) {
    console.error('질문 목록 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// ===== /:id 하위 경로들 (/:id 보다 먼저!) =====

// 의견 등록 + 3송이 지급
router.post('/:id/opinion', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { opinion, questionType = 'user_question' } = req.body;
    const userId = req.user.id || req.user.userId;

    if (!opinion || !opinion.trim()) {
      return res.status(400).json({ error: '의견을 입력해주세요' });
    }

    await client.query('BEGIN');

    // 의견 저장 (question_type 포함)
    const result = await client.query(
      `INSERT INTO question_opinions (question_id, user_id, opinion, question_type, created_at) 
       VALUES ($1, $2, $3, $4, NOW()) 
       RETURNING id, opinion, created_at`,
      [id, userId, opinion, questionType]
    );

    // 2송이 지급 (관리자 계정은 제외)
    const opinionGrantResult = await client.query(
      'UPDATE users SET songi_count = songi_count + 2 WHERE id = $1 AND is_admin IS NOT TRUE',
      [userId]
    );
    const opinionSongiGranted = opinionGrantResult.rowCount > 0;

    // 원래 질문 내용 조회 + 작성자에게 알림 (씨드질문은 작성자가 없어서 알림 대상 아님)
    const isSeedQ = ['icebreaking', 'seed', 'quiz', 'olympic'].includes(questionType);
    let questionText = '';
    let opinionQId = null;
    try {
      if (isSeedQ) {
        const qRes = await client.query('SELECT question as title FROM seed_questions WHERE id = $1', [parseInt(id)]);
        questionText = qRes.rows[0]?.title || '';
      } else {
        const qRes = await client.query('SELECT title, user_id FROM user_questions WHERE id = $1', [parseInt(id)]);
        questionText = qRes.rows[0]?.title || '';
        const authorId = qRes.rows[0]?.user_id;
        // 작성자가 본인이 아닌 경우에만 알림 생성
        if (authorId && authorId !== userId) {
          await client.query(
            `INSERT INTO notifications (user_id, type, message, related_question_id, actor_id)
             VALUES ($1, 'opinion', $2, $3, $4)`,
            [authorId, `내 질문 "${questionText}"에 누군가 의견을 남겼어요.`, parseInt(id), userId]
          );
        }
      }
      opinionQId = parseInt(id) || null;
    } catch (e) {
      console.error('질문 내용 조회 실패 (무시):', e.message);
    }

    // songi_transactions 기록 (관리자는 0송이로 남겨서 활동 이력은 유지)
    // question_text에는 원래 질문 제목이 아니라 "내가 실제로 쓴 의견" 내용을 저장 — 송이내역에서 그대로 보여줘야 하니까
    await client.query(
      `INSERT INTO songi_transactions (user_id, amount, activity_type, description, question_id, question_text)
       VALUES ($1, $2, 'opinion', '의견 작성', $3, $4)`,
      [userId, opinionSongiGranted ? 2 : 0, opinionQId, opinion]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: opinionSongiGranted ? '의견이 등록되었습니다! 2송이를 획득했어요 🌸' : '의견이 등록되었습니다!',
      opinion: result.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('의견 등록 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  } finally {
    client.release();
  }
});

// 이름 뒤에 붙는 조사 "이/가" 고르기 (예: 철수가, 민준이, 314pie가)
function josaIGa(name) {
  const s = String(name || '').trim();
  if (!s) return '가';
  const ch = s[s.length - 1];
  const code = ch.charCodeAt(0);
  let hasBatchim;
  if (code >= 0xAC00 && code <= 0xD7A3) hasBatchim = (code - 0xAC00) % 28 !== 0;      // 한글: 받침 여부
  else if (/[0-9]/.test(ch)) hasBatchim = '013678'.includes(ch);                       // 영,일,삼,육,칠,팔
  else if (/[a-zA-Z]/.test(ch)) hasBatchim = 'lmnrLMNR'.includes(ch);                  // 엘,엠,엔,알
  else hasBatchim = false;
  return hasBatchim ? '이' : '가';
}

// 로그인 정보가 있으면 사용자 id를, 없거나 잘못됐으면 에러 없이 null을 돌려준다 (로그인 없이도 열리는 API용)
function getOptionalUserId(req) {
  try {
    const h = req.headers['authorization'];
    const token = h && h.split(' ')[1];
    if (!token) return null;
    const jwt = require('jsonwebtoken');
    const u = jwt.verify(token, process.env.JWT_SECRET);
    return u.id || u.userId || null;
  } catch (e) {
    return null;
  }
}

// 질문 주인이 의견을 열어 본 순간, 의견을 쓴 친구에게 "○○ 친구가 내 의견을 봤어요" 알림을 보낸다.
// (의견 하나당 한 번만, AI 의견과 본인 의견은 제외. 실패해도 조용히 무시)
async function markOpinionsSeen(ownerId, questionId, opinions) {
  try {
    const targets = opinions.filter(o => o.user_id !== ownerId && !o.is_ai);
    if (targets.length === 0) return;
    const nameRes = await pool.query('SELECT COALESCE(name, username) AS n FROM users WHERE id = $1', [ownerId]);
    const ownerName = nameRes.rows[0]?.n || '친구';
    for (const o of targets) {
      const ins = await pool.query(
        `INSERT INTO opinion_views (opinion_id, viewer_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING RETURNING opinion_id`,
        [o.id, ownerId]
      );
      if (ins.rowCount > 0) {
        await pool.query(
          `INSERT INTO notifications (user_id, type, message, related_question_id, actor_id)
           VALUES ($1, 'opinion_seen', $2, $3, $4)`,
          [o.user_id, `${ownerName}${josaIGa(ownerName)} 내 의견을 봤어요.`, parseInt(questionId, 10) || null, ownerId]
        );
      }
    }
  } catch (e) {
    console.error('의견 열람 알림 생성 실패 (무시):', e.message);
  }
}

// 의견 목록 조회
// - 질문 주인이 열면: (1) 각 의견에 can_mark(도움이 됐어요를 누를 수 있음) 표시, (2) 열람 알림 발송
router.get('/:id/opinions', async (req, res) => {
  try {
    const { id } = req.params;
    const questionType = req.query.type || 'user_question';
    const viewerId = getOptionalUserId(req);

    const result = await pool.query(
      `SELECT
        qo.id,
        qo.opinion,
        qo.created_at,
        qo.user_id,
        u.username,
        COALESCE(u.is_ai, FALSE) AS is_ai
       FROM question_opinions qo
       JOIN users u ON qo.user_id = u.id
       WHERE qo.question_id = $1 AND qo.question_type = $2
       ORDER BY qo.created_at DESC`,
      [id, questionType]
    );

    let opinions = result.rows;

    // 질문 주인인지 확인 (사용자가 올린 질문일 때만)
    let isOwner = false;
    if (viewerId && questionType === 'user_question') {
      try {
        const own = await pool.query('SELECT user_id FROM user_questions WHERE id = $1', [id]);
        isOwner = own.rows.length > 0 && own.rows[0].user_id === viewerId;
      } catch (e) { /* 무시 */ }
    }

    // 이미 "도움이 됐어요"가 눌린 의견 표시 (테이블이 아직 없어도 화면은 정상 동작)
    let helpfulSet = new Set();
    if (opinions.length > 0) {
      try {
        const h = await pool.query(
          'SELECT opinion_id FROM opinion_helpful WHERE opinion_id = ANY($1::int[])',
          [opinions.map(o => o.id)]
        );
        helpfulSet = new Set(h.rows.map(r => r.opinion_id));
      } catch (e) { /* 무시 */ }
    }

    opinions = opinions.map(o => ({
      id: o.id,
      opinion: o.opinion,
      created_at: o.created_at,
      username: o.username,
      helpful: helpfulSet.has(o.id),
      can_mark: isOwner && o.user_id !== viewerId && !o.is_ai,
      can_delete: isOwner && o.is_ai
    }));

    res.json({ opinions });

    // 응답을 보낸 뒤에 열람 알림 처리 (기다리지 않음)
    if (isOwner) {
      markOpinionsSeen(viewerId, id, result.rows);
    }

  } catch (error) {
    console.error('의견 목록 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// "도움이 됐어요": 질문 주인이 받은 의견에 누르는 버튼. 의견 쓴 친구에게 1송이(하루 최대 10번) + 알림
// - 질문 주인만, 남이 쓴 의견에만 가능. 의견 하나당 한 번만. AI 의견은 기록만 하고 송이/알림은 없음
router.post('/opinions/:opinionId/helpful', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const opinionId = parseInt(req.params.opinionId, 10);
    const userId = req.user.id || req.user.userId;
    if (!opinionId) {
      client.release();
      return res.status(400).json({ error: '잘못된 요청이에요' });
    }

    await client.query('BEGIN');

    const opRes = await client.query(
      `SELECT qo.id, qo.user_id, qo.question_id, qo.question_type, COALESCE(u.is_ai, FALSE) AS is_ai
       FROM question_opinions qo
       JOIN users u ON qo.user_id = u.id
       WHERE qo.id = $1`,
      [opinionId]
    );
    if (opRes.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: '의견을 찾을 수 없어요' });
    }
    const op = opRes.rows[0];

    const qRes = op.question_type === 'user_question'
      ? await client.query('SELECT user_id, title FROM user_questions WHERE id = $1', [op.question_id])
      : { rows: [] };
    if (qRes.rows.length === 0 || qRes.rows[0].user_id !== userId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json({ error: '내가 올린 질문에 달린 의견에만 누를 수 있어요' });
    }
    if (op.user_id === userId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: '내 의견에는 누를 수 없어요' });
    }

    const ins = await client.query(
      `INSERT INTO opinion_helpful (opinion_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING id`,
      [opinionId, userId]
    );

    let songi = 0;
    if (ins.rowCount > 0 && !op.is_ai) {
      // 하루 최대 10번까지만 송이 지급 (서로 눌러주기로 송이 모으는 것 방지)
      const cnt = await client.query(
        `SELECT COUNT(*) FROM songi_transactions
         WHERE user_id = $1 AND activity_type = 'helpful' AND amount > 0
           AND created_at >= date_trunc('day', NOW())`,
        [op.user_id]
      );
      if (parseInt(cnt.rows[0].count, 10) < 10) {
        const grant = await client.query(
          'UPDATE users SET songi_count = songi_count + 1 WHERE id = $1 AND is_admin IS NOT TRUE',
          [op.user_id]
        );
        if (grant.rowCount > 0) songi = 1;
      }
      await client.query(
        `INSERT INTO songi_transactions (user_id, amount, activity_type, description, question_id, question_text)
         VALUES ($1, $2, 'helpful', '의견이 도움이 됐어요', $3, $4)`,
        [op.user_id, songi, op.question_id, qRes.rows[0].title]
      );

      const nameRes = await client.query('SELECT COALESCE(name, username) AS n FROM users WHERE id = $1', [userId]);
      const ownerName = nameRes.rows[0]?.n || '친구';
      await client.query(
        `INSERT INTO notifications (user_id, type, message, related_question_id, actor_id)
         VALUES ($1, 'helpful', $2, $3, $4)`,
        [
          op.user_id,
          `${ownerName}${josaIGa(ownerName)} 내 의견이 도움이 됐대요!${songi > 0 ? ' 1송이를 받았어요 🌸' : ''}`,
          op.question_id,
          userId
        ]
      );
    }

    await client.query('COMMIT');
    client.release();
    res.json({ ok: true, alreadyMarked: ins.rowCount === 0 });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (e) { /* 무시 */ }
    client.release();
    console.error('도움이 됐어요 처리 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했어요' });
  }
});

// 관련질문에 "도움이 됐어요": 내 질문에 친구가 단 관련질문에 누르는 버튼. 관련질문 쓴 친구에게 1송이(하루 최대 10번, 의견과 합산) + 알림
// - 부모 질문의 주인만, 남이 쓴 관련질문에만 가능. 관련질문 하나당 한 번만
router.post('/related/:relatedId/helpful', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const relatedId = parseInt(req.params.relatedId, 10);
    const userId = req.user.id || req.user.userId;
    if (!relatedId) {
      client.release();
      return res.status(400).json({ error: '잘못된 요청이에요' });
    }

    await client.query('BEGIN');

    const rRes = await client.query(
      `SELECT r.id, r.user_id, r.title, r.parent_question_id, p.user_id AS parent_owner
       FROM user_questions r
       JOIN user_questions p ON r.parent_question_id = p.id
       WHERE r.id = $1 AND r.is_deleted = false`,
      [relatedId]
    );
    if (rRes.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: '관련질문을 찾을 수 없어요' });
    }
    const r = rRes.rows[0];
    if (r.parent_owner !== userId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json({ error: '내가 올린 질문에 달린 관련질문에만 누를 수 있어요' });
    }
    if (r.user_id === userId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(400).json({ error: '내가 쓴 관련질문에는 누를 수 없어요' });
    }

    const ins = await client.query(
      `INSERT INTO related_helpful (related_question_id, user_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING RETURNING id`,
      [relatedId, userId]
    );

    let songi = 0;
    if (ins.rowCount > 0) {
      const cnt = await client.query(
        `SELECT COUNT(*) FROM songi_transactions
         WHERE user_id = $1 AND activity_type = 'helpful' AND amount > 0
           AND created_at >= date_trunc('day', NOW())`,
        [r.user_id]
      );
      if (parseInt(cnt.rows[0].count, 10) < 10) {
        const grant = await client.query(
          'UPDATE users SET songi_count = songi_count + 1 WHERE id = $1 AND is_admin IS NOT TRUE',
          [r.user_id]
        );
        if (grant.rowCount > 0) songi = 1;
      }
      await client.query(
        `INSERT INTO songi_transactions (user_id, amount, activity_type, description, question_id, question_text)
         VALUES ($1, $2, 'helpful', '관련질문이 도움이 됐어요', $3, $4)`,
        [r.user_id, songi, relatedId, r.title]
      );

      const nameRes = await client.query('SELECT COALESCE(name, username) AS n FROM users WHERE id = $1', [userId]);
      const ownerName = nameRes.rows[0]?.n || '친구';
      await client.query(
        `INSERT INTO notifications (user_id, type, message, related_question_id, actor_id)
         VALUES ($1, 'helpful', $2, $3, $4)`,
        [
          r.user_id,
          `${ownerName}${josaIGa(ownerName)} 내 관련질문이 도움이 됐대요!${songi > 0 ? ' 1송이를 받았어요 🌸' : ''}`,
          r.parent_question_id,
          userId
        ]
      );
    }

    await client.query('COMMIT');
    client.release();
    res.json({ ok: true, alreadyMarked: ins.rowCount === 0 });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (e) { /* 무시 */ }
    client.release();
    console.error('관련질문 도움이 됐어요 처리 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했어요' });
  }
});

// 내 질문에 달린 "물음송이 AI" 의견 삭제 (질문 주인만, AI가 쓴 의견만 삭제 가능)
// - 친구가 쓴 의견은 여기서 지울 수 없다 (친구의 피드백은 도움이 됐어요로 응답)
router.delete('/opinions/:opinionId/ai', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const opinionId = parseInt(req.params.opinionId, 10);
    const userId = req.user.id || req.user.userId;
    if (!opinionId) {
      client.release();
      return res.status(400).json({ error: '잘못된 요청이에요' });
    }

    await client.query('BEGIN');

    const opRes = await client.query(
      `SELECT qo.id, qo.user_id, qo.question_id, qo.question_type, COALESCE(u.is_ai, FALSE) AS is_ai
       FROM question_opinions qo
       JOIN users u ON qo.user_id = u.id
       WHERE qo.id = $1`,
      [opinionId]
    );
    if (opRes.rows.length === 0) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(404).json({ error: '이미 지워졌거나 없는 의견이에요' });
    }
    const op = opRes.rows[0];
    if (!op.is_ai) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json({ error: '물음송이 AI가 쓴 의견만 지울 수 있어요' });
    }

    const qRes = op.question_type === 'user_question'
      ? await client.query('SELECT user_id FROM user_questions WHERE id = $1', [op.question_id])
      : { rows: [] };
    if (qRes.rows.length === 0 || qRes.rows[0].user_id !== userId) {
      await client.query('ROLLBACK');
      client.release();
      return res.status(403).json({ error: '내가 올린 질문에 달린 AI 의견만 지울 수 있어요' });
    }

    await client.query('DELETE FROM question_opinions WHERE id = $1', [opinionId]);
    // 그 AI 의견을 알리던 알림도 함께 정리
    await client.query(
      `DELETE FROM notifications
       WHERE user_id = $1 AND actor_id = $2 AND related_question_id = $3 AND type = 'opinion'`,
      [userId, op.user_id, op.question_id]
    );

    await client.query('COMMIT');
    client.release();
    res.json({ ok: true });
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (e) { /* 무시 */ }
    client.release();
    console.error('AI 의견 삭제 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했어요' });
  }
});

// 관련질문 등록 (icebreaking/seed/quiz 포함 모든 타입 지원) + 6송이
router.post('/:id/related', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { title, content, questionType } = req.body;
    const userId = req.user.id || req.user.userId;

    if (!title) {
      return res.status(400).json({ error: '질문 내용을 입력해주세요' });
    }

    await client.query('BEGIN');

    const isSeedType = questionType === 'icebreaking' || questionType === 'seed' || questionType === 'quiz' || questionType === 'olympic';

    let insertResult;
    if (isSeedType) {
      // seed_questions 참조 → related_seed_question_id 컬럼 사용
      insertResult = await client.query(
        `INSERT INTO user_questions (user_id, title, content, related_seed_question_id) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, title, content, created_at`,
        [userId, title, content || '', id]
      );
    } else {
      // user_questions 참조 → parent_question_id 컬럼 사용
      insertResult = await client.query(
        `INSERT INTO user_questions (user_id, title, content, parent_question_id) 
         VALUES ($1, $2, $3, $4) 
         RETURNING id, title, content, created_at`,
        [userId, title, content || '', id]
      );
    }

    const newQuestionId = insertResult.rows[0].id;

    // 대상이 사용자 질문인 경우, 그 작성자에게 알림 (본인이 아닌 경우만; 씨드질문은 작성자가 없어 생략)
    if (!isSeedType) {
      try {
        const parentRes = await client.query('SELECT user_id, title FROM user_questions WHERE id = $1', [id]);
        const parentAuthor = parentRes.rows[0]?.user_id;
        const parentTitle = parentRes.rows[0]?.title || '';
        if (parentAuthor && parentAuthor !== userId) {
          await client.query(
            `INSERT INTO notifications (user_id, type, message, related_question_id, actor_id)
             VALUES ($1, 'related', $2, $3, $4)`,
            [parentAuthor, `내 질문 "${parentTitle}"에 관련질문이 달렸어요: "${title}"`, id, userId]
          );
        }
      } catch (e) {
        console.error('관련질문 알림 생성 실패 (무시):', e.message);
      }
    }

    // saved_questions에도 저장 (내활동에서 보이게)
    const savedType = isSeedType ? `${questionType}_related` : 'related_question';
    try {
      await client.query(
        `INSERT INTO saved_questions (user_id, question_id, question_type) 
         VALUES ($1, $2, $3) 
         ON CONFLICT DO NOTHING`,
        [userId, newQuestionId, savedType]
      );
    } catch (err) {
      console.error('saved_questions 저장 실패:', err);
    }

    // ⚠️ 부모 질문도 함께 저장 - 관련질문(자식)은 "내 활동"에서 독립 카드로 안 보이게
    // 필터링돼 있고, 대신 부모 카드 밑에 트리로 중첩돼서 보여야 함. 근데 부모가
    // saved_questions에 없으면 부모 카드 자체가 안 뜨니 자식이 매달릴 자리가 없어짐.
    // 그래서 관련질문을 달 때마다 부모도 항상 같이 저장해줌 (이미 저장돼 있으면 그냥 무시됨).
    try {
      await client.query(
        `INSERT INTO saved_questions (user_id, question_id, question_type)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [userId, id, questionType]
      );
    } catch (err) {
      console.error('부모 질문 saved_questions 저장 실패:', err);
    }

    // seed_questions의 related_count 업데이트 (트리 구조 표시용)
    if (isSeedType) {
      try {
        await client.query(
          `UPDATE seed_questions SET related_count = COALESCE(related_count, 0) + 1 WHERE id = $1`,
          [id]
        );
      } catch (err) {
        console.error('related_count 업데이트 실패:', err);
      }
    }

    // 6송이 지급 (관리자 계정은 제외) - 질문(5송이)보다 관련질문을 더 높게 보상
    const relatedGrantResult = await client.query(
      'UPDATE users SET songi_count = songi_count + 6 WHERE id = $1 AND is_admin IS NOT TRUE',
      [userId]
    );
    const relatedSongiGranted = relatedGrantResult.rowCount > 0;

    // songi_transactions 기록 (관리자는 0송이로 남겨서 활동 이력은 유지)
    await client.query(
      `INSERT INTO songi_transactions (user_id, amount, activity_type, description, question_id, question_text)
       VALUES ($1, $2, 'related', '관련질문 작성', $3, $4)`,
      [userId, relatedSongiGranted ? 6 : 0, newQuestionId, title]
    );

    const userResult = await client.query(
      'SELECT songi_count FROM users WHERE id = $1',
      [userId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: relatedSongiGranted ? '관련질문이 등록되었습니다! 6송이를 획득했어요 🌸' : '관련질문이 등록되었습니다!',
      relatedQuestion: insertResult.rows[0],
      songi_count: userResult.rows[0].songi_count,
      songi_earned: relatedSongiGranted ? 6 : 0
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('관련질문 등록 오류:', error);
    res.status(500).json({ error: '관련질문 등록에 실패했습니다' });
  } finally {
    client.release();
  }
});

// 관련질문 전체 트리 조회 (1단계, 2단계, 3단계... 전부, 재귀)
// ⚡ 성능: 각 노드의 좋아요/싫어요/의견 개수/내 반응까지 이 쿼리 안에서 한 번에 내려줌
//    (예전엔 프론트에서 노드마다 /questions/:id를 또 호출해서 N+1이 났었음 — 2026-09-10 개선)
router.get('/:id/related-tree', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user.userId;
    // ⚠️ user_questions와 seed_questions는 서로 다른 테이블이라 id가 우연히 같을 수 있음.
    // type을 명시하지 않으면 엉뚱한 테이블의 질문이 부모/자식으로 잘못 엮일 수 있어서 반드시 구분해야 함.
    const questionType = req.query.type || 'user_question';
    const isSeedType = questionType === 'icebreaking' || questionType === 'seed' || questionType === 'quiz' || questionType === 'olympic';
    const rootWhere = isSeedType
      ? 'uq.related_seed_question_id = $1'
      : 'uq.parent_question_id = $1';

    const result = await pool.query(
      `WITH RECURSIVE thread AS (
         SELECT uq.id, uq.title, uq.content, uq.created_at, uq.parent_question_id, u.username, u.id as user_id,
                uq.likes_count, uq.dislikes_count
         FROM user_questions uq
         JOIN users u ON uq.user_id = u.id
         WHERE ${rootWhere} AND uq.is_deleted = false

         UNION ALL

         SELECT child.id, child.title, child.content, child.created_at, child.parent_question_id, u.username, u.id as user_id,
                child.likes_count, child.dislikes_count
         FROM user_questions child
         JOIN users u ON child.user_id = u.id
         JOIN thread ON child.parent_question_id = thread.id AND child.is_deleted = false
       )
       SELECT
         thread.*,
         (SELECT COUNT(*) FROM question_opinions
          WHERE question_id = thread.id AND (question_type = 'user_question' OR question_type IS NULL)) as opinion_count,
         (SELECT reaction_type FROM question_reactions
          WHERE question_id = thread.id AND user_id = $2 AND question_type = 'user_question') as user_reaction
       FROM thread
       ORDER BY created_at ASC`,
      [id, userId]
    );

    const relatedTree = result.rows.map(row => ({
      ...row,
      likesCount: parseInt(row.likes_count) || 0,
      dislikesCount: parseInt(row.dislikes_count) || 0,
      opinionCount: parseInt(row.opinion_count) || 0,
      userReaction: row.user_reaction || null,
    }));

    res.json({ relatedTree, rootId: parseInt(id) });
  } catch (error) {
    console.error('관련질문 트리 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 관련질문 목록 조회 (type 파라미터로 seed 타입 구분)
router.get('/:id/related', async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;

    const isSeedType = type === 'icebreaking' || type === 'seed' || type === 'quiz' || type === 'olympic';

    const whereClause = isSeedType
      ? 'uq.related_seed_question_id = $1'
      : 'uq.parent_question_id = $1';

    const result = await pool.query(
      `SELECT 
        uq.id,
        uq.title,
        uq.content,
        uq.created_at,
        u.username,
        u.id as user_id
       FROM user_questions uq
       JOIN users u ON uq.user_id = u.id
       WHERE ${whereClause} AND uq.is_deleted = false
       ORDER BY uq.created_at DESC`,
      [id]
    );

    res.json({ relatedQuestions: result.rows });

  } catch (error) {
    console.error('관련질문 목록 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 개별 질문 상태 조회 (is_saved, user_reaction)
router.get('/:id/status', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user.userId;

    const questionCheck = await pool.query(
      'SELECT id FROM user_questions WHERE id = $1',
      [id]
    );

    if (questionCheck.rows.length === 0) {
      return res.status(404).json({ error: '질문을 찾을 수 없습니다' });
    }

    const savedCheck = await pool.query(
      `SELECT id FROM saved_questions 
       WHERE user_id = $1 AND question_id = $2 AND question_type = 'user_question'`,
      [userId, id]
    );

    const reactionCheck = await pool.query(
      `SELECT reaction_type FROM question_reactions 
       WHERE user_id = $1 AND question_id = $2`,
      [userId, id]
    );

    res.json({
      is_saved: savedCheck.rows.length > 0,
      user_reaction: reactionCheck.rows.length > 0 ? reactionCheck.rows[0].reaction_type : null
    });

  } catch (error) {
    console.error('질문 상태 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 👍👎 좋아요/싫어요 토글 (같은 반응 → 취소, 다른 반응 → 변경, 새 반응 → 추가)
router.post('/:id/reaction', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const { reactionType, questionType = 'user_question' } = req.body;
    const userId = req.user.id || req.user.userId;

    if (!['like', 'dislike'].includes(reactionType)) {
      return res.status(400).json({ error: '올바른 반응 타입을 선택해주세요' });
    }

    // 테이블 결정
    const isSeed = ['icebreaking', 'seed', 'quiz', 'olympic'].includes(questionType);
    const tableName = isSeed ? 'seed_questions' : 'user_questions';

    await client.query('BEGIN');

    // 기존 반응 확인 (question_type 포함)
    const existingReaction = await client.query(
      'SELECT reaction_type FROM question_reactions WHERE question_id = $1 AND user_id = $2 AND question_type = $3',
      [id, userId, questionType]
    );

    if (existingReaction.rows.length > 0) {
      const currentReaction = existingReaction.rows[0].reaction_type;
      
      if (currentReaction === reactionType) {
        // ✅ 같은 반응 클릭 → 취소
        await client.query(
          'DELETE FROM question_reactions WHERE question_id = $1 AND user_id = $2 AND question_type = $3',
          [id, userId, questionType]
        );
        
        const countColumn = reactionType === 'like' ? 'likes_count' : 'dislikes_count';
        await client.query(
          `UPDATE ${tableName} SET ${countColumn} = GREATEST(${countColumn} - 1, 0) WHERE id = $1`,
          [id]
        );
        
        await client.query('COMMIT');
        return res.json({ message: '반응이 취소되었습니다', action: 'removed', reactionType });
        
      } else {
        // ✅ 다른 반응으로 변경
        await client.query(
          'UPDATE question_reactions SET reaction_type = $1 WHERE question_id = $2 AND user_id = $3 AND question_type = $4',
          [reactionType, id, userId, questionType]
        );
        
        const oldCountColumn = currentReaction === 'like' ? 'likes_count' : 'dislikes_count';
        await client.query(
          `UPDATE ${tableName} SET ${oldCountColumn} = GREATEST(${oldCountColumn} - 1, 0) WHERE id = $1`,
          [id]
        );
        
        const newCountColumn = reactionType === 'like' ? 'likes_count' : 'dislikes_count';
        await client.query(
          `UPDATE ${tableName} SET ${newCountColumn} = ${newCountColumn} + 1 WHERE id = $1`,
          [id]
        );
        
        await client.query('COMMIT');
        return res.json({ message: '반응이 변경되었습니다', action: 'changed', reactionType });
      }
      
    } else {
      // ✅ 새로운 반응 추가
      await client.query(
        'INSERT INTO question_reactions (question_id, user_id, reaction_type, question_type) VALUES ($1, $2, $3, $4)',
        [id, userId, reactionType, questionType]
      );
      
      const countColumn = reactionType === 'like' ? 'likes_count' : 'dislikes_count';
      await client.query(
        `UPDATE ${tableName} SET ${countColumn} = ${countColumn} + 1 WHERE id = $1`,
        [id]
      );

      // 대상이 사용자 질문인 경우, 작성자에게 알림 (본인이 아닌 경우만; 씨드질문은 작성자가 없어 생략)
      if (!isSeed) {
        try {
          const ownerRes = await client.query('SELECT user_id, title FROM user_questions WHERE id = $1', [id]);
          const ownerId = ownerRes.rows[0]?.user_id;
          const ownerTitle = ownerRes.rows[0]?.title || '';
          if (ownerId && ownerId !== userId) {
            const reactionLabel = reactionType === 'like' ? '관심있음' : '관심없음';
            await client.query(
              `INSERT INTO notifications (user_id, type, message, related_question_id, actor_id)
               VALUES ($1, 'reaction', $2, $3, $4)`,
              [ownerId, `내 질문 "${ownerTitle}"에 누군가 ${reactionLabel}을 눌렀어요.`, parseInt(id), userId]
            );
          }
        } catch (e) {
          console.error('반응 알림 생성 실패 (무시):', e.message);
        }
      }

      // 관심있음(like)일 때만 송이 지급 — 하루 최대 6회(=3점) 캡 (관리자는 캡과 무관하게 항상 0송이로 기록)
      if (reactionType === 'like') {
        const adminCheckForInterest = await client.query('SELECT is_admin FROM users WHERE id = $1', [userId]);
        const isAdminUser = adminCheckForInterest.rows[0]?.is_admin === true;

        const today = new Date().toISOString().slice(0, 10);
        const capCheck = await client.query(
          `SELECT COUNT(*) as today_count
           FROM songi_transactions
           WHERE user_id = $1
             AND activity_type = 'interest'
             AND DATE(created_at) = $2
             AND amount > 0`,
          [userId, today]
        );
        const todayCount = parseInt(capCheck.rows[0].today_count) || 0;

        if (isAdminUser || todayCount < 6) {
          // 원래 질문 내용 조회
          const isSeedQ2 = ['icebreaking', 'seed', 'quiz', 'olympic'].includes(questionType);
          let interestQText = '';
          let interestQId = null;
          try {
            const qRes2 = isSeedQ2
              ? await client.query('SELECT question as title FROM seed_questions WHERE id = $1', [parseInt(id)])
              : await client.query('SELECT title FROM user_questions WHERE id = $1', [parseInt(id)]);
            interestQText = qRes2.rows[0]?.title || '';
            interestQId = parseInt(id) || null;
          } catch (e) {
            console.error('질문 내용 조회 실패 (무시):', e.message);
          }

          // 0.5송이 지급 (관리자 계정은 제외, 기록은 항상 남김)
          let interestAmount = 0;
          if (!isAdminUser) {
            const interestGrantResult = await client.query(
              'UPDATE users SET songi_count = songi_count + 0.5 WHERE id = $1 AND is_admin IS NOT TRUE',
              [userId]
            );
            if (interestGrantResult.rowCount > 0) interestAmount = 0.5;
          }
          await client.query(
            `INSERT INTO songi_transactions (user_id, amount, activity_type, description, question_id, question_text)
             VALUES ($1, $2, 'interest', '관심 표시', $3, $4)`,
            [userId, interestAmount, interestQId, interestQText]
          );
        }
      }
      
      await client.query('COMMIT');
      return res.json({ message: '반응이 등록되었습니다', action: 'added', reactionType });
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('좋아요/싫어요 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  } finally {
    client.release();
  }
});

// 질문 반응 취소
router.delete('/:id/reaction', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user.userId;
    const questionType = req.query.type || 'user_question';

    const isSeed = ['icebreaking', 'seed', 'quiz', 'olympic'].includes(questionType);
    const tableName = isSeed ? 'seed_questions' : 'user_questions';

    await client.query('BEGIN');

    const existingReaction = await client.query(
      'SELECT reaction_type FROM question_reactions WHERE question_id = $1 AND user_id = $2 AND question_type = $3',
      [id, userId, questionType]
    );

    if (existingReaction.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: '반응을 찾을 수 없습니다' });
    }

    const reactionType = existingReaction.rows[0].reaction_type;

    await client.query(
      'DELETE FROM question_reactions WHERE question_id = $1 AND user_id = $2 AND question_type = $3',
      [id, userId, questionType]
    );

    const countField = reactionType === 'like' ? 'likes_count' : 'dislikes_count';
    await client.query(
      `UPDATE ${tableName} SET ${countField} = GREATEST(0, ${countField} - 1) WHERE id = $1`,
      [id]
    );

    await client.query('COMMIT');
    res.json({ message: '반응을 취소했습니다', action: 'removed', reactionType });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('반응 취소 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  } finally {
    client.release();
  }
});

// ===== /:id 단일 경로 (맨 마지막!) =====

// ⭐ 질문 상세 조회 (통계 + 사용자 반응 포함) - user_questions & seed_questions 모두 지원
router.get('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user.userId;
    const questionType = req.query.type || 'user_question'; // 쿼리 파라미터로 타입 구분

    console.log(`⭐ GET /:id 호출 - id: ${id}, type: ${questionType}`);

    let question = null;
    let opinionCount = 0;
    let relatedCount = 0;

    if (questionType === 'user_question' || questionType === 'user' || questionType === 'friend_question' || questionType === 'my_question' || questionType === 'quiz_related' || questionType === 'icebreaking_related' || questionType === 'related_question') {
      // user_questions 테이블 조회
      const result = await pool.query(
        `SELECT 
          uq.id, 
          uq.title, 
          uq.content, 
          uq.thumbnail_url,
          uq.likes_count,
          uq.dislikes_count,
          uq.created_at,
          u.username,
          u.id as user_id,
          (SELECT COUNT(*) FROM question_opinions WHERE question_id = uq.id AND (question_type = 'user_question' OR question_type IS NULL)) as opinion_count,
          (SELECT COUNT(*) FROM user_questions WHERE parent_question_id = uq.id AND is_deleted = false) as related_count
         FROM user_questions uq
         JOIN users u ON uq.user_id = u.id
         WHERE uq.id = $1`,
        [id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: '질문을 찾을 수 없습니다' });
      }

      question = result.rows[0];
      opinionCount = parseInt(question.opinion_count) || 0;
      relatedCount = parseInt(question.related_count) || 0;

    } else {
      // seed_questions 테이블 조회 (icebreaking, quiz, seed)
      console.log(`⭐ seed_questions 조회 시작 - id: ${id}, type: ${questionType}`);
      const result = await pool.query(
        `SELECT 
          id, 
          question as title, 
          category as content,
          COALESCE(likes_count, 0) as likes_count,
          COALESCE(dislikes_count, 0) as dislikes_count,
          COALESCE(related_count, 0) as related_count
         FROM seed_questions
         WHERE id = $1`,
        [id]
      );

      console.log(`⭐ seed_questions 결과: ${result.rows.length}건`, result.rows[0]);

      if (result.rows.length === 0) {
        return res.status(404).json({ error: '질문을 찾을 수 없습니다' });
      }

      // 의견 수 별도 조회 (seed/quiz/icebreaking 모두 포함)
      const opinionResult = await pool.query(
        `SELECT COUNT(*) as cnt FROM question_opinions WHERE question_id = $1 AND question_type = ANY($2)`,
        [id, ['seed', 'quiz', 'icebreaking', questionType]]
      );

      question = result.rows[0];
      opinionCount = parseInt(opinionResult.rows[0].cnt) || 0;
      relatedCount = parseInt(result.rows[0].related_count) || 0;
    }

    // 사용자 반응 확인 (question_type 포함)
    const reactionResult = await pool.query(
      'SELECT reaction_type FROM question_reactions WHERE question_id = $1 AND user_id = $2 AND question_type = $3',
      [id, userId, questionType]
    );

    res.json({ 
      question,
      likesCount: parseInt(question.likes_count) || 0,
      dislikesCount: parseInt(question.dislikes_count) || 0,
      opinionCount: opinionCount,
      relatedCount: relatedCount,
      userReaction: reactionResult.rows.length > 0 ? reactionResult.rows[0].reaction_type : null
    });

  } catch (error) {
    console.error('질문 상세 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 질문 수정
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, thumbnail_url } = req.body;
    const userId = req.user.id || req.user.userId;

    const checkResult = await pool.query(
      'SELECT user_id FROM user_questions WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: '질문을 찾을 수 없습니다' });
    }

    if (checkResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: '수정 권한이 없습니다' });
    }

    const result = await pool.query(
      `UPDATE user_questions 
       SET title = $1, content = $2, thumbnail_url = $3 
       WHERE id = $4 
       RETURNING id, title, content, thumbnail_url, created_at`,
      [title, content, thumbnail_url, id]
    );

    res.json({
      message: '질문이 수정되었습니다',
      question: result.rows[0]
    });

  } catch (error) {
    console.error('질문 수정 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 질문 삭제 (소프트 삭제 + 지급됐던 송이 회수)
// 실제로 행을 지우지 않고 is_deleted = true 로만 표시함.
// 학생 화면에서는 완전히 사라지지만 연구 분석용으로 원문은 DB에 남음.
router.delete('/:id', authenticateToken, async (req, res) => {
  const client = await pool.connect();
  let released = false;
  const releaseOnce = () => { if (!released) { released = true; client.release(); } };
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user.userId;

    await client.query('BEGIN');

    const checkResult = await client.query(
      `SELECT user_id, parent_question_id, related_seed_question_id, is_deleted
       FROM user_questions WHERE id = $1 FOR UPDATE`,
      [id]
    );

    if (checkResult.rows.length === 0) {
      await client.query('ROLLBACK');
      releaseOnce();
      return res.status(404).json({ error: '질문을 찾을 수 없습니다' });
    }

    const row = checkResult.rows[0];

    if (row.user_id !== userId) {
      // 본인 글이 아니면 관리자 권한 확인 (DB에서 직접 조회 — 토큰에 is_admin이 없을 수 있어서)
      const adminCheck = await client.query(
        'SELECT is_admin FROM users WHERE id = $1',
        [userId]
      );
      const isAdmin = adminCheck.rows.length > 0 && adminCheck.rows[0].is_admin === true;

      if (!isAdmin) {
        await client.query('ROLLBACK');
        releaseOnce();
        return res.status(403).json({ error: '삭제 권한이 없습니다' });
      }
    }

    if (row.is_deleted) {
      await client.query('ROLLBACK');
      releaseOnce();
      return res.status(400).json({ error: '이미 삭제된 질문이에요' });
    }

    // 소프트 삭제
    await client.query(
      'UPDATE user_questions SET is_deleted = true WHERE id = $1',
      [id]
    );

    // 이 질문을 올릴 때 지급됐던 송이를 찾아서 그만큼만 회수
    // 주의: 회수는 항상 '원 작성자(row.user_id)' 기준. 관리자가 삭제해도 관리자 송이가 아니라
    // 글쓴이 송이가 깎여야 함.
    const ownerId = row.user_id;
    const isAdminDelete = ownerId !== userId;
    const isRelated = row.parent_question_id !== null || row.related_seed_question_id !== null;
    const activityType = isRelated ? 'related' : 'question';

    const tx = await client.query(
      `SELECT amount FROM songi_transactions
       WHERE question_id = $1 AND activity_type = $2 AND user_id = $3
       ORDER BY created_at DESC LIMIT 1`,
      [id, activityType, ownerId]
    );

    let reversedAmount = 0;
    if (tx.rows.length > 0) reversedAmount = parseFloat(tx.rows[0].amount);

    if (reversedAmount > 0) {
      await client.query(
        'UPDATE users SET songi_count = GREATEST(songi_count - $1, 0) WHERE id = $2',
        [reversedAmount, ownerId]
      );
      await client.query(
        `INSERT INTO songi_transactions (user_id, amount, activity_type, description)
         VALUES ($1, $2, 'user_delete_reversal', $3)`,
        [ownerId, -reversedAmount, isAdminDelete
          ? `관리자 삭제로 인한 회수 (${activityType})`
          : `본인 삭제로 인한 회수 (${activityType})`]
      );
    }

    await client.query('COMMIT');
    releaseOnce();

    return res.json({
      message: reversedAmount > 0
        ? `질문을 지웠어요. ${reversedAmount}송이도 함께 반납됐어요`
        : '질문을 지웠어요',
      reversedAmount,
      adminDelete: isAdminDelete
    });

  } catch (error) {
    try { await client.query('ROLLBACK'); } catch (e) { /* 무시 */ }
    releaseOnce();
    console.error('질문 삭제 오류:', error);
    return res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;