# 로컬 테스트 가이드 🧪

물음송이 백엔드를 로컬에서 테스트하는 방법입니다.

## 준비사항

1. **Node.js** 설치 (v16 이상)
2. **PostgreSQL** 설치 (v12 이상) 또는 Railway/Supabase 무료 DB

---

## 1단계: 의존성 설치

```bash
cd backend
npm install
```

---

## 2단계: 데이터베이스 설정

### 옵션 A: 로컬 PostgreSQL 사용

```bash
# PostgreSQL 시작
brew services start postgresql@14  # Mac
# 또는 Windows에서 서비스 시작

# 데이터베이스 생성
createdb muleumsongi

# .env 파일 확인
# DATABASE_URL=postgresql://localhost:5432/muleumsongi
```

### 옵션 B: Railway 무료 DB 사용

1. Railway.app 접속
2. PostgreSQL 프로젝트 생성
3. Connection URL 복사
4. `.env` 파일의 `DATABASE_URL`에 붙여넣기

---

## 3단계: 테이블 및 데이터 생성

```bash
# 실행 권한 부여
chmod +x setup-db.sh

# 데이터베이스 설정 실행
./setup-db.sh
```

또는 수동으로:

```bash
# 테이블 생성
psql $DATABASE_URL -f database.sql

# 씨앗 질문 삽입
psql $DATABASE_URL -f seed_data.sql
```

---

## 4단계: 서버 실행

```bash
# 개발 모드 (자동 재시작)
npm run dev

# 또는 일반 모드
npm start
```

서버가 http://localhost:5000 에서 실행됩니다.

---

## 5단계: API 테스트

### 방법 1: 테스트 스크립트 사용

```bash
node test-api.js
```

자동으로 다음 테스트 진행:
- ✅ 회원가입
- ✅ 로그인
- ✅ 랜덤 질문 조회
- ✅ 질문 작성
- ✅ 질문 목록
- ✅ 랭킹 조회

### 방법 2: 브라우저에서 확인

http://localhost:5000 접속

### 방법 3: Postman/Thunder Client 사용

#### 회원가입
```
POST http://localhost:5000/api/auth/register
Content-Type: application/json

{
  "username": "testuser",
  "password": "test1234"
}
```

#### 로그인
```
POST http://localhost:5000/api/auth/login
Content-Type: application/json

{
  "username": "testuser",
  "password": "test1234"
}
```

#### 랜덤 질문
```
GET http://localhost:5000/api/icebreaking/random
Authorization: Bearer [로그인에서 받은 토큰]
```

---

## 문제 해결

### 포트 5000이 이미 사용 중
```bash
# .env 파일에서 포트 변경
PORT=5001
```

### 데이터베이스 연결 실패
```bash
# PostgreSQL 실행 확인
psql --version
brew services list  # Mac

# 연결 테스트
psql $DATABASE_URL
```

### 모듈을 찾을 수 없음
```bash
rm -rf node_modules package-lock.json
npm install
```

---

## 다음 단계

✅ 백엔드 테스트 완료 후:
1. 프론트엔드 개발
2. 프론트엔드 <-> 백엔드 연동 테스트
3. Railway 배포

---

## 유용한 명령어

```bash
# 데이터베이스 초기화 (모든 데이터 삭제)
psql $DATABASE_URL -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# 특정 테이블 조회
psql $DATABASE_URL -c "SELECT * FROM users;"
psql $DATABASE_URL -c "SELECT COUNT(*) FROM seed_questions;"

# 로그 확인
npm run dev  # 자세한 로그 출력
```
