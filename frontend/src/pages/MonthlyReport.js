import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import './WeeklyReport.css';
import BottomNav from '../components/BottomNav';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function MonthlyReport() {
    const navigate = useNavigate();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [monthOffset, setMonthOffset] = useState(0);
    const [openToggles, setOpenToggles] = useState({});

    const [mostCurious, setMostCurious] = useState('');
    const [didResearch, setDidResearch] = useState(false);
    const [researchTopic, setResearchTopic] = useState('');
    const [researchNote, setResearchNote] = useState('');
    const [monthlyFeeling, setMonthlyFeeling] = useState('');
    const [reflectionSaved, setReflectionSaved] = useState(false);
    const [saving, setSaving] = useState(false);

    const toggleSection = (key) => {
        setOpenToggles(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { loadReport(); }, [monthOffset]);

    const getMonthRange = (offset = 0) => {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        firstDay.setHours(0, 0, 0, 0);
        const lastDay = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
        lastDay.setHours(23, 59, 59, 999);
        return {
            start: firstDay.toISOString(),
            end: lastDay.toISOString(),
            label: `${firstDay.getFullYear()}년 ${firstDay.getMonth() + 1}월`
        };
    };

    const loadReport = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const { start, end } = getMonthRange(monthOffset);
            const res = await axios.get(
                `${API}/api/reports/monthly?start=${start}&end=${end}`,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            setReport(res.data);
            if (res.data.reflection) {
                const r = res.data.reflection;
                setMostCurious(r.most_curious || '');
                setDidResearch(r.did_research || false);
                setResearchTopic(r.research_topic || '');
                setResearchNote(r.research_note || '');
                setMonthlyFeeling(r.monthly_feeling || '');
                setReflectionSaved(true);
            } else {
                setMostCurious(''); setDidResearch(false);
                setResearchTopic(''); setResearchNote('');
                setMonthlyFeeling(''); setReflectionSaved(false);
            }
        } catch (err) {
            console.error('월간 리포트 로드 오류:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveReflection = async () => {
        if (!mostCurious.trim()) { alert('이번 달 가장 궁금했던 것을 적어주세요!'); return; }
        try {
            setSaving(true);
            const token = localStorage.getItem('token');
            const { start } = getMonthRange(monthOffset);
            await axios.post(`${API}/api/reports/monthly/reflection`, {
                monthStart: start, mostCurious, didResearch,
                researchTopic: didResearch ? researchTopic : '',
                researchNote: didResearch ? researchNote : '',
                monthlyFeeling
            }, { headers: { Authorization: `Bearer ${token}` } });
            alert('월간 돌아보기가 저장되었어요! 10송이 획득 🌸');
            setReflectionSaved(true);
            loadReport();
        } catch (err) {
            alert('저장에 실패했어요');
        } finally {
            setSaving(false);
        }
    };

    const totalActivity = report ?
        (report.stats.questionsCreated || 0) + (report.stats.opinionsGiven || 0) +
        (report.stats.reactionsGiven || 0) + (report.stats.relatedQuestions || 0) : 0;

    const estimatedSongi = report ?
        (report.stats.questionsCreated * 5) + (report.stats.opinionsGiven * 3) +
        (report.stats.reactionsGiven * 1) + (report.stats.relatedQuestions * 5) : 0;

    const { label } = getMonthRange(monthOffset);

    if (loading) return <div className="wr-loading">📈 월간 리포트 불러오는 중...</div>;

    return (
        <div className="wr-container">
            <header className="wr-header">
                <button onClick={() => navigate('/setting')} className="wr-back">← 설정</button>
                <h1>📈 월간 리포트</h1>
                <div className="wr-spacer"></div>
            </header>

            <div className="wr-week-nav">
                <button onClick={() => setMonthOffset(prev => prev - 1)} className="week-arrow">◀</button>
                <span className="week-label">{label}{monthOffset === 0 && ' (이번 달)'}</span>
                <button onClick={() => setMonthOffset(prev => Math.min(prev + 1, 0))} className="week-arrow" disabled={monthOffset >= 0}>▶</button>
            </div>

            <div className="wr-content">

                {/* ===== 돌아보기 (맨 위) ===== */}
                <div className="reflection-card">
                    <h3>💭 이번 달 돌아보기</h3>
                    <p className="reflection-intro">
                        한 달 동안의 활동을 돌아보며 느낀 점을 적어보세요.{!reflectionSaved && ' (+10🌸)'}
                    </p>

                    <div className="reflection-group">
                        <label>📌 이번 달 가장 궁금했던 것은? *</label>
                        <textarea className="reflection-textarea" rows={3}
                            placeholder="가장 궁금했던 질문이나 주제를 적어주세요"
                            value={mostCurious} onChange={e => setMostCurious(e.target.value)}
                            disabled={reflectionSaved} />
                    </div>

                    <div className="reflection-group">
                        <label>🔍 궁금한 것을 찾아본 적 있나요?</label>
                        <div className="research-toggle">
                            <button className={`toggle-btn ${didResearch ? 'active' : ''}`}
                                onClick={() => !reflectionSaved && setDidResearch(true)}
                                disabled={reflectionSaved}>✅ 네, 찾아봤어요</button>
                            <button className={`toggle-btn ${!didResearch ? 'active' : ''}`}
                                onClick={() => !reflectionSaved && setDidResearch(false)}
                                disabled={reflectionSaved}>❌ 아직 못 찾아봤어요</button>
                        </div>
                        {didResearch && (
                            <div className="sub-group" style={{marginTop: 10}}>
                                <label>무엇을 찾아봤나요?</label>
                                <input className="reflection-input" placeholder="찾아본 주제나 내용"
                                    value={researchTopic} onChange={e => setResearchTopic(e.target.value)}
                                    disabled={reflectionSaved} />
                                <label style={{marginTop: 8, display: 'block'}}>알게 된 것을 짧게 적어볼까요?
                                    <span style={{fontSize:'11px', background:'#e5e7eb', color:'#666', padding:'2px 7px', borderRadius:'10px', marginLeft:'4px'}}>선택</span>
                                </label>
                                <textarea className="reflection-textarea" rows={2}
                                    placeholder="알게 된 것을 간단히 적어주세요"
                                    value={researchNote} onChange={e => setResearchNote(e.target.value)}
                                    disabled={reflectionSaved} />
                            </div>
                        )}
                    </div>

                    <div className="reflection-group">
                        <label>💌 이번 달을 한 마디로 표현하면?
                            <span style={{fontSize:'11px', background:'#e5e7eb', color:'#666', padding:'2px 7px', borderRadius:'10px', marginLeft:'4px'}}>선택</span>
                        </label>
                        <input className="reflection-input" placeholder="예: 호기심 가득한 달, 발견의 달..."
                            value={monthlyFeeling} onChange={e => setMonthlyFeeling(e.target.value)}
                            disabled={reflectionSaved} />
                    </div>

                    {!reflectionSaved ? (
                        <button className="save-reflection-btn" onClick={handleSaveReflection}
                            disabled={saving || !mostCurious.trim()}>
                            {saving ? '저장 중...' : '월간 돌아보기 저장하기 (+10🌸)'}
                        </button>
                    ) : (
                        <div style={{textAlign:'center', padding:'16px', background:'#f0fdf4', borderRadius:'12px', color:'#166534', fontWeight:600, fontSize:14}}>
                            ✅ 이번 달 돌아보기 완료! 10송이 획득 🌸
                        </div>
                    )}
                </div>

                {/* ===== 활동 통계 (아래) ===== */}
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

                <div className="stats-card">
                    <h3>📝 이번 달 활동</h3>

                    {/* 만든 질문 */}
                    <div className="stat-row stat-row-toggle" onClick={() => toggleSection('questions')}>
                        <span className="stat-icon">✏️</span>
                        <span className="stat-name">만든 질문</span>
                        <span className="stat-value">{report?.stats?.questionsCreated || 0}개</span>
                        <span className="toggle-arrow">{openToggles['questions'] ? '▲' : '▼'}</span>
                    </div>
                    {openToggles['questions'] && (
                        <div className="toggle-list">
                            {report?.lists?.questions?.length > 0 ? report.lists.questions.map((q, i) => (
                                <div key={i} className="toggle-item">
                                    <span className="toggle-item-text">"{q.title}"</span>
                                </div>
                            )) : <div className="toggle-empty">이번 달 만든 질문이 없어요</div>}
                        </div>
                    )}

                    {/* 관련질문 */}
                    <div className="stat-row stat-row-toggle" onClick={() => toggleSection('related')}>
                        <span className="stat-icon">❓</span>
                        <span className="stat-name">관련질문</span>
                        <span className="stat-value">{report?.stats?.relatedQuestions || 0}개</span>
                        <span className="toggle-arrow">{openToggles['related'] ? '▲' : '▼'}</span>
                    </div>
                    {openToggles['related'] && (
                        <div className="toggle-list">
                            {report?.lists?.related?.length > 0 ? report.lists.related.map((q, i) => (
                                <div key={i} className="toggle-item">
                                    {q.parent_title && <div className="toggle-item-question">💬 {q.parent_title}</div>}
                                    <span className="toggle-item-text">"{q.title}"</span>
                                </div>
                            )) : <div className="toggle-empty">이번 달 관련질문이 없어요</div>}
                        </div>
                    )}

                    {/* 남긴 의견 */}
                    <div className="stat-row stat-row-toggle" onClick={() => toggleSection('opinions')}>
                        <span className="stat-icon">💬</span>
                        <span className="stat-name">남긴 의견</span>
                        <span className="stat-value">{report?.stats?.opinionsGiven || 0}개</span>
                        <span className="toggle-arrow">{openToggles['opinions'] ? '▲' : '▼'}</span>
                    </div>
                    {openToggles['opinions'] && (
                        <div className="toggle-list">
                            {report?.lists?.opinions?.length > 0 ? report.lists.opinions.map((o, i) => (
                                <div key={i} className="toggle-item">
                                    <div className="toggle-item-question">↳ "{o.question_title}"</div>
                                    <div className="toggle-item-text">"{o.content}"</div>
                                </div>
                            )) : <div className="toggle-empty">이번 달 남긴 의견이 없어요</div>}
                        </div>
                    )}

                    {/* 관심 표시 - 토글 + 원본질문 */}
                    <div className="stat-row stat-row-toggle" onClick={() => toggleSection('reactions')}>
                        <span className="stat-icon">👍</span>
                        <span className="stat-name">관심 표시</span>
                        <span className="stat-value">{report?.stats?.reactionsGiven || 0}개</span>
                        <span className="toggle-arrow">{openToggles['reactions'] ? '▲' : '▼'}</span>
                    </div>
                    {openToggles['reactions'] && (
                        <div className="toggle-list">
                            {report?.lists?.reactions?.length > 0 ? report.lists.reactions.map((r, i) => (
                                <div key={i} className="toggle-item">
                                    <span className="toggle-item-text">{r.question_title}</span>
                                    <span className="toggle-item-meta">{r.reaction_type === 'like' ? '👍' : '👎'}</span>
                                </div>
                            )) : <div className="toggle-empty">이번 달 관심 표시가 없어요</div>}
                        </div>
                    )}

                    {/* 퀴즈 - 횟수만 */}
                    <div className="stat-row">
                        <span className="stat-icon">🧩</span>
                        <span className="stat-name">퀴즈 완료</span>
                        <span className="stat-value">{report?.stats?.quizCompleted || 0}회</span>
                    </div>

                    {/* 저장한 질문 */}
                    <div className="stat-row">
                        <span className="stat-icon">🏷️</span>
                        <span className="stat-name">저장한 질문</span>
                        <span className="stat-value">{report?.stats?.questionsSaved || 0}개</span>
                    </div>
                </div>

                {/* TOP 질문 */}
                {report?.highlights?.topQuestions?.length > 0 && (
                    <div className="stats-card">
                        <h3>🏆 이번 달 인기 질문 TOP 3</h3>
                        {report.highlights.topQuestions.map((q, i) => (
                            <div key={i} className="top-question-item">
                                <span className="top-rank">{['🥇','🥈','🥉'][i]}</span>
                                <span className="top-title">{q.title}</span>
                                <span className="top-stats">👍{q.likes} 💬{q.opinion_count}</span>
                            </div>
                        ))}
                    </div>
                )}

                {/* 성장 메시지 */}
                <div className="growth-card">
                    <h3>🌱 이번 달 성장</h3>
                    <p className="growth-msg">
                        {totalActivity === 0
                            ? '이번 달 아직 활동이 없어요. 질문을 시작해볼까요? 🌸'
                            : totalActivity < 10
                            ? `이번 달 ${totalActivity}번 활동했어요. 꾸준히 하면 더 많은 것을 발견할 수 있어요! 💪`
                            : totalActivity < 30
                            ? `이번 달 ${totalActivity}번 활동했어요. 과학적 호기심이 쑥쑥 자라고 있어요! 🌿`
                            : `이번 달 무려 ${totalActivity}번 활동했어요! 정말 대단한 탐구자예요! 🔥`}
                    </p>
                </div>
            </div>

            <BottomNav />
        </div>
    );
}

export default MonthlyReport;
