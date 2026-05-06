import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { icebreakingAPI } from '../services/api';
import axios from 'axios';
import './IcebreakingNew.css';
import BottomNav from '../components/BottomNav';
import TopHeader from '../components/TopHeader';
import OpinionModal from '../components/OpinionModal';
import RelatedModal from '../components/RelatedModal'; 

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function IcebreakingNew() {
    const instructionMessages = [
        "과학과 관련한 호기심을 나눠볼까요?",
        "다섯 개의 질문에 대한 관심을 표시해 보세요",
        "의견을 달 수도 있고, 궁금증을 질문할 수도 있어요!"
    ];

    const [questions, setQuestions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');
    const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
    const [savedQuestions, setSavedQuestions] = useState(new Set());
    const [likedQuestions, setLikedQuestions] = useState(new Set());
    const [dislikedQuestions, setDislikedQuestions] = useState(new Set());

    const [opinionModal, setOpinionModal] = useState(null);
    // eslint-disable-next-line no-unused-vars
    const [opinionText, setOpinionText] = useState('');
    const [opinions, setOpinions] = useState({});

    const [relatedModal, setRelatedModal] = useState(null);
    // eslint-disable-next-line no-unused-vars
    const [relatedTitle, setRelatedTitle] = useState('');
    const [relatedQuestions, setRelatedQuestions] = useState({});

    const navigate = useNavigate();

    useEffect(() => { loadQuestions(); }, []);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentMessageIndex(prev => (prev + 1) % instructionMessages.length);
        }, 8000);
        return () => clearInterval(interval);
    }, []);

    const loadQuestions = async () => {
        try {
            setLoading(true);
            const response = await icebreakingAPI.getRandom();
            setQuestions(response.data.questions);
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
            if (savedQuestions.has(questionId)) {
                setSavedQuestions(prev => { const s = new Set(prev); s.delete(questionId); return s; });
            } else {
                await axios.post(`${API_BASE}/api/icebreaking/save`,
                    { questionId, sourceType: 'icebreaking' },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setSavedQuestions(prev => new Set([...prev, questionId]));
            }
        } catch (err) {
            alert('저장에 실패했습니다');
        }
    };

    const handleReaction = (questionId, type) => {
        if (type === 'like') {
            setLikedQuestions(prev => {
                const s = new Set(prev);
                if (s.has(questionId)) { s.delete(questionId); }
                else {
                    s.add(questionId);
                    setDislikedQuestions(p => { const d = new Set(p); d.delete(questionId); return d; });
                }
                return s;
            });
        } else {
            setDislikedQuestions(prev => {
                const s = new Set(prev);
                if (s.has(questionId)) { s.delete(questionId); }
                else {
                    s.add(questionId);
                    setLikedQuestions(p => { const d = new Set(p); d.delete(questionId); return d; });
                }
                return s;
            });
        }
    };

    const handleOpinionSubmit = async (text) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE}/api/questions/${opinionModal}/opinion`,
                { opinion: text, questionType: 'icebreaking' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setOpinions(prev => ({
                ...prev,
                [opinionModal]: [...(prev[opinionModal] || []), { opinion: text }]
            }));
            setOpinionModal(null);
        } catch (err) {
            alert('의견 등록에 실패했습니다');
        }
    };

    const handleRelatedSubmit = async (text) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(`${API_BASE}/api/questions/${relatedModal}/related`,
                { title: text, questionType: 'icebreaking' },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // 부모 씨앗질문도 자동으로 담기에 저장
            try {
                await axios.post(`${API_BASE}/api/icebreaking/save`,
                    { questionId: relatedModal, sourceType: 'icebreaking' },
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                setSavedQuestions(prev => new Set([...prev, relatedModal]));
            } catch (err) {
                // 이미 저장된 경우 무시
            }

            setRelatedQuestions(prev => ({
                ...prev,
                [relatedModal]: [...(prev[relatedModal] || []), { title: text }]
            }));
            setRelatedModal(null);
        } catch (err) {
            alert('관련질문 등록에 실패했습니다');
        }
    };

    const handleRefresh = () => {
        loadQuestions();
        setSavedQuestions(new Set());
        setLikedQuestions(new Set());
        setDislikedQuestions(new Set());
        setOpinions({});
        setRelatedQuestions({});
    };

    const handleSubmit = async () => {
        setSubmitting(true);
        setError('');
        try {
            const token = localStorage.getItem('token');
            for (const questionId of likedQuestions) {
                try {
                    await axios.post(`${API_BASE}/api/questions/${questionId}/reaction`,
                        { reactionType: 'like', questionType: 'icebreaking' },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                } catch (err) {}
            }
            for (const questionId of dislikedQuestions) {
                try {
                    await axios.post(`${API_BASE}/api/questions/${questionId}/reaction`,
                        { reactionType: 'dislike', questionType: 'icebreaking' },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                } catch (err) {}
            }
            await axios.post(`${API_BASE}/api/icebreaking/submit-interest`,
                { responses: [
                    ...Array.from(likedQuestions).map(id => ({ questionId: id, interested: true })),
                    ...Array.from(dislikedQuestions).map(id => ({ questionId: id, interested: false }))
                ]},
                { headers: { Authorization: `Bearer ${token}` } }
            );
            alert('선택 완료! +5송이 획득!');
            navigate('/saved');
        } catch (err) {
            setError(err.response?.data?.message || '제출에 실패했습니다');
        } finally {
            setSubmitting(false);
        }
    };

    const allQuestionsAnswered = questions.length === 5 &&
        questions.every(q => likedQuestions.has(q.id) || dislikedQuestions.has(q.id));
    const unansweredCount = questions.filter(
        q => !likedQuestions.has(q.id) && !dislikedQuestions.has(q.id)
    ).length;

    if (loading) return (
        <div className="icebreaking-container">
            <div className="loading">질문을 불러오는 중...</div>
        </div>
    );

    return (
        <div className="icebreaking-container">
            <TopHeader icon="🤔" title="재미있는 질문 고르기" messages={[]} backTo="/main" />

            <div className="icebreaking-content">
                <div className="instruction instruction-animated">
                    {instructionMessages[currentMessageIndex]}
                </div>
                {error && <div className="error-message">{error}</div>}

                <div className="questions-list">
                    {questions.map((q) => (
                        <div key={q.id} className="question-card">
                            <div className="question-title">{q.question}</div>

                            {/* ✅ 5버튼 액션바 */}
                            <div className="action-bar">
                                <button
                                    className={`action-btn required-btn ${likedQuestions.has(q.id) ? 'active-like' : ''}`}
                                    onClick={() => handleReaction(q.id, 'like')}
                                >
                                    <span className="btn-icon">👍</span>
                                    <span className="btn-label">관심있음</span>
                                </button>
                                <button
                                    className={`action-btn required-btn ${dislikedQuestions.has(q.id) ? 'active-dislike' : ''}`}
                                    onClick={() => handleReaction(q.id, 'dislike')}
                                >
                                    <span className="btn-icon">👎</span>
                                    <span className="btn-label">관심없음</span>
                                </button>
                                <button
                                    className={`action-btn optional-btn ${(opinions[q.id] || []).length > 0 ? 'active-opinion' : ''}`}
                                    onClick={() => { setOpinionModal(q.id); setOpinionText(''); }}
                                >
                                    <span className="btn-icon">💬</span>
                                    <span className="btn-label">의견</span>
                                </button>
                                <button
                                    className={`action-btn optional-btn ${(relatedQuestions[q.id] || []).length > 0 ? 'active-related' : ''}`}
                                    onClick={() => { setRelatedModal(q.id); setRelatedTitle(''); }}
                                >
                                    <span className="btn-icon">❓</span>
                                    <span className="btn-label">관련질문</span>
                                </button>
                                <button
                                    className={`action-btn optional-btn ${savedQuestions.has(q.id) ? 'active-save' : ''}`}
                                    onClick={() => handleSave(q.id)}
                                >
                                    <span className="btn-icon">🏷️</span>
                                    <span className="btn-label">담기</span>
                                </button>
                            </div>

                            {/* 의견 미리보기 */}
                            {(opinions[q.id] || []).length > 0 && (
                                <div className="inline-preview">
                                    {opinions[q.id].map((op, i) => (
                                        <div key={i} className="preview-item">
                                            <span className="preview-icon">💬</span>
                                            <span className="preview-me">나:</span>
                                            <span className="preview-text">{op.opinion}</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* 관련질문 미리보기 */}
                            {(relatedQuestions[q.id] || []).length > 0 && (
                                <div className="inline-preview related-preview">
                                    {relatedQuestions[q.id].map((rq, i) => (
                                        <div key={i} className="preview-item">
                                            <span className="preview-icon">❓</span>
                                            <span className="preview-me">나:</span>
                                            <span className="preview-text">{rq.title}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* 제출 영역 */}
                <div className={`bottom-actions ${allQuestionsAnswered ? 'two-col' : 'three-col'}`}>
                    {!allQuestionsAnswered && (
                        <button className="unanswered-btn" disabled>
                            ⚠️ {unansweredCount}개 미선택
                        </button>
                    )}
                    <button className="refresh-button" onClick={handleRefresh} disabled={submitting}>
                        🔄 다시 고르기
                    </button>
                    <button
                        className="submit-button"
                        onClick={handleSubmit}
                        disabled={!allQuestionsAnswered || submitting}
                    >
                        {submitting ? '제출 중...' : '선택 완료 (+5송이)'}
                    </button>
                </div>
            </div>

            {/* 의견 모달 */}
            {opinionModal && (
                <OpinionModal
                    questionTitle={questions.find(q => q.id === opinionModal)?.question}
                    onSubmit={handleOpinionSubmit}
                    onClose={() => setOpinionModal(null)}
                    songi={3}
                />
            )}

            {/* 관련질문 모달 */}
            {relatedModal && (
                <RelatedModal
                    questionTitle={questions.find(q => q.id === relatedModal)?.question}
                    onSubmit={handleRelatedSubmit}
                    onClose={() => setRelatedModal(null)}
                    songi={5}
                />
            )}

            <BottomNav />
        </div>
    );
}

export default IcebreakingNew;
