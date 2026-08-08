import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './WeeklyReport.css';
import SettingBottomNav from '../components/SettingBottomNav';
import NotificationBell from '../components/NotificationBell';

function WeeklyReport() {
    const navigate = useNavigate();
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);

    const [activeTab, setActiveTab] = useState('stats');

    const [mostCurious, setMostCurious] = useState('');
    const [selectedQuestions, setSelectedQuestions] = useState([]);
    const [funFriendQuestion, setFunFriendQuestion] = useState('');
    const [weeklyFeeling, setWeeklyFeeling] = useState('');
    const [reflectionSaved, setReflectionSaved] = useState(false);
    const [saving, setSaving] = useState(false);
    const [openToggles, setOpenToggles] = useState({});
    const [editMode, setEditMode] = useState(false);
    const [keywords, setKeywords] = useState(null);
    const [keywordsLoading, setKeywordsLoading] = useState(true);
    const [keywordsRefreshing, setKeywordsRefreshing] = useState(false);
    const [copiedIndex, setCopiedIndex] = useState(null);
    const [showTips, setShowTips] = useState(false);

    const toggleSection = (key) => {
        setOpenToggles(prev => ({ ...prev, [key]: !prev[key] }));
    };

    const [weekOffset, setWeekOffset] = useState(0);
    const [weeklyHeroes, setWeeklyHeroes] = useState([]);

    useEffect(() => {
        const { start, end } = getWeekRange(weekOffset);
        api.get(`/reports/weekly-leaderboard?start=${start}&end=${end}`)
            .then(res => setWeeklyHeroes(res.data.leaderboard || []))
            .catch(err => console.error('이주의 영웅 로드 오류:', err));
    }, [weekOffset]);

    useEffect(() => {
        loadReport();
    }, [weekOffset]);

    // 최근 15일 관심사 브리핑 — weekOffset과 무관하게 항상 "지금 기준 최근 15일"이라
    // 주 이동(◀▶)과 상관없이 한 번만 불러오면 됨
    useEffect(() => {
        loadKeywords(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const loadKeywords = async (force) => {
        if (force) setKeywordsRefreshing(true); else setKeywordsLoading(true);
        try {
            const res = await api.get('/users/me/keywords', { params: { period: 'recent', ...(force ? { force: 'true' } : {}) } });
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
            const { start, end } = getWeekRange(weekOffset);
            const response = await api.get(`/reports/weekly?start=${start}&end=${end}`);
            setReport(response.data);

            if (response.data.reflection) {
                const r = response.data.reflection;
                setMostCurious(r.most_curious || '');
                setSelectedQuestions(r.research_topic ? r.research_topic.split('||').filter(Boolean) : []);
                setFunFriendQuestion(r.fun_friend_question || '');
                setWeeklyFeeling(r.weekly_feeling || '');
                setReflectionSaved(true);
                setEditMode(false);
            } else {
                setMostCurious('');
                setSelectedQuestions([]);
                setFunFriendQuestion('');
                setWeeklyFeeling('');
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
            const { start } = getWeekRange(weekOffset);
            await api.post('/reports/weekly/reflection', {
                weekStart: start,
                mostCurious,
                didResearch: selectedQuestions.length > 0,
                researchTopic: selectedQuestions.join('||'),
                researchNote: '',
                funFriendQuestion,
                weeklyFeeling
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

    // ✅ 퀴즈 완료 횟수도 항목으로 포함
    const getAllItems = () => {
        const items = [
            ...(report?.lists?.questions || []).map(q => ({ title: q.title, type: '만든질문' })),
            ...(report?.lists?.related || []).map(q => ({ title: q.title, type: '관련질문' })),
        ].filter((item, idx, arr) => item.title && arr.findIndex(a => a.title === item.title) === idx);

        // 퀴즈는 선택 목록에서 제외

        return items;
    };

    const toggleQuestion = (title) => {
        setSelectedQuestions(prev =>
            prev.includes(title) ? prev.filter(t => t !== title) : [...prev, title]
        );
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

    const isEditable = !reflectionSaved || editMode;

    return (
        <div className="wr-container">
            <header className="wr-header">
                <button onClick={() => navigate(-1)} className="wr-back">← 나의공간</button>
                <h1 style={{fontSize:"22px", fontWeight:"800", margin:0}}>📊 이번 주의 활동</h1>
                <NotificationBell />
            </header>

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

            <div className="wr-content">
                {/* ===== 이주의 영웅 TOP 3 ===== */}
                {weeklyHeroes.length > 0 && (
                    <div className="stats-card" style={{background:'linear-gradient(135deg, #fff7e6, #fff1cc)'}}>
                        <h3>🏆 이주의 영웅</h3>
                        <div style={{display:'flex', flexDirection:'column', gap:'8px', marginTop:'8px'}}>
                            {weeklyHeroes.map((h, i) => (
                                <div key={i} style={{display:'flex', alignItems:'center', gap:'10px'}}>
                                    <span style={{fontSize:'20px'}}>{['🥇','🥈','🥉'][i]}</span>
                                    <span style={{flex:1, fontWeight:600, color:'#333'}}>{h.name}</span>
                                    <span style={{color:'#f59e0b', fontWeight:700}}>{h.songi}송이</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* ===== 최근 15일 관심사 브리핑 (프로필에서 이동해옴) ===== */}
                <div className="stats-card">
                    <h3>🔮 당신의 성향은요</h3>
                    {keywordsLoading ? (
                        <div style={{textAlign:'center', color:'#aaa', fontSize:'13px', padding:'12px 0'}}>불러오는 중...</div>
                    ) : keywords?.insufficientData ? (
                        <div style={{textAlign:'center', color:'#aaa', fontSize:'13px', padding:'12px 0'}}>
                            최근 15일 동안은 활동이 없었어요. 질문을 써보거나 관심있음을 눌러보세요!
                        </div>
                    ) : (
                        <div>
                            <p style={{ fontSize: '15px', color: '#333', lineHeight: 1.6, margin: '8px 0 16px' }}>
                                최근 15일 활동에서는 주로{' '}
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
                    <h3>💭 이번 주 돌아보기</h3>
                    <p className="reflection-intro">
                        이번 주를 돌아보며 적어보세요. {!reflectionSaved && '(+8🌸)'}
                    </p>

                    <div className="reflection-group">
                        <label>🤔 이번 주 가장 궁금했던 것은?</label>
                        <textarea
                            value={mostCurious}
                            onChange={e => setMostCurious(e.target.value)}
                            placeholder="이번 주에 가장 궁금했던 것을 적어보세요"
                            rows={3}
                            maxLength={300}
                            className="reflection-textarea"
                            disabled={!isEditable}
                        />
                    </div>

                    <div className="reflection-group">
                        <label>
                            🔍 궁금한 것을 더 찾아본 적이 있나요?{' '}
                            <span style={{fontSize:'14px', color:'#888'}}>이번 주에 활동한 것들 중에서 선택해 보세요.</span>
                        </label>

                        {/* 저장 완료 상태: 선택된 항목만 표시 */}
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
                            /* 편집 상태: 체크박스 목록 */
                            (() => {
                                const allItems = getAllItems();
                                if (allItems.length === 0) return (
                                    <div style={{color:'#aaa', fontSize:'13px', padding:'8px 0'}}>이번 주 활동한 내용이 없어요</div>
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
                                                        {/* ✅ 출처 표시: 바탕색 없이 흐린 검은 글씨 */}
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
                        <label>
                            👥 친구 질문 중 기억에 남는 게 있었어요?{' '}
                            <span style={{fontSize:'11px', background:'#e5e7eb', color:'#666', padding:'2px 7px', borderRadius:'10px', marginLeft:'4px'}}>선택</span>
                            <br/>
                            <span style={{fontSize:'12px', color:'#aaa', fontWeight:400}}>굉장한 질문? 이상한 질문? 말도 안 되는 질문도 좋아요</span>
                        </label>
                        <textarea
                            value={funFriendQuestion}
                            onChange={e => setFunFriendQuestion(e.target.value)}
                            placeholder="친구가 만든 질문 중 기억에 남는 걸 적어보세요"
                            rows={2}
                            maxLength={300}
                            className="reflection-textarea"
                            disabled={!isEditable}
                        />
                    </div>

                    <div className="reflection-group">
                        <label>💫 이번 주 한마디 <span style={{fontSize:'11px', background:'#e5e7eb', color:'#666', padding:'2px 7px', borderRadius:'10px', marginLeft:'4px'}}>선택</span></label>
                        <textarea
                            value={weeklyFeeling}
                            onChange={e => setWeeklyFeeling(e.target.value)}
                            placeholder="이번 주 물음송이 활동은 어땠나요?"
                            rows={2}
                            maxLength={300}
                            className="reflection-textarea"
                            disabled={!isEditable}
                        />
                    </div>

                    {/* 버튼 영역 */}
                    {!reflectionSaved && (
                        <button
                            className="save-reflection-btn"
                            onClick={handleSaveReflection}
                            disabled={saving || !mostCurious.trim()}
                        >
                            {saving ? '저장 중...' : '돌아보기 완료 (+8🌸)'}
                        </button>
                    )}
                    {/* ✅ 수정하기 버튼 - 녹색 상자 위로 이동 */}
                    {reflectionSaved && !editMode && (
                        <button
                            className="save-reflection-btn"
                            style={{background:'#87CEEB', marginBottom:'12px'}}
                            onClick={() => setEditMode(true)}
                        >
                            ✏️ 수정하기
                        </button>
                    )}

                    {/* 저장 완료 상태 */}
                    {reflectionSaved && !editMode && (
                        <div style={{marginBottom:'12px', background:'#f0fdf4', borderRadius:'12px', padding:'14px 16px', color:'#166534', fontWeight:700, fontSize:14, textAlign:'center'}}>
                            ✅ 이번주 완료! 다음주에 만나요.
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
                    <h3>📝 이번 주의 활동</h3>

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
                            )) : <div className="toggle-empty">이번 주 만든 질문이 없어요</div>}
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
                            )) : <div className="toggle-empty">이번 주 관련질문이 없어요</div>}
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
                            )) : <div className="toggle-empty">이번 주 남긴 의견이 없어요</div>}
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
                            )) : <div className="toggle-empty">이번 주 관심 표시가 없어요</div>}
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

function getChangeText(current, previous) {
    if (previous === undefined || previous === null) return '';
    const diff = (current || 0) - (previous || 0);
    if (diff > 0) return `↑${diff}`;
    if (diff < 0) return `↓${Math.abs(diff)}`;
    return '→';
}

function getGrowthMessages(report) {
    if (!report) return ['아직 데이터가 없어요. 활동을 시작해보세요! 🌱'];
    const messages = [];
    const { stats, comparison } = report;
    if (stats.questionsCreated > 0) {
        if (stats.questionsCreated > comparison.prevQuestions) {
            messages.push(`질문을 지난 주보다 ${stats.questionsCreated - comparison.prevQuestions}개 더 만들었어요! 👏`);
        } else {
            messages.push(`이번 주 ${stats.questionsCreated}개의 질문을 만들었어요! ✏️`);
        }
    }
    if (stats.opinionsGiven > comparison.prevOpinions) {
        messages.push('의견 남기기를 더 열심히 했어요! 💬');
    }
    if (stats.relatedQuestions > 0) {
        messages.push(`관련질문 ${stats.relatedQuestions}개로 탐구를 넓혔어요! ❓`);
    }
    if (stats.questionsCreated === 0 && stats.opinionsGiven === 0) {
        messages.push('이번 주는 좀 쉬었나봐요. 다음 주에 질문해볼까요? 🌱');
    }
    return messages.length > 0 ? messages : ['꾸준히 활동하고 있어요! 좋아요! 🎉'];
}

export default WeeklyReport;
