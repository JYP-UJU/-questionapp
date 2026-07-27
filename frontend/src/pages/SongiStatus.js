import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import BottomNav from '../components/BottomNav';
import './SongiStatus.css';

function SongiStatus() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [submitted, setSubmitted] = useState(false);
    const [showInfoBanner, setShowInfoBanner] = useState(
        localStorage.getItem('songi_info_dismissed') !== 'true'
    );

    const dismissInfoBanner = () => {
        localStorage.setItem('songi_info_dismissed', 'true');
        setShowInfoBanner(false);
    };

    useEffect(() => {
        loadUserInfo();
    }, []);

    const loadUserInfo = async () => {
        try {
            const response = await api.get('/users/me');
            setUser(response.data.user || response.data);
        } catch (err) {
            console.error('사용자 정보 로드 오류:', err);
        } finally {
            setLoading(false);
        }
    };

    const totalSongi = user?.songi_count || 0;
    const couponsReceived = Math.floor(totalSongi / 100);
    const remainder = totalSongi >= 0
        ? totalSongi % 100
        : (100 + (totalSongi % 100)) % 100;
    const fillPercent = totalSongi < 0 ? 0 : Math.min(remainder, 100);
    const isEligible = remainder >= 90 && totalSongi >= 0;

    const getBatteryColor = (pct) => {
        if (pct >= 90) return '#3bb36e';
        if (pct >= 60) return '#6bbf6b';
        if (pct >= 30) return '#9fcf9f';
        return '#c5e8c5';
    };

    const handleSubmit = () => {
        if (!name.trim() || !phone.trim()) {
            alert('이름과 휴대폰 번호를 모두 입력해주세요.');
            return;
        }
        setSubmitted(true);
    };

    if (loading) {
        return <div className="songi-loading">로딩 중...</div>;
    }

    return (
        <div className="songi-container">
            <header className="songi-header">
                <button className="back-btn" onClick={() => navigate('/settings')}>&#8592;</button>
                <h1>&#127800; 내 송이</h1>
                <div style={{ width: 32 }} />
            </header>

            <div className="songi-user-bar">
                <span className="user-info-text">
                    &#128100; {user?.username || '사용자'} &nbsp;|&nbsp; &#127800; 누적 {totalSongi}송이
                </span>
            </div>

            <div className="songi-content">

                {showInfoBanner && (
                    <div style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                        background: '#eef6ff',
                        border: '1px solid #bfdcff',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        margin: '0 0 14px',
                        fontSize: '13px',
                        color: '#1e4d8f',
                        lineHeight: '1.5',
                    }}>
                        <span style={{ fontSize: '18px', flexShrink: 0 }}>💡</span>
                        <div style={{ flex: 1 }}>
                            <strong>송이가 뭐예요?</strong>
                            <p style={{ margin: '4px 0 0' }}>
                                질문하고, 반응하고, 일지를 쓸 때마다 <strong>송이</strong>가 쌓여요.
                                <strong> 100송이를 모으면 1,000원 상품권</strong>으로 바꿀 수 있어요!
                            </p>
                        </div>
                        <button
                            onClick={dismissInfoBanner}
                            style={{
                                background: 'none',
                                border: 'none',
                                color: '#1e4d8f',
                                fontSize: '16px',
                                cursor: 'pointer',
                                padding: '0 2px',
                                flexShrink: 0,
                            }}
                            aria-label="닫기"
                        >
                            ✕
                        </button>
                    </div>
                )}

                <div className="battery-section">
                    <div className="battery-top-row">
                        <span className="battery-main-label">내 송이</span>
                        <span className="battery-progress">
                            {totalSongi < 0
                                ? '0 / 100 (' + totalSongi + '송이)'
                                : remainder + ' / 100'}
                        </span>
                    </div>

                    <div className="battery-wrap">
                        <div className="battery-body">
                            <div
                                className="battery-fill"
                                style={{
                                    width: fillPercent + '%',
                                    background: getBatteryColor(fillPercent)
                                }}
                            />
                        </div>
                        <div className="battery-cap" />
                    </div>

                    {totalSongi < 0 && (
                        <p className="minus-note">
                            {totalSongi}송이 &mdash; 앞으로 {Math.abs(totalSongi)}송이를 먼저 채워야 해요.
                        </p>
                    )}

                    {couponsReceived > 0 && totalSongi >= 0 && (
                        <p className="carry-note">
                            지금까지 상품권 {couponsReceived}장 달성 &mdash; {remainder}송이 이월 중
                        </p>
                    )}

                    <p className="battery-guide">
                        하루 최대 <strong>20~25송이</strong> &middot; 주간 일지와 관련질문은 <strong>필수</strong>
                    </p>
                    <p className="battery-guide-detail">
                        관심 표시 3 &middot; 의견 작성 3 &middot; 관련질문 5 &middot; 질문고르기 3 &middot; 퀴즈 5 &middot; 주간 일지 8 &middot; 월간 일지 10
                    </p>
                </div>

                {isEligible && (
                    <div className="claim-section">
                        <div className="reward-banner">
                            <span className="reward-icon">&#127873;</span>
                            <span className="reward-text">검토 후에 1,000원 상품권을 전달해 드려요.</span>
                        </div>

                        {submitted ? (
                            <div className="submitted-msg">
                                <p>&#10003; 전달 정보가 확인되었어요. 선생님이 곧 연락드릴게요!</p>
                            </div>
                        ) : (
                            <div className="claim-box">
                                <p className="claim-title">상품권 전달 정보</p>
                                <div className="field-wrap">
                                    <label className="field-label">이름</label>
                                    <input
                                        type="text"
                                        className="field-input"
                                        placeholder="이름을 적어주세요"
                                        value={name}
                                        onChange={e => setName(e.target.value)}
                                    />
                                </div>
                                <div className="field-wrap">
                                    <label className="field-label">휴대폰 번호</label>
                                    <input
                                        type="tel"
                                        className="field-input"
                                        placeholder="010-0000-0000"
                                        value={phone}
                                        onChange={e => setPhone(e.target.value)}
                                    />
                                </div>
                                <p className="privacy-note">
                                    이름과 휴대폰 번호는 상품권 전달 외 목적으로 사용하지 않아요.
                                </p>
                                <button className="confirm-btn" onClick={handleSubmit}>확인</button>
                            </div>
                        )}
                    </div>
                )}

            </div>

            <BottomNav />
        </div>
    );
}

export default SongiStatus;
