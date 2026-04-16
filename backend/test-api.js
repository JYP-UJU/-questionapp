// API 테스트 스크립트
// 사용법: node test-api.js

const axios = require('axios');

const API_URL = 'http://localhost:5000/api';
let authToken = '';

// 색상 출력
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  reset: '\x1b[0m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// 1. 회원가입 테스트
async function testRegister() {
  try {
    log('\n📝 회원가입 테스트...', 'yellow');
    const response = await axios.post(`${API_URL}/auth/register`, {
      username: 'testuser',
      password: 'test1234'
    });
    
    authToken = response.data.token;
    log('✅ 회원가입 성공!', 'green');
    log(`Token: ${authToken.substring(0, 20)}...`);
    return true;
  } catch (error) {
    if (error.response?.status === 400) {
      log('⚠️  이미 존재하는 사용자 - 로그인 시도', 'yellow');
      return testLogin();
    }
    log(`❌ 회원가입 실패: ${error.message}`, 'red');
    return false;
  }
}

// 2. 로그인 테스트
async function testLogin() {
  try {
    log('\n🔐 로그인 테스트...', 'yellow');
    const response = await axios.post(`${API_URL}/auth/login`, {
      username: 'testuser',
      password: 'test1234'
    });
    
    authToken = response.data.token;
    log('✅ 로그인 성공!', 'green');
    log(`송이: ${response.data.user.songi_count}개`);
    return true;
  } catch (error) {
    log(`❌ 로그인 실패: ${error.message}`, 'red');
    return false;
  }
}

// 3. 랜덤 질문 테스트
async function testRandomQuestions() {
  try {
    log('\n🎲 랜덤 질문 가져오기 테스트...', 'yellow');
    const response = await axios.get(`${API_URL}/icebreaking/random`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    log('✅ 랜덤 질문 조회 성공!', 'green');
    response.data.questions.forEach((q, i) => {
      log(`${i + 1}. [${q.category}] ${q.question.substring(0, 30)}...`);
    });
    return true;
  } catch (error) {
    log(`❌ 랜덤 질문 실패: ${error.message}`, 'red');
    return false;
  }
}

// 4. 질문 작성 테스트
async function testCreateQuestion() {
  try {
    log('\n✍️  질문 작성 테스트...', 'yellow');
    const response = await axios.post(`${API_URL}/questions`, {
      title: '테스트 질문',
      content: '이것은 테스트 질문입니다. 로컬 테스트 중!',
      thumbnail_url: 'https://via.placeholder.com/300'
    }, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    
    log('✅ 질문 작성 성공!', 'green');
    log(`송이: ${response.data.songi_count}개 (+5송이)`);
    return response.data.question.id;
  } catch (error) {
    log(`❌ 질문 작성 실패: ${error.message}`, 'red');
    return null;
  }
}

// 5. 질문 목록 테스트
async function testGetQuestions() {
  try {
    log('\n📚 질문 목록 조회 테스트...', 'yellow');
    const response = await axios.get(`${API_URL}/questions?sort=latest`);
    
    log(`✅ 질문 목록 조회 성공! (총 ${response.data.questions.length}개)`, 'green');
    response.data.questions.slice(0, 3).forEach(q => {
      log(`- ${q.title} (${q.username})`);
    });
    return true;
  } catch (error) {
    log(`❌ 질문 목록 실패: ${error.message}`, 'red');
    return false;
  }
}

// 6. 랭킹 테스트
async function testRanking() {
  try {
    log('\n🏆 랭킹 조회 테스트...', 'yellow');
    const response = await axios.get(`${API_URL}/ranking`);
    
    log(`✅ 랭킹 조회 성공! (총 ${response.data.rankings.length}명)`, 'green');
    response.data.rankings.slice(0, 3).forEach(r => {
      log(`${r.medal || r.rank}위. ${r.username} (${r.question_count}개)`);
    });
    return true;
  } catch (error) {
    log(`❌ 랭킹 조회 실패: ${error.message}`, 'red');
    return false;
  }
}

// 전체 테스트 실행
async function runAllTests() {
  log('🌸 물음송이 API 테스트 시작', 'green');
  log('================================');
  
  // 서버 연결 확인
  try {
    await axios.get('http://localhost:5000');
    log('✅ 서버 연결 성공!', 'green');
  } catch (error) {
    log('❌ 서버가 실행 중이 아닙니다. npm start를 먼저 실행하세요.', 'red');
    return;
  }
  
  // 순차적 테스트
  const loginSuccess = await testRegister();
  if (!loginSuccess) return;
  
  await testRandomQuestions();
  const questionId = await testCreateQuestion();
  await testGetQuestions();
  await testRanking();
  
  log('\n================================', 'green');
  log('🎉 모든 테스트 완료!', 'green');
}

// 실행
runAllTests();
