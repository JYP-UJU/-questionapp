import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './SettingBottomNav.css';

function SettingBottomNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;

    // 주간/월간 토글: 지금 주간이면 "월간일지", 나머지는 "주간일지"
    const isWeekly = currentPath === '/weekly-report';
    const journalLabel = isWeekly ? '월간일지' : '주간일지';
    const journalPath = isWeekly ? '/monthly-report' : '/weekly-report';
    const journalIcon = isWeekly ? '📈' : '📊';

    const navItems = [
        { path: '/questions', icon: '🏠', label: '메인' },      // /friends → /questions
        { path: journalPath, icon: journalIcon, label: journalLabel },
        { path: '/saved', icon: '📝', label: '내활동' },
        { path: '/setting', icon: '⚙️', label: '나의공간' },    // 송이내역 → 나의공간
    ];

    return (
        <nav className="setting-bottom-nav">
            {navItems.slice(0, 2).map((item) => (
                <button
                    key={item.label}
                    className={`setting-nav-btn ${currentPath === item.path ? 'active' : ''}`}
                    onClick={() => navigate(item.path)}
                >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                </button>
            ))}

            {/* 가운데 질문쓰기 버튼 */}
            <button
                className="setting-nav-center-btn"
                onClick={() => navigate('/create')}
            >
                <span className="center-plus">✏️</span>
                <span>질문쓰기</span>
            </button>

            {navItems.slice(2).map((item) => (
                <button
                    key={item.label}
                    className={`setting-nav-btn ${currentPath === item.path ? 'active' : ''}`}
                    onClick={() => navigate(item.path)}
                >
                    <span>{item.icon}</span>
                    <span>{item.label}</span>
                </button>
            ))}
        </nav>
    );
}

export default SettingBottomNav;
