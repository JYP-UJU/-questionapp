import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './WeeklyReport.css';
import SettingBottomNav from '../components/SettingBottomNav';
import NotificationBell from '../components/NotificationBell';


function MonthlyReport() {
    const navigate = useNavigate();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [monthOffset, setMonthOffset] = useState(0);
    const [openToggles, setOpenToggles] = useState({});

    const [mostCurious, setMostCurious] = useState('');
    const [selectedQuestions, setSelectedQuestions] = useState([]);
    const [monthlyFeeling, setMonthlyFeeling] = useState('');
    const [reflectionSaved, setReflectionSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editMode, setEditMode] = useState(false);

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
            const { start, end } = getMonthRange(monthOffset);
            const res = await api.get(`/reports/monthly?start=${start}&end=${end}`);
            setReport(res.data);
            if (res.data.reflection) {
                const r = res.data.reflection;
                setMostCurious(r.most_curious || '');
                setSelectedQuestions(r.research_topic ? r.research_topic.split('||').filter(Boolean) : []);
                setMonthlyFeeling(r.monthly_feeling || '');
                setReflectionSaved(true);
                setEditMode(false);
            } else {
                setMostCurious('');
                setSelectedQuestions([]);
                setMonthlyFeeling('');
                setReflectionSaved(false);
                setEditMode(false);
            }
        } catch (err) {
            console.error('이번 달의 활동 로드 오류:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveReflection = async () => {
        if (!mostCurious.trim()) { alert('이번 달 가장 궁금했던 것을 적어주세요!'); return; }
        try {
            setSaving(true);
            const { start } = getMonthRange(monthOffset);
            await api.post('/reports/monthly/reflection', {
                monthStart: start, mostCurious,
                didResearch: selectedQuestions.length > 0,
                researchTopic: selectedQuestions.join('||'),
                researchNote: '',
                monthlyFeeling
            });
            setReflectionSaved(true);
            setEditMode(false);
            loadReport();
        } catch (err) {
            alert('저장에 실패했어요');
        } finally {
            setSaving(false);
        }
    };

    const getAllItems = () => {
        return [
            ...(report?.lists?.questions || []).map(q => ({ title: q.title, type: '만든질문' })),
            ...(report?.lists?.related || []).map(q => ({ title: q.title, type: '관련질문' })),
        ].filter((item, idx, arr) => item.title && arr.findIndex(a => a.title === item.title) === idx);
    };

    const toggleQuestion = (title) => {
        setSelectedQuestions(prev =>
            prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
        );
    };

    const totalActivity = report ?
        (report.stats.questionsCreated || 0) + (report.stats.opinionsGiven || 0) +
        (report.stats.reactionsGiven || 0) + (report.stats.relatedQuestions || 0) : 0;

    const estimatedSongi = report ?
        (report.stats.questionsCreated * 5) + (report.stats.opinionsGiven * 3) +
        (report.stats.reactionsGiven * 1) + (report.stats.relatedQuestions * 5) : 0;

    const { label } = getMonthRange(monthOffset);

    if (loading) return <div className="wr-loading">📈  이번 달의 활동 불러오는 중...</div>;

    const isEditable = !reflectionSaved || editMode;

    return (
        <div className="wr-container">
            <header className="wr-header">
                <button onClick={() => navigate(-1)} className="wr-back">← 나의공간</button>
                <h1 style={{fontSize:"22px", fontWeight:"800", margin:0}}>📈 이번 달의 활동</h1>
                <NotificationBell />
            </header>

            <div className="wr-week-nav">
                <button onClick={() => setMonthOffset(prev => prev - 1)} className="week-arrow">◀</button>
                <span className="week-label">{label}{monthOffset === 0 && ' (이번 달)'}</span>
                <button onClick={() => setMonthOffset(prev => Math.min(prev + 1, 0))} className="week-arrow" disabled={monthOffset >= 0}>▶</button>
            </div>

            <div className="wr-content">

                {/* ===== 돌아보기 ===== */}
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
                            disabled={!isEditable} />
                    </div>

                    <div className="reflection-group">
                        <label>
                            🔍 궁금한 것을 더 찾아본 적이 있나요?{' '}
                            <span style={{fontSize:'11px', color:'#888'}}>이번 달에 활동한 질문들 중에서 선택해 보세요.</span>
                        </label>

                        {/* 저장 완료 상태: 선택된 항목만 표시 */}
                        {reflectionSaved && !editMode ? (
                            <div style={{marginTop:'8px'}}>
                                {selectedQuestions.length === 0 ? (
                                    <div style={{color:'#aaa', fontSize:'13px', padding:'6px 0'}}>선택한 질문이 없어요</div>
                                ) : (
                                    <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
                                        {selectedQuestions.map((title, i) => (
                                            <div key={i} style={{
                                                display:'flex', alignItems:'center', gap:'6px',
                                                background:'#eff6ff', borderRadius:'8px',
                                                padding:'7px 10px', fontSize:'13px', color:'#1e40af'
                                            }}>
                                                <span>✅</span>
                                                <span>{title}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            /* 편집 상태: 체크박스 목록 */
                            (() => {
                                const allItems = getAllItems();
                                if (allItems.length === 0) return (
                                    <div style={{color:'#aaa', fontSize:'13px', padding:'8px 0'}}>이번 달 활동한 질문이 없어요</div>
                                );
                                return (
                                    <div style={{display:'flex', flexDirection:'column', gap:'6px', marginTop:'8px'}}>
                                        {allItems.map((item, i) => {
                                            const checked = selectedQuestions.includes(item.title);
                                            return (
                                                <div
                                                    key={i}
                                                    onClick={() => toggleQuestion(item.title)}
                                                    style={{
                                                        display:'flex', alignItems:'flex-start', gap:'8px',
                                                        cursor:'pointer', padding:'4px 2px'
                                                    }}
                                                >
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleQuestion(item.title)}
                                                        onClick={e => e.stopPropagation()}
                                                        style={{marginTop:'2px', accentColor:'#3b82f6', cursor:'pointer', width:'16px', height:'16px', flexShrink:0}}
                                                    />
                                                    <span style={{fontSize:'13px', color:'#333', lineHeight:'1.5', userSelect:'none'}}>
                                                        {item.title}
                                                        <span style={{marginLeft:'6px', fontSize:'11px', background:'#e5e7eb', color:'#666', padding:'1px 6px', borderRadius:'8px'}}>{item.type}</span>
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                );
                            })()
                        )}
                    </div>

                    <div className="reflection-group">
                        <label>💌 이번 달을 한 마디로 표현하면?
                            <span style={{fontSize:'11px', background:'#e5e7eb', color:'#666', padding:'2px 7px', borderRadius:'10px', marginLeft:'4px'}}>선택</span>
                        </label>
                        <input className="reflection-input" placeholder="예: 호기심 가득한 달, 발견의 달..."
                            value={monthlyFeeling} onChange={e => setMonthlyFeeling(e.target.value)}
                            disabled={!isEditable} />
                    </div>

                    {/* 저장 완료 상태 */}
                    {reflectionSaved && !editMode && (
                        <div style={{marginBottom:'12px', background:'#f0fdf4', borderRadius:'12px', padding:'14px 16px', color:'#166534', fontWeight:700, fontSize:14, textAlign:'center'}}>
                            ✅ 이번 달 돌아보기 완료! 10송이 획득 🌸
                        </div>
                    )}


                    {/* 버튼 영역 */}
                    {!reflectionSaved && (
                        <button className="save-reflection-btn" onClick={handleSaveReflection}
                            disabled={saving || !mostCurious.trim()}>
                            {saving ? '저장 중...' : '이번 달의 활동 저장하기 (+10🌸)'}
                        </button>
                    )}
                    {reflectionSaved && !editMode && (
                        <button
                            className="save-reflection-btn"
                            style={{background:'#9ca3af', marginTop:'4px'}}
                            onClick={() => setEditMode(true)}
                        >
                            ✏️ 수정하기
                        </button>
                    )}
                    {reflectionSaved && editMode && (
                        <div style={{display:'flex', gap:'8px', marginTop:'4px'}}>
                            <button
                                className="save-reflection-btn"
                                onClick={handleSaveReflection}
                                disabled={saving || !mostCurious.trim()}
                                style={{flex:2}}
                            >
                                {saving ? '저장 중...' : '💾 수정 저장'}
                            </button>
                            <button
                                className="save-reflection-btn"
                                style={{flex:1, background:'#9ca3af'}}
                                onClick={() => { setEditMode(false); loadReport(); }}
                            >
                                취소
                            </button>
                        </div>
                    )}
                </div>



                <div className="stats-card">
                    <h3>📝 이번 달 활동</h3>

                    {/* 1. 만든 질문 */}
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
                                    <span className="toggle-item-meta">👍 {q.likes ?? 0} &nbsp; 💬 {q.opinion_count ?? 0}</span>
                                </div>
                            )) : <div className="toggle-empty">이번 달 만든 질문이 없어요</div>}
                        </div>
                    )}

                    {/* 2. 관련질문 */}
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
                                    <span className="toggle-item-meta">👍 {q.likes ?? 0} &nbsp; 💬 {q.opinion_count ?? 0}</span>
                                </div>
                            )) : <div className="toggle-empty">이번 달 관련질문이 없어요</div>}
                        </div>
                    )}

                    {/* 3. 남긴 의견 */}
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

                    {/* 4. 관심 표시 */}
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

                    {/* 5. 퀴즈 완료 */}
                    <div className="stat-row">
                        <span className="stat-icon">🧩</span>
                        <span className="stat-name">퀴즈 완료</span>
                        <span className="stat-value">{report?.stats?.quizCompleted || 0}회</span>
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
    {totalActivity === 0
        ? <p className="growth-msg">이번 달은 좀 쉬었나봐요. 다음 달에 질문해볼까요? 🌱</p>
        : <>
            {(report?.stats?.questionsCreated || 0) > 0 && (
                <p className="growth-msg">이번 달 {report.stats.questionsCreated}개의 질문을 만들었어요! ✏️</p>
            )}
            {(report?.stats?.relatedQuestions || 0) > 0 && (
                <p className="growth-msg">관련질문 {report.stats.relatedQuestions}개로 탐구를 넓혔어요! ❓</p>
            )}
            {(report?.stats?.opinionsGiven || 0) > 0 && (
                <p className="growth-msg">의견 {report.stats.opinionsGiven}개로 생각을 나눴어요! 💬</p>
            )}
            {(report?.stats?.reactionsGiven || 0) > 0 && (
                <p className="growth-msg">{report.stats.reactionsGiven}번 관심을 표시했어요! 👍</p>
            )}
        </>
    }
</div>
            </div>
<div style={{
    textAlign:'center', padding:'16px 20px 80px',
    fontSize:'14px', color:'#666'
}}>
    <span>🌸 송이를 확인해 보세요! </span>
    <button
        onClick={() => navigate('/profile')}
        style={{
            background:'none', border:'none',
            color:'#3b82f6', fontWeight:'700',
            fontSize:'14px', cursor:'pointer',
            textDecoration:'underline'
        }}
    >
        내 프로필에서 확인하기 →
    </button>
</div>
<div style={{
    margin:'12px 8px 80px',
    background:'#eff6ff',
    borderRadius:'14px',
    padding:'16px 20px',
    textAlign:'center'
}}>
    <div style={{fontSize:'15px', color:'#1e40af', fontWeight:'600', marginBottom:'8px'}}>
        🌸 송이를 확인해 보세요!
    </div>
    <button
        onClick={() => navigate('/profile')}
        style={{
            background:'#3b82f6', border:'none',
            color:'white', fontWeight:'700',
            fontSize:'14px', cursor:'pointer',
            padding:'8px 20px', borderRadius:'20px'
        }}
    >
        내 프로필에서 확인하기 →
    </button>
</div>
            <SettingBottomNav />
        </div>
    );
}

export default MonthlyReport;
