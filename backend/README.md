# 물음송이 v2 백엔드

초등학생들의 호기심과 질문을 키우는 교육 플랫폼 🌸

## 기능

- 회원가입/로그인 (JWT 인증)
- 재미있는 질문 고르기 (5개 랜덤 질문, 분야별 1개씩)
- 사용자 질문 작성/수정/삭제
- 질문에 대한 좋아요/싫어요
- 추가 질문(댓글) 기능
- 랭킹 시스템
- 송이(포인트) 시스템

## 기술 스택

- Node.js + Express
- PostgreSQL
- JWT 인증
- Unsplash API (썸네일)

## 설치 방법

### 1. 의존성 설치

```bash
cd backend
npm install
```

### 2. 환경변수 설정

`.env.example`을 복사해서 `.env` 파일을 만들고 설정:

```bash
cp .env.example .env
```

필수 환경변수:
- `DATABASE_URL`: PostgreSQL 연결 URL
- `JWT_SECRET`: JWT 시크릿 키
- `UNSPLASH_ACCESS_KEY`: Unsplash API 키
- `FRONTEND_URL`: 프론트엔드 URL (CORS)

### 3. 데이터베이스 설정

Railway PostgreSQL에 접속해서:

```bash
# 1. 테이블 생성
psql $DATABASE_URL < database.sql

# 2. 씨앗 질문 데이터 삽입 (270개)
psql $DATABASE_URL < seed_data.sql
```

### 4. 서버 실행

```bash
# 개발 모드 (nodemon)
npm run dev

# 프로덕션 모드
npm start
```

서버가 http://localhost:5000 에서 실행됩니다.

## API 엔드포인트

### 인증
- `POST /api/auth/register` - 회원가입
- `POST /api/auth/login` - 로그인

### 재미있는 질문 고르기
- `GET /api/icebreaking/random` - 랜덤 5개 질문
- `POST /api/icebreaking/response` - 흥미도 응답 저장 (+5송이)

### 질문
- `POST /api/questions` - 질문 작성 (+5송이)
- `GET /api/questions` - 질문 목록 (최신순/인기순)
- `GET /api/questions/my` - 내 질문 목록
- `GET /api/questions/:id` - 질문 상세
- `PUT /api/questions/:id` - 질문 수정
- `DELETE /api/questions/:id` - 질문 삭제
- `POST /api/questions/thumbnail` - 썸네일 생성

### 반응
- `POST /api/reactions` - 좋아요/싫어요 (+1송이)
- `GET /api/reactions/my/:questionId` - 내 반응 조회

### 추가 질문(댓글)
- `POST /api/followup` - 댓글 작성 (+5송이)
- `GET /api/followup/:parentQuestionId` - 댓글 목록
- `GET /api/followup/my/all` - 내가 작성한 댓글

### 랭킹
- `GET /api/ranking` - 전체 랭킹
- `GET /api/ranking/top3` - 상위 3명

### 사용자
- `GET /api/users/me` - 내 정보
- `PUT /api/users/me` - 프로필 수정
- `PUT /api/users/me/password` - 비밀번호 변경

## 송이 획득 규칙

- 재미있는 질문 5개 응답 완료: **+5송이**
- 내 질문 올리기: **+5송이**
- 좋아요/싫어요: **+1송이** (각 1번만)
- 질문하기(댓글): **+5송이** (제한 없음)

100송이 = 상품권 교환 가능

## 데이터베이스 구조

- `users` - 사용자
- `seed_questions` - 씨앗 질문 (270개)
- `interest_responses` - 흥미도 응답
- `user_questions` - 사용자 질문
- `question_reactions` - 좋아요/싫어요
- `follow_up_questions` - 추가 질문(댓글)

## 배포 (Railway)

1. Railway 계정 생성
2. GitHub 저장소 연결
3. PostgreSQL 애드온 추가
4. 환경변수 설정
5. 자동 배포

## 라이선스

MIT
