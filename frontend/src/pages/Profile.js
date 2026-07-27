import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import SettingBottomNav from '../components/SettingBottomNav';
import './Profile.css';

function Profile() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [exchangeStatus, setExchangeStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showUsernameModal, setShowUsernameModal] = useState(false);
    const [newUsername, setNewUsername] = useState('');
    const [claimName, setClaimName] = useState('');
    const [claimPhone, setClaimPhone] = useState('');
    const [claimSubmitted, setClaimSubmitted] = useState(false);
    const [claimSubmitting, setClaimSubmitting] = useState(false);

    useEffect(() => {
        loadProfile();
        loadExchangeStatus();
    }, []);

    const loadExchangeStatus = async () => {
        try {
            const res = await api.get('/reports/exchange-status');
            setExchangeStatus(res.data);
        } catch (err) {
            console.error('교환 자격 로드 오류:', err);
        }
    };

    const loadProfile = async () => {
        try {
            const res = await api.get('/users/me/profile-stats');
            setData(res.data);
        } catch (err) {
            console.error('프로필 로드 오류:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleUsernameUpdate = async () => {
        if (!newUsername.trim()) {
            alert('닉네임을 입력해주세요');
            return;
        }
        try {
            await api.put('/users/me', { username: newUsername });
            alert('닉네임이 변경되었어요! 🎉');
            setShowUsernameModal(false);
            setNewUsername('');
            loadProfile();
        } catch (err) {
            alert(err.response?.data?.error || '닉네임 변경에 실패했어요');
        }
    };

    const handleClaimSubmit = async () => {
        if (!claimName.trim() || !claimPhone.trim()) {
            alert('이름과 휴대폰 번호를 모두 입력해주세요');
            return;
        }
        setClaimSubmitting(true);
        try {
            await api.post('/reports/claim-reward', { name: claimName, phone: claimPhone });
            setClaimSubmitted(true);
        } catch (err) {
            alert(err.response?.data?.error || '신청에 실패했어요');
        } finally {
            setClaimSubmitting(false);
        }
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        const d = new Date(dateStr);
        return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;
    };

    if (loading) {
        return <div className="profile-loading">로딩 중...</div>;
    }

    const { user, stats, rewards } = data || {};
    const AVATARS = ['🐱','🐶','🐰','🐻','🐼','🐨','🦊','🐸','🐧','🦋','🐙','🦄','🐬','🦁','🐯'];
    const avatarEmoji = AVATARS[(user?.id || 0) % AVATARS.length];

    return (
        <div className="profile-container">
            {/* 헤더 */}
            <header className="profile-header">
                <button className="back-btn" onClick={() => navigate(-1)}>←</button>
                <h1>내 프로필</h1>
                <div />
            </header>

            <div className="profile-content">

                {/* 유저 정보 카드 */}
                <div className="profile-card user-card">
                    <div className="profile-avatar">{avatarEmoji}</div>
                    <div className="profile-user-info">
                        <div className="profile-username">{user?.username}</div>
                        <div className="profile-joined">가입일 {formatDate(user?.created_at)}</div>
                        <div className="profile-songi">🌸 총 {parseFloat(user?.songi_count || 0).toFixed(1)}송이 획득</div>
                    </div>
                    <button className="edit-username-btn" onClick={() => {
                        setNewUsername(user?.username || '');
                        setShowUsernameModal(true);
                    }}>닉네임 변경</button>
                </div>

                {/* 활동 통계 */}
                <div className="profile-section">
                    <h2 className="section-title">📊 나의 활동</h2>
                    <div className="stats-grid">
                        <div className="stat-item">
                            <div className="stat-value">
                                {(stats?.myQuestions || 0) + (stats?.relatedQuestions || 0)}
                            </div>
                            <div className="stat-label">총 질문</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">{stats?.myQuestions || 0}</div>
                            <div className="stat-label">만든 질문</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">{stats?.relatedQuestions || 0}</div>
                            <div className="stat-label">관련질문</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">{stats?.quizCount || 0}</div>
                            <div className="stat-label">퀴즈 완료</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">{stats?.reactions || 0}</div>
                            <div className="stat-label">관심표시</div>
                        </div>
                        <div className="stat-item">
                            <div className="stat-value">{stats?.opinions || 0}</div>
                            <div className="stat-label">남긴 의견</div>
                        </div>
                    </div>
                </div>

                {/* 송이 진행도 건전지 바 — 실제 교환 자격(누적 200송이 + 최근2주 주간일지) 기준 */}
                <div className="profile-section">
                    <h2 className="section-title">🌸 상품권 교환 진행도</h2>
                    {!exchangeStatus ? (
                        <div style={{textAlign:'center', color:'#aaa', fontSize:'13px', padding:'12px 0'}}>불러오는 중...</div>
                    ) : (() => {
                        const { lifetimeSongi, threshold, eligible, hasJournalInWindow, songiNeeded } = exchangeStatus;
                        const pct = Math.min((lifetimeSongi / threshold) * 100, 100);

                        // 하단 안내 멘트: 막히는 이유만 짚어줌 (누적 송이는 위에서 이미 보여주므로 중복 설명 안 함)
                        let message;
                        if (eligible) {
                            message = '🎉 교환 조건을 채웠어요! 선생님께 상품권 교환을 요청하세요!';
                        } else {
                            const parts = [];
                            if (songiNeeded > 0) parts.push(`아직 ${songiNeeded.toFixed(1)}송이가 더 필요해요`);
                            if (!hasJournalInWindow) parts.push('최근 2주 안에 주간일지를 작성하지 않으셨어요');
                            message = parts.join('. 그리고 ') + '.';
                        }

                        return (
                            <div>
                                {/* 주간일지 작성 여부 체크 */}
                                <div style={{
                                    display:'flex', alignItems:'center', gap:'8px',
                                    marginBottom:'10px', padding:'8px 10px',
                                    background: hasJournalInWindow ? '#f0fdf4' : '#f9fafb',
                                    borderRadius:'8px'
                                }}>
                                    <span style={{
                                        fontSize:'18px',
                                        color: hasJournalInWindow ? '#16a34a' : '#c1c7d0'
                                    }}>
                                        {hasJournalInWindow ? '✅' : '⭕'}
                                    </span>
                                    <span style={{fontSize:'13px', fontWeight:600, color: hasJournalInWindow ? '#16a34a' : '#999'}}>
                                        최근 2주 안 주간일지 {hasJournalInWindow ? '작성 완료' : '아직 안 씀'}
                                    </span>
                                </div>

                                <div style={{display:'flex', justifyContent:'space-between', marginBottom:'8px', fontSize:'14px', color:'#555'}}>
                                    <span>누적 <strong style={{color:'#3b82f6'}}>{lifetimeSongi.toFixed(1)}송이</strong> (교환 기준 {threshold}송이)</span>
                                </div>
                                <div style={{display:'flex', alignItems:'center', gap:'4px'}}>
                                    <div style={{
                                        flex:1, height:'28px',
                                        background:'#e5e7eb', borderRadius:'6px',
                                        overflow:'hidden', position:'relative'
                                    }}>
                                        <div style={{
                                            width:`${pct}%`, height:'100%',
                                            background: eligible
                                                ? 'linear-gradient(90deg, #22c55e, #16a34a)'
                                                : pct >= 60
                                                ? 'linear-gradient(90deg, #60a5fa, #3b82f6)'
                                                : pct >= 30
                                                ? 'linear-gradient(90deg, #fbbf24, #f59e0b)'
                                                : 'linear-gradient(90deg, #f87171, #ef4444)',
                                            borderRadius:'6px',
                                            transition:'width 0.5s ease'
                                        }}/>
                                        <span style={{
                                            position:'absolute', top:'50%', left:'50%',
                                            transform:'translate(-50%,-50%)',
                                            fontSize:'12px', fontWeight:'700', color:'#333'
                                        }}>{Math.round(pct)}%</span>
                                    </div>
                                    <div style={{
                                        width:'10px', height:'16px',
                                        background:'#9ca3af', borderRadius:'0 3px 3px 0',
                                        flexShrink:0
                                    }}/>
                                </div>
                                <div style={{marginTop:'8px', fontSize:'13px', color:'#888', textAlign:'center'}}>
                                    {message}
                                </div>
                                <div style={{marginTop:'6px', fontSize:'12px', color:'#aaa', textAlign:'center'}}>
                                    ⚠️ 누적 {threshold}송이 이상 + 최근 2주 안 주간일지 작성 시 교환 가능해요
                                </div>
                            </div>
                        );
                    })()}
                </div>

                {/* 상품권 수령 내역 */}
                <div className="profile-section">
                    <h2 className="section-title">🎫 상품권 내역</h2>
                    {rewards && rewards.length > 0 ? (
                        <div className="rewards-list">
                            {rewards.map((r, i) => (
                                <div key={i} className="reward-item">
                                    <div className="reward-desc">{r.description || '상품권 수령'}</div>
                                    <div className="reward-date">{formatDate(r.created_at)}</div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="rewards-empty">
                            <p>아직 상품권 수령 내역이 없어요</p>
                            <p className="rewards-hint">100송이를 모으면 1,000원 상품권을 받을 수 있어요 🌸</p>
                        </div>
                    )}

                    {/* 교환 자격을 채웠을 때만 신청 폼 표시 */}
                    {exchangeStatus?.eligible && (
                        claimSubmitted ? (
                            <div style={{
                                marginTop: '14px', padding: '14px', borderRadius: '10px',
                                background: '#f0fdf4', textAlign: 'center',
                            }}>
                                <p style={{ margin: 0, color: '#16a34a', fontWeight: 600 }}>
                                    ✓ 신청이 접수됐어요! 선생님이 곧 연락드릴게요
                                </p>
                            </div>
                        ) : (
                            <div style={{
                                marginTop: '14px', padding: '14px', borderRadius: '10px',
                                background: '#fefce8', border: '1px solid #fde68a',
                            }}>
                                <p style={{ margin: '0 0 10px', fontWeight: 700, fontSize: '14px' }}>
                                    🎁 상품권 전달 정보를 입력해주세요
                                </p>
                                <div style={{ marginBottom: '8px' }}>
                                    <label style={{ fontSize: '12px', color: '#888' }}>이름</label>
                                    <input
                                        type="text"
                                        placeholder="이름을 적어주세요"
                                        value={claimName}
                                        onChange={e => setClaimName(e.target.value)}
                                        style={{
                                            width: '100%', boxSizing: 'border-box', padding: '8px 10px',
                                            borderRadius: '8px', border: '1px solid #e5e7eb', marginTop: '2px',
                                        }}
                                    />
                                </div>
                                <div style={{ marginBottom: '10px' }}>
                                    <label style={{ fontSize: '12px', color: '#888' }}>휴대폰 번호</label>
                                    <input
                                        type="tel"
                                        placeholder="010-0000-0000"
                                        value={claimPhone}
                                        onChange={e => setClaimPhone(e.target.value)}
                                        style={{
                                            width: '100%', boxSizing: 'border-box', padding: '8px 10px',
                                            borderRadius: '8px', border: '1px solid #e5e7eb', marginTop: '2px',
                                        }}
                                    />
                                </div>
                                <p style={{ fontSize: '11px', color: '#aaa', margin: '0 0 10px' }}>
                                    이름과 휴대폰 번호는 상품권 전달 외 목적으로 사용하지 않아요.
                                </p>
                                <button
                                    onClick={handleClaimSubmit}
                                    disabled={claimSubmitting}
                                    style={{
                                        width: '100%', padding: '10px', borderRadius: '8px', border: 'none',
                                        background: '#f59e0b', color: 'white', fontWeight: 700, cursor: 'pointer',
                                    }}
                                >
                                    {claimSubmitting ? '제출 중...' : '신청하기'}
                                </button>
                            </div>
                        )
                    )}
                </div>

            </div>

            {/* 닉네임 변경 모달 */}
            {showUsernameModal && (
                <div className="modal-overlay" onClick={() => setShowUsernameModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>👤 닉네임 변경</h3>
                        <input
                            type="text"
                            placeholder="새 닉네임 (3자 이상)"
                            value={newUsername}
                            onChange={e => setNewUsername(e.target.value)}
                            maxLength={20}
                            className="modal-input"
                        />
                        <div className="modal-buttons">
                            <button className="modal-cancel" onClick={() => setShowUsernameModal(false)}>취소</button>
                            <button className="modal-confirm" onClick={handleUsernameUpdate}>변경하기</button>
                        </div>
                    </div>
                </div>
            )}

            <SettingBottomNav />
        </div>
    );
}

export default Profile;
