import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api'; 
import './Setting.css';
import SettingBottomNav from '../components/SettingBottomNav';
import NotificationBell from '../components/NotificationBell';


function Setting() {
    const navigate = useNavigate();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const [showPasswordModal, setShowPasswordModal] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [showProfileModal, setShowProfileModal] = useState(false);
    const [newUsername, setNewUsername] = useState('');

    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleteConfirmText, setDeleteConfirmText] = useState('');

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

    const handleLogout = () => {
        if (window.confirm('정말 로그아웃 하시겠어요?')) {
            localStorage.removeItem('token');
            navigate('/login');
        }
    };

    const handlePasswordChange = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            alert('모든 필드를 입력해주세요');
            return;
        }
        if (newPassword !== confirmPassword) {
            alert('새 비밀번호가 일치하지 않아요');
            return;
        }
        if (newPassword.length < 4) {
            alert('비밀번호는 4자 이상이어야 해요');
            return;
        }

        try {
            await api.put('/users/me/password', {
                currentPassword,
                newPassword
            });
            alert('비밀번호가 변경되었어요! 🎉');
            setShowPasswordModal(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (err) {
            if (err.response?.status === 401) {
                alert('현재 비밀번호가 틀려요');
            } else {
                alert('비밀번호 변경에 실패했어요');
            }
        }
    };

    const handleProfileUpdate = async () => {
        if (!newUsername.trim()) {
            alert('닉네임을 입력해주세요');
            return;
        }

        try {
            await api.put('/users/me', {
                username: newUsername
            });
            alert('닉네임이 변경되었어요! 🎉');
            setShowProfileModal(false);
            setNewUsername('');
            loadUserInfo();
        } catch (err) {
            alert('닉네임 변경에 실패했어요');
        }
    };

    const handleDeleteAccount = async () => {
        if (deleteConfirmText !== '탈퇴합니다') {
            alert('"탈퇴합니다"를 정확히 입력해주세요');
            return;
        }

        try {
            await api.delete('/users/me');
            alert('계정이 삭제되었습니다. 그동안 감사했어요 🌸');
            localStorage.removeItem('token');
            navigate('/login');
        } catch (err) {
            alert('계정 삭제에 실패했어요');
        }
    };

    if (loading) {
        return <div className="setting-loading">로딩 중...</div>;
    }

    return (
        <div className="setting-container">
            <header className="setting-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h1 style={{ margin: 0 }}>🪐 나의공간</h1>
                <NotificationBell />
            </header>

            <div className="setting-user-bar">
                <span className="user-info-text">
                    💬 {user?.username || '사용자'} | 🌸 {parseFloat(user?.songi_count || 0).toFixed(1)}송이
                </span>
            </div>

            <div className="setting-content">
                <div className="menu-grid">
                    {/* 1행: 일지 */}
                    <button className="menu-btn report-btn" onClick={() => navigate('/weekly-report')}>
                        <span className="menu-icon">📊</span>
                        <span className="menu-label">주간 일지</span>
                        <span className="menu-desc">이번 주 활동</span>
                    </button>
                    <button className="menu-btn report-btn" onClick={() => navigate('/monthly-report')}>
                        <span className="menu-icon">📈</span>
                        <span className="menu-label">월간 일지</span>
                        <span className="menu-desc">이번 달 활동</span>
                    </button>

                    {/* 2행: 내 활동 + 송이 내역 */}
                    <button className="menu-btn songi-btn" onClick={() => navigate('/saved')}>
                        <span className="menu-icon">📝</span>
                        <span className="menu-label">내 활동</span>
                        <span className="menu-desc">저장한 질문 보기</span>
                    </button>
                    <button className="menu-btn songi-btn" onClick={() => navigate('/songi-history')}>
                        <span className="menu-icon">🌸</span>
                        <span className="menu-label">송이 내역</span>
                        <span className="menu-desc">현재 {parseFloat(user?.songi_count || 0).toFixed(1)}송이</span>
                    </button>

                    {/* 3행: 계정 */}
                    <button className="menu-btn account-btn" onClick={() => navigate('/profile')}>
                        <span className="menu-icon">👤</span>
                        <span className="menu-label">내 프로필</span>
                        <span className="menu-desc">활동 통계 보기</span>
                    </button>
                    <button className="menu-btn account-btn" onClick={() => setShowPasswordModal(true)}>
                        <span className="menu-icon">🔒</span>
                        <span className="menu-label">비밀번호 변경</span>
                        <span className="menu-desc">비밀번호 수정</span>
                    </button>

                    {/* 4행: 기타 */}
                    <button className="menu-btn logout-btn" onClick={handleLogout}>
                        <span className="menu-icon">🚪</span>
                        <span className="menu-label">로그아웃</span>
                        <span className="menu-desc">다음에 또 만나요</span>
                    </button>
                    <button className="menu-btn delete-btn" onClick={() => setShowDeleteModal(true)}>
                        <span className="menu-icon">❌</span>
                        <span className="menu-label">회원탈퇴</span>
                        <span className="menu-desc">계정 삭제</span>
                    </button>

                    {/* 관리자 전용 */}
                    {user?.is_admin && (
                        <button className="menu-btn admin-btn" onClick={() => navigate('/admin')}
                            style={{gridColumn: '1 / -1'}}>
                            <span className="menu-icon">🔧</span>
                            <span className="menu-label">관리자 페이지</span>
                            <span className="menu-desc">활동 조회 및 관리</span>
                        </button>
                    )}
                </div>

                <div className="copyright">
                    <p>© 2026 물음송이 (Question Blossom)</p>
                    <p>과학적 호기심을 꽃피우는 질문 플랫폼 🌸</p>
                    <p className="made-by">made by Claude & PIO</p>
                </div>
            </div>

            {/* 비밀번호 변경 모달 */}
            {showPasswordModal && (
                <div className="modal-overlay" onClick={() => setShowPasswordModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>🔒 비밀번호 변경</h3>
                        <input
                            type="password"
                            placeholder="현재 비밀번호"
                            value={currentPassword}
                            onChange={e => setCurrentPassword(e.target.value)}
                            className="modal-input"
                        />
                        <input
                            type="password"
                            placeholder="새 비밀번호 (4자 이상)"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className="modal-input"
                        />
                        <input
                            type="password"
                            placeholder="새 비밀번호 확인"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className="modal-input"
                        />
                        <div className="modal-buttons">
                            <button className="modal-cancel" onClick={() => setShowPasswordModal(false)}>취소</button>
                            <button className="modal-confirm" onClick={handlePasswordChange}>변경하기</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 프로필 변경 모달 */}
            {showProfileModal && (
                <div className="modal-overlay" onClick={() => setShowProfileModal(false)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()}>
                        <h3>👤 닉네임 변경</h3>
                        <input
                            type="text"
                            placeholder="새 닉네임"
                            value={newUsername}
                            onChange={e => setNewUsername(e.target.value)}
                            maxLength={20}
                            className="modal-input"
                        />
                        <div className="modal-buttons">
                            <button className="modal-cancel" onClick={() => setShowProfileModal(false)}>취소</button>
                            <button className="modal-confirm" onClick={handleProfileUpdate}>변경하기</button>
                        </div>
                    </div>
                </div>
            )}

            {/* 회원탈퇴 모달 */}
            {showDeleteModal && (
                <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
                    <div className="modal-content delete-modal" onClick={e => e.stopPropagation()}>
                        <h3>❌ 정말 탈퇴하시겠어요?</h3>
                        <p className="delete-warning">
                            탈퇴하면 모든 질문, 의견, 송이가 삭제되고 복구할 수 없어요.
                        </p>
                        <p className="delete-instruction">
                            탈퇴를 원하시면 아래에 <strong>"탈퇴합니다"</strong>를 입력해주세요.
                        </p>
                        <input
                            type="text"
                            placeholder="탈퇴합니다"
                            value={deleteConfirmText}
                            onChange={e => setDeleteConfirmText(e.target.value)}
                            className="modal-input"
                        />
                        <div className="modal-buttons">
                            <button className="modal-cancel" onClick={() => {
                                setShowDeleteModal(false);
                                setDeleteConfirmText('');
                            }}>취소</button>
                            <button className="modal-delete" onClick={handleDeleteAccount}>탈퇴하기</button>
                        </div>
                    </div>
                </div>
            )}

            <SettingBottomNav />
        </div>
    );
}

export default Setting;
