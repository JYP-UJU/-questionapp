const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const axios = require('axios');

// 랜덤 질문 5개 가져오기
router.get('/random', authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT id, question, category
            FROM seed_questions
            WHERE review_stage = 'final_reviewed'
            ORDER BY RANDOM()
            LIMIT 5
        `);

        res.json({
            questions: result.rows
        });
    } catch (error) {
        console.error('Get random questions error:', error);
        res.status(500).json({ message: '질문을 불러오는데 실패했습니다' });
    }
});

// 질문 저장 (saved_questions에 저장)
router.post('/save', authenticateToken, async (req, res) => {
    const { questionId, sourceType } = req.body;
    const userId = req.user.userId;

    try {
        // 저장
        await pool.query(
            'INSERT INTO saved_questions (user_id, question_id, question_type) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
            [userId, questionId, sourceType]
        );

        res.json({ message: '질문이 저장되었습니다' });
    } catch (error) {
        console.error('Save question error:', error);
        res.status(500).json({ message: '질문 저장에 실패했습니다' });
    }
});

// 관심 표시 제출 (송이 지급)
router.post('/submit-interest', authenticateToken, async (req, res) => {
    const { responses } = req.body; // [{ questionId, interested }]
    const userId = req.user.userId;

    try {
        // 3송이 지급 (질문고르기 완료)
        await pool.query(
    'UPDATE users SET songi_count = songi_count + 5 WHERE id = $1',
    [userId]
);

// songi_transactions 기록
await pool.query(
    `INSERT INTO songi_transactions (user_id, amount, activity_type, description)
     VALUES ($1, 5, 'icebreaking', '질문고르기 완료')`,
    [userId]
);

res.json({ 
    message: '제출 완료! +5송이 획득',
    songiEarned: 5
});
    } catch (error) {
        console.error('Submit interest error:', error);
        res.status(500).json({ message: '제출에 실패했습니다' });
    }
});

// 좋아요/싫어요 저장 API
router.post('/reaction', authenticateToken, async (req, res) => {
    const { questionId, reactionType } = req.body;
    const userId = req.user.userId || req.user.id;

    try {
        if (!questionId || !reactionType) {
            return res.status(400).json({ message: '질문 ID와 반응 타입이 필요합니다' });
        }

        if (reactionType !== 'like' && reactionType !== 'dislike') {
            return res.status(400).json({ message: '반응 타입은 like 또는 dislike여야 합니다' });
        }

        // 기존 반응 확인
        const existing = await pool.query(
            'SELECT id, reaction_type FROM icebreaking_reactions WHERE user_id = $1 AND question_id = $2',
            [userId, questionId]
        );

        if (existing.rows.length > 0) {
            const existingReaction = existing.rows[0].reaction_type;
            
            if (existingReaction === reactionType) {
                // 같은 반응 클릭 = 취소
                await pool.query(
                    'DELETE FROM icebreaking_reactions WHERE user_id = $1 AND question_id = $2',
                    [userId, questionId]
                );
            } else {
                // 다른 반응으로 변경
                await pool.query(
                    'UPDATE icebreaking_reactions SET reaction_type = $1 WHERE user_id = $2 AND question_id = $3',
                    [reactionType, userId, questionId]
                );
            }
        } else {
            // 새 반응 추가
            await pool.query(
                'INSERT INTO icebreaking_reactions (user_id, question_id, reaction_type) VALUES ($1, $2, $3)',
                [userId, questionId, reactionType]
            );
        }

        // 업데이트된 카운트 조회
        const counts = await pool.query(
            `SELECT 
                COUNT(CASE WHEN reaction_type = 'like' THEN 1 END) as likes_count,
                COUNT(CASE WHEN reaction_type = 'dislike' THEN 1 END) as dislikes_count
             FROM icebreaking_reactions 
             WHERE question_id = $1`,
            [questionId]
        );

        res.json({
            message: '반응이 저장되었습니다',
            likes_count: parseInt(counts.rows[0].likes_count),
            dislikes_count: parseInt(counts.rows[0].dislikes_count)
        });
    } catch (error) {
        console.error('Reaction save error:', error);
        res.status(500).json({ message: '반응 저장에 실패했습니다' });
    }
});

// 질문들의 반응 카운트 조회
router.post('/reactions/counts', authenticateToken, async (req, res) => {
    const { questionIds } = req.body;
    const userId = req.user.userId || req.user.id;

    try {
        if (!questionIds || !Array.isArray(questionIds)) {
            return res.status(400).json({ message: '질문 ID 배열이 필요합니다' });
        }

        // 전체 카운트 조회
        const counts = await pool.query(
            `SELECT 
                question_id,
                COUNT(CASE WHEN reaction_type = 'like' THEN 1 END) as likes_count,
                COUNT(CASE WHEN reaction_type = 'dislike' THEN 1 END) as dislikes_count
             FROM icebreaking_reactions 
             WHERE question_id = ANY($1)
             GROUP BY question_id`,
            [questionIds]
        );

        // 내 반응 조회
        const myReactions = await pool.query(
            'SELECT question_id, reaction_type FROM icebreaking_reactions WHERE user_id = $1 AND question_id = ANY($2)',
            [userId, questionIds]
        );

        // 결과 정리
        const result = {};
        questionIds.forEach(id => {
            result[id] = {
                likes_count: 0,
                dislikes_count: 0,
                my_reaction: null
            };
        });

        counts.rows.forEach(row => {
            result[row.question_id] = {
                likes_count: parseInt(row.likes_count),
                dislikes_count: parseInt(row.dislikes_count),
                my_reaction: null
            };
        });

        myReactions.rows.forEach(row => {
            if (result[row.question_id]) {
                result[row.question_id].my_reaction = row.reaction_type;
            }
        });

        res.json({ reactions: result });
    } catch (error) {
        console.error('Get reactions error:', error);
        res.status(500).json({ message: '반응 조회에 실패했습니다' });
    }
});

module.exports = router;