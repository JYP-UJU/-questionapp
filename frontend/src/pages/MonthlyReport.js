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

    const [mostCurious, setMostCurious] = useState('');
    const [selectedQuestions, setSelectedQuestions] = useState([]);
    const [monthlyFeeling, setMonthlyFeeling] = useState('');
    const [reflectionSaved, setReflectionSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [openToggles, setOpenToggles] = useState({});
    const [editMode, setEditMode] = useState(false);

    // 당신의 성향은요 (월간 = 최근 30일 버전)
    const [keywords, setKeywords] = useState(null);
    const [keywordsLoading, setKeywordsLoading] = useState(true);
    const [keywordsRefreshing, setKeywordsRefreshing] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState(null);
    const [showTips, setShowTips] = useState(false);

    const toggleSection = (key) => {
        setOpenToggles(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const [monthOffset, setMonthOffset] = useState(0);
    const [monthlyHeroes, setMonthlyHeroes] = useState([]);

    useEffect(() => {
        const { start, end } = getMonthRange(monthOffset);
        api.get(`/reports/monthly-leaderboard?start=${start}&end=${end}`)
            .then(res => setMonthlyHeroes(res.data.leaderboard || []))
            .catch(err => console.error('이달의 영웅 로드 오류:', err));
    }, [monthOffset]);

    useEffect(() => {
        loadReport();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [monthOffset]);

    // 최근 30일 관심사 브리핑 — monthOffset과 무관하게 항상 "지금 기준 최근 30일"이라 한 번만 불러오면 됨
    useEffect(() => {
        loadKeywords(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadKeywords = async (force) => {
        if (force) setKeywordsRefreshing(true); else setKeywordsLoading(true);
        try {
            const res = await api.get('/users/me/keywords', { params: { period: 'monthly', ...(force ? { force: 'true' } : {}) } });
            setKeywords(res.data);
        } catch (err) {
            console.error('키워드 로드 오류:', err);
        } finally {
            setKeywordsLoading(false);
            setKeywordsRefreshing(false);
        }
    };

    // 로그 기록은 화면 반응을 막으면 안 되니 실패해도 조용히 무시 (fire-and-forget)
    const logKeywordEvent = (eventType, target, questionText) => {
        api.post('/users/me/keyword-events', { eventType, target, questionText }).catch(() => {});
    };

    const handleCopy = async (text, index) => {
        try {
            await navigator.clipboard.writeText(text);
        } catch (err) {
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            try { document.execCommand('copy'); } catch (e) {}
            document.body.removeChild(textarea);
        }
        setCopiedIndex(index);
        setTimeout(() => setCopiedIndex(null), 1500);
        logKeywordEvent('copy', null, text);
    };

    const handleSearchClick = (questionText, engine) => {
        logKeywordEvent('search_click', engine, questionText);
        const url = engine === 'naver'
            ? `https://search.naver.com/search.naver?query=${encodeURIComponent(questionText)}`
            : `https://www.google.com/search?q=${encodeURIComponent(questionText + ' 원리 이유')}`;
        window.open(url, '_blank', 'noopener,noreferrer');
    };

    const getMonthRange = (offset = 0) => {
        const now = new Date();
        const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
        first.setHours(0, 0, 0, 0);
        const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
        last.setHours(23, 59, 59, 999);
        return { start: first.toISOString(), end: last.toISOString() };
    };

    const loadReport = async () => {
        try {
            setLoading(true);
            const { start, end } = getMonthRange(monthOffset);
            const response = await api.get(`/reports/monthly?start=${start}&end=${end}`);
            setReport(response.data);

            if (response.data.reflection) {
                const r = response.data.reflection;
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
            const { start } = getMonthRange(monthOffset);
            await api.post('/reports/monthly/reflection', {
                monthStart: start,
                mostCurious,
                didResearch: selectedQuestions.length > 0,
                researchTopic: selectedQuestions.join('||'),
                researchNote: '',
                monthlyFeeling
            });
            setReflectionSaved(true);
            setEditMode(false);
            loadReport();
        } catch (err) {
            console.error('돌아보기 저장 오류:', err);
            alert('저장에 실패했어요');
        } finally {
            setSaving(false);
        }
    };

    const getAllItems = () => {
        const items = [
            ...(report?.lists?.questions || []).map(q => ({ title: q.title, type: '만든질문' })),
            ...(report?.lists?.related || []).map(q => ({ title: q.title, type: '관련질문' })),
        ].filter((item, idx, arr) => item.title && arr.findIndex(a => a.title === item.title) === idx);

        return items;
    };

    const toggleQuestion = (title) => {
        setSelectedQuestions(prev =>
            prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
        );
    };

    if (loading) {
        return <div className="wr-loading">📊 리포트 불러오는 중...</div>;
    }

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
                <span className="week-label">
                    {report?.period?.label || '...'}
                    {monthOffset === 0 && ' (이번 달)'}
                </span>
                <button
                    onClick={() => setMonthOffset(prev => Math.min(prev + 1, 0))}
                    className="week-arrow"
                    disabled={monthOffset >= 0}
                >▶</button>
            </div>

            <div className="wr-content">
                {/* ===== 이달의 영웅 TOP 3 ===== */}
                {monthlyHeroes.length > 0 && (
                    <div className="stats-card" style={{background:'linear-gradient(135deg, #fff7e6, #fff1cc)'}}>
                        <h3>🏆 이달의 영웅</h3>
                        <div style={{display:'flex', flexDirection:'column', gap:'8px', marginTop:'8px'}}>
                            {monthlyHeroes.map((h, i) => (
                                <div key={i} style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                    <span style={{fontSize:'20px'}}>{['🥇','🥈','🥉'][i]}</span>
                                    <span style={{flex:1, fontWeight:600, color:'#333'}}>{h.name}</span>
                                    <span style={{color:'#f59e0b', fontWeight:700}}>{h.songi}송이</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ===== 최근 30일 관심사 브리핑 ===== */}
                <div className="stats-card">
                    <h3>🔮 당신의 성향은요</h3>
                    {keywordsLoading ? (
                        <div style={{textAlign:'center', color:'#aaa', fontSize:'13px', padding:'12px 0'}}>불러오는 중...</div>
                    ) : keywords?.insufficientData ? (
                        <div style={{textAlign:'center', color:'#aaa', fontSize:'13px', padding:'12px 0'}}>
                            최근 30일 동안은 활동이 없었어요. 질문을 써보거나 관심있음을 눌러보세요!
                        </div>
                    ) : (
                        <div>
                            <p style={{ fontSize: '15px', color: '#333', lineHeight: 1.6, margin: '8px 0 16px' }}>
                                최근 30일 활동에서는 주로{' '}
                                {(keywords?.keywords || []).map((kw, i) => (
                                    <React.Fragment key={i}>
                                        <span
                                            onClick={() => navigate(`/questions?search=${encodeURIComponent(kw)}`)}
                                            style={{ color: '#6b84c4', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline' }}
                                        >
                                            {kw}
                                        </span>
                                        {i < (keywords?.keywords?.length || 0) - 1 ? ', ' : ''}
                                    </React.Fragment>
                                ))}
                                에 관심이 많았어요.{' '}
                                <span style={{ fontSize: '12px', color: '#aaa' }}>
                                    (클릭하면 물음송이의 질문 검색 결과를 볼 수 있어요.)
                                </span>
                            </p>

                            <p style={{ fontSize: '13px', color: '#888', margin: '0 0 12px' }}>
                                이 질문으로 한번 더 찾아볼 수도 있어요.
                            </p>

                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '10px' }}>
                                {(keywords?.questions || []).map((q, i) => (
                                    <div key={i} style={{
                                        display: 'flex', alignItems: 'center', gap: '8px',
                                        background: '#f8f9ff', border: '1px solid #e5e7eb',
                                        borderRadius: '10px', padding: '10px 12px'
                                    }}>
                                        <span style={{ flex: 1, fontSize: '14px', color: '#333', lineHeight: 1.4 }}>{q}</span>
                                        <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                                            <button
                                                onClick={() => handleCopy(q, i)}
                                                style={{
                                                    padding: '6px 8px', borderRadius: '8px', border: 'none',
                                                    background: copiedIndex === i ? '#16a34a' : '#6b84c4',
                                                    color: 'white', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
                                                    whiteSpace: 'nowrap'
                                                }}
                                            >
                                                {copiedIndex === i ? '✓' : '📋 복사'}
                                            </button>
                                            <button
                                                onClick={() => handleSearchClick(q, 'naver')}
                                                style={{
                                                    padding: '6px 8px', borderRadius: '8px', border: '1px solid #e5e7eb',
                                                    background: 'white', color: '#03c75a', fontSize: '11px', fontWeight: 700,
                                                    cursor: 'pointer', whiteSpace: 'nowrap'
                                                }}
                                            >
                                                🔍 네이버
                                            </button>
                                            <button
                                                onClick={() => handleSearchClick(q, 'google')}
                                                style={{
                                                    padding: '6px 8px', borderRadius: '8px', border: '1px solid #e5e7eb',
                                                    background: 'white', color: '#333', fontSize: '11px', fontWeight: 700,
                                                    cursor: 'pointer', whiteSpace: 'nowrap'
                                                }}
                                            >
                                                🔍 구글
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <button
                                onClick={() => setShowTips(v => !v)}
                                style={{
                                    display: 'flex', alignItems: 'center', gap: '4px',
                                    background: 'none', border: 'none', color: '#6b84c4',
                                    fontSize: '12px', fontWeight: 600, cursor: 'pointer', padding: 0
                                }}
                            >
                                {showTips ? '▲' : '▼'} 찾아볼 때 팁
                            </button>
                            {showTips && (
                                <ul style={{ margin: '8px 0 0', paddingLeft: '18px', fontSize: '12px', color: '#888', lineHeight: 1.6 }}>
                                    <li>검색 결과가 어려우면, 모르는 단어만 따로 한 번 더 검색해보세요.</li>
                                    <li>여러 사이트 결과를 비교해서 읽어보면 이해가 더 잘 돼요.</li>
                                </ul>
                            )}

                            <button
                                onClick={() => loadKeywords(true)}
                                disabled={keywordsRefreshing}
                                style={{
                                    display: 'block', marginTop: '12px', background: 'none', border: 'none',
                                    color: '#aaa', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline'
                                }}
                            >
                                {keywordsRefreshing ? '새로 만드는 중...' : '🔄 새로 만들기'}
                            </button>
                        </div>
                    )}
                </div>

                {/* ===== 돌아보기 ===== */}
                <div className="reflection-card">
                    <h3>💭 이번 달 돌아보기</h3>
                    <p className="reflection-intro">
                        이번 달을 돌아보며 적어보세요. {!reflectionSaved && '(+3~7🌸)'}
                    </p>

                    <div className="reflection-group">
                        <label>🤔 이번 달 가장 궁금했던 것은?</label>
                        <textarea
                            value={mostCurious}
                            onChange={e => setMostCurious(e.target.value)}
                            placeholder="이번 달에 가장 궁금했던 것을 적어보세요"
                            rows={3}
                            maxLength={300}
                            className="reflection-textarea"
                            disabled={!isEditable}
                        />
                    </div>

                    <div className="reflection-group">
                        <label>
                            🔍 궁금한 것을 더 찾아본 적이 있나요?{' '}
                            <span style={{fontSize:'14px', color:'#888'}}>이번 달에 활동한 것들 중에서 선택해 보세요.</span>
                        </label>

                        {reflectionSaved && !editMode ? (
                            <div style={{marginTop:'8px'}}>
                                {selectedQuestions.length === 0 ? (
                                    <div style={{color:'#aaa', fontSize:'13px', padding:'6px 0'}}>선택한 항목이 없어요</div>
                                ) : (
                                    <div style={{display:'flex', flexDirection:'column', gap:'5px'}}>
                                        {selectedQuestions.map((title, i) => (
                                            <div key={i} style={{
                                                display:'flex', alignItems:'center', gap:'6px',
                                                background:'#eff6ff', borderRadius:'8px',
                                                padding:'7px 10px', fontSize:'16px', color:'#1e40af'
                                            }}>
                                                <span>✅</span>
                                                <span>{title}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            (() => {
                                const allItems = getAllItems();
                                if (allItems.length === 0) return (
                                    <div style={{color:'#aaa', fontSize:'13px', padding:'8px 0'}}>이번 달 활동한 내용이 없어요</div>
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
                                                    <span style={{fontSize:'16px', color:'#333', lineHeight:'1.7', userSelect:'none'}}>
                                                        {item.title}
                                                        <span style={{marginLeft:'6px', fontSize:'14px', color:'#aaa'}}>{item.type}</span>
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
                        <label>💫 이번 달 한마디 <span style={{fontSize:'11px', background:'#e5e7eb', color:'#666', padding:'2px 7px', borderRadius:'10px', marginLeft:'4px'}}>선택</span></label>
                        <textarea
                            value={monthlyFeeling}
                            onChange={e => setMonthlyFeeling(e.target.value)}
                            placeholder="이번 달 물음송이 활동은 어땠나요?"
                            rows={2}
                            maxLength={300}
                            className="reflection-textarea"
                            disabled={!isEditable}
                        />
                    </div>

                    {!reflectionSaved && (
                        <button
                            className="save-reflection-btn"
                            onClick={handleSaveReflection}
                            disabled={saving || !mostCurious.trim()}
                        >
                            {saving ? '저장 중...' : '돌아보기 완료'}
                        </button>
                    )}
                    {reflectionSaved && !editMode && (
                        <button
                            className="save-reflection-btn"
                            style={{background:'#87CEEB', marginBottom:'12px'}}
                            onClick={() => setEditMode(true)}
                        >
                            ✏️ 수정하기
                        </button>
                    )}

                    {reflectionSaved && !editMode && (
                        <div style={{marginBottom:'12px', background:'#f0fdf4', borderRadius:'12px', padding:'14px 16px', color:'#166534', fontWeight:700, fontSize:14, textAlign:'center'}}>
                            ✅ 이번 달 완료! 다음 달에 만나요.
                        </div>
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
                    <h3>📝 이번 달의 활동</h3>

                    {/* 1. 만든 질문 */}
                    <div className="stat-row stat-row-toggle" onClick={() => toggleSection('questions')}>
                        <span className="stat-icon">✏️</span>
                        <span className="stat-name">만든 질문</span>
                        <span className="stat-value">{report?.stats.questionsCreated || 0}개</span>
                        <span className="toggle-arrow">{openToggles.questions ? '▲' : '▼'}</span>
                    </div>
                    {openToggles.questions && (
                        <div className="toggle-list">
                            {report?.lists?.questions?.length > 0 ? report.lists.questions.map(q => (
                                <div key={q.id} className="toggle-item">
                                    <span className="toggle-item-text">"{q.title}"</span>
                                    <span className="toggle-item-meta">👍 {q.likes} &nbsp; 💬 {q.opinion_count}</span>
                                </div>
                            )) : <div className="toggle-empty">이번 달 만든 질문이 없어요</div>}
                        </div>
                    )}

                    {/* 2. 관련질문 */}
                    <div className="stat-row stat-row-toggle" onClick={() => toggleSection('related')}>
                        <span className="stat-icon">❓</span>
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
                                    <span className="toggle-item-meta">👍 {q.likes ?? 0} &nbsp; 💬 {q.opinion_count ?? 0}</span>
                                </div>
                            )) : <div className="toggle-empty">이번 달 관련질문이 없어요</div>}
                        </div>
                    )}

                    {/* 3. 남긴 의견 */}
                    <div className="stat-row stat-row-toggle" onClick={() => toggleSection('opinions')}>
                        <span className="stat-icon">💬</span>
                        <span className="stat-name">남긴 의견</span>
                        <span className="stat-value">{report?.stats.opinionsGiven || 0}개</span>
                        <span className="toggle-arrow">{openToggles.opinions ? '▲' : '▼'}</span>
                    </div>
                    {openToggles.opinions && (
                        <div className="toggle-list">
                            {report?.lists?.opinions?.length > 0 ? report.lists.opinions.map((op, i) => (
                                <div key={i} className="toggle-item">
                                    <div className="toggle-item-question">↳ "{op.question_title}"</div>
                                    <div className="toggle-item-text">"{op.content}"</div>
                                </div>
                            )) : <div className="toggle-empty">이번 달 남긴 의견이 없어요</div>}
                        </div>
                    )}

                    {/* 4. 관심 표시 */}
                    <div className="stat-row stat-row-toggle" onClick={() => toggleSection('reactions')}>
                        <span className="stat-icon">👍</span>
                        <span className="stat-name">관심 표시</span>
                        <span className="stat-value">{report?.stats.reactionsGiven || 0}개</span>
                        <span className="toggle-arrow">{openToggles.reactions ? '▲' : '▼'}</span>
                    </div>
                    {openToggles.reactions && (
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
                        <span className="stat-value">{report?.stats.quizCompleted || 0}회</span>
                    </div>
                </div>

                {/* 하이라이트 */}
                {report?.highlights?.topQuestions?.length > 0 && (
                    <div className="stats-card">
                        <h3>🌟 이번 달 하이라이트</h3>
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

                {/* 성장 메시지 (월간엔 지난달 비교 데이터가 없어서 절대치 기준으로만 안내) */}
                <div className="growth-card">
                    <h3>📈 나의 성장</h3>
                    {getMonthlyGrowthMessages(report).map((msg, i) => (
                        <p key={i} className="growth-msg">{msg}</p>
                    ))}
                </div>
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

function getMonthlyGrowthMessages(report) {
    if (!report) return ['아직 데이터가 없어요. 활동을 시작해보세요! 🌱'];
    const { stats } = report;
    const messages = [];
    if (stats.questionsCreated > 0) {
        messages.push(`이번 달 ${stats.questionsCreated}개의 질문을 만들었어요! ✏️`);
    }
    if (stats.relatedQuestions > 0) {
        messages.push(`관련질문 ${stats.relatedQuestions}개로 탐구를 넓혔어요! ❓`);
    }
    if (stats.opinionsGiven > 0) {
        messages.push(`의견을 ${stats.opinionsGiven}번 남겼어요! 💬`);
    }
    if (stats.questionsCreated === 0 && stats.opinionsGiven === 0 && stats.relatedQuestions === 0) {
        messages.push('이번 달은 좀 쉬었나봐요. 다음 달에 질문해볼까요? 🌱');
    }
    return messages.length > 0 ? messages : ['꾸준히 활동하고 있어요! 좋아요! 🎉'];
}

export default MonthlyReport;
