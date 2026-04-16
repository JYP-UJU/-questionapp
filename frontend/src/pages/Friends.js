import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './Friends.css';
import BottomNav from '../components/BottomNav';
import TopHeader from '../components/TopHeader';
import OpinionModal from '../components/OpinionModal';
import RelatedModal from '../components/RelatedModal';

function Friends() {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedQuestion, setSelectedQuestion] = useState(null);
    const [relatedModal, setRelatedModal] = useState(null);
    const [visibleCount, setVisibleCount] = useState(25);

    const [expandedOpinions, setExpandedOpinions] = useState({});
    const [expandedRelated, setExpandedRelated] = useState({});
    const [allOpinions, setAllOpinions] = useState({});
    const [allRelated, setAllRelated] = useState({});

    const navigate = useNavigate();
    const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
    const friendsMessages = [
        "친구들은 어떤 궁금증이 있을까요?",
        "친구 질문에 의견을 남겨보세요!"
    ];

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentMessageIndex(prev => (prev + 1) % friendsMessages.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        loadQuestions();
    }, []);

    const loadQuestions = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');

            const response = await axios.get(`${API_BASE}/api/questions/with-status`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const sortedQuestions = response.data.questions
                .filter(q => !q.is_mine)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            // 최신 의견 1개 + 최신 관련질문 1개 미리보기 로드
            const questionsWithPreview = await Promise.all(
                sortedQuestions.map(async (q) => {
                    let latestOpinion = null;
                    let latestRelated = null;

                    if (q.opinion_count > 0) {
                        try {
                            const opRes = await axios.get(
                                `${API_BASE}/api/questions/${q.id}/opinions`,
                                { headers: { Authorization: `Bearer ${token}` } }
                            );
                            latestOpinion = opRes.data.opinions[0] || null;
                        } catch (err) {}
                    }

                    if (q.related_count > 0) {
                        try {
                            const relRes = await axios.get(
                                `${API_BASE}/api/questions/${q.id}/related`,
                                { headers: { Authorization: `Bearer ${token}` } }
                            );
                            latestRelated = relRes.data.relatedQuestions[0] || null;
                        } catch (err) {}
                    }

                    return { ...q, latestOpinion, latestRelated };
                })
            );

            setQuestions(questionsWithPreview);
            setError('');
        } catch (err) {
            setError('질문을 불러오는데 실패했습니다');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async (questionId) => {
        try {
            const token = localStorage.getItem('token');
            const question = questions.find(q => q.id === questionId);
            if (!question) return;

            if (question.is_saved) {
                const savedRes = await axios.get(`${API_BASE}/api/saved`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const savedItem = savedRes.data.savedQuestions.find(
                    sq => sq.questionType === 'user_question' && sq.questionId === questionId
                );
                if (savedItem) {
                    await axios.delete(`${API_BASE}/api/saved/${savedItem.savedId}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });
                }
            } else {
                await axios.post(
                    `${API_BASE}/api/saved`,
                    { questionId, questionType: 'user_question' },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
            }

            setQuestions(prev => prev.map(q =>
                q.id === questionId ? { ...q, is_saved: !q.is_saved } : q
            ));
        } catch (err) {
            alert('저장에 실패했습니다');
        }
    };

    const handleReaction = async (questionId, reactionType) => {
        try {
            const token = localStorage.getItem('token');
            const question = questions.find(q => q.id === questionId);
            if (!question) return;

            if (question.user_reaction === reactionType) {
                await axios.delete(`${API_BASE}/api/questions/${questionId}/reaction?type=user_question`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setQuestions(prev => prev.map(q => {
                    if (q.id !== questionId) return q;
                    return {
                        ...q,
                        user_reaction: null,
                        likes_count: reactionType === 'like' ? Math.max(0, (q.likes_count || 1) - 1) : q.likes_count,
                        dislikes_count: reactionType === 'dislike' ? Math.max(0, (q.dislikes_count || 1) - 1) : q.dislikes_count
                    };
                }));
            } else {
                await axios.post(
                    `${API_BASE}/api/questions/${questionId}/reaction`,
                    { reactionType, questionType: 'user_question' },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setQuestions(prev => prev.map(q => {
                    if (q.id !== questionId) return q;
                    const old = q.user_reaction;
                    return {
                        ...q,
                        user_reaction: reactionType,
                        likes_count: reactionType === 'like'
                            ? (q.likes_count || 0) + 1
                            : old === 'like' ? Math.max(0, (q.likes_count || 1) - 1) : q.likes_count,
                        dislikes_count: reactionType === 'dislike'
                            ? (q.dislikes_count || 0) + 1
                            : old === 'dislike' ? Math.max(0, (q.dislikes_count || 1) - 1) : q.dislikes_count
                    };
                }));
            }
        } catch (err) {
            alert('반응 처리에 실패했습니다');
        }
    };

    const handleOpinionSubmit = async (text) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(
                `${API_BASE}/api/questions/${selectedQuestion}/opinion`,
                { opinion: text },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setSelectedQuestion(null);
            await loadQuestions();
        } catch (err) {
            alert('의견 등록에 실패했습니다');
        }
    };

    const handleRelatedSubmit = async (text) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(
                `${API_BASE}/api/questions/${relatedModal.id}/related`,
                { title: text, questionType: 'friend_question' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setRelatedModal(null);
            await loadQuestions();
        } catch (err) {
            alert('관련질문 등록에 실패했습니다');
        }
    };

    // 의견 토글 (펼치기/접기)
    const handleToggleOpinions = async (questionId) => {
        if (expandedOpinions[questionId]) {
            setExpandedOpinions(prev => ({ ...prev, [questionId]: false }));
            return;
        }
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(
                `${API_BASE}/api/questions/${questionId}/opinions`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setAllOpinions(prev => ({ ...prev, [questionId]: res.data.opinions || [] }));
            setExpandedOpinions(prev => ({ ...prev, [questionId]: true }));
        } catch (err) {}
    };

    // 관련질문 토글 (펼치기/접기)
    const handleToggleRelated = async (questionId) => {
        if (expandedRelated[questionId]) {
            setExpandedRelated(prev => ({ ...prev, [questionId]: false }));
            return;
        }
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(
                `${API_BASE}/api/questions/${questionId}/related`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setAllRelated(prev => ({ ...prev, [questionId]: res.data.relatedQuestions || [] }));
            setExpandedRelated(prev => ({ ...prev, [questionId]: true }));
        } catch (err) {}
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
            <TopHeader icon="👥" title="친구질문" messages={[]} backTo="/main" />

            <div className="friends-content">
                <div className="instruction instruction-animated">
                    {friendsMessages[currentMessageIndex]}
                </div>
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
                        <>
                        {questions.slice(0, visibleCount).map((q) => (
                            <div key={q.id} className="question-card">

                                {/* 작성자 + 시간 */}
                                <div className="question-header">
                                    {q.is_mine && <span className="my-badge">✏️</span>}
                                    <span className="question-author">
                                        {q.is_mine ? '나' : q.username}
                                    </span>
                                    <span className="question-time">{formatTime(q.created_at)}</span>
                                </div>

                                {/* 질문 제목 + 내용 */}
                                <div className="question-title">{q.title}</div>
                                {q.content && (
                                    <div className="question-content">{q.content}</div>
                                )}

                                {/* 의견 미리보기 B방식: 최신 1개 + 토글 */}
                                {q.latestOpinion && (
                                    <div className="preview-section">
                                        <div className="preview-row">
                                            <span className="preview-icon">💬</span>
                                            <span className="preview-author">{q.latestOpinion.username}:</span>
                                            <span className="preview-text">{q.latestOpinion.opinion}</span>
                                            {q.opinion_count > 1 && (
                                                <button
                                                    className="preview-toggle-btn"
                                                    onClick={() => handleToggleOpinions(q.id)}
                                                >
                                                    {expandedOpinions[q.id] ? '▲ 접기' : `+${q.opinion_count - 1}개 더 ▼`}
                                                </button>
                                            )}
                                        </div>
                                        {expandedOpinions[q.id] && (allOpinions[q.id] || []).slice(1).map((op, i) => (
                                            <div key={i} className="preview-row preview-row-indent">
                                                <span className="preview-icon">💬</span>
                                                <span className="preview-author">{op.username}:</span>
                                                <span className="preview-text">{op.opinion}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* 관련질문 미리보기 B방식: 최신 1개 + 토글 */}
                                {q.latestRelated && (
                                    <div className="preview-section preview-related-section">
                                        <div className="preview-row">
                                            <span className="preview-icon">❓</span>
                                            <span className="preview-author">{q.latestRelated.username}:</span>
                                            <span className="preview-text">{q.latestRelated.title}</span>
                                            {q.related_count > 1 && (
                                                <button
                                                    className="preview-toggle-btn"
                                                    onClick={() => handleToggleRelated(q.id)}
                                                >
                                                    {expandedRelated[q.id] ? '▲ 접기' : `+${q.related_count - 1}개 더 ▼`}
                                                </button>
                                            )}
                                        </div>
                                        {expandedRelated[q.id] && (allRelated[q.id] || []).slice(1).map((rq, i, arr) => (
                                            <div key={i} className="preview-row preview-row-indent">
                                                <span className="tree-connector">
                                                    {i === arr.length - 1 ? '┗━' : '┣━'}
                                                </span>
                                                <span className="preview-author">{rq.username}:</span>
                                                <span className="preview-text">{rq.title}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* ✅ 5버튼 액션바 — IcebreakingNew 스타일, 숫자 포함 */}
                                <div className="action-bar">
                                    <button
                                        className={`action-btn required-btn ${q.user_reaction === 'like' ? 'active-like' : ''}`}
                                        onClick={() => handleReaction(q.id, 'like')}
                                    >
                                        <span className="btn-icon">👍</span>
                                        <span className="btn-label">관심있음 {q.likes_count || 0}</span>
                                    </button>
                                    <button
                                        className={`action-btn required-btn ${q.user_reaction === 'dislike' ? 'active-dislike' : ''}`}
                                        onClick={() => handleReaction(q.id, 'dislike')}
                                    >
                                        <span className="btn-icon">👎</span>
                                        <span className="btn-label">관심없음 {q.dislikes_count || 0}</span>
                                    </button>
                                    <button
                                        className="action-btn optional-btn"
                                        onClick={() => setSelectedQuestion(q.id)}
                                    >
                                        <span className="btn-icon">💬</span>
                                        <span className="btn-label">의견</span>
                                    </button>
                                    <button
                                        className="action-btn optional-btn"
                                        onClick={() => setRelatedModal({ id: q.id, title: q.title })}
                                    >
                                        <span className="btn-icon">❓</span>
                                        <span className="btn-label">관련질문</span>
                                    </button>
                                    <button
                                        className={`action-btn optional-btn ${q.is_saved ? 'active-save' : ''}`}
                                        onClick={() => handleSave(q.id)}
                                    >
                                        <span className="btn-icon">🏷️</span>
                                        <span className="btn-label">담기</span>
                                    </button>
                                </div>

                            </div>
                        ))}
                        {visibleCount < questions.length && (
                            <button
                                className="load-more-btn"
                                onClick={() => setVisibleCount(prev => prev + 25)}
                            >
                                더보기 ({questions.length - visibleCount}개 남음)
                            </button>
                        )}
                        </>
                    )}
                </div>
            </div>

            {/* 의견 작성 모달 */}
            {selectedQuestion && (
                <OpinionModal
                    questionTitle={questions.find(q => q.id === selectedQuestion)?.title}
                    onSubmit={handleOpinionSubmit}
                    onClose={() => setSelectedQuestion(null)}
                    songi={3}
                />
            )}

            {/* 관련질문 모달 */}
            {relatedModal && (
                <RelatedModal
                    questionTitle={relatedModal.title}
                    onSubmit={handleRelatedSubmit}
                    onClose={() => setRelatedModal(null)}
                    songi={5}
                />
            )}

            <BottomNav />
        </div>
    );
}

export default Friends;
