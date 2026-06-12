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

    const svgHome = (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#3b82f6' : '#aaa'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/>
            <path d="M9 21V12h6v9"/>
        </svg>
    );
    const svgJournal = (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#3b82f6' : '#aaa'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <path d="M8 7h8M8 11h8M8 15h5"/>
        </svg>
    );
    const svgActivity = (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#3b82f6' : '#aaa'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="3" width="16" height="18" rx="2"/>
            <path d="M8 7h8M8 11h8M8 15h5"/>
        </svg>
    );
    const svgUser = (active) => (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={active ? '#3b82f6' : '#aaa'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="3.5"/>
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
        </svg>
    );

    const navItems = [
        { path: '/questions', icon: svgHome, label: '메인' },
        { path: journalPath, icon: svgJournal, label: journalLabel },
        { path: '/saved', icon: svgActivity, label: '내활동' },
        { path: '/setting', icon: svgUser, label: '나의공간' },
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
                        {item.icon(isActive)}
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
                        <path d="M12 20h9"/>
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
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
                        {item.icon(isActive)}
                        <span style={{fontSize:'11px', fontWeight: isActive ? '700' : '400', color: isActive ? '#3b82f6' : '#aaa'}}>{item.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}

export default SettingBottomNav;
