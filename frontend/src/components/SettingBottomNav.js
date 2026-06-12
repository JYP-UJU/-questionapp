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
        { path: '/questions', emoji: '💬', label: '메인' },
        { path: journalPath, emoji: journalIcon, label: journalLabel },
        { path: '/saved', emoji: '📝', label: '내활동' },
        { path: '/setting', emoji: '🪐', label: '나의공간' },
    ];

    return (
        <nav className="setting-bottom-nav">
            {navItems.slice(0, 2).map((item) => {
                const isActive = currentPath === item.path;
                return (
                    <button
                        key={item.label}
                        className={`setting-nav-btn ${isActive ? 'active' : ''}`}
                        onClick={() => navigate(item.path)}
                    >
                        <span style={{fontSize:'22px'}}>{item.emoji}</span>
                        <span style={{fontSize:'11px', fontWeight: isActive ? '700' : '400', color: isActive ? '#3b82f6' : '#aaa'}}>{item.label}</span>
                    </button>
                );
            })}

            {/* 가운데 질문쓰기 버튼 */}
            <button
                className="setting-nav-center-btn"
                onClick={() => navigate('/create')}
                style={{background:'none', border:'none', cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', gap:'2px', position:'relative', top:'-14px'}}
            >
                <div style={{width:'52px', height:'52px', borderRadius:'50%', background:'linear-gradient(135deg, #6ee7b7, #3b82f6)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 14px rgba(59,130,246,0.4)'}}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                    </svg>
                </div>
                <span style={{fontSize:'11px', fontWeight:'500', color:'#3b82f6'}}>질문쓰기</span>
            </button>

            {navItems.slice(2).map((item) => {
                const isActive = currentPath === item.path;
                return (
                    <button
                        key={item.label}
                        className={`setting-nav-btn ${isActive ? 'active' : ''}`}
                        onClick={() => navigate(item.path)}
                    >
                        <span style={{fontSize:'22px'}}>{item.emoji}</span>
                        <span style={{fontSize:'11px', fontWeight: isActive ? '700' : '400', color: isActive ? '#3b82f6' : '#aaa'}}>{item.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}

export default SettingBottomNav;
