import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import SettingBottomNav from '../components/SettingBottomNav';
import './Profile.css';

function Profile() {
    const navigate = useNavigate();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showUsernameModal, setShowUsernameModal] = useState(false);
    const [newUsername, setNewUsername] = useState('');

    useEffect(() => {
        loadProfile();
    }, []);

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
                        <div className="profile-songi">🌸 총 {user?.songi_count || 0}송이 획득</div>
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
