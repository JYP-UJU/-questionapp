const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');

// 랜덤 퀴즈 5문제 가져오기 (올림픽 4강 진출 4문제 우선 + 랜덤 1개)
router.get('/random', authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const questions = [];
        const usedIds = [];

        // 1. 직전 올림픽 세션에서 4강에 올라온 질문 4개 뽑기
        //    (선택 여부 관계없이 round_number=1에 노출된 것 전부)
        try {
            const lastSession = await pool.query(
                `SELECT id FROM olympic_sessions
                 WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
                [userId]
            );
            if (lastSession.rows.length > 0) {
                const sessionId = lastSession.rows[0].id;

                // 4강(round_number=1)에 노출된 질문 전부 (최대 4개)
                const semifinalQ = await pool.query(
                    `SELECT DISTINCT sq.id, sq.question, sq.category,
                            sq.option_1, sq.option_2, sq.option_3, sq.option_4, sq.option_5
                     FROM olympic_rounds or2
                     JOIN seed_questions sq ON or2.question_id = sq.id
                     WHERE or2.session_id = $1
                       AND or2.round_number = 1
                       AND sq.option_1 IS NOT NULL
                     LIMIT 4`,
                    [sessionId]
                );
                for (const row of semifinalQ.rows) {
                    questions.push(row);
                    usedIds.push(row.id);
                }
            }
        } catch (e) {
            console.error('olympic 4강 조회 오류:', e.message);
        }

        // 2. 나머지를 랜덤으로 채우기 (5개 목표, 보통 랜덤 1개)
        const needed = 5 - questions.length;
        if (needed > 0) {
            const placeholders = usedIds.length > 0
                ? `AND id NOT IN (${usedIds.map((_, i) => `$${i + 2}`).join(',')})`
                : '';
            const params = usedIds.length > 0 ? [needed, ...usedIds] : [needed];
            const fill = await pool.query(
                `SELECT id, question, category, option_1, option_2, option_3, option_4, option_5
                 FROM seed_questions
                 WHERE option_1 IS NOT NULL
                 ${placeholders}
                 ORDER BY RANDOM()
                 LIMIT $1`,
                params
            );
            questions.push(...fill.rows);
        }

        if (questions.length === 0) {
            return res.status(404).json({ message: '사용 가능한 퀴즈 문제가 없습니다' });
        }

        // 순서 섞기
        questions.sort(() => Math.random() - 0.5);

        res.json({ questions, total: questions.length });

    } catch (error) {
        console.error('퀴즈 가져오기 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다' });
    }
});

// 퀴즈 제출 및 채점
router.post('/submit', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    
    try {
        const { responses, savedQuestions = [], opinions = [] } = req.body;
        const userId = req.user?.userId || req.user?.id;

        if (!userId) {
            return res.status(400).json({ message: 'userId가 필요합니다' });
        }

        if (!responses || !Array.isArray(responses) || responses.length === 0) {
            return res.status(400).json({ message: '응답 데이터가 필요합니다' });
        }

        await client.query('BEGIN');

        let correctCount = 0;
        const results = [];

        // 각 문제 채점
        for (const response of responses) {
            const { questionId, selectedOption } = response;

            const questionResult = await client.query(
                `SELECT id, question, correct_option, explanation, 
                        option_1, option_2, option_3, option_4, option_5
                 FROM seed_questions WHERE id = $1`,
                [questionId]
            );

            if (questionResult.rows.length === 0) continue;

            const question = questionResult.rows[0];
            const isCorrect = selectedOption === question.correct_option;
            if (isCorrect) correctCount++;

            await client.query(
                `INSERT INTO quiz_responses (user_id, question_id, selected_option, is_correct)
                 VALUES ($1, $2, $3, $4)`,
                [userId, questionId, selectedOption, isCorrect]
            );

            results.push({
                questionId: question.id,
                question: question.question,
                selectedOption,
                correctOption: question.correct_option,
                isCorrect,
                explanation: question.explanation,
                options: {
                    option_1: question.option_1,
                    option_2: question.option_2,
                    option_3: question.option_3,
                    option_4: question.option_4,
                    option_5: question.option_5
                }
            });
        }

        // 저장된 질문들 처리
        for (const questionId of savedQuestions) {
            try {
                const checkResult = await client.query(
                    `SELECT id FROM saved_questions 
                     WHERE user_id = $1 AND question_id = $2 AND source_type = 'quiz'`,
                    [userId, questionId]
                );

                if (checkResult.rows.length === 0) {
                    await client.query(
                        `INSERT INTO saved_questions (user_id, question_id, source_type, source_id, user_answer)
                         VALUES ($1, $2, 'quiz', $2, $3)`,
                        [userId, questionId, responses.find(r => r.questionId === questionId)?.selectedOption]
                    );
                }
            } catch (err) {
                console.error(`질문 ${questionId} 저장 실패:`, err.message);
            }
        }

        // 의견 저장 처리
        for (const opinion of opinions) {
            try {
                const { questionId, opinionText } = opinion;
                if (!opinionText || opinionText.trim() === '') continue;

                await client.query(
                    `INSERT INTO question_opinions (user_id, question_id, question_type, opinion)
                     VALUES ($1, $2, 'quiz', $3)`,
                    [userId, questionId, opinionText.trim()]
                );
            } catch (err) {
                console.error(`의견 저장 실패:`, err.message);
            }
        }

        // 송이 지급 (+5송이)
        await client.query(
            'UPDATE users SET songi_count = songi_count + 5 WHERE id = $1',
            [userId]
        );
        await client.query(
            `INSERT INTO songi_transactions (user_id, amount, activity_type, description)
             VALUES ($1, 5, 'quiz', '퀴즈 완료')`,
            [userId]
        );

        const userResult = await client.query(
            'SELECT songi_count FROM users WHERE id = $1',
            [userId]
        );
        const currentSongi = userResult.rows[0]?.songi_count || 0;

        await client.query('COMMIT');

        res.json({
            correctCount,
            totalCount: responses.length,
            songiEarned: 5,
            currentSongi,
            results,
            savedCount: savedQuestions.length,
            opinionsCount: opinions.length
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('퀴즈 제출 오류:', error.message);
        res.status(500).json({ 
            message: '서버 오류가 발생했습니다',
            error: error.message
        });
    } finally {
        client.release();
    }
});

// 내 퀴즈 기록 조회 (5문제=1회 기준)
router.get('/my-history', authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const { limit = 10, offset = 0 } = req.query;

        const result = await pool.query(
            `SELECT qr.*, sq.question, sq.category, sq.explanation
             FROM quiz_responses qr
             JOIN seed_questions sq ON qr.question_id = sq.id
             WHERE qr.user_id = $1
             ORDER BY qr.created_at DESC
             LIMIT $2 OFFSET $3`,
            [userId, limit, offset]
        );

        const countResult = await pool.query(
            'SELECT COUNT(*) FROM quiz_responses WHERE user_id = $1',
            [userId]
        );

        const totalResponses = parseInt(countResult.rows[0].count);

        res.json({
            history: result.rows,
            total: totalResponses,
            totalSessions: Math.floor(totalResponses / 5)
        });

    } catch (error) {
        console.error('퀴즈 기록 조회 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다' });
    }
});

module.exports = router;
