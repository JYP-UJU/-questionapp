#!/bin/bash

# 물음송이 데이터베이스 설정 스크립트

echo "🌸 물음송이 데이터베이스 설정 시작..."

# 환경변수 로드
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# 데이터베이스 URL 확인
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL이 설정되지 않았습니다."
    echo "📝 .env 파일을 확인해주세요."
    exit 1
fi

echo "📊 데이터베이스 연결: $DATABASE_URL"

# 테이블 생성
echo "1️⃣ 테이블 생성 중..."
psql $DATABASE_URL -f database.sql

if [ $? -eq 0 ]; then
    echo "✅ 테이블 생성 완료"
else
    echo "❌ 테이블 생성 실패"
    exit 1
fi

# 씨앗 질문 데이터 삽입
echo "2️⃣ 씨앗 질문 270개 삽입 중..."
psql $DATABASE_URL -f seed_data.sql

if [ $? -eq 0 ]; then
    echo "✅ 씨앗 질문 삽입 완료"
else
    echo "❌ 씨앗 질문 삽입 실패"
    exit 1
fi

# 데이터 확인
echo "3️⃣ 데이터 확인 중..."
psql $DATABASE_URL -c "SELECT COUNT(*) as total_questions FROM seed_questions;"

echo ""
echo "🎉 데이터베이스 설정 완료!"
echo "🚀 이제 'npm start' 또는 'npm run dev'로 서버를 실행하세요."
