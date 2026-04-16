import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './WeeklyReport.css';
import BottomNav from '../components/BottomNav';

function WeeklyReport() {
    const navigate = useNavigate();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('stats'); // 'stats' | 'reflection'

    // 돌아보기 폼
    const [mostCurious, setMostCurious] = useState('');
    const [didResearch, setDidResearch] = useState(false);
    const [researchTopic, setResearchTopic] = useState('');
    const [researchNote, setResearchNote] = useState('');
    const [funFriendQuestion, setFunFriendQuestion] = useState('');
    const [weeklyFeeling, setWeeklyFeeling] = useState('');
    const [reflectionSaved, setReflectionSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [openToggles, setOpenToggles] = useState({});

const toggleSection = (key) => {
    setOpenToggles(prev => ({ ...prev, [key]: !prev[key] }));
};
    // 주차 이동
    const [weekOffset, setWeekOffset] = useState(0);

    useEffect(() => {
        loadReport();
    }, [weekOffset]);

    const getWeekRange = (offset = 0) => {
        const now = new Date();
        const dayOfWeek = now.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        
        const monday = new Date(now);
        monday.setDate(now.getDate() + mondayOffset + (offset * 7));
        monday.setHours(0, 0, 0, 0);
        
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);
        
        return { start: monday.toISOString(), end: sunday.toISOString() };
    };

    const loadReport = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const { start, end } = getWeekRange(weekOffset);
            
            const response = await axios.get(
                `http://localhost:5000/api/reports/weekly?start=${start}&end=${end}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            setReport(response.data);
            
            // 돌아보기 데이터가 있으면 폼에 채우기
            if (response.data.reflection) {
                const r = response.data.reflection;
                setMostCurious(r.most_curious || '');
                setDidResearch(r.did_research || false);
                setResearchTopic(r.research_topic || '');
                setResearchNote(r.research_note || '');
                setFunFriendQuestion(r.fun_friend_question || '');
                setWeeklyFeeling(r.weekly_feeling || '');
                setReflectionSaved(true);
            } else {
                setMostCurious('');
                setDidResearch(false);
                setResearchTopic('');
                setResearchNote('');
                setFunFriendQuestion('');
                setWeeklyFeeling('');
                setReflectionSaved(false);
            }
        } catch (err) {
            console.error('리포트 로드 오류:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveReflection = async () => {
        if (!mostCurious.trim()) {
            alert('가장 궁금했던 것을 적어주세요!');
            return;
        }

        try {
            setSaving(true);
            const token = localStorage.getItem('token');
            const { start } = getWeekRange(weekOffset);
            
            await axios.post(
                'http://localhost:5000/api/reports/weekly/reflection',
                {
                    weekStart: start,
                    mostCurious,
                    didResearch,
                    researchTopic: didResearch ? researchTopic : '',
                    researchNote: didResearch ? researchNote : '',
                    funFriendQuestion,
                    weeklyFeeling
                },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            alert('돌아보기가 저장되었어요! 8송이 획득 🌸');
            setReflectionSaved(true);
            loadReport();
        } catch (err) {
            console.error('돌아보기 저장 오류:', err);
            alert('저장에 실패했어요');
        } finally {
            setSaving(false);
        }
    };

    const totalActivity = report ? 
        report.stats.questionsCreated + report.stats.opinionsGiven + 
        report.stats.reactionsGiven + report.stats.relatedQuestions : 0;

    const estimatedSongi = report ?
        (report.stats.questionsCreated * 5) + (report.stats.opinionsGiven * 3) + 
        (report.stats.reactionsGiven * 1) + (report.stats.relatedQuestions * 5) : 0;

    if (loading) {
        return <div className="wr-loading">📊 리포트 불러오는 중...</div>;
    }

    return (
        <div className="wr-container">
            {/* 헤더 */}
            <header className="wr-header">
                <button onClick={() => navigate('/setting')} className="wr-back">← 설정</button>
                <h1>📊 주간 리포트</h1>
                <div className="wr-spacer"></div>
            </header>

            {/* 주차 네비게이션 */}
            <div className="wr-week-nav">
                <button onClick={() => setWeekOffset(prev => prev - 1)} className="week-arrow">◀</button>
                <span className="week-label">
                    {report?.period?.label || '...'}
                    {weekOffset === 0 && ' (이번 주)'}
                </span>
                <button 
                    onClick={() => setWeekOffset(prev => Math.min(prev + 1, 0))} 
                    className="week-arrow"
                    disabled={weekOffset >= 0}
                >▶</button>
            </div>

            {/* 탭 없음 - 돌아보기 먼저, 활동통계 아래 */}

            <div className="wr-content">
                {/* ===== 돌아보기 (맨 위) ===== */}
                <div className="reflection-card">
                    <h3>💭 이번 주 돌아보기</h3>
                    <p className="reflection-intro">
                        이번 주를 돌아보며 적어보세요. {!reflectionSaved && '(+8🌸)'}
                    </p>

                    {/* Q1: 가장 궁금했던 것 */}
                    <div className="reflection-group">
                        <label>🤔 이번 주 가장 궁금했던 것은?</label>
                        <textarea
                            value={mostCurious}
                            onChange={e => setMostCurious(e.target.value)}
                            placeholder="이번 주에 가장 궁금했던 것을 적어보세요"
                            rows={3}
                            maxLength={300}
                            className="reflection-textarea"
                            disabled={reflectionSaved}
                        />
                    </div>

                    {/* Q2: 찾아본 적 있는지 */}
                    <div className="reflection-group">
                        <label>🔍 궁금한 것을 찾아본 적이 있나요?</label>
                        <div className="research-toggle">
                            <button
                                className={`toggle-btn ${didResearch ? 'active' : ''}`}
                                onClick={() => !reflectionSaved && setDidResearch(true)}
                                disabled={reflectionSaved}
                            >✅ 찾아봤어요!</button>
                            <button
                                className={`toggle-btn ${!didResearch ? 'active' : ''}`}
                                onClick={() => !reflectionSaved && setDidResearch(false)}
                                disabled={reflectionSaved}
                            >🤷 아직 못 찾아봤어요</button>
                        </div>
                    </div>

                    {didResearch && (
                        <>
                            <div className="reflection-group sub-group">
                                <label>📌 무엇을 찾아봤어요?</label>
                                <input
                                    type="text"
                                    value={researchTopic}
                                    onChange={e => setResearchTopic(e.target.value)}
                                    placeholder="예: 열기구가 뜨는 원리"
                                    maxLength={100}
                                    className="reflection-input"
                                    disabled={reflectionSaved}
                                />
                            </div>
                            <div className="reflection-group sub-group">
                                <label>📝 알게 된 것을 짧게 적어볼까요? <span style={{fontSize: '11px', background: '#e5e7eb', color: '#666', padding: '2px 7px', borderRadius: '10px', marginLeft: '4px'}}>선택</span></label>
                                <textarea
                                    value={researchNote}
                                    onChange={e => setResearchNote(e.target.value)}
                                    placeholder="찾아보고 알게 된 것을 적어보세요"
                                    rows={3}
                                    maxLength={500}
                                    className="reflection-textarea"
                                    disabled={reflectionSaved}
                                />
                            </div>
                        </>
                    )}

                    {/* Q3: 재밌었던 친구 질문 */}
                    <div className="reflection-group">
                        <label>👥 친구 질문 중 재미있던 것은? <span style={{fontSize: '11px', background: '#e5e7eb', color: '#666', padding: '2px 7px', borderRadius: '10px', marginLeft: '4px'}}>선택</span></label>
                        <textarea
                            value={funFriendQuestion}
                            onChange={e => setFunFriendQuestion(e.target.value)}
                            placeholder="친구가 만든 질문 중 재미있던 것을 적어보세요"
                            rows={2}
                            maxLength={300}
                            className="reflection-textarea"
                            disabled={reflectionSaved}
                        />
                    </div>

                    {/* Q4: 이번 주 느낌 */}
                    <div className="reflection-group">
                        <label>💫 이번 주 한마디 <span style={{fontSize: '11px', background: '#e5e7eb', color: '#666', padding: '2px 7px', borderRadius: '10px', marginLeft: '4px'}}>선택</span></label>
                        <textarea
                            value={weeklyFeeling}
                            onChange={e => setWeeklyFeeling(e.target.value)}
                            placeholder="이번 주 물음송이 활동은 어땠나요?"
                            rows={2}
                            maxLength={300}
                            className="reflection-textarea"
                            disabled={reflectionSaved}
                        />
                    </div>

                    {!reflectionSaved ? (
                        <button
                            className="save-reflection-btn"
                            onClick={handleSaveReflection}
                            disabled={saving}
                        >
                            {saving ? '저장 중...' : '돌아보기 완료 (+8🌸)'}
                        </button>
                    ) : (
                        <div style={{textAlign:'center', padding:'16px', background:'#f0fdf4', borderRadius:'12px', color:'#166534', fontWeight:600, fontSize:14}}>
                            ✅ 이번 주 돌아보기 완료! 8송이 획득 🌸
                        </div>
                    )}
                </div>

                {/* ===== 활동 통계 (아래) ===== */}
                <>
                    {/* 요약 카드 */}
                    <div className="summary-card">
                        <div className="summary-item">
                            <span className="summary-number">{totalActivity}</span>
                            <span className="summary-label">총 활동</span>
                        </div>
                        <div className="summary-divider"></div>
                        <div className="summary-item">
                            <span className="summary-number">~{estimatedSongi}🌸</span>
                            <span className="summary-label">예상 송이</span>
                        </div>
                    </div>

                    {/* 활동 상세 */}
                    <div className="stats-card">
                        <h3>📝 이번 주 활동</h3>

                        {/* 만든 질문 */}
                        <div className="stat-row stat-row-toggle" onClick={() => toggleSection('questions')}>
                            <span className="stat-icon">✏️</span>
                            <span className="stat-name">만든 질문</span>
                            <span className="stat-value">{report?.stats.questionsCreated || 0}개</span>
                            <span className="stat-change">{getChangeText(report?.stats.questionsCreated, report?.comparison.prevQuestions)}</span>
                            <span className="toggle-arrow">{openToggles.questions ? '▲' : '▼'}</span>
                        </div>
                        {openToggles.questions && (
                            <div className="toggle-list">
                                {report?.lists?.questions?.length > 0 ? report.lists.questions.map(q => (
                                    <div key={q.id} className="toggle-item">
                                        <span className="toggle-item-text">"{q.title}"</span>
                                        <span className="toggle-item-meta">👍{q.likes} 💬{q.opinion_count}</span>
                                    </div>
                                )) : <div className="toggle-empty">이번 주 만든 질문이 없어요</div>}
                            </div>
                        )}

                        {/* 남긴 의견 */}
                        <div className="stat-row stat-row-toggle" onClick={() => toggleSection('opinions')}>
                            <span className="stat-icon">💬</span>
                            <span className="stat-name">남긴 의견</span>
                            <span className="stat-value">{report?.stats.opinionsGiven || 0}개</span>
                            <span className="stat-change">{getChangeText(report?.stats.opinionsGiven, report?.comparison.prevOpinions)}</span>
                            <span className="toggle-arrow">{openToggles.opinions ? '▲' : '▼'}</span>
                        </div>
                        {openToggles.opinions && (
                            <div className="toggle-list">
                                {report?.lists?.opinions?.length > 0 ? report.lists.opinions.map((op, i) => (
                                    <div key={i} className="toggle-item">
                                        <div className="toggle-item-question">↳ "{op.question_title}"</div>
                                        <div className="toggle-item-text">"{op.content}"</div>
                                    </div>
                                )) : <div className="toggle-empty">이번 주 남긴 의견이 없어요</div>}
                            </div>
                        )}

                        {/* 관심 표시 */}
                        <div className="stat-row stat-row-toggle" onClick={() => toggleSection('reactions')}>
                            <span className="stat-icon">👍</span>
                            <span className="stat-name">관심 표시</span>
                            <span className="stat-value">{report?.stats.reactionsGiven || 0}회</span>
                            <span className="toggle-arrow">{openToggles.reactions ? '▲' : '▼'}</span>
                        </div>
                        {openToggles.reactions && (
                            <div className="toggle-list">
                                {report?.lists?.reactions?.length > 0 ? report.lists.reactions.map((r, i) => (
                                    <div key={i} className="toggle-item">
                                        <span className="toggle-item-text">{r.question_title}</span>
                                        <span className="toggle-item-meta">{r.reaction_type === 'like' ? '👍' : '👎'}</span>
                                    </div>
                                )) : <div className="toggle-empty">이번 주 반응이 없어요</div>}
                            </div>
                        )}

                        {/* 관련질문 */}
                        <div className="stat-row stat-row-toggle" onClick={() => toggleSection('related')}>
                            <span className="stat-icon">🔗</span>
                            <span className="stat-name">관련질문</span>
                            <span className="stat-value">{report?.stats.relatedQuestions || 0}개</span>
                            <span className="toggle-arrow">{openToggles.related ? '▲' : '▼'}</span>
                        </div>
                        {openToggles.related && (
                            <div className="toggle-list">
                                {report?.lists?.related?.length > 0 ? report.lists.related.map(q => (
                                    <div key={q.id} className="toggle-item">
                                        {q.parent_title && <div className="toggle-item-question">💬 {q.parent_title}</div>}
                                        <span className="toggle-item-text">"{q.title}"</span>
                                    </div>
                                )) : <div className="toggle-empty">이번 주 관련질문이 없어요</div>}
                            </div>
                        )}

                        {/* 저장한 질문 */}
                        <div className="stat-row stat-row-toggle" onClick={() => toggleSection('saved')}>
                            <span className="stat-icon">🏷️</span>
                            <span className="stat-name">저장한 질문</span>
                            <span className="stat-value">{report?.stats.questionsSaved || 0}개</span>
                            <span className="toggle-arrow">{openToggles.saved ? '▲' : '▼'}</span>
                        </div>
                        {openToggles.saved && (
                            <div className="toggle-list">
                                {report?.lists?.saved?.length > 0 ? report.lists.saved.map((s, i) => (
                                    <div key={i} className="toggle-item">
                                        <span className="toggle-item-text">"{s.question_title}"</span>
                                    </div>
                                )) : <div className="toggle-empty">이번 주 저장한 질문이 없어요</div>}
                            </div>
                        )}

                        {/* 퀴즈 완료 - 횟수만 */}
                        <div className="stat-row">
                            <span className="stat-icon">🎯</span>
                            <span className="stat-name">퀴즈 완료</span>
                            <span className="stat-value">{report?.stats.quizCompleted || 0}회</span>
                        </div>
                    </div>

                    {/* 하이라이트 */}
                    {report?.highlights.topQuestions?.length > 0 && (
                        <div className="stats-card">
                            <h3>🌟 이번 주 하이라이트</h3>
                            {report.highlights.mostActiveDay && (
                                <p className="highlight-text">가장 활발했던 날: <strong>{report.highlights.mostActiveDay}</strong></p>
                            )}
                            <div className="top-questions">
                                <p className="section-subtitle">인기 질문 TOP</p>
                                {report.highlights.topQuestions.map((q, i) => (
                                    <div key={q.id} className="top-question-item">
                                        <span className="top-rank">{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                                        <span className="top-title">{q.title}</span>
                                        <span className="top-stats">👍{q.likes} 💬{q.opinion_count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* 성장 메시지 */}
                    <div className="growth-card">
                        <h3>📈 나의 성장</h3>
                        {getGrowthMessages(report).map((msg, i) => (
                            <p key={i} className="growth-msg">{msg}</p>
                        ))}
                    </div>
                </>
            </div>

            <BottomNav />
        </div>
    );
}

// 변화 텍스트
function getChangeText(current, previous) {
    if (previous === undefined || previous === null) return '';
    const diff = (current || 0) - (previous || 0);
    if (diff > 0) return `↑${diff}`;
    if (diff < 0) return `↓${Math.abs(diff)}`;
    return '→';
}

// 성장 메시지 생성
function getGrowthMessages(report) {
    if (!report) return ['아직 데이터가 없어요. 활동을 시작해보세요! 🌱'];
    
    const messages = [];
    const { stats, comparison } = report;
    
    if (stats.questionsCreated > 0) {
        if (stats.questionsCreated > comparison.prevQuestions) {
            messages.push(`질문을 지난 주보다 ${stats.questionsCreated - comparison.prevQuestions}개 더 만들었어요! 👏`);
        } else if (stats.questionsCreated > 0) {
            messages.push(`이번 주 ${stats.questionsCreated}개의 질문을 만들었어요! ✨`);
        }
    }
    
    if (stats.opinionsGiven > comparison.prevOpinions) {
        messages.push('의견 남기기를 더 열심히 했어요! 💬');
    }
    
    if (stats.relatedQuestions > 0) {
        messages.push(`관련질문 ${stats.relatedQuestions}개로 탐구를 넓혔어요! 🔗`);
    }
    
    if (stats.questionsCreated === 0 && stats.opinionsGiven === 0) {
        messages.push('이번 주는 좀 쉬었나봐요. 다음 주에 질문해볼까요? 🌱');
    }
    
    return messages.length > 0 ? messages : ['꾸준히 활동하고 있어요! 좋아요! 🎉'];
}

export default WeeklyReport;
