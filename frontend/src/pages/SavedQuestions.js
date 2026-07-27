import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './SavedQuestions.css';
import SettingBottomNav from '../components/SettingBottomNav';
import TopHeader from '../components/TopHeader';
import OpinionModal from '../components/OpinionModal';
import RelatedModal from '../components/RelatedModal';

function SavedQuestions() {
    const [savedQuestions, setSavedQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const [totalSongi, setTotalSongi] = useState(0);
    const [currentMessageIndex, setCurrentMessageIndex] = useState(0);

    const [selectedQuestion, setSelectedQuestion] = useState(null);
    const [selectedQuestionTitle, setSelectedQuestionTitle] = useState('');
    const [relatedModal, setRelatedModal] = useState(null);

    const [expandedOpinions, setExpandedOpinions] = useState({});
    const [expandedRelated, setExpandedRelated] = useState({});
    const [allOpinions, setAllOpinions] = useState({});
    const [allRelated, setAllRelated] = useState({});

    const scrollPositionRef = useRef(0);
    const navigate = useNavigate();
    const [visibleCount, setVisibleCount] = useState(15);

    const rotatingMessages = [
        "과학과 관련한 호기심을 나눠볼까요?",
        "여러분이 저장한 질문의 목록입니다.",
        "질문을 톺아볼까요?"
    ];

    useEffect(() => {
        loadSavedQuestions();
    }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentMessageIndex((prev) => (prev + 1) % rotatingMessages.length);
        }, 3000);
        return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadSavedQuestions = async () => {
        try {
            setLoading(true);

            const response = await api.get('/saved');

            const allQuestions = response.data.savedQuestions || [];

            // quiz_related / icebreaking_related / related_question 타입은 별도 카드로 안 보여줌
            const questions = allQuestions.filter(q =>
                q.questionType !== 'quiz_related' &&
                q.questionType !== 'icebreaking_related' &&
                q.questionType !== 'related_question'
            );

            const questionsWithData = await Promise.all(
                questions.map(async (q) => {
                    if (!q.questionId) return { ...q, latestOpinion: null, latestRelated: null };

                    try {
                        const statsRes = await api.get(
                            `/questions/${q.questionId}?type=${q.questionType}`
                        );
                        const stats = statsRes.data;

                        // 최신 의견 미리보기 (실제 로드해서 정확한 count 사용)
                        let latestOpinion = null;
                        let actualOpinionCount = stats.opinionCount || 0;
                        if (actualOpinionCount > 0) {
                            try {
                                const opRes = await api.get(
                                    `/questions/${q.questionId}/opinions?type=${q.questionType}`
                                );
                                const opinions = opRes.data.opinions || [];
                                latestOpinion = opinions[0] || null;
                                actualOpinionCount = opinions.length;
                            } catch (err) {}
                        }

                        // 최신 관련질문 미리보기 (실제 로드해서 정확한 count 사용)
                        let latestRelated = null;
                        let actualRelatedCount = stats.relatedCount || 0;
                        if (actualRelatedCount > 0) {
                            try {
                                const relRes = await api.get(
                                    `/questions/${q.questionId}/related?type=${q.questionType}`
                                );
                                const related = relRes.data.relatedQuestions || [];
                                latestRelated = related[0] || null;
                                actualRelatedCount = related.length;

                                // 관련질문 자체의 반응/좋아요/의견도 독립적으로 불러옴 (자기 카드용)
                                if (latestRelated && latestRelated.id) {
                                    try {
                                        const childStats = await api.get(
                                            `/questions/${latestRelated.id}?type=user_question`
                                        );
                                        let childLatestOpinion = null;
                                        const childOpinionCount = childStats.data.opinionCount || 0;
                                        if (childOpinionCount > 0) {
                                            try {
                                                const childOpRes = await api.get(
                                                    `/questions/${latestRelated.id}/opinions?type=user_question`
                                                );
                                                const childOpinions = childOpRes.data.opinions || [];
                                                childLatestOpinion = childOpinions[0] || null;
                                            } catch (e) {}
                                        }
                                        latestRelated = {
                                            ...latestRelated,
                                            likesCount: childStats.data.likesCount || 0,
                                            dislikesCount: childStats.data.dislikesCount || 0,
                                            userReaction: childStats.data.userReaction || null,
                                            opinionCount: childOpinionCount,
                                            latestOpinion: childLatestOpinion,
                                        };
                                    } catch (e) {}
                                }
                            } catch (err) {}
                        }

                        // 퀴즈/질문고르기는 content(카테고리) 숨김
                        const isSeeded = q.questionType === 'quiz' || q.questionType === 'icebreaking' || q.questionType === 'seed';

                        return {
                            ...q,
                            content: isSeeded ? null : q.content,
                            likesCount: stats.likesCount || 0,
                            dislikesCount: stats.dislikesCount || 0,
                            opinionCount: actualOpinionCount,
                            relatedCount: actualRelatedCount,
                            userReaction: stats.userReaction,
                            latestOpinion,
                            latestRelated
                        };
                    } catch (err) {
                        return { ...q, latestOpinion: null, latestRelated: null };
                    }
                })
            );

            // 백엔드가 이미 각 항목의 실제 활동 시각(createdAt) 기준 최신순으로 정렬해서 줌
            // (질문 작성/반응/의견/관련질문/담기 - 어떤 활동이든 가장 최근 것이 위로)
            setSavedQuestions(questionsWithData);

            try {
                const songiRes = await api.get('/users/me');
                const userData = songiRes.data.user || songiRes.data;
                setTotalSongi(userData.songi_count || userData.songiCount || 0);
            } catch (err) {
                setTotalSongi(0);
            }

            setError('');
        } catch (err) {
            setError('저장된 질문을 불러오는데 실패했습니다');
        } finally {
            setLoading(false);
        }
    };

    const refreshWithScroll = async () => {
        scrollPositionRef.current = window.scrollY;
        await loadSavedQuestions();
        setTimeout(() => {
            window.scrollTo(0, scrollPositionRef.current);
        }, 50);
    };

    // 제거 (담기 해제)
    const handleRemove = async (savedId) => {
        try {
            await api.delete(`/saved/${savedId}`);
            setSavedQuestions(prev => prev.filter(q => q.savedId !== savedId));
        } catch (err) {
            alert('제거에 실패했습니다');
        }
    };

    const handleReaction = async (questionId, reactionType) => {
        try {
            const question = savedQuestions.find(q => q.questionId === questionId);
            if (!question) return;
            const qType = question.questionType || 'user_question';

            if (question.userReaction === reactionType) {
                await api.delete(`/questions/${questionId}/reaction?type=${qType}`);
                setSavedQuestions(prev => prev.map(q => {
                    if (q.questionId !== questionId) return q;
                    return {
                        ...q,
                        userReaction: null,
                        likesCount: reactionType === 'like' ? Math.max(0, (q.likesCount || 1) - 1) : q.likesCount,
                        dislikesCount: reactionType === 'dislike' ? Math.max(0, (q.dislikesCount || 1) - 1) : q.dislikesCount
                    };
                }));
            } else {
                await api.post(
                    `/questions/${questionId}/reaction`,
                    { reactionType, questionType: qType }
                );
                setSavedQuestions(prev => prev.map(q => {
                    if (q.questionId !== questionId) return q;
                    const wasLiked = q.userReaction === 'like';
                    const wasDisliked = q.userReaction === 'dislike';
                    return {
                        ...q,
                        userReaction: reactionType,
                        likesCount: reactionType === 'like'
                            ? (q.likesCount || 0) + 1
                            : wasLiked ? Math.max(0, (q.likesCount || 1) - 1) : q.likesCount,
                        dislikesCount: reactionType === 'dislike'
                            ? (q.dislikesCount || 0) + 1
                            : wasDisliked ? Math.max(0, (q.dislikesCount || 1) - 1) : q.dislikesCount
                    };
                }));
            }
        } catch (err) {
            console.error('Reaction error:', err);
        }
    };

    // 관련질문 자체에 대한 반응 (부모 카드 안에 중첩된 자기 자신의 액션바용)
    const handleChildReaction = async (parentQuestionId, childId, reactionType) => {
        try {
            const parent = savedQuestions.find(q => q.questionId === parentQuestionId);
            const child = parent?.latestRelated;
            if (!child || child.id !== childId) return;

            if (child.userReaction === reactionType) {
                await api.delete(`/questions/${childId}/reaction?type=user_question`);
                setSavedQuestions(prev => prev.map(q => {
                    if (q.questionId !== parentQuestionId || !q.latestRelated) return q;
                    return {
                        ...q,
                        latestRelated: {
                            ...q.latestRelated,
                            userReaction: null,
                            likesCount: reactionType === 'like' ? Math.max(0, (q.latestRelated.likesCount || 1) - 1) : q.latestRelated.likesCount,
                            dislikesCount: reactionType === 'dislike' ? Math.max(0, (q.latestRelated.dislikesCount || 1) - 1) : q.latestRelated.dislikesCount,
                        }
                    };
                }));
            } else {
                await api.post(
                    `/questions/${childId}/reaction`,
                    { reactionType, questionType: 'user_question' }
                );
                setSavedQuestions(prev => prev.map(q => {
                    if (q.questionId !== parentQuestionId || !q.latestRelated) return q;
                    const wasLiked = q.latestRelated.userReaction === 'like';
                    const wasDisliked = q.latestRelated.userReaction === 'dislike';
                    return {
                        ...q,
                        latestRelated: {
                            ...q.latestRelated,
                            userReaction: reactionType,
                            likesCount: reactionType === 'like'
                                ? (q.latestRelated.likesCount || 0) + 1
                                : wasLiked ? Math.max(0, (q.latestRelated.likesCount || 1) - 1) : q.latestRelated.likesCount,
                            dislikesCount: reactionType === 'dislike'
                                ? (q.latestRelated.dislikesCount || 0) + 1
                                : wasDisliked ? Math.max(0, (q.latestRelated.dislikesCount || 1) - 1) : q.latestRelated.dislikesCount,
                        }
                    };
                }));
            }
        } catch (err) {
            console.error('Child reaction error:', err);
        }
    };

    const handleOpinionSubmit = async (text) => {
        try {
            const question = savedQuestions.find(q => q.questionId === selectedQuestion);
            const qType = question?.questionType || 'user_question';
            await api.post(
                `/questions/${selectedQuestion}/opinion`,
                { opinion: text, questionType: qType }
            );
            setSelectedQuestion(null);
            await refreshWithScroll();
        } catch (err) {
            alert('의견 등록에 실패했습니다');
        }
    };

    const handleRelatedSubmit = async (text) => {
        try {
            await api.post(
                `/questions/${relatedModal.id}/related`,
                { title: text, questionType: relatedModal.questionType || 'user_question' }
            );
            setRelatedModal(null);
            await refreshWithScroll();
        } catch (err) {
            alert('관련질문 등록에 실패했습니다');
        }
    };

    // 의견 토글 (펼치기/접기)
    const handleToggleOpinions = async (questionId, questionType) => {
        if (expandedOpinions[questionId]) {
            setExpandedOpinions(prev => ({ ...prev, [questionId]: false }));
            return;
        }
        try {
            const res = await api.get(`/questions/${questionId}/opinions?type=${questionType}`);
            setAllOpinions(prev => ({ ...prev, [questionId]: res.data.opinions || [] }));
            setExpandedOpinions(prev => ({ ...prev, [questionId]: true }));
        } catch (err) {}
    };

    // 관련질문 토글 (펼치기/접기)
    const handleToggleRelated = async (questionId, questionType) => {
        if (expandedRelated[questionId]) {
            setExpandedRelated(prev => ({ ...prev, [questionId]: false }));
            return;
        }
        try {
            const res = await api.get(`/questions/${questionId}/related?type=${questionType}`);
            setAllRelated(prev => ({ ...prev, [questionId]: res.data.relatedQuestions || [] }));
            setExpandedRelated(prev => ({ ...prev, [questionId]: true }));
        } catch (err) {}
    };

    const formatTime = (timestamp) => {
        const now = new Date();
        const created = new Date(timestamp);
        const diffMs = now - created;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        if (diffMins < 1) return '방금 전';
        if (diffMins < 60) return `${diffMins}분 전`;
        if (diffHours < 24) return `${diffHours}시간 전`;
        if (diffDays < 7) return `${diffDays}일 전`;
        return created.toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
    };

    const getSourceInfo = (questionType) => {
        switch (questionType) {
            case 'quiz': return { icon: '🎯', name: '퀴즈' };
            case 'icebreaking': return { icon: '🤔', name: '질문고르기' };
            case 'seed': return { icon: '🎯', name: '퀴즈' };
            case 'user_question': return { icon: '✏️', name: '내질문' };
            case 'friend_question':
            case 'user': return { icon: '👥', name: '친구질문' };
            case 'my_question': return { icon: '✏️', name: '내가 올린 질문' };
            case 'opinion_question': return { icon: '💬', name: '의견 남긴 질문' };
            default: return { icon: '❓', name: '질문' };
        }
    };

    if (loading) {
        return (
            <div className="saved-container">
                <div className="loading">로딩 중...</div>
            </div>
        );
    }

    return (
        <div className="saved-container">
            <TopHeader icon="📚" title="내 활동" messages={[]} backTo={null} />

            <div className="saved-content">
                <div className="instruction instruction-animated">
                    {rotatingMessages[currentMessageIndex]}
                </div>
                {error && <div className="error-message">{error}</div>}

                {savedQuestions.length === 0 ? (
                    <div className="no-saved">
                        <p>아직 저장한 질문이 없습니다</p>
                        <button
                            className="goto-button"
                            onClick={() => navigate('/questions')}
                        >
                            친구질문 보러가기
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="questions-list">
                            {savedQuestions.slice(0, visibleCount).map((saved) => {
                                const sourceInfo = getSourceInfo(saved.questionType);

                                return (
                                    <div key={saved.savedId} className="question-card" style={{
                                    background: (saved.latestOpinion || saved.latestRelated)
                                        ? 'rgba(239, 246, 255, 0.98)'
                                        : 'rgba(255, 255, 255, 0.92)',
                                    borderLeft: (saved.latestOpinion || saved.latestRelated)
                                        ? '4px solid #3b82f6'
                                        : 'none'
                                }}>

                                        {/* 출처 + 시간 */}
                                        <div className="question-source">
                                            <span className="source-icon">{sourceInfo.icon}</span>
                                            <span className="source-name">{sourceInfo.name}</span>
                                            <span className="question-time">{formatTime(saved.createdAt)}</span>
                                        </div>

                                        {/* 질문 내용 */}
                                        {saved.title && (
                                            <div className="question-title">{saved.title}</div>
                                        )}
                                        {saved.content && saved.content !== saved.title && (
                                            (saved.questionType === 'quiz' || saved.questionType === 'icebreaking' || saved.questionType === 'seed')
                                                ? <span className="category-badge">{saved.content}</span>
                                                : <div className="question-content">{saved.content}</div>
                                        )}

                                        {/* 의견 미리보기 B방식: 최신 1개 + 토글 */}
                                        {saved.latestOpinion && (
                                            <div className="preview-section">
                                                <div className="preview-row">
                                                    <span className="preview-icon">💬</span>
                                                    <span className="preview-author">{saved.latestOpinion.username}:</span>
                                                    <span className="preview-text">{saved.latestOpinion.opinion}</span>
                                                    {(saved.opinionCount || 0) > 1 && (
                                                        <button
                                                            className="preview-toggle-btn"
                                                            onClick={() => handleToggleOpinions(saved.questionId, saved.questionType)}
                                                        >
                                                            {expandedOpinions[saved.questionId] ? '▲ 접기' : `+${saved.opinionCount - 1}개 더 ▼`}
                                                        </button>
                                                    )}
                                                </div>
                                                {expandedOpinions[saved.questionId] && (allOpinions[saved.questionId] || []).slice(1).map((op, i) => (
                                                    <div key={i} className="preview-row preview-row-indent">
                                                        <span className="preview-icon">💬</span>
                                                        <span className="preview-author">{op.username}:</span>
                                                        <span className="preview-text">{op.opinion}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* 관련질문: ㄴ자 연결선 + 독립된 자기 카드 (반응/의견/관련질문 버튼 포함) */}
                                        {saved.latestRelated && (
                                            <div style={{
                                                marginTop: '10px',
                                                paddingLeft: '14px',
                                                borderLeft: '3px solid #bfdcff',
                                            }}>
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '8px' }}>
                                                    <span style={{ fontSize: '18px', color: '#3b82f6', fontWeight: '700', lineHeight: '1.3', flexShrink: 0 }}>
                                                        ┗━
                                                    </span>
                                                    <div style={{ flex: 1 }}>
                                                        <div style={{ fontSize: '13px', color: '#888', marginBottom: '2px' }}>
                                                            {saved.latestRelated.username}의 관련질문
                                                        </div>
                                                        <div style={{ fontSize: '17px', fontWeight: '700', color: '#222', lineHeight: '1.4' }}>
                                                            {saved.latestRelated.title}
                                                        </div>
                                                    </div>
                                                    {(saved.relatedCount || 0) > 1 && (
                                                        <button
                                                            className="preview-toggle-btn"
                                                            onClick={() => handleToggleRelated(saved.questionId, saved.questionType)}
                                                        >
                                                            {expandedRelated[saved.questionId] ? '▲ 접기' : `+${saved.relatedCount - 1}개 더 ▼`}
                                                        </button>
                                                    )}
                                                </div>

                                                {/* 관련질문 자신의 액션바 */}
                                                {saved.latestRelated.id && (
                                                    <div className="action-bar" style={{ marginBottom: '4px' }}>
                                                        <button
                                                            className={`action-btn required-btn ${saved.latestRelated.userReaction === 'like' ? 'active-like' : ''}`}
                                                            onClick={() => handleChildReaction(saved.questionId, saved.latestRelated.id, 'like')}
                                                        >
                                                            <span className="btn-icon">👍</span>
                                                            <span className="btn-label">관심있음 {saved.latestRelated.likesCount || 0}</span>
                                                        </button>
                                                        <button
                                                            className={`action-btn required-btn ${saved.latestRelated.userReaction === 'dislike' ? 'active-dislike' : ''}`}
                                                            onClick={() => handleChildReaction(saved.questionId, saved.latestRelated.id, 'dislike')}
                                                        >
                                                            <span className="btn-icon">👎</span>
                                                            <span className="btn-label">관심없음 {saved.latestRelated.dislikesCount || 0}</span>
                                                        </button>
                                                        <button
                                                            className="action-btn optional-btn"
                                                            onClick={() => {
                                                                setSelectedQuestion(saved.latestRelated.id);
                                                                setSelectedQuestionTitle(saved.latestRelated.title);
                                                            }}
                                                        >
                                                            <span className="btn-icon">💬</span>
                                                            <span className="btn-label">의견</span>
                                                        </button>
                                                        <button
                                                            className="action-btn optional-btn"
                                                            onClick={() => setRelatedModal({
                                                                id: saved.latestRelated.id,
                                                                title: saved.latestRelated.title,
                                                                questionType: 'user_question'
                                                            })}
                                                        >
                                                            <span className="btn-icon">❓</span>
                                                            <span className="btn-label">관련질문</span>
                                                        </button>
                                                    </div>
                                                )}

                                                {/* 관련질문 자신에게 달린 의견 미리보기 */}
                                                {saved.latestRelated.latestOpinion && (
                                                    <div style={{
                                                        display: 'flex',
                                                        gap: '6px',
                                                        alignItems: 'flex-start',
                                                        background: 'rgba(255,255,255,0.7)',
                                                        borderRadius: '8px',
                                                        padding: '8px 10px',
                                                        marginBottom: '4px',
                                                    }}>
                                                        <span style={{ fontSize: '14px' }}>💬</span>
                                                        <span style={{ fontSize: '13px' }}>
                                                            <strong>{saved.latestRelated.latestOpinion.username}:</strong> {saved.latestRelated.latestOpinion.opinion}
                                                        </span>
                                                    </div>
                                                )}

                                                {expandedRelated[saved.questionId] && (allRelated[saved.questionId] || []).slice(1).map((rq, i, arr) => (
                                                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginTop: '8px' }}>
                                                        <span style={{ fontSize: '16px', color: '#93c5fd', fontWeight: '700', flexShrink: 0 }}>
                                                            {i === arr.length - 1 ? '┗━' : '┣━'}
                                                        </span>
                                                        <div>
                                                            <div style={{ fontSize: '12px', color: '#999' }}>{rq.username}</div>
                                                            <div style={{ fontSize: '15px', fontWeight: '600', color: '#333' }}>{rq.title}</div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* ✅ 5버튼 액션바 — 담기 대신 제거 */}
                                        <div className="action-bar">
                                            <button
                                                className={`action-btn required-btn ${saved.userReaction === 'like' ? 'active-like' : ''}`}
                                                onClick={() => handleReaction(saved.questionId, 'like')}
                                            >
                                                <span className="btn-icon">👍</span>
                                                <span className="btn-label">관심있음 {saved.likesCount || 0}</span>
                                            </button>
                                            <button
                                                className={`action-btn required-btn ${saved.userReaction === 'dislike' ? 'active-dislike' : ''}`}
                                                onClick={() => handleReaction(saved.questionId, 'dislike')}
                                            >
                                                <span className="btn-icon">👎</span>
                                                <span className="btn-label">관심없음 {saved.dislikesCount || 0}</span>
                                            </button>
                                            <button
                                                className="action-btn optional-btn"
                                                onClick={() => {
                                                    setSelectedQuestion(saved.questionId);
                                                    setSelectedQuestionTitle(saved.title);
                                                }}
                                            >
                                                <span className="btn-icon">💬</span>
                                                <span className="btn-label">의견</span>
                                            </button>
                                            <button
                                                className="action-btn optional-btn"
                                                onClick={() => setRelatedModal({ id: saved.questionId, title: saved.title || saved.question, questionType: saved.questionType })}
                                            >
                                                <span className="btn-icon">❓</span>
                                                <span className="btn-label">관련질문</span>
                                            </button>
                                            <button
                                                className="action-btn remove-btn"
                                                onClick={() => handleRemove(saved.savedId)}
                                            >
                                                <span className="btn-icon">🚫</span>
                                                <span className="btn-label">제거</span>
                                            </button>
                                        </div>

                                    </div>
                                );
                            })}
                        </div>

                        {savedQuestions.length > visibleCount && (
                            <button
                                onClick={() => setVisibleCount(prev => prev + 15)}
                                className="load-more-btn"
                            >
                                더보기 ({savedQuestions.length - visibleCount}개 더 있어요)
                            </button>
                        )}
                    </>
                )}
            </div>

            {/* 의견 작성 모달 */}
            {selectedQuestion && (
                <OpinionModal
                    questionTitle={selectedQuestionTitle}
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

            <SettingBottomNav />
        </div>
    );
}

export default SavedQuestions;
