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

    // 질문 저장 (관련질문인 경우 parent_question_id 포함)
    const result = await client.query(
      `INSERT INTO user_questions (user_id, title, content, thumbnail_url, parent_question_id) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING id, title, content, thumbnail_url, parent_question_id, created_at`,
      [userId, title, content, thumbnail_url, parent_question_id || null]
    );

    const question = result.rows[0];

    // 5송이 지급
    await client.query(
      'UPDATE users SET songi_count = songi_count + 5 WHERE id = $1',
      [userId]
    );

    // songi_transactions 기록
    await client.query(
      `INSERT INTO songi_transactions (user_id, amount, activity_type, description, question_id, question_text)
       VALUES ($1, 5, 'question', $2, $3, $4)`,
      [userId, '질문 작성', question.id, title]
    );

    // 업데이트된 송이 개수 조회
    const userResult = await client.query(
      'SELECT songi_count FROM users WHERE id = $1',
      [userId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: '질문이 등록되었습니다! 5송이를 획득했어요 🌸',
      question,
      songi_count: userResult.rows[0].songi_count,
      songi_earned: 5
    });

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
            (SELECT COUNT(*) FROM user_questions WHERE parent_question_id = q.id)
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
        (SELECT json_build_object('username', u2.username, 'opinion', op.opinion)
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
             WHERE rq.parent_question_id = q.id
             ORDER BY rq.created_at DESC LIMIT 1)
          ELSE
            (SELECT json_build_object('username', u3.username, 'title', rq.title)
             FROM user_questions rq
             JOIN users u3 ON rq.user_id = u3.id
             WHERE rq.related_seed_question_id = q.id
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
             COALESCE((SELECT MAX(created_at) FROM user_questions WHERE parent_question_id = uq.id), uq.created_at),
             COALESCE((SELECT MAX(created_at) FROM question_reactions WHERE question_id = uq.id AND question_type = 'user_question'), uq.created_at)
           ) as latest_activity
         FROM user_questions uq
         JOIN users u ON uq.user_id = u.id
         WHERE uq.parent_question_id IS NULL AND uq.related_seed_question_id IS NULL

         UNION ALL

         -- 퀴즈/씨드 질문 (의견 또는 관련질문이 있는 것만)
         SELECT
           sq.id,
           sq.question as title,
           sq.category as content,
           NULL as thumbnail_url,
           COALESCE(sq.likes_count, 0) as likes_count,
           COALESCE(sq.dislikes_count, 0) as dislikes_count,
           sq.created_at,
           'quiz' as question_source,
           NULL as user_id,
           '씨드질문' as username,
           GREATEST(
             COALESCE((SELECT MAX(created_at) FROM question_opinions WHERE question_id = sq.id AND question_type IN ('quiz', 'seed', 'icebreaking')), sq.created_at),
             COALESCE((SELECT MAX(created_at) FROM user_questions WHERE related_seed_question_id = sq.id), sq.created_at),
             COALESCE((SELECT MAX(created_at) FROM question_reactions WHERE question_id = sq.id AND question_type IN ('quiz', 'seed', 'icebreaking')), sq.created_at)
           ) as latest_activity
         FROM seed_questions sq
         WHERE
           EXISTS(SELECT 1 FROM question_opinions WHERE question_id = sq.id AND question_type IN ('quiz', 'seed', 'icebreaking'))
           OR EXISTS(SELECT 1 FROM user_questions WHERE related_seed_question_id = sq.id)
           OR EXISTS(SELECT 1 FROM question_reactions WHERE question_id = sq.id AND question_type IN ('quiz', 'seed', 'icebreaking'))
       ) q
       ORDER BY q.latest_activity DESC
       LIMIT 25`,
      [userId, userId, userId, userId]
    );

    // user_reaction 필드 통일
    const questions = result.rows.map(q => ({
      ...q,
      user_reaction: q.user_liked ? 'like' : q.user_disliked ? 'dislike' : null,
      is_quiz: q.question_source === 'quiz',
    }));

    res.json({ questions });

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
       WHERE user_id = $1
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
        (SELECT COUNT(*) FROM user_questions WHERE parent_question_id = uq.id) as comment_count
       FROM user_questions uq
       JOIN users u ON uq.user_id = u.id
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

    // 3송이 지급
    await client.query(
      'UPDATE users SET songi_count = songi_count + 3 WHERE id = $1',
      [userId]
    );

    // 원래 질문 내용 조회
    const isSeedQ = ['icebreaking', 'seed', 'quiz'].includes(questionType);
    let questionText = '';
    let opinionQId = null;
    try {
      const qRes = isSeedQ
        ? await client.query('SELECT question as title FROM seed_questions WHERE id = $1', [parseInt(id)])
        : await client.query('SELECT title FROM user_questions WHERE id = $1', [parseInt(id)]);
      questionText = qRes.rows[0]?.title || '';
      opinionQId = parseInt(id) || null;
    } catch (e) {
      console.error('질문 내용 조회 실패 (무시):', e.message);
    }

    // songi_transactions 기록
    await client.query(
      `INSERT INTO songi_transactions (user_id, amount, activity_type, description, question_id, question_text)
       VALUES ($1, 3, 'opinion', '의견 작성', $2, $3)`,
      [userId, opinionQId, questionText]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: '의견이 등록되었습니다! 3송이를 획득했어요 🌸',
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

// 의견 목록 조회
router.get('/:id/opinions', async (req, res) => {
  try {
    const { id } = req.params;
    const questionType = req.query.type || 'user_question';

    const result = await pool.query(
      `SELECT 
        qo.id,
        qo.opinion,
        qo.created_at,
        u.username
       FROM question_opinions qo
       JOIN users u ON qo.user_id = u.id
       WHERE qo.question_id = $1 AND qo.question_type = $2
       ORDER BY qo.created_at DESC`,
      [id, questionType]
    );

    res.json({ opinions: result.rows });

  } catch (error) {
    console.error('의견 목록 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

// 관련질문 등록 (icebreaking/seed/quiz 포함 모든 타입 지원) + 5송이
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

    const isSeedType = questionType === 'icebreaking' || questionType === 'seed' || questionType === 'quiz';

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

    // 5송이 지급
    await client.query(
      'UPDATE users SET songi_count = songi_count + 5 WHERE id = $1',
      [userId]
    );

    // songi_transactions 기록
    await client.query(
      `INSERT INTO songi_transactions (user_id, amount, activity_type, description, question_id, question_text)
       VALUES ($1, 5, 'related', '관련질문 작성', $2, $3)`,
      [userId, newQuestionId, title]
    );

    const userResult = await client.query(
      'SELECT songi_count FROM users WHERE id = $1',
      [userId]
    );

    await client.query('COMMIT');

    res.status(201).json({
      message: '관련질문이 등록되었습니다! 5송이를 획득했어요 🌸',
      relatedQuestion: insertResult.rows[0],
      songi_count: userResult.rows[0].songi_count,
      songi_earned: 5
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('관련질문 등록 오류:', error);
    res.status(500).json({ error: '관련질문 등록에 실패했습니다' });
  } finally {
    client.release();
  }
});

// 관련질문 목록 조회 (type 파라미터로 seed 타입 구분)
router.get('/:id/related', async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;

    const isSeedType = type === 'icebreaking' || type === 'seed' || type === 'quiz';

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
       WHERE ${whereClause}
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
    const isSeed = ['icebreaking', 'seed', 'quiz'].includes(questionType);
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

      // 관심있음(like)일 때만 송이 지급 — 하루 최대 3점 캡
      if (reactionType === 'like') {
        const today = new Date().toISOString().slice(0, 10);
        const capCheck = await client.query(
          `SELECT COALESCE(SUM(amount), 0) as today_total
           FROM songi_transactions
           WHERE user_id = $1
             AND activity_type = 'interest'
             AND DATE(created_at) = $2`,
          [userId, today]
        );
        const todayTotal = parseInt(capCheck.rows[0].today_total) || 0;

        if (todayTotal < 3) {
          // 원래 질문 내용 조회
          const isSeedQ2 = ['icebreaking', 'seed', 'quiz'].includes(questionType);
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

          await client.query(
            'UPDATE users SET songi_count = songi_count + 1 WHERE id = $1',
            [userId]
          );
          await client.query(
            `INSERT INTO songi_transactions (user_id, amount, activity_type, description, question_id, question_text)
             VALUES ($1, 1, 'interest', '관심 표시', $2, $3)`,
            [userId, interestQId, interestQText]
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

    const isSeed = ['icebreaking', 'seed', 'quiz'].includes(questionType);
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

    if (questionType === 'user_question' || questionType === 'user' || questionType === 'friend_question' || questionType === 'quiz_related' || questionType === 'icebreaking_related' || questionType === 'related_question') {
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
          (SELECT COUNT(*) FROM user_questions WHERE parent_question_id = uq.id) as related_count
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

// 질문 삭제
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id || req.user.userId;

    const checkResult = await pool.query(
      'SELECT user_id FROM user_questions WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: '질문을 찾을 수 없습니다' });
    }

    if (checkResult.rows[0].user_id !== userId) {
      return res.status(403).json({ error: '삭제 권한이 없습니다' });
    }

    await pool.query('DELETE FROM user_questions WHERE id = $1', [id]);

    res.json({ message: '질문이 삭제되었습니다' });

  } catch (error) {
    console.error('질문 삭제 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다' });
  }
});

module.exports = router;