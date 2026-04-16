const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticateToken = require('../middleware/auth');
const axios = require('axios');

// 랜덤 퀴즈 5문제 가져오기 (각 분야별 1개씩)
router.get('/random', authenticateToken, async (req, res) => {
    try {
        console.log('=== 랜덤 퀴즈 요청 ===');
        console.log('userId:', req.user?.userId);
        
        const categories = ['물리', '화학', '생물', '지구과학', '일상생활'];
        const questions = [];

        for (const category of categories) {
            const result = await pool.query(
                `SELECT id, question, category, option_1, option_2, option_3, option_4, option_5
                 FROM seed_questions 
                 WHERE category = $1 
                 ORDER BY RANDOM() 
                 LIMIT 1`,
                [category]
            );

            if (result.rows.length > 0) {
                questions.push(result.rows[0]);
            }
        }

        if (questions.length === 0) {
            return res.status(404).json({ message: '사용 가능한 퀴즈 문제가 없습니다' });
        }

        console.log('퀴즈 문제 수:', questions.length);
        res.json({
            questions: questions,
            total: questions.length
        });

    } catch (error) {
        console.error('퀴즈 가져오기 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다' });
    }
});

// 퀴즈 제출 및 채점
router.post('/submit', authenticateToken, async (req, res) => {
    console.log('=== 퀴즈 제출 시작 ===');
    console.log('req.user:', req.user);
    console.log('req.body:', JSON.stringify(req.body, null, 2));
    
    const client = await pool.connect();
    
    try {
        const { responses, savedQuestions = [], opinions = [] } = req.body;
        const userId = req.user?.userId;

        console.log('추출된 userId:', userId);
        console.log('responses 타입:', typeof responses);
        console.log('responses 배열 여부:', Array.isArray(responses));
        console.log('responses 길이:', responses?.length);
        console.log('savedQuestions:', savedQuestions);
        console.log('opinions:', opinions);

        // 유효성 검사
        if (!userId) {
            console.error('❌ userId가 없습니다!');
            return res.status(400).json({ message: 'userId가 필요합니다' });
        }

        if (!responses || !Array.isArray(responses) || responses.length === 0) {
            console.error('❌ responses 데이터 문제!');
            return res.status(400).json({ message: '응답 데이터가 필요합니다' });
        }

        await client.query('BEGIN');
        console.log('✅ 트랜잭션 시작');

        let correctCount = 0;
        const results = [];

        // 각 문제 채점
        for (let i = 0; i < responses.length; i++) {
            const response = responses[i];
            const { questionId, selectedOption } = response;

            console.log(`\n--- 문제 ${i + 1} ---`);
            console.log('questionId:', questionId, '(타입:', typeof questionId, ')');
            console.log('selectedOption:', selectedOption, '(타입:', typeof selectedOption, ')');

            // 정답 및 설명 가져오기
            const questionResult = await client.query(
                `SELECT id, question, correct_option, explanation, 
                        option_1, option_2, option_3, option_4, option_5
                 FROM seed_questions 
                 WHERE id = $1`,
                [questionId]
            );

            console.log('DB 조회 결과 수:', questionResult.rows.length);

            if (questionResult.rows.length === 0) {
                console.warn(`⚠️ 문제 ${questionId}를 DB에서 찾을 수 없습니다`);
                continue;
            }

            const question = questionResult.rows[0];
            console.log('문제 정보:', {
                id: question.id,
                correct_option: question.correct_option,
                question: question.question.substring(0, 30) + '...'
            });

            const isCorrect = selectedOption === question.correct_option;
            console.log('정답 여부:', isCorrect);

            if (isCorrect) {
                correctCount++;
            }

            // 퀴즈 응답 저장
            console.log('quiz_responses에 저장:', { userId, questionId, selectedOption, isCorrect });
            await client.query(
                `INSERT INTO quiz_responses (user_id, question_id, selected_option, is_correct)
                 VALUES ($1, $2, $3, $4)`,
                [userId, questionId, selectedOption, isCorrect]
            );
            console.log('✅ 저장 완료');

            results.push({
                questionId: question.id,
                question: question.question,
                selectedOption: selectedOption,
                correctOption: question.correct_option,
                isCorrect: isCorrect,
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

        console.log('\n--- 질문 저장 처리 ---');
        // 저장된 질문들 처리 (북마크 🔖)
        const savedQuestionIds = [];
        for (const questionId of savedQuestions) {
            try {
                // 중복 확인
                const checkResult = await client.query(
                    `SELECT id FROM saved_questions 
                     WHERE user_id = $1 AND question_id = $2 AND source_type = 'quiz'`,
                    [userId, questionId]
                );

                if (checkResult.rows.length === 0) {
                    // 저장
                    const insertResult = await client.query(
                        `INSERT INTO saved_questions (user_id, question_id, source_type, source_id, user_answer)
                         VALUES ($1, $2, 'quiz', $2, $3)
                         RETURNING id`,
                        [userId, questionId, responses.find(r => r.questionId === questionId)?.selectedOption]
                    );
                    savedQuestionIds.push({
                        questionId,
                        savedId: insertResult.rows[0].id
                    });
                    console.log(`✅ 질문 ${questionId} 저장 완료`);
                } else {
                    savedQuestionIds.push({
                        questionId,
                        savedId: checkResult.rows[0].id
                    });
                    console.log(`ℹ️ 질문 ${questionId} 이미 저장됨`);
                }
            } catch (error) {
                console.error(`❌ 질문 ${questionId} 저장 실패:`, error);
            }
        }

        console.log('\n--- 의견 저장 처리 ---');
        // 의견 저장 처리 (🤔 제 생각과 달라요)
        for (const opinion of opinions) {
            try {
                const { questionId, opinionText } = opinion;
                
                if (!opinionText || opinionText.trim() === '') {
                    console.log(`⚠️ 질문 ${questionId} 의견이 비어있음`);
                    continue;
                }

                // 해당 질문이 저장되었는지 확인
                const saved = savedQuestionIds.find(sq => sq.questionId === questionId);
                let savedQuestionId;

                if (saved) {
                    savedQuestionId = saved.savedId;
                } else {
                    // 의견만 입력한 경우, 질문도 함께 저장
                    const insertResult = await client.query(
                        `INSERT INTO saved_questions (user_id, question_id, source_type, source_id, user_answer)
                         VALUES ($1, $2, 'quiz', $2, $3)
                         RETURNING id`,
                        [userId, questionId, responses.find(r => r.questionId === questionId)?.selectedOption]
                    );
                    savedQuestionId = insertResult.rows[0].id;
                    console.log(`✅ 의견 입력을 위해 질문 ${questionId} 자동 저장`);
                }

                // 의견 저장
                await client.query(
                    `INSERT INTO question_opinions (saved_question_id, user_id, opinion)
                     VALUES ($1, $2, $3)`,
                    [savedQuestionId, userId, opinionText.trim()]
                );
                console.log(`✅ 질문 ${questionId}에 대한 의견 저장 완료`);

            } catch (error) {
                console.error(`❌ 의견 저장 실패:`, error);
            }
        }

        console.log('\n--- 송이 지급 ---');
        // 송이 지급 (+5송이)
        await client.query(
            'UPDATE users SET songi_count = songi_count + 5 WHERE id = $1',
            [userId]
        );

        // songi_transactions 기록
        await client.query(
            `INSERT INTO songi_transactions (user_id, amount, activity_type, description)
             VALUES ($1, 5, 'quiz', '퀴즈 완료')`,
            [userId]
        );
        console.log('✅ 송이 +5 완료');

        // 업데이트된 송이 수 가져오기
        const userResult = await client.query(
            'SELECT songi_count FROM users WHERE id = $1',
            [userId]
        );

        const currentSongi = userResult.rows.length > 0 ? userResult.rows[0].songi_count : 0;
        console.log('현재 송이:', currentSongi);

        await client.query('COMMIT');
        console.log('✅ 트랜잭션 커밋 완료');

        const responseData = {
            correctCount: correctCount,
            totalCount: responses.length,
            songiEarned: 5,
            currentSongi: currentSongi,
            results: results,
            savedCount: savedQuestions.length,
            opinionsCount: opinions.length
        };

        console.log('\n=== 퀴즈 제출 성공 ===');
        console.log('정답 수:', correctCount, '/', responses.length);
        console.log('저장된 질문 수:', savedQuestions.length);
        console.log('입력된 의견 수:', opinions.length);
        
        res.json(responseData);

    } catch (error) {
        await client.query('ROLLBACK');
        console.error('\n❌❌❌ 퀴즈 제출 오류 ❌❌❌');
        console.error('오류 메시지:', error.message);
        console.error('오류 스택:', error.stack);
        console.error('오류 상세:', JSON.stringify(error, null, 2));
        
        res.status(500).json({ 
            message: '서버 오류가 발생했습니다',
            error: error.message,
            detail: error.detail || '상세 정보 없음'
        });
    } finally {
        client.release();
        console.log('DB 연결 해제');
    }
});

// 내 퀴즈 기록 조회
router.get('/my-history', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
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

        res.json({
            history: result.rows,
            total: parseInt(countResult.rows[0].count)
        });

    } catch (error) {
        console.error('퀴즈 기록 조회 오류:', error);
        res.status(500).json({ message: '서버 오류가 발생했습니다' });
    }
});

module.exports = router;