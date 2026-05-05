import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { quizAPI, savedAPI } from '../services/api';
import axios from 'axios';
import './Quiz.css';
import BottomNav from '../components/BottomNav';
import TopHeader from '../components/TopHeader';
import OpinionModal from '../components/OpinionModal';
import RelatedModal from '../components/RelatedModal'; 

function Quiz() {
    const [questions, setQuestions] = useState([]);
    const [answers, setAnswers] = useState({});
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const [results, setResults] = useState(null);
    const [error, setError] = useState('');
    
    // 새로운 상태: 북마크와 의견
    const [bookmarkedQuestions, setBookmarkedQuestions] = useState(new Set());
    const [likedQuestions, setLikedQuestions] = useState(new Set());
    const [dislikedQuestions, setDislikedQuestions] = useState(new Set());
    const [opinions, setOpinions] = useState({});
    const [showOpinionModal, setShowOpinionModal] = useState(false);
    const [currentOpinionQuestion, setCurrentOpinionQuestion] = useState(null);
    const [opinionText, setOpinionText] = useState('');
    const [relatedModal, setRelatedModal] = useState(null);
    const [relatedTitle, setRelatedTitle] = useState('');
    const [relatedMap, setRelatedMap] = useState({});

    const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000';
    const navigate = useNavigate();
     const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
const quizMessages = [
    "가장 그럴듯한 설명을 선택해주세요!",
    "제출하면 적절한 설명을 확인할 수 있어요."
];

useEffect(() => {
    const interval = setInterval(() => {
        setCurrentMessageIndex(prev => (prev + 1) % quizMessages.length);
    }, 4000);
    return () => clearInterval(interval);
}, []);

    useEffect(() => {
        loadQuestions();
    }, []);

    const loadQuestions = async () => {
        try {
            setLoading(true);
            const response = await quizAPI.getRandom();
            setQuestions(response.data.questions);
            setError('');
        } catch (err) {
            setError('퀴즈를 불러오는데 실패했습니다');
            console.error('Load error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleAnswer = (questionId, selectedOption) => {
        setAnswers({
            ...answers,
            [questionId]: selectedOption
        });
    };

    // 북마크 토글 (결과 화면에서)
    const toggleBookmark = async (questionId) => {
        const newBookmarks = new Set(bookmarkedQuestions);
        if (newBookmarks.has(questionId)) {
            newBookmarks.delete(questionId);
        } else {
            newBookmarks.add(questionId);
            if (showResults) {
                try {
                    await savedAPI.save(questionId, 'seed');
                    console.log('담기 즉시 저장 완료');
                } catch (err) {
                    console.error('담기 저장 실패:', err);
                }
            }
        }
        setBookmarkedQuestions(newBookmarks);
    };

    // 의견 입력 모달 열기
    const openOpinionModal = (questionId) => {
        setCurrentOpinionQuestion(questionId);
        setOpinionText(opinions[questionId] || '');
        setShowOpinionModal(true);
    };

    // 의견 저장 + 즉시 API 저장
    const saveOpinion = async (text) => {
        const token = localStorage.getItem('token');
        setOpinions({ ...opinions, [currentOpinionQuestion]: text });
        try {
            await axios.post(`${API_BASE}/api/questions/${currentOpinionQuestion}/opinion`,
                { opinion: text, questionType: 'quiz' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (err) { console.error('Opinion save error:', err); }
        setShowOpinionModal(false);
        setCurrentOpinionQuestion(null);
    };

    // 관심있음/없음 토글 + 즉시 저장
    const handleReaction = async (questionId, type) => {
        const token = localStorage.getItem('token');
        try {
            await axios.post(`${API_BASE}/api/questions/${questionId}/reaction`,
                { reactionType: type, questionType: 'quiz' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
        } catch (err) { console.error('Reaction error:', err); }

        if (type === 'like') {
            setLikedQuestions(prev => {
                const s = new Set(prev);
                if (s.has(questionId)) { s.delete(questionId); }
                else { s.add(questionId); setDislikedQuestions(p => { const d = new Set(p); d.delete(questionId); return d; }); }
                return s;
            });
        } else {
            setDislikedQuestions(prev => {
                const s = new Set(prev);
                if (s.has(questionId)) { s.delete(questionId); }
                else { s.add(questionId); setLikedQuestions(p => { const d = new Set(p); d.delete(questionId); return d; }); }
                return s;
            });
        }
    };

    // 관련질문 제출
    const handleRelatedSubmit = async (text) => {
        try {
            const token = localStorage.getItem('token');
            await axios.post(
                `${API_BASE}/api/questions/${relatedModal.id}/related`,
                { title: text, questionType: 'quiz' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setRelatedMap(prev => ({
                ...prev,
                [relatedModal.id]: [...(prev[relatedModal.id] || []), { title: text }]
            }));
            setRelatedModal(null);
        } catch (err) {
            alert('관련질문 등록에 실패했습니다');
        }
    };

    const handleSubmit = async () => {
        console.log('제출 시작!', answers);
        const token = localStorage.getItem('token');
        const responseArray = Object.entries(answers).map(([questionId, selectedOption]) => ({
            questionId: parseInt(questionId),
            selectedOption
        }));

        if (responseArray.length < questions.length) {
            setError('모든 질문에 답해주세요');
            return;
        }

        setSubmitting(true);
        setError('');

        try {
            // 관심있음/없음 저장
            for (const questionId of likedQuestions) {
                try {
                    await axios.post(`${API_BASE}/api/questions/${questionId}/reaction`,
                        { reactionType: 'like', questionType: 'quiz' },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                } catch (err) {}
            }
            for (const questionId of dislikedQuestions) {
                try {
                    await axios.post(`${API_BASE}/api/questions/${questionId}/reaction`,
                        { reactionType: 'dislike', questionType: 'quiz' },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                } catch (err) {}
            }

            // 의견 저장
            for (const [questionId, opinionText] of Object.entries(opinions)) {
                try {
                    await axios.post(`${API_BASE}/api/questions/${questionId}/opinion`,
                        { opinion: opinionText, questionType: 'quiz' },
                        { headers: { Authorization: `Bearer ${token}` } }
                    );
                } catch (err) {}
            }

            // 북마크된 질문 ID 배열
            const savedQuestions = Array.from(bookmarkedQuestions);
            
            // 의견 배열
            const opinionsArray = Object.entries(opinions).map(([questionId, opinionText]) => ({
                questionId: parseInt(questionId),
                opinionText
            }));

            const response = await quizAPI.submit({ 
                responses: responseArray,
                savedQuestions,
                opinions: opinionsArray
            });
            
            setResults(response.data);
            setShowResults(true);
            window.scrollTo(0, 0);
        } catch (err) {
            setError(err.response?.data?.message || '제출에 실패했습니다');
            console.error('Submit error:', err);
        } finally {
            setSubmitting(false);
        }
    };

    const allAnswered = Object.keys(answers).length === questions.length;

    if (loading) {
        return (
            <div className="quiz-container">
                <div className="loading">퀴즈를 불러오는 중...</div>
            </div>
        );
    }

    if (showResults) {
        return (
            <div className="quiz-container">
                <TopHeader
    icon="🎯"
    title="질문대기실"
    messages={["가장 그럴듯한 설명을 선택해주세요!", "질문대기실에서 5송이를 획득해요 🌸"]}
    backTo="/main"
/>

                <div className="quiz-content">
                    <div className="result-summary">
                        <div className="score-circle">
                            <div className="score-number">{results.correctCount}</div>
                            <div className="score-total">/ {results.totalCount}</div>
                        </div>
                        <div className="score-text">
                            {results.correctCount === results.totalCount && '완벽해요! 🎉'}
                            {results.correctCount >= results.totalCount * 0.8 && results.correctCount < results.totalCount && '잘했어요! 👍'}
                            {results.correctCount >= results.totalCount * 0.6 && results.correctCount < results.totalCount * 0.8 && '좋아요! 😊'}
                            {results.correctCount < results.totalCount * 0.6 && '이런 점도 생각해 볼까요? 🤔'}
                        </div>
                        <div className="songi-earned">
                            +5송이 획득! 🌸
                            {results.savedCount > 0 && ` | ${results.savedCount}개 질문 저장됨`}
                            {results.opinionsCount > 0 && ` | ${results.opinionsCount}개 의견 입력됨`}
                        </div>
                    </div>

                    <div className="results-list">
                        {results.results.map((result, index) => {
                            const isBookmarked = bookmarkedQuestions.has(result.questionId);
                            const hasOpinion = opinions[result.questionId];
                            
                            return (
                                <div key={result.questionId} className={`result-card ${result.isCorrect ? 'correct' : 'wrong'}`}>
                                    <div className="result-header">
                                        <span className="result-number">문제 {index + 1}</span>
                                        <span className="result-badge">
                                            {result.isCorrect ? '😊 지금까지 알려진 설명' : '😊 그럴까요?'}
                                        </span>
                                    </div>
                                    <div className="result-question">{result.question}</div>
                                    <div className="result-answer">
                                        <div className="your-answer">
                                            내 생각: {result.selectedOption}. {result.options[`option_${result.selectedOption}`]}
                                        </div>
                                        {!result.isCorrect && (
                                            <div className="correct-answer">
                                                지금까지 알려진 설명: {result.correctOption}. {result.options[`option_${result.correctOption}`]}
                                            </div>
                                        )}
                                    </div>
                                    <div className="result-explanation-container">
                                        <div className="result-explanation">
                                            💡 {result.explanation}
                                        </div>
                                        {hasOpinion && (
                                            <div className="user-opinion-box">
                                                📝 내 생각: {opinions[result.questionId]}
                                            </div>
                                        )}
                                        {(relatedMap[result.questionId] || []).length > 0 && (
                                            <div className="user-opinion-box" style={{borderLeftColor:'#22c55e', background:'#f0fdf4'}}>
                                                {relatedMap[result.questionId].map((rq, i) => (
                                                    <div key={i}>❓ 나: {rq.title}</div>
                                                ))}
                                            </div>
                                        )}
                                        {/* ✅ 5버튼 액션바 */}
                                        <div className="quiz-action-bar">
                                            <button
                                                className={`quiz-action-btn required-btn ${likedQuestions.has(result.questionId) ? 'active-like' : ''}`}
                                                onClick={() => handleReaction(result.questionId, 'like')}
                                            >
                                                <span>👍</span>
                                                <span>관심있음</span>
                                            </button>
                                            <button
                                                className={`quiz-action-btn required-btn ${dislikedQuestions.has(result.questionId) ? 'active-dislike' : ''}`}
                                                onClick={() => handleReaction(result.questionId, 'dislike')}
                                            >
                                                <span>👎</span>
                                                <span>관심없음</span>
                                            </button>
                                            <button
                                                className={`quiz-action-btn optional-btn ${hasOpinion ? 'active-opinion' : ''}`}
                                                onClick={() => openOpinionModal(result.questionId)}
                                            >
                                                <span>💬</span>
                                                <span>의견</span>
                                            </button>
                                            <button
                                                className={`quiz-action-btn optional-btn ${(relatedMap[result.questionId] || []).length > 0 ? 'active-related' : ''}`}
                                                onClick={() => { setRelatedModal({ id: result.questionId, question: result.question }); setRelatedTitle(''); }}
                                            >
                                                <span>❓</span>
                                                <span>관련질문</span>
                                            </button>
                                            <button
                                                className={`quiz-action-btn optional-btn ${isBookmarked ? 'active-save' : ''}`}
                                                onClick={() => toggleBookmark(result.questionId)}
                                            >
                                                <span>🏷️</span>
                                                <span>담기</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <button
                        className="action-button"
                        onClick={async () => {
                            // 메인으로 가기 전 자동 저장
                            try {
                                const savedQuestions = Array.from(bookmarkedQuestions);
                                const opinionsArray = Object.entries(opinions).map(([questionId, opinionText]) => ({
                                    questionId: parseInt(questionId),
                                    opinionText
                                }));
                                
                                // 저장할 내용이 있으면 저장
                                if (savedQuestions.length > 0 || opinionsArray.length > 0) {
                                    const responseArray = results.results.map(r => ({
                                        questionId: r.questionId,
                                        selectedOption: r.selectedOption
                                    }));
                                    
                                    await quizAPI.submit({ 
                                        responses: responseArray,
                                        savedQuestions,
                                        opinions: opinionsArray,
                                        resubmit: true
                                    });
                                    
                                    console.log('북마크/의견 자동 저장 완료');
                                }
                            } catch (err) {
                                console.error('자동 저장 실패:', err);
                                // 에러가 나도 메인으로 이동
                            }
                            
                            navigate('/saved');
                        }}
                    >
                        내 활동으로
                    </button>
                </div>

                {/* 의견 입력 모달 */}
                {showOpinionModal && (
                    <OpinionModal
                        questionTitle={results?.results.find(r => r.questionId === currentOpinionQuestion)?.question}
                        initialValue={opinions[currentOpinionQuestion] || ''}
                        onSubmit={saveOpinion}
                        onClose={() => { setShowOpinionModal(false); setCurrentOpinionQuestion(null); }}
                        songi={3}
                    />
                )}

                {/* 관련질문 모달 */}
                {relatedModal && (
                    <RelatedModal
                        questionTitle={relatedModal.question}
                        onSubmit={handleRelatedSubmit}
                        onClose={() => setRelatedModal(null)}
                        songi={5}
                    />
                )}

                <BottomNav />
            </div>
        );
    }

    return (
        <div className="quiz-container">
            <header className="quiz-header">
                <button onClick={() => navigate('/main')} className="back-button">
                    ← 뒤로
                </button>
                <h1>🎯 질문대기실</h1>
            </header>

            <div className="quiz-content">
                <div className="instruction instruction-animated">
                    {quizMessages[currentMessageIndex]}
                </div>

                <div className="progress-bar" style={{ marginTop: '8px' }}>
                    <div className="progress-text">
                        {Object.keys(answers).length} / {questions.length}
                    </div>
                    <div className="progress-fill" style={{ width: `${(Object.keys(answers).length / questions.length) * 100}%` }}></div>
                </div>


                {error && <div className="error-message">{error}</div>}

                <div className="questions-list">
                    {questions.map((q, index) => (
                        <div key={q.id} className={`question-card ${answers[q.id] ? 'answered' : ''}`}>
                            <div className="question-number">문제 {index + 1}</div>
                            <div className="question-title">{q.question}</div>
                            
                            <div className="options-list">
                                {[1, 2, 3, 4, 5].map(num => (
                                    <button
                                        key={num}
                                        className={`option-btn ${answers[q.id] === num ? 'selected' : ''}`}
                                        onClick={() => handleAnswer(q.id, num)}
                                    >
                                        <span className="option-number">{num}</span>
                                        <span className="option-text">{q[`option_${num}`]}</span>
                                    </button>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>

                <button
                    className="submit-button"
                    onClick={handleSubmit}
                    disabled={!allAnswered || submitting}
                >
                    {submitting ? '확인 중...' : '제출하면 적절한 설명을 확인할 수 있어요 🌸 (+5송이)'}
                </button>

                
            </div>

            <BottomNav />
        </div>
    );
}

export default Quiz;