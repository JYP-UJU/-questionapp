const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';
let authToken = '';

async function testSavedAPI() {
    console.log('🌸 물음송이 질문 담기 API 테스트 시작\n');
    console.log('='.repeat(50));

    try {
        // 1. 로그인
        console.log('\n📝 로그인 테스트...');
        const loginRes = await axios.post(`${BASE_URL}/auth/login`, {
            username: 'testuser',
            password: 'test1234'
        });
        authToken = loginRes.data.token;
        console.log('✅ 로그인 성공!');

        // 2. 씨앗 질문 1개 담기
        console.log('\n📌 씨앗 질문 담기 테스트...');
        const saveRes = await axios.post(`${BASE_URL}/saved`,
            {
                questionId: 1,
                questionType: 'seed'
            },
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        console.log('✅ 질문 담기 성공!');
        console.log(`   질문 ID: ${saveRes.data.savedQuestion.question_id}`);
        console.log(`   타입: ${saveRes.data.savedQuestion.question_type}`);

        // 3. 같은 질문 다시 담기 시도 (중복 체크)
        console.log('\n🔄 중복 담기 테스트...');
        try {
            await axios.post(`${BASE_URL}/saved`,
                {
                    questionId: 1,
                    questionType: 'seed'
                },
                { headers: { Authorization: `Bearer ${authToken}` } }
            );
        } catch (error) {
            console.log('✅ 중복 방지 작동!');
            console.log(`   메시지: ${error.response.data.message}`);
        }

        // 4. 다른 씨앗 질문 2개 더 담기
        console.log('\n📌 추가 질문 담기...');
        await axios.post(`${BASE_URL}/saved`,
            { questionId: 5, questionType: 'seed' },
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        await axios.post(`${BASE_URL}/saved`,
            { questionId: 10, questionType: 'seed' },
            { headers: { Authorization: `Bearer ${authToken}` } }
        );
        console.log('✅ 2개 질문 추가 담기 성공!');

        // 5. 담은 질문 목록 조회
        console.log('\n📋 담은 질문 목록 조회...');
        const listRes = await axios.get(`${BASE_URL}/saved/my-saved`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        console.log('✅ 담은 질문 조회 성공!');
        console.log(`   총 ${listRes.data.total}개 담음`);
        
        listRes.data.savedQuestions.forEach((sq, index) => {
            console.log(`\n   ${index + 1}. [${sq.question_type}] ${sq.question_text}`);
            if (sq.category) {
                console.log(`      카테고리: ${sq.category}`);
            }
        });

        // 6. 특정 질문이 담겨있는지 확인
        console.log('\n🔍 질문 담기 여부 확인...');
        const checkRes = await axios.get(`${BASE_URL}/saved/check/1/seed`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        console.log(`✅ 질문 ID 1: ${checkRes.data.isSaved ? '담김' : '안 담김'}`);

        const checkRes2 = await axios.get(`${BASE_URL}/saved/check/999/seed`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        console.log(`✅ 질문 ID 999: ${checkRes2.data.isSaved ? '담김' : '안 담김'}`);

        // 7. 담은 질문 삭제
        console.log('\n🗑️  담은 질문 삭제 테스트...');
        const savedId = listRes.data.savedQuestions[0].id;
        await axios.delete(`${BASE_URL}/saved/${savedId}`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        console.log('✅ 질문 삭제 성공!');

        // 8. 삭제 후 목록 재조회
        console.log('\n📋 삭제 후 목록 재조회...');
        const listRes2 = await axios.get(`${BASE_URL}/saved/my-saved`, {
            headers: { Authorization: `Bearer ${authToken}` }
        });
        console.log(`✅ 현재 ${listRes2.data.total}개 담김`);

        console.log('\n' + '='.repeat(50));
        console.log('🎊 모든 질문 담기 API 테스트 완료!');

    } catch (error) {
        console.error('\n❌ 테스트 실패:', error.response?.data || error.message);
    }
}

testSavedAPI();
