const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
let authToken = '';

async function testQuizAPI() {
    console.log('🌸 물음송이 퀴즈 API 테스트 시작\n');
    console.log('='.repeat(50));

    try {
        // 1. 로그인 (기존 testuser 계정 사용)
        console.log('\n📝 로그인 테스트...');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            username: 'testuser',
            password: 'test1234'
        });
        authToken = loginRes.data.token;
        console.log('✅ 로그인 성공!');

        // 2. 랜덤 퀴즈 5문제 가져오기
        console.log('\n🎯 랜덤 퀴즈 5문제 가져오기...');
        const quizRes = await axios.get(`${BASE_URL}/quiz/random`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        
        console.log('✅ 퀴즈 가져오기 성공!');
        console.log(`   총 ${quizRes.data.total}개 문제`);
        
        const questions = quizRes.data.questions;
        questions.forEach((q, index) => {
            console.log(`\n   ${index + 1}. [${q.category}] ${q.question}`);
            console.log(`      ① ${q.option_1}`);
            console.log(`      ② ${q.option_2}`);
            console.log(`      ③ ${q.option_3}`);
            console.log(`      ④ ${q.option_4}`);
            console.log(`      ⑤ ${q.option_5}`);
        });

        // 3. 퀴즈 제출 (랜덤으로 답 선택)
        console.log('\n\n📤 퀴즈 제출 테스트...');
        const responses = questions.map(q => ({
            questionId: q.id,
            selectedOption: Math.floor(Math.random() * 5) + 1 // 1~5 랜덤
        }));

        const submitRes = await axios.post(`${BASE_URL}/quiz/submit`, 
            { responses },
            { headers: { Authorization: `Bearer ${authToken}` } }
        );

        console.log('✅ 퀴즈 제출 성공!');
        console.log(`\n   🎯 결과: ${submitRes.data.correctCount}/${submitRes.data.totalCount} 적절!`);
        console.log(`   🌸 송이 획득: +${submitRes.data.songiEarned}송이`);
        console.log(`   💰 현재 송이: ${submitRes.data.currentSongi}개`);

        console.log('\n   📝 각 문제 결과:');
        submitRes.data.results.forEach((result, index) => {
            const mark = result.isCorrect ? '✅' : '❌';
            console.log(`\n   ${index + 1}. ${mark} ${result.question}`);
            console.log(`      선택: ${result.selectedOption}번 / 적절한 답: ${result.correctOption}번`);
            console.log(`      💡 설명: ${result.explanation.substring(0, 60)}...`);
        });

        // 4. 내 퀴즈 기록 조회
        console.log('\n\n📊 내 퀴즈 기록 조회...');
        const historyRes = await axios.get(`${BASE_URL}/quiz/my-history?limit=5`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });

        console.log('✅ 퀴즈 기록 조회 성공!');
        console.log(`   총 ${historyRes.data.total}개 기록`);
        console.log(`   최근 ${historyRes.data.history.length}개 표시:`);
        
        historyRes.data.history.forEach((h, index) => {
            const mark = h.is_correct ? '✅' : '❌';
            console.log(`   ${index + 1}. ${mark} [${h.category}] ${h.question.substring(0, 30)}...`);
        });

        console.log('\n' + '='.repeat(50));
        console.log('🎊 모든 퀴즈 API 테스트 완료!');

    } catch (error) {
        console.error('\n❌ 테스트 실패:', error.response?.data || error.message);
    }
}

testQuizAPI();
