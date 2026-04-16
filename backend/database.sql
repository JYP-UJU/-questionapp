-- 물음송이 v2 데이터베이스 스키마

-- 사용자 테이블
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    songi_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 씨앗 질문 테이블 (122개의 미리 준비된 질문)
CREATE TABLE seed_questions (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    category VARCHAR(20) NOT NULL, -- 물리, 화학, 생물, 지구과학, 일상생활
    book_source INTEGER NOT NULL, -- 1
    page_number INTEGER,
    -- 퀴즈 관련 컬럼
    option_1 TEXT,
    option_2 TEXT,
    option_3 TEXT,
    option_4 TEXT,
    option_5 TEXT DEFAULT '적절한 답 없음',
    correct_option INTEGER, -- 1~5
    explanation TEXT
);

-- 흥미도 응답 테이블 (재미있는 질문 고르기)
CREATE TABLE interest_responses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    question_id INTEGER REFERENCES seed_questions(id) ON DELETE CASCADE,
    interest_level INTEGER NOT NULL, -- 1=별로, 2=관심있음
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, question_id, interest_level)
);

-- 사용자 질문 테이블
CREATE TABLE user_questions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    thumbnail_url TEXT,
    likes_count INTEGER DEFAULT 0,
    dislikes_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 질문 반응 테이블 (좋아요/싫어요)
CREATE TABLE question_reactions (
    id SERIAL PRIMARY KEY,
    question_id INTEGER REFERENCES user_questions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    reaction_type VARCHAR(10) NOT NULL, -- 'like' 또는 'dislike'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(question_id, user_id, reaction_type)
);

-- 추가 질문 테이블 (댓글)
CREATE TABLE follow_up_questions (
    id SERIAL PRIMARY KEY,
    parent_question_id INTEGER REFERENCES user_questions(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 퀴즈 응답 테이블
CREATE TABLE quiz_responses (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    question_id INTEGER REFERENCES seed_questions(id) ON DELETE CASCADE,
    selected_option INTEGER NOT NULL, -- 1~5
    is_correct BOOLEAN,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 질문 담기 테이블
CREATE TABLE saved_questions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    question_id INTEGER REFERENCES seed_questions(id) ON DELETE CASCADE,
    question_type VARCHAR(20) DEFAULT 'seed', -- 'seed' 또는 'user'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, question_id, question_type)
);

-- 사용자 질문에 연결된 씨앗 질문 (관련 질문하기)
ALTER TABLE user_questions ADD COLUMN related_seed_question_id INTEGER REFERENCES seed_questions(id);

-- 인덱스 생성 (성능 최적화)
CREATE INDEX idx_user_questions_user_id ON user_questions(user_id);
CREATE INDEX idx_user_questions_created_at ON user_questions(created_at);
CREATE INDEX idx_question_reactions_question_id ON question_reactions(question_id);
CREATE INDEX idx_follow_up_questions_parent_id ON follow_up_questions(parent_question_id);
CREATE INDEX idx_quiz_responses_user_id ON quiz_responses(user_id);
CREATE INDEX idx_saved_questions_user_id ON saved_questions(user_id);
