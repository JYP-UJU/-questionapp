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
                    if (!q.questionId) return { ...q, latestOpinion: null, relatedTree: [] };

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

                        // 관련질문 전체 트리 (1단계, 2단계, 3단계... 전부, 시간순)
                        let relatedTree = [];
                        const actualRelatedCount = stats.relatedCount || 0;
                        if (actualRelatedCount > 0) {
                            try {
                                const treeRes = await api.get(`/questions/${q.questionId}/related-tree`);
                                const rawNodes = treeRes.data.relatedTree || [];

                                // 각 노드마다 반응/의견 정보 채우기
                                relatedTree = await Promise.all(rawNodes.map(async (node) => {
                                    let nodeLikes = 0, nodeDislikes = 0, nodeReaction = null;
                                    let nodeOpinionCount = 0, nodeLatestOpinion = null;
                                    try {
                                        const nodeStats = await api.get(`/questions/${node.id}?type=user_question`);
                                        nodeLikes = nodeStats.data.likesCount || 0;
                                        nodeDislikes = nodeStats.data.dislikesCount || 0;
                                        nodeReaction = nodeStats.data.userReaction || null;
                                        nodeOpinionCount = nodeStats.data.opinionCount || 0;
                                        if (nodeOpinionCount > 0) {
                                            try {
                                                const nodeOpRes = await api.get(`/questions/${node.id}/opinions?type=user_question`);
                                                nodeLatestOpinion = (nodeOpRes.data.opinions || [])[0] || null;
                                            } catch (e) {}
                                        }
                                    } catch (e) {}
                                    return {
                                        ...node,
                                        likesCount: nodeLikes,
                                        dislikesCount: nodeDislikes,
                                        userReaction: nodeReaction,
                                        opinionCount: nodeOpinionCount,
                                        latestOpinion: nodeLatestOpinion,
                                    };
                                }));
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
                            relatedTree
                        };
                    } catch (err) {
                        return { ...q, latestOpinion: null, relatedTree: [] };
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

    // 관련질문 트리의 임의 노드에 대한 반응 (부모를 자동으로 찾아서 그 안의 트리를 갱신)
    const handleChildReaction = async (nodeId, reactionType) => {
        try {
            const parentSaved = savedQuestions.find(q => (q.relatedTree || []).some(n => n.id === nodeId));
            if (!parentSaved) return;
            const node = parentSaved.relatedTree.find(n => n.id === nodeId);
            if (!node) return;

            if (node.userReaction === reactionType) {
                await api.delete(`/questions/${nodeId}/reaction?type=user_question`);
                setSavedQuestions(prev => prev.map(q => {
                    if (q.questionId !== parentSaved.questionId) return q;
                    return {
                        ...q,
                        relatedTree: q.relatedTree.map(n => n.id !== nodeId ? n : {
                            ...n,
                            userReaction: null,
                            likesCount: reactionType === 'like' ? Math.max(0, (n.likesCount || 1) - 1) : n.likesCount,
                            dislikesCount: reactionType === 'dislike' ? Math.max(0, (n.dislikesCount || 1) - 1) : n.dislikesCount,
                        })
                    };
                }));
            } else {
                await api.post(`/questions/${nodeId}/reaction`, { reactionType, questionType: 'user_question' });
                setSavedQuestions(prev => prev.map(q => {
                    if (q.questionId !== parentSaved.questionId) return q;
                    return {
                        ...q,
                        relatedTree: q.relatedTree.map(n => {
                            if (n.id !== nodeId) return n;
                            const wasLiked = n.userReaction === 'like';
                            const wasDisliked = n.userReaction === 'dislike';
                            return {
                                ...n,
                                userReaction: reactionType,
                                likesCount: reactionType === 'like'
                                    ? (n.likesCount || 0) + 1
                                    : wasLiked ? Math.max(0, (n.likesCount || 1) - 1) : n.likesCount,
                                dislikesCount: reactionType === 'dislike'
                                    ? (n.dislikesCount || 0) + 1
                                    : wasDisliked ? Math.max(0, (n.dislikesCount || 1) - 1) : n.dislikesCount,
                            };
                        })
                    };
                }));
            }
        } catch (err) {
            console.error('Child reaction error:', err);
        }
    };

    // 관련질문 트리를 재귀적으로 렌더링 (형제는 시간순, 자식은 그 아래 바로)
    const renderRelatedNode = (node, allNodes, depth) => {
        const children = allNodes
            .filter(n => n.parent_question_id === node.id)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        return (
            <div key={node.id} style={{ marginTop: '10px', paddingLeft: '14px', borderLeft: '3px solid #bfdcff' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '6px', marginBottom: '8px' }}>
                    <span style={{ fontSize: '18px', color: '#3b82f6', fontWeight: '700', lineHeight: '1.3', flexShrink: 0 }}>
                        ┗━
                    </span>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '13px', color: '#888', marginBottom: '2px' }}>
                            {node.username}의 관련질문
                        </div>
                        <div style={{ fontSize: depth === 0 ? '17px' : '15px', fontWeight: '700', color: '#222', lineHeight: '1.4' }}>
                            {node.title}
                        </div>
                    </div>
                </div>

                <div className="action-bar" style={{ marginBottom: '4px' }}>
                    <button
                        className={`action-btn required-btn ${node.userReaction === 'like' ? 'active-like' : ''}`}
                        onClick={() => handleChildReaction(node.id, 'like')}
                    >
                        <span className="btn-icon">👍</span>
                        <span className="btn-label">관심있음 {node.likesCount || 0}</span>
                    </button>
                    <button
                        className={`action-btn required-btn ${node.userReaction === 'dislike' ? 'active-dislike' : ''}`}
                        onClick={() => handleChildReaction(node.id, 'dislike')}
                    >
                        <span className="btn-icon">👎</span>
                        <span className="btn-label">관심없음 {node.dislikesCount || 0}</span>
                    </button>
                    <button
                        className="action-btn optional-btn"
                        onClick={() => {
                            setSelectedQuestion(node.id);
                            setSelectedQuestionTitle(node.title);
                        }}
                    >
                        <span className="btn-icon">💬</span>
                        <span className="btn-label">의견</span>
                    </button>
                    <button
                        className="action-btn optional-btn"
                        onClick={() => setRelatedModal({ id: node.id, title: node.title, questionType: 'user_question' })}
                    >
                        <span className="btn-icon">❓</span>
                        <span className="btn-label">관련질문</span>
                    </button>
                </div>

                {node.latestOpinion && (
                    <div style={{
                        display: 'flex', gap: '6px', alignItems: 'flex-start',
                        background: 'rgba(255,255,255,0.7)', borderRadius: '8px',
                        padding: '8px 10px', marginBottom: '4px',
                    }}>
                        <span style={{ fontSize: '14px' }}>💬</span>
                        <span style={{ fontSize: '13px' }}>
                            <strong>{node.latestOpinion.username}:</strong> {node.latestOpinion.opinion}
                        </span>
                    </div>
                )}

                {children.map(child => renderRelatedNode(child, allNodes, depth + 1))}
            </div>
        );
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
                                    background: (saved.latestOpinion || (saved.relatedTree && saved.relatedTree.length > 0))
                                        ? 'rgba(239, 246, 255, 0.98)'
                                        : 'rgba(255, 255, 255, 0.92)',
                                    borderLeft: (saved.latestOpinion || (saved.relatedTree && saved.relatedTree.length > 0))
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

                                        {/* 관련질문 전체 트리: 형제는 시간순, 자식은 그 아래 바로 (재귀) */}
                                        {saved.relatedTree && saved.relatedTree.length > 0 &&
                                            saved.relatedTree
                                                .filter(n => n.parent_question_id === null || n.parent_question_id === saved.questionId)
                                                .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                                                .map(node => renderRelatedNode(node, saved.relatedTree, 0))
                                        }

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
