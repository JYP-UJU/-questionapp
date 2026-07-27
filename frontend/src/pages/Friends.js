import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './Friends.css';
import BottomNav from '../components/BottomNav';
import TopHeader from '../components/TopHeader';
import OpinionModal from '../components/OpinionModal';
import RelatedModal from '../components/RelatedModal';

function Friends() {
    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [error, setError] = useState('');
    const [selectedQuestion, setSelectedQuestion] = useState(null);
    const [relatedModal, setRelatedModal] = useState(null);
    const [total, setTotal] = useState(0);
    const PAGE_SIZE = 25;

    const [expandedOpinions, setExpandedOpinions] = useState({});
    const [expandedRelated, setExpandedRelated] = useState({});
    const [allOpinions, setAllOpinions] = useState({});
    const [allRelated, setAllRelated] = useState({});

    const navigate = useNavigate();
    const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
    const friendsMessages = [
        "모두의 질문을 볼 수 있어요!",
        "친구의 질문에 의견을 남기거나 관련 질문을 제시해 보세요."
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
            const response = await api.get(`/questions/with-status?limit=${PAGE_SIZE}&offset=0`);
            // ✅ 백엔드에서 미리보기까지 같이 줌 - 개별 API 호출 불필요
            const newQuestions = response.data.questions.map(q => ({
                ...q,
                latestOpinion: q.latest_opinion || null,
                latestRelated: q.latest_related || null,
            }));
            setQuestions(newQuestions);
            setTotal(response.data.total || newQuestions.length);
            setError('');
        } catch (err) {
            setError('질문을 불러오는데 실패했습니다');
        } finally {
            setLoading(false);
        }
    };

    const loadMoreQuestions = async () => {
        if (loadingMore) return;
        try {
            setLoadingMore(true);
            const response = await api.get(`/questions/with-status?limit=${PAGE_SIZE}&offset=${questions.length}`);
            const moreQuestions = response.data.questions.map(q => ({
                ...q,
                latestOpinion: q.latest_opinion || null,
                latestRelated: q.latest_related || null,
            }));
            setQuestions(prev => [...prev, ...moreQuestions]);
            setTotal(response.data.total ?? total);
        } catch (err) {
            alert('더 불러오는데 실패했습니다');
        } finally {
            setLoadingMore(false);
        }
    };

    const handleSave = async (questionId) => {
        try {
            const question = questions.find(q => q.id === questionId);
            if (!question) return;

            if (question.is_saved) {
                const savedRes = await api.get('/saved');
                const savedItem = savedRes.data.savedQuestions.find(
                    sq => sq.questionType === 'user_question' && sq.questionId === questionId
                );
                if (savedItem) {
                    await api.delete(`/saved/${savedItem.savedId}`);
                }
            } else {
                await api.post('/saved', { questionId, questionType: 'user_question' });
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
            const question = questions.find(q => q.id === questionId);
            if (!question) return;

            if (question.user_reaction === reactionType) {
                await api.delete(`/questions/${questionId}/reaction?type=user_question`);
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
                await api.post(`/questions/${questionId}/reaction`, { reactionType, questionType: 'user_question' });
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
            await api.post(`/questions/${selectedQuestion}/opinion`, { opinion: text });
            setSelectedQuestion(null);
            await loadQuestions();
        } catch (err) {
            alert('의견 등록에 실패했습니다');
        }
    };

    const handleRelatedSubmit = async (text) => {
        try {
            await api.post(`/questions/${relatedModal.id}/related`, { title: text, questionType: 'friend_question' });
            setRelatedModal(null);
            await loadQuestions();
        } catch (err) {
            alert('관련질문 등록에 실패했습니다');
        }
    };

    const handleToggleOpinions = async (questionId) => {
        if (expandedOpinions[questionId]) {
            setExpandedOpinions(prev => ({ ...prev, [questionId]: false }));
        } else {
            if (!allOpinions[questionId]) {
                try {
                    const opRes = await api.get(`/questions/${questionId}/opinions`);
                    setAllOpinions(prev => ({ ...prev, [questionId]: opRes.data.opinions }));
                } catch (err) {}
            }
            setExpandedOpinions(prev => ({ ...prev, [questionId]: true }));
        }
    };

    const handleToggleRelated = async (questionId) => {
        if (expandedRelated[questionId]) {
            setExpandedRelated(prev => ({ ...prev, [questionId]: false }));
        } else {
            if (!allRelated[questionId]) {
                try {
                    const relRes = await api.get(`/questions/${questionId}/related`);
                    setAllRelated(prev => ({ ...prev, [questionId]: relRes.data.relatedQuestions }));
                } catch (err) {}
            }
            setExpandedRelated(prev => ({ ...prev, [questionId]: true }));
        }
    };

    const formatTime = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        if (diff < 60) return '방금 전';
        if (diff < 3600) return `${Math.floor(diff / 60)}분 전`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`;
        return `${Math.floor(diff / 86400)}일 전`;
    };

    if (loading) return (
        <div className="friends-container">
            <div className="loading">질문을 불러오는 중...</div>
        </div>
    );

    return (
        <div className="friends-container">
            <TopHeader icon="💬" title="꼬리에 꼬리를 무는 질문들" messages={[]} />

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
                        {questions.map((q) => (
                            <div key={q.id} className="question-card">

                                {/* 작성자 + 시간 */}
                                <div className="question-header">
                                    {q.is_quiz
                                        ? <span className="my-badge">🧩</span>
                                        : q.is_mine && <span className="my-badge">✏️</span>
                                    }
                                    <span className="question-author">
                                        {q.is_quiz ? '퀴즈' : q.is_mine ? '나' : q.username}
                                    </span>
                                    <span className="question-time">{formatTime(q.latest_activity || q.created_at)}</span>
                                </div>

                                {/* 질문 제목 + 내용 */}
                                <div className="question-title">{q.title}</div>
                                {q.content && !q.is_quiz && (
                                    <div className="question-content">{q.content}</div>
                                )}

                                {/* 의견 미리보기 */}
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

                                {/* 관련질문 미리보기 */}
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

                                {/* 5버튼 액션바 */}
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
                        {questions.length < total && (
                            <button
                                className="load-more-btn"
                                onClick={loadMoreQuestions}
                                disabled={loadingMore}
                            >
                                {loadingMore ? '불러오는 중...' : `더보기 (${total - questions.length}개 남음)`}
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
