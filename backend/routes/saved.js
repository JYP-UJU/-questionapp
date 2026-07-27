const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const axios = require('axios');

// 질문 저장하기 (새로 추가!)
router.post('/', authenticateToken, async (req, res) => {
    console.log('=== 질문 저장 시작 ===');
    console.log('Request body:', req.body);
    
    try {
        const userId = req.user.userId;
        const { questionId, questionType } = req.body;

        console.log('userId:', userId, 'questionId:', questionId, 'questionType:', questionType);

        if (!questionId || !questionType) {
            return res.status(400).json({ 
                message: '질문 ID와 타입을 입력해주세요',
                received: { questionId, questionType }
            });
        }

        // 유효한 타입 체크
        const validTypes = ['seed', 'user', 'quiz', 'icebreaking', 'user_question', 'friend_question', 'quiz_related', 'icebreaking_related', 'related_question', 'olympic'];
        if (!validTypes.includes(questionType)) {
            return res.status(400).json({ 
                message: '올바른 질문 타입이 아닙니다',
                validTypes 
            });
        }

        // 이미 저장되어 있는지 확인
        const checkResult = await pool.query(
            'SELECT id FROM saved_questions WHERE user_id = $1 AND question_id = $2 AND question_type = $3',
            [userId, questionId, questionType]
        );

        if (checkResult.rows.length > 0) {
            return res.status(200).json({ 
                message: '이미 저장된 질문입니다',
                savedId: checkResult.rows[0].id,
                alreadySaved: true
            });
        }

        // 질문 저장
        const result = await pool.query(
            `INSERT INTO saved_questions (user_id, question_id, question_type)
             VALUES ($1, $2, $3)
             RETURNING id, question_id, question_type, created_at`,
            [userId, questionId, questionType]
        );

        console.log('✅ 질문 저장 완료:', result.rows[0]);
        res.status(201).json({
            message: '질문이 저장되었습니다',
            saved: result.rows[0]
        });

    } catch (error) {
        console.error('❌ 질문 저장 오류:', error);
        res.status(500).json({ 
            message: '서버 오류가 발생했습니다',
            error: error.message 
        });
    }
});

// 담은 질문 목록 조회
router.get('/', authenticateToken, async (req, res) => {
    console.log('=== 담은 질문 조회 시작 ===');
    console.log('userId:', req.user?.userId);
    
    try {
        const userId = req.user.userId;
        const { sort = 'recent' } = req.query;

        // 정렬 조건
        let orderBy = 'sq.created_at DESC';
        if (sort === 'popular') {
            orderBy = 'sq.created_at DESC'; // 나중에 구현
        }
// 관심있음(like) 반응한 질문 조회
        const likedResult = await pool.query(`
            SELECT DISTINCT
                qr.question_id,
                qr.question_type,
                qr.created_at,
                COALESCE(uq.title, sq.question) as title,
                COALESCE(uq.content, sq.category) as content,
                COALESCE(uq.likes_count, sq.likes_count, 0) as likes_count,
                COALESCE(uq.dislikes_count, sq.dislikes_count, 0) as dislikes_count
            FROM question_reactions qr
            LEFT JOIN user_questions uq ON qr.question_id = uq.id
                AND qr.question_type IN ('user_question', 'friend_question', 'user')
                AND uq.parent_question_id IS NULL AND uq.related_seed_question_id IS NULL
            LEFT JOIN seed_questions sq ON qr.question_id = sq.id
                AND qr.question_type IN ('quiz', 'seed', 'icebreaking')
            WHERE qr.user_id = $1
              AND qr.reaction_type = 'like'
              AND (uq.id IS NOT NULL OR sq.id IS NOT NULL)
            ORDER BY qr.created_at DESC
        `, [userId]);

        // 내가 올린 질문 조회 (saved_questions에 이미 있는 건 제외)
        const myQuestionsResult = await pool.query(`
            SELECT 
                uq.id as question_id,
                'my_question' as question_type,
                uq.created_at,
                uq.title,
                uq.content,
                uq.thumbnail_url,
                uq.likes_count,
                uq.dislikes_count,
                u.username as author_username
            FROM user_questions uq
            JOIN users u ON uq.user_id = u.id
            WHERE uq.user_id = $1 
              AND uq.parent_question_id IS NULL 
              AND uq.related_seed_question_id IS NULL
              AND NOT EXISTS (
                SELECT 1 FROM saved_questions sq2
                WHERE sq2.user_id = $1
                AND sq2.question_id = uq.id
                AND sq2.question_type IN ('user_question', 'user', 'my_question', 'friend_question')
              )
            ORDER BY uq.created_at DESC
        `, [userId]);

        // 의견 남긴 질문 조회 (user_questions + seed_questions 모두)
        const opinionsResult = await pool.query(`
            SELECT DISTINCT
                qo.question_id,
                qo.question_type,
                MAX(qo.created_at) as created_at,
                COALESCE(uq.title, sq.question) as title,
                COALESCE(uq.content, sq.category) as content,
                uq.thumbnail_url,
                COALESCE(uq.likes_count, sq.likes_count, 0) as likes_count,
                COALESCE(uq.dislikes_count, sq.dislikes_count, 0) as dislikes_count,
                u.username as author_username
            FROM question_opinions qo
            LEFT JOIN user_questions uq ON qo.question_id = uq.id
                AND qo.question_type IN ('user_question', 'friend_question', 'user', 'my_question', 'opinion_question')
                AND uq.parent_question_id IS NULL AND uq.related_seed_question_id IS NULL
            LEFT JOIN seed_questions sq ON qo.question_id = sq.id
                AND qo.question_type IN ('quiz', 'seed', 'icebreaking')
            LEFT JOIN users u ON uq.user_id = u.id
            WHERE qo.user_id = $1
              AND qo.question_id IS NOT NULL
              AND (uq.id IS NOT NULL OR sq.id IS NOT NULL)
            GROUP BY qo.question_id, qo.question_type, uq.title, sq.question,
                     uq.content, sq.category, uq.thumbnail_url,
                     uq.likes_count, sq.likes_count, uq.dislikes_count, sq.dislikes_count, u.username
            ORDER BY created_at DESC
        `, [userId]);

        // 담은 질문 조회 (출처별 정보 포함)
        const query = `
            SELECT 
                sq.id as saved_id,
                sq.question_id,
                sq.question_type,
                sq.source_type,
                sq.created_at,
                
                -- seed_questions 정보 (퀴즈 문제)
                seed.question,
                seed.category,
                seed.option_1,
                seed.option_2,
                seed.option_3,
                seed.option_4,
                seed.option_5,
                seed.correct_option,
                seed.explanation,
                COALESCE(seed.likes_count, 0) as seed_likes_count,
                COALESCE(seed.dislikes_count, 0) as seed_dislikes_count,
                
                -- user_questions 정보 (내질문, 친구질문)
                uq.title as user_question_title,
                uq.content as user_question_content,
                uq.thumbnail_url,
                uq.likes_count,
                uq.dislikes_count,
                
                -- 작성자 정보 (친구질문용)
                u.username as author_username,

                -- olympic 질문 텍스트
                olq.question_text as olympic_question_text,
                olq.subject as olympic_subject,
                olq.question_type as olympic_type
                
            FROM saved_questions sq
LEFT JOIN seed_questions seed ON sq.question_id = seed.id AND COALESCE(sq.question_type, sq.source_type) IN ('quiz', 'icebreaking', 'seed')
LEFT JOIN user_questions uq ON sq.question_id = uq.id AND COALESCE(sq.question_type, sq.source_type) IN ('user', 'user_question', 'friend_question', 'quiz_related', 'icebreaking_related', 'related_question')
LEFT JOIN users u ON uq.user_id = u.id
LEFT JOIN LATERAL (
    SELECT DISTINCT ON (question_id) question_text, subject, question_type
    FROM olympic_rounds
    WHERE question_id = sq.question_id
    ORDER BY question_id, id DESC
) olq ON COALESCE(sq.question_type, sq.source_type) = 'olympic'

WHERE sq.user_id = $1
            ORDER BY ${orderBy}
        `;

        const result = await pool.query(query, [userId]);
        
        console.log(`조회된 담은 질문 수: ${result.rows.length}`);

        // 데이터 가공
        const savedQuestions = result.rows.map(row => {
            const base = {
                savedId: row.saved_id,
                questionType: row.question_type || row.source_type,
                createdAt: row.created_at
            };

            // 출처별 데이터 구성
            const qType = row.question_type || row.source_type;
            console.log(`row: questionId=${row.question_id}, qType=${qType}, question=${row.question}`);
            if (qType === 'quiz' || qType === 'icebreaking' || qType === 'seed') {
                return {
                    ...base,
                    questionId: row.question_id,
                    question: row.question,
                    title: row.question,
                    category: row.category,
                    correctOption: row.correct_option,
                    explanation: row.explanation,
                    likesCount: parseInt(row.seed_likes_count) || 0,
                    dislikesCount: parseInt(row.seed_dislikes_count) || 0,
                    options: row.option_1 ? {
                        option_1: row.option_1,
                        option_2: row.option_2,
                        option_3: row.option_3,
                        option_4: row.option_4,
                        option_5: row.option_5
                    } : null
                };
            } else if (qType === 'olympic') {
                return {
                    ...base,
                    questionId: row.question_id,
                    title: row.olympic_question_text,
                    content: row.olympic_subject,
                    likesCount: 0,
                    dislikesCount: 0,
                };
            } else if (qType === 'user' || qType === 'user_question' || qType === 'friend_question' || qType === 'quiz_related' || qType === 'icebreaking_related' || qType === 'related_question') {
                return {
                    ...base,
                    questionId: row.question_id,
                    title: row.user_question_title,
                    content: row.user_question_content,
                    thumbnailUrl: row.thumbnail_url,
                    likesCount: row.likes_count,
                    dislikesCount: row.dislikes_count,
                    authorUsername: row.author_username
                };
            }

            return base;
        });

        console.log('=== 담은 질문 조회 성공 ===');

        // 같은 질문이 화면(퀴즈/질문올림픽/질문고르기 등)에 따라 다른 question_type으로
        // 기록되어도 "같은 질문"으로 인식하도록 그룹화 (중복 카드 방지)
        const typeGroup = (t) => {
            if (['user_question', 'user', 'my_question', 'friend_question'].includes(t)) return 'user_group';
            if (['quiz', 'seed', 'icebreaking', 'olympic'].includes(t)) return 'seed_group';
            return t;
        };
        const dedupKey = (q) => `${q.questionId}_${typeGroup(q.questionType)}`;

        // 내가 올린 질문 가공
        const myQuestions = myQuestionsResult.rows.map(row => ({
            savedId: `my_${row.question_id}`,
            questionId: row.question_id,
            questionType: 'my_question',
            createdAt: row.created_at,
            title: row.title,
            content: row.content,
            thumbnailUrl: row.thumbnail_url,
            likesCount: row.likes_count,
            dislikesCount: row.dislikes_count,
            authorUsername: row.author_username
        }));

        // 의견 남긴 질문 가공
        const opinionQuestions = opinionsResult.rows.map(row => ({
            savedId: `op_${row.question_id}_${row.question_type}`,
            questionId: row.question_id,
            questionType: row.question_type || 'opinion_question',
            createdAt: row.created_at,
            title: row.title,
            content: row.content,
            thumbnailUrl: row.thumbnail_url,
            likesCount: parseInt(row.likes_count) || 0,
            dislikesCount: parseInt(row.dislikes_count) || 0,
            authorUsername: row.author_username
        }));

        // 중복 제거 - questionId + 타입그룹 조합으로 비교 (같은 씨드질문이 quiz/seed/olympic 등으로 갈려도 하나로 취급)
        const savedKeys = new Set(savedQuestions.map(dedupKey));
        const savedUserQuestionIds = new Set(
            savedQuestions
                .filter(q => typeGroup(q.questionType) === 'user_group')
                .map(q => q.questionId)
        );

        const uniqueMyQuestions = myQuestions.filter(q =>
            !savedKeys.has(dedupKey(q)) &&
            !savedUserQuestionIds.has(q.questionId)
        );

        const myAndSavedKeys = new Set([
            ...savedKeys,
            ...uniqueMyQuestions.map(dedupKey)
        ]);

        const uniqueOpinionQuestions = opinionQuestions.filter(q =>
            !myAndSavedKeys.has(dedupKey(q))
        );

        // 관심있음 가공
        const likedQuestions = likedResult.rows.map(row => ({
            savedId: `like_${row.question_id}_${row.question_type}`,
            questionId: row.question_id,
            questionType: row.question_type,
            createdAt: row.created_at,
            title: row.title,
            content: row.content,
            likesCount: parseInt(row.likes_count) || 0,
            dislikesCount: parseInt(row.dislikes_count) || 0,
        }));

        // 중복 제거 - 이미 다른 목록에 있는 건 제외 (타입그룹 기준)
        const allExistingKeys = new Set([
            ...savedQuestions.map(dedupKey),
            ...uniqueMyQuestions.map(dedupKey),
            ...uniqueOpinionQuestions.map(dedupKey),
        ]);
        const uniqueLikedQuestions = likedQuestions.filter(q =>
            !allExistingKeys.has(dedupKey(q))
        );

        const allQuestions = [...savedQuestions, ...uniqueMyQuestions, ...uniqueOpinionQuestions, ...uniqueLikedQuestions]
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

        res.json({
            savedQuestions: allQuestions,
            total: allQuestions.length
        });

    } catch (error) {
        console.error('❌ 담은 질문 조회 오류:', error);
        res.status(500).json({ 
            message: '서버 오류가 발생했습니다',
            error: error.message 
        });
    }
});

// 담은 질문 삭제
router.delete('/:savedId', authenticateToken, async (req, res) => {
    console.log('=== 담은 질문 삭제 시작 ===');
    
    try {
        const userId = req.user.userId;
        const { savedId } = req.params;

        console.log('userId:', userId, 'savedId:', savedId);

        // 본인의 저장 질문인지 확인
        const checkResult = await pool.query(
            'SELECT id FROM saved_questions WHERE id = $1 AND user_id = $2',
            [savedId, userId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: '저장된 질문을 찾을 수 없습니다' });
        }

        // 삭제 (CASCADE로 의견도 함께 삭제됨)
        await pool.query(
            'DELETE FROM saved_questions WHERE id = $1',
            [savedId]
        );

        console.log('✅ 담은 질문 삭제 완료');
        res.json({ message: '삭제되었습니다' });

    } catch (error) {
        console.error('❌ 담은 질문 삭제 오류:', error);
        res.status(500).json({ 
            message: '서버 오류가 발생했습니다',
            error: error.message 
        });
    }
});

// 담은 질문에 대한 의견 수정
router.put('/:savedId/opinion', authenticateToken, async (req, res) => {
    console.log('=== 의견 수정 시작 ===');
    
    try {
        const userId = req.user.userId;
        const { savedId } = req.params;
        const { opinion } = req.body;

        console.log('userId:', userId, 'savedId:', savedId, 'opinion:', opinion);

        // 본인의 저장 질문인지 확인
        const checkResult = await pool.query(
            'SELECT id FROM saved_questions WHERE id = $1 AND user_id = $2',
            [savedId, userId]
        );

        if (checkResult.rows.length === 0) {
            return res.status(404).json({ message: '저장된 질문을 찾을 수 없습니다' });
        }

        // 기존 의견 확인
        const existingOpinion = await pool.query(
            'SELECT id FROM question_opinions WHERE saved_question_id = $1',
            [savedId]
        );

        if (existingOpinion.rows.length > 0) {
            // 의견 수정
            await pool.query(
                `UPDATE question_opinions 
                 SET opinion = $1, updated_at = NOW() 
                 WHERE saved_question_id = $2`,
                [opinion, savedId]
            );
            console.log('✅ 의견 수정 완료');
        } else {
            // 의견 새로 추가
            await pool.query(
                `INSERT INTO question_opinions (saved_question_id, user_id, opinion)
                 VALUES ($1, $2, $3)`,
                [savedId, userId, opinion]
            );
            console.log('✅ 의견 추가 완료');
        }

        res.json({ message: '의견이 저장되었습니다' });

    } catch (error) {
        console.error('❌ 의견 수정 오류:', error);
        res.status(500).json({ 
            message: '서버 오류가 발생했습니다',
            error: error.message 
        });
    }
});

module.exports = router;