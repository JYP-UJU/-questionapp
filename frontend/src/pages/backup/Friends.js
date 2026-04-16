import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Friends.css';

function Friends() {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedQuestion, setSelectedQuestion] = useState(null);
    const [opinion, setOpinion] = useState('');
    const [viewingOpinions, setViewingOpinions] = useState(null);
    const [opinions, setOpinions] = useState([]);
    const [relatedQuestions, setRelatedQuestions] = useState({});
    const [expandedRelated, setExpandedRelated] = useState({});
    const [showAllRelated, setShowAllRelated] = useState({});
    const navigate = useNavigate();

    useEffect(() => {
        loadQuestions();
    }, []);

    const loadQuestions = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            
            const response = await axios.get('http://localhost:5000/api/questions/with-status', {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            const sortedQuestions = response.data.questions.sort((a, b) => 
                new Date(b.created_at) - new Date(a.created_at)
            );
            
            const questionsWithOpinions = await Promise.all(
                sortedQuestions.map(async (q) => {
                    if (q.opinion_count > 0) {
                        try {
                            const opResponse = await axios.get(
                                `http://localhost:5000/api/questions/${q.id}/opinions`,
                                { headers: { Authorization: `Bearer ${token}` } }
                            );
                            return {
                                ...q,
                                recentOpinions: opResponse.data.opinions.slice(0, 2)
                            };
                        } catch (err) {
                            console.error('Load opinions error:', err);
                            return { ...q, recentOpinions: [] };
                        }
                    }
                    return { ...q, recentOpinions: [] };
                })
            );
            
            setQuestions(questionsWithOpinions);
            setError('');
        } catch (err) {
            setError('질문을 불러오는데 실패했습니다');
            console.error('Load error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (questionId) => {
        try {
            const token = localStorage.getItem('token');
            const question = questions.find(q => q.id === questionId);
            
            if (question.is_saved) {
                const savedResponse = await axios.get('http://localhost:5000/api/saved', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                
                const savedQuestion = savedResponse.data.savedQuestions.find(
                    sq => sq.questionType === 'user_question' && sq.questionId === questionId
                );
                
                if (savedQuestion) {
                    await axios.delete(`http://localhost:5000/api/saved/${savedQuestion.savedId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                }
            } else {
                await axios.post(
                    'http://localhost:5000/api/saved',
                    {
                        questionId: questionId,
                        questionType: 'user_question'
                    },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }
            
            // 즉시 상태 업데이트
            setQuestions(prev => prev.map(q =>
                q.id === questionId ? { ...q, is_saved: !q.is_saved } : q
            ));
        } catch (err) {
            console.error('Save error:', err);
            alert('저장에 실패했습니다');
        }
    };

    const handleReaction = async (questionId, reactionType) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(
                `http://localhost:5000/api/questions/${questionId}/reaction`,
                { reactionType },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            // 즉시 상태 업데이트
            setQuestions(prev => prev.map(q => {
                if (q.id === questionId) {
                    const newLikes = reactionType === 'like' ? (q.likes_count || 0) + 1 : q.likes_count;
                    const newDislikes = reactionType === 'dislike' ? (q.dislikes_count || 0) + 1 : q.dislikes_count;
                    return { ...q, likes_count: newLikes, dislikes_count: newDislikes };
                }
                return q;
            }));
        } catch (err) {
            console.error('Reaction error:', err);
            alert('반응 등록에 실패했습니다');
        }
    };

    const handleOpinionSubmit = async () => {
        if (!opinion.trim()) {
            alert('의견을 입력해주세요');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.post(
                `http://localhost:5000/api/questions/${selectedQuestion}/opinion`,
                { opinion: opinion },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setSelectedQuestion(null);
            setOpinion('');
            await loadQuestions();
        } catch (err) {
            console.error('Opinion error:', err);
            alert('의견 등록에 실패했습니다');
        }
    };

    const handleViewOpinions = async (questionId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `http://localhost:5000/api/questions/${questionId}/opinions`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setOpinions(response.data.opinions);
            setViewingOpinions(questionId);
        } catch (err) {
            console.error('Load opinions error:', err);
            alert('의견을 불러오는데 실패했습니다');
        }
    };

    const loadRelatedQuestions = async (questionId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(
                `http://localhost:5000/api/questions/${questionId}/related`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setRelatedQuestions(prev => ({
                ...prev,
                [questionId]: response.data.relatedQuestions
            }));
            
            setExpandedRelated(prev => ({
                ...prev,
                [questionId]: true
            }));
        } catch (err) {
            console.error('Load related error:', err);
        }
    };

    const handleCreateRelated = (parentQuestion) => {
        navigate('/create-related', { state: { parentQuestion } });
    };

    const formatTime = (timestamp) => {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        
        if (days > 0) return `${date.getMonth() + 1}. ${date.getDate()}.`;
        if (hours > 0) return `${hours}시간 전`;
        return '방금 전';
    };

    if (loading) {
        return (
            <div className="friends-container">
                <div className="loading">질문을 불러오는 중...</div>
            </div>
        );
    }

    return (
        <div className="friends-container">
            <header className="friends-header">
                <h1>👥 친구질문</h1>
            </header>

            <div className="friends-content">
                {error && <div className="error-message">{error}</div>}

                <div className="questions-list">
                    {questions.length === 0 ? (
                        <div className="no-questions">
                            <p>아직 질문이 없어요</p>
                            <button onClick={() => navigate('/create')} className="create-button">
                                ✏ 질문 작성하기
                            </button>
                        </div>
                    ) : (
                        questions.map((q) => (
                            <React.Fragment key={q.id}>
                                <div className="question-card">
                                    <div className="question-header">
                                        {q.is_mine && <span className="my-badge">✏️</span>}
                                        <span className="question-author">
                                            {q.is_mine ? '나' : q.username}
                                        </span>
                                        <span className="question-time">{formatTime(q.created_at)}</span>
                                    </div>
                                    
                                    <div className="question-title">{q.title}</div>
                                    
                                    {q.content && (
                                        <div className="question-content">{q.content}</div>
                                    )}

                                    {q.opinion_count > 0 && q.recentOpinions && q.recentOpinions.length > 0 && (
                                        <div className="opinions-box">
                                            {q.recentOpinions.map((op) => (
                                                <div key={op.id} className="opinion-preview">
                                                    <span className="opinion-icon">💬</span>
                                                    <span className="opinion-author">{op.username}:</span>
                                                    <span className="opinion-preview-text">{op.opinion}</span>
                                                </div>
                                            ))}
                                            {q.opinion_count > 3 && (
                                                <button
                                                    className="view-more-opinions"
                                                    onClick={() => handleViewOpinions(q.id)}
                                                >
                                                    💬 더보기 ({q.opinion_count})
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    <div className="action-bar">
                                        <button
                                            className={`save-btn ${q.is_saved ? 'saved' : ''}`}
                                            onClick={() => handleSave(q.id)}
                                        >
                                            🏷️
                                        </button>
                                        
                                        <div className="reactions">
                                            <button className="reaction-btn" onClick={() => handleReaction(q.id, 'like')}>
                                                <span className="icon">👍🏻</span>
                                                <span className="count">{q.likes_count || 0}</span>
                                            </button>
                                            
                                            <button className="reaction-btn" onClick={() => handleReaction(q.id, 'dislike')}>
                                                <span className="icon">👎🏻</span>
                                                <span className="count">{q.dislikes_count || 0}</span>
                                            </button>
                                            
                                            <button className="reaction-btn" onClick={() => setSelectedQuestion(q.id)}>
                                                <span className="icon">💭</span>
                                                <span className="count">{q.opinion_count || 0}</span>
                                            </button>

                                            <button 
                                                className="reaction-btn related-btn"
                                                onClick={() => loadRelatedQuestions(q.id)}
                                            >
                                                <span className="icon">❓</span>
                                                <span className="count">{q.related_count || 0}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {expandedRelated[q.id] && relatedQuestions[q.id] && (
                                    <div className="related-questions-thread">
                                        {(showAllRelated[q.id] 
                                            ? relatedQuestions[q.id] 
                                            : relatedQuestions[q.id].slice(0, 2)
                                        ).map((rq, index, array) => (
                                            <div key={rq.id} className="related-card-wrapper">
                                                <div className="thread-connector">
                                                    {index === array.length - 1 && (!showAllRelated[q.id] && relatedQuestions[q.id].length > 2) ? '┣' : 
                                                     index === array.length - 1 ? '┗' : '┣'}━
                                                </div>
                                                <div className="question-card related-card">
                                                    <div className="related-card-layout">
                                                        <div className="related-card-text">
                                                            <div className="question-header">
                                                                <span className="related-badge">✏️</span>
                                                                <span className="question-author">{rq.username}</span>
                                                                <span className="question-time">{formatTime(rq.created_at)}</span>
                                                            </div>
                                                            
                                                            <div className="question-title">{rq.title}</div>
                                                            
                                                            {rq.content && (
                                                                <div className="question-content">{rq.content}</div>
                                                            )}
                                                        </div>

                                                        <div className="related-card-actions">
                                                            <button
                                                                className="icon-btn"
                                                                onClick={() => handleSave(rq.id)}
                                                            >
                                                                🏷️
                                                            </button>
                                                            
                                                            <button
                                                                className="icon-btn"
                                                                onClick={() => handleReaction(rq.id, 'like')}
                                                            >
                                                                👍 {rq.likes_count || 0}
                                                            </button>
                                                            
                                                            <button
                                                                className="icon-btn"
                                                                onClick={() => handleReaction(rq.id, 'dislike')}
                                                            >
                                                                👎 {rq.dislikes_count || 0}
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                        
                                        <div className="thread-buttons-row">
                                            {!showAllRelated[q.id] && relatedQuestions[q.id].length > 2 ? (
                                                <>
                                                    <div className="thread-add-wrapper">
                                                        <div className="thread-connector">┣━</div>
                                                        <button 
                                                            className="show-more-related-btn"
                                                            onClick={() => setShowAllRelated(prev => ({ ...prev, [q.id]: true }))}
                                                        >
                                                            ⬇️ 관련질문 {relatedQuestions[q.id].length - 2}개 더보기
                                                        </button>
                                                    </div>
                                                    <div className="thread-add-wrapper">
                                                        <div className="thread-connector">┗━</div>
                                                        <button 
                                                            className="add-related-btn-inline"
                                                            onClick={() => handleCreateRelated(q)}
                                                        >
                                                            ➕ 관련질문 추가하기
                                                        </button>
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="thread-add-wrapper">
                                                    <div className="thread-connector">┗━</div>
                                                    <button 
                                                        className="add-related-btn-inline"
                                                        onClick={() => handleCreateRelated(q)}
                                                    >
                                                        ➕ 관련질문 추가하기
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </React.Fragment>
                        ))
                    )}
                </div>
            </div>

            {selectedQuestion && (
                <div className="modal-overlay" onClick={() => setSelectedQuestion(null)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h3>💬 저는 이렇게 생각해요.</h3>
                        <textarea
                            value={opinion}
                            onChange={(e) => setOpinion(e.target.value)}
                            placeholder="어떤 생각이 드나요?"
                            rows={4}
                            className="opinion-input"
                        />
                        <div className="modal-buttons">
                            <button onClick={() => setSelectedQuestion(null)} className="cancel-button">
                                취소
                            </button>
                            <button onClick={handleOpinionSubmit} className="submit-button">
                                등록
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {viewingOpinions && (
                <div className="modal-overlay" onClick={() => setViewingOpinions(null)}>
                    <div className="modal-content opinions-modal" onClick={(e) => e.stopPropagation()}>
                        <h3>💬 다른 사람들의 생각</h3>
                        <div className="opinions-list">
                            {opinions.length === 0 ? (
                                <p className="no-opinions">아직 의견이 없어요</p>
                            ) : (
                                opinions.map((op) => (
                                    <div key={op.id} className="opinion-item">
                                        <div className="opinion-header">
                                            <span className="opinion-author">{op.username}</span>
                                            <span className="opinion-time">{formatTime(op.created_at)}</span>
                                        </div>
                                        <div className="opinion-text">{op.opinion}</div>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="modal-buttons">
                            <button onClick={() => setViewingOpinions(null)} className="cancel-button">
                                닫기
                            </button>
                            <button onClick={() => {
                                setViewingOpinions(null);
                                setSelectedQuestion(viewingOpinions);
                            }} className="submit-button">
                                의견 추가
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <nav className="bottom-nav">
                <button onClick={() => navigate('/create')}>
                    <span>✏️</span>
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
                <button className="active" onClick={() => navigate('/questions')}>
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

export default Friends;