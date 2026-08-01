import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
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
    const [selectedQuestionTitle, setSelectedQuestionTitle] = useState('');
    const [relatedModal, setRelatedModal] = useState(null);
    const [total, setTotal] = useState(0);
    const PAGE_SIZE = 25;

    const [expandedOpinions, setExpandedOpinions] = useState({});
    const [expandedRelated, setExpandedRelated] = useState({});
    const [allOpinions, setAllOpinions] = useState({});
    const [allRelated, setAllRelated] = useState({});

    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const highlightParam = searchParams.get('highlight');
    const [highlightedId, setHighlightedId] = useState(null); // 반짝임 표시할 id (알림에서 넘어온 id)
    const cardRefs = useRef({});
    const highlightAttempts = useRef(0);
    const [sortMode, setSortMode] = useState('engagement'); // 'engagement' | 'random'
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sortMode]);

    // 알림 클릭(?highlight=id)으로 들어온 경우: 최상위 질문이든 그 아래 관련질문 트리 속 질문이든
    // 카드가 화면(cardRefs)에 잡힐 때까지 "더보기"를 자동으로 반복해서 찾아낸 다음 스크롤 + 반짝임 표시
    useEffect(() => {
        if (!highlightParam || loading) return;
        const targetId = parseInt(highlightParam);

        // 알림(관심/의견/관련질문)은 항상 실제 user_questions 행을 가리키므로 'user_question' 타입으로 조회
        const el = cardRefs.current[`user_question:${targetId}`];
        if (el) {
            setTimeout(() => {
                el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                setHighlightedId(targetId);
                setTimeout(() => setHighlightedId(null), 2500);
            }, 150);
        } else if (questions.length < total && !loadingMore && highlightAttempts.current < 15) {
            highlightAttempts.current += 1;
            loadMoreQuestions();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [questions, total, loading, loadingMore, highlightParam]);

    // 관련질문 전체 트리(재귀) + 각 노드 통계를 채워서 붙여줌
    const attachRelatedTrees = async (list) => {
        return Promise.all(list.map(async (q) => {
            if (!q.related_count || q.related_count < 1) return { ...q, relatedTree: [] };
            try {
                const treeRes = await api.get(`/questions/${q.id}/related-tree`);
                const rawNodes = treeRes.data.relatedTree || [];
                const relatedTree = await Promise.all(rawNodes.map(async (node) => {
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
                return { ...q, relatedTree };
            } catch (err) {
                return { ...q, relatedTree: [] };
            }
        }));
    };

    const loadQuestions = async () => {
        try {
            setLoading(true);
            const response = await api.get(`/questions/with-status?limit=${PAGE_SIZE}&offset=0&sort=${sortMode}`);
            // ✅ 백엔드에서 미리보기까지 같이 줌 - 개별 API 호출 불필요
            const newQuestions = response.data.questions.map(q => ({
                ...q,
                latestOpinion: q.latest_opinion || null,
            }));
            const withTrees = await attachRelatedTrees(newQuestions);
            setQuestions(withTrees);
            setTotal(response.data.total || withTrees.length);
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
            const response = await api.get(`/questions/with-status?limit=${PAGE_SIZE}&offset=${questions.length}&sort=${sortMode}`);
            const moreQuestions = response.data.questions.map(q => ({
                ...q,
                latestOpinion: q.latest_opinion || null,
            }));
            const withTrees = await attachRelatedTrees(moreQuestions);
            setQuestions(prev => [...prev, ...withTrees]);
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

    // 관련질문 트리의 임의 노드에 대한 반응
    const handleChildReaction = async (nodeId, reactionType) => {
        try {
            const parent = questions.find(q => (q.relatedTree || []).some(n => n.id === nodeId));
            if (!parent) return;
            const node = parent.relatedTree.find(n => n.id === nodeId);
            if (!node) return;

            if (node.userReaction === reactionType) {
                await api.delete(`/questions/${nodeId}/reaction?type=user_question`);
                setQuestions(prev => prev.map(q => {
                    if (q.id !== parent.id) return q;
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
                setQuestions(prev => prev.map(q => {
                    if (q.id !== parent.id) return q;
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

    // 관련질문 트리를 재귀적으로 렌더링 - 부모와 분리된 독립 카드, 깊이만큼 들여쓰기
    const renderRelatedNode = (node, allNodes, depth, refsMap, highlightId) => {
        const children = allNodes
            .filter(n => n.parent_question_id === node.id)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        return (
            <React.Fragment key={node.id}>
                <div style={{
                    marginLeft: `${(depth + 1) * 18}px`,
                    marginTop: '8px',
                }}>
                    <div
                        className="question-card"
                        ref={(el) => { if (el && refsMap) refsMap.current[`user_question:${node.id}`] = el; }}
                        style={{
                            background: node.latestOpinion ? 'rgba(239, 246, 255, 0.98)' : 'rgba(255, 255, 255, 0.95)',
                            border: '1px solid #dbeafe',
                            ...(highlightId === node.id ? { boxShadow: '0 0 0 3px #fbbf24' } : {}),
                        }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                            <div className="question-title" style={{ fontSize: depth === 0 ? '16px' : '15px', flex: 1 }}>
                                <span style={{ color: '#93c5fd', fontWeight: '700', marginRight: '6px' }}>┗━</span>
                                {node.title}
                            </div>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: '#333', flexShrink: 0, marginTop: '2px', whiteSpace: 'nowrap' }}>
                                {node.username}
                            </span>
                        </div>

                        {node.latestOpinion && (
                            <div className="preview-section">
                                <div className="preview-row">
                                    <span className="preview-icon">💬</span>
                                    <span className="preview-author">{node.latestOpinion.username}:</span>
                                    <span className="preview-text">{node.latestOpinion.opinion}</span>
                                </div>
                            </div>
                        )}

                        <div className="action-bar">
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
                                onClick={() => setRelatedModal({ id: node.id, title: node.title })}
                            >
                                <span className="btn-icon">❓</span>
                                <span className="btn-label">관련질문</span>
                            </button>
                        </div>
                    </div>
                </div>

                {children.map(child => renderRelatedNode(child, allNodes, depth + 1, refsMap, highlightId))}
            </React.Fragment>
        );
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

                <div style={{display:'flex', justifyContent:'flex-end', gap:'8px', marginBottom:'10px'}}>
                    <button
                        onClick={() => setSortMode('engagement')}
                        style={{
                            padding:'6px 12px', borderRadius:'20px', border:'none',
                            fontSize:'13px', fontWeight:600, cursor:'pointer',
                            background: sortMode === 'engagement' ? '#3b82f6' : '#e5e7eb',
                            color: sortMode === 'engagement' ? 'white' : '#666',
                        }}
                    >
                        🔥 인기순
                    </button>
                    <button
                        onClick={() => setSortMode('random')}
                        style={{
                            padding:'6px 12px', borderRadius:'20px', border:'none',
                            fontSize:'13px', fontWeight:600, cursor:'pointer',
                            background: sortMode === 'random' ? '#3b82f6' : '#e5e7eb',
                            color: sortMode === 'random' ? 'white' : '#666',
                        }}
                    >
                        🎲 랜덤
                    </button>
                </div>

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
                            <React.Fragment key={q.id}>
                            <div
                                className="question-card"
                                ref={(el) => {
                                    if (el) {
                                        const refKey = `${q.question_source === 'quiz' ? 'seed' : 'user_question'}:${q.id}`;
                                        cardRefs.current[refKey] = el;
                                    }
                                }}
                                style={(highlightedId === q.id && q.question_source !== 'quiz') ? {
                                    boxShadow: '0 0 0 3px #fbbf24',
                                    transition: 'box-shadow 0.3s',
                                } : undefined}
                            >

                                {/* 작성자 + 시간 */}
                                <div className="question-header">
                                    {q.is_quiz
                                        ? <span className="my-badge">🎯</span>
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
                                        onClick={() => {
                                            setSelectedQuestion(q.id);
                                            setSelectedQuestionTitle(q.title);
                                        }}
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

                            {/* 관련질문 전체 트리: 부모와 분리된 독립 카드로, 형제는 시간순, 자식은 그 아래 바로 */}
                            {q.relatedTree && q.relatedTree.length > 0 &&
                                q.relatedTree
                                    .filter(n => n.parent_question_id === null || n.parent_question_id === q.id)
                                    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                                    .map(node => renderRelatedNode(node, q.relatedTree, 0, cardRefs, highlightedId))
                            }
                            </React.Fragment>
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

            <BottomNav />
        </div>
    );
}

export default Friends;
