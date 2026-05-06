import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import './RelatedQuestion.css';

function RelatedQuestion() {
    const navigate = useNavigate();
    const location = useLocation();
    const parentQuestion = location.state?.parentQuestion;

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);

    // 부모 질문이 없으면 친구질문으로 돌아가기
    if (!parentQuestion) {
        navigate(-1);
        return null;
    }

    // 관련질문 제출
    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!title.trim()) {
            alert('질문을 입력해주세요');
            return;
        }

        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            
            // eslint-disable-next-line no-unused-vars
            const response = await axios.post(
                'http://localhost:5000/api/questions',
                {
                    title,
                    content: content || ' ', // 빈 값이면 공백 하나
                    parent_question_id: parentQuestion.id
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            alert('관련질문이 등록되었습니다! 5송이를 획득했어요 🌸');
            navigate(-1);
        } catch (err) {
            console.error('Submit error:', err);
            alert('질문 등록에 실패했습니다');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="related-container">
            <header className="related-header">
                <button onClick={() => navigate(-1)} className="back-button">
                    ← 뒤로
                </button>
                <h1>📎 관련질문 작성</h1>
            </header>

            <div className="related-content">
                {/* 원본 질문 표시 */}
                <div className="parent-question-box">
                    <div className="parent-label">📎 원본 질문</div>
                    <div className="parent-title">{parentQuestion.title}</div>
                    {parentQuestion.content && (
                        <div className="parent-content">{parentQuestion.content}</div>
                    )}
                    <div className="parent-author">
                        - 작성자: {parentQuestion.is_mine ? '나' : parentQuestion.username}
                    </div>
                </div>

                {/* 관련질문 폼 */}
                <div className="form-section">
                    <h2 className="form-title">관련된 질문이 있어요.</h2>

                    <form onSubmit={handleSubmit}>
                        {/* 질문 */}
                        <div className="form-group">
                            <label>📝 질문</label>
                            <textarea
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="궁금한 질문을 입력하세요"
                                rows={9}
                                maxLength={500}
                                className="title-textarea"
                                required
                            />
                            <span className="char-count">{title.length}/500</span>
                        </div>

                        {/* 질문 설명 (선택) */}
                        <div className="form-group">
                            <label>✍️ 질문 설명(선택)</label>
                            <textarea
                                value={content}
                                onChange={(e) => setContent(e.target.value)}
                                placeholder="질문에 대한 추가 설명을 작성해주세요"
                                rows={4}
                                maxLength={500}
                                className="content-textarea"
                            />
                            <span className="char-count">{content.length}/500</span>
                        </div>

                        {/* 버튼 */}
                        <div className="button-group">
                            <button
                                type="button"
                                onClick={() => navigate(-1)}
                                className="cancel-btn"
                            >
                                취소
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="submit-btn"
                            >
                                {loading ? '등록 중...' : '작성하기 + 5송이 🌸'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>

            <nav className="bottom-nav">
                <button onClick={() => navigate('/create')}>
                    <span>❓</span>
                    <span>질문하기</span>
                </button>
                <button onClick={() => navigate('/icebreaking')}>
                    <span>🤔</span>
                    <span>질문고르기</span>
                </button>
                <button onClick={() => navigate('/quiz')}>
                    <span>🎯</span>
                    <span>퀴즈</span>
                </button>
                <button onClick={() => navigate('/questions')}>
                    <span>👥</span>
                    <span>친구질문</span>
                </button>
                <button onClick={() => navigate('/saved')}>
                    <span>📚</span>
                    <span>내활동</span>
                </button>
                <button onClick={() => navigate('/setting')}>
                    <span>⚙️</span>
                    <span>설정</span>
                </button>
            </nav>
        </div>
    );
}

export default RelatedQuestion;