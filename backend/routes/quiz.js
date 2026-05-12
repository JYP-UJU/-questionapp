const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');

// 랜덤 퀴즈 5문제 가져오기 (올림픽 top3 우선 + 나머지 랜덤)
router.get('/random', authenticateToken, async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id;
        const questions = [];
        const usedIds = [];

        // 1. 직전 올림픽에서 top3 뽑기
        //    - 우승 질문 1개 (결승 선택)
        //    - 4강에서 선택된 질문 중 2개
        try {
            // 직전 세션 id 조회
            const lastSession = await pool.query(
                `SELECT id, winner_question_id FROM olympic_sessions
                 WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
                [userId]
            );
            if (lastSession.rows.length > 0) {
                const sessionId = lastSession.rows[0].id;
                const winnerId = lastSession.rows[0].winner_question_id;

                // 우승 질문 (seed_questions에 있고 보기 있는 것)
                const winnerQ = await pool.query(
                    `SELECT id, question, category, option_1, option_2, option_3, option_4, option_5
                     FROM seed_questions
                     WHERE id = $1 AND option_1 IS NOT NULL`,
                    [winnerId]
                );
                if (winnerQ.rows.length > 0) {
                    questions.push(winnerQ.rows[0]);
                    usedIds.push(winnerQ.rows[0].id);
                }

                // 4강(round_number=1)에서 선택된 질문 중 우승 제외 2개
                const semifinalQ = await pool.query(
                    `SELECT DISTINCT sq.id, sq.question, sq.category,
                            sq.option_1, sq.option_2, sq.option_3, sq.option_4, sq.option_5
                     FROM olympic_rounds or2
                     JOIN seed_questions sq ON or2.question_id = sq.id
                     WHERE or2.session_id = $1
                       AND or2.round_number = 2
                       AND or2.selected = TRUE
                       AND sq.option_1 IS NOT NULL
                       AND sq.id != $2
                     LIMIT 2`,
                    [sessionId, winnerId]
                );
                for (const row of semifinalQ.rows) {
                    if (!usedIds.includes(row.id)) {
                        questions.push(row);
                        usedIds.push(row.id);
                    }
                }
            }
        } catch (e) {
            // olympic 데이터 없으면 무시하고 랜덤으로만 채움
            console.error('olympic top3 조회 오류:', e.message);
        }

        // 2. 나머지를 랜덤으로 채우기 (5개 목표)
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

        // 의견 저장 처리 - question_id + question_type 방식으로 통일
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

        // 송이 지급 (+5송이) - 5문제 세트 1회 기준
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
            totalSessions: Math.floor(totalResponses / 5) // 5문제=1회
        });

    } catch (error) {
        console.error('퀴즈 기록 조회 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다' });
    }
});

module.exports = router;
