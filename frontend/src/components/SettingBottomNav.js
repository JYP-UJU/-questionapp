import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './SettingBottomNav.css';

function SettingBottomNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;

    const isWeekly = currentPath === '/weekly-report';
    const journalLabel = isWeekly ? '월간일지' : '주간일지';
    const journalPath = isWeekly ? '/monthly-report' : '/weekly-report';

    const navItems = [
        {
            path: '/setting',
            label: '나의공간',
            icon: (active) => (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                    stroke={active ? '#3b82f6' : '#aaa'} strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="3.5"/>
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
            )
        },
        {
            path: '/questions',
            label: '질문들',
            icon: (active) => (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                    stroke={active ? '#3b82f6' : '#aaa'} strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7a2 2 0 0 1 4 0c0 1.5-2 1.5-2 3.5"/>
                    <circle cx="5" cy="13" r="0.6" fill={active ? '#3b82f6' : '#aaa'} stroke="none"/>
                    <path d="M10 7a2 2 0 0 1 4 0c0 1.5-2 1.5-2 3.5"/>
                    <circle cx="12" cy="13" r="0.6" fill={active ? '#3b82f6' : '#aaa'} stroke="none"/>
                    <path d="M17 7a2 2 0 0 1 4 0c0 1.5-2 1.5-2 3.5"/>
                    <circle cx="19" cy="13" r="0.6" fill={active ? '#3b82f6' : '#aaa'} stroke="none"/>
                </svg>
            )
        },
        {
            path: journalPath,
            label: journalLabel,
            icon: (active) => (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                    stroke={active ? '#3b82f6' : '#aaa'} strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                </svg>
            )
        },
        {
            path: '/saved',
            label: '내활동',
            icon: (active) => (
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
                    stroke={active ? '#3b82f6' : '#aaa'} strokeWidth="1.8"
                    strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
            )
        },
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
                        {item.icon(isActive)}
                        <span style={{fontSize:'11px', fontWeight: isActive ? '700' : '400', color: isActive ? '#3b82f6' : '#aaa'}}>{item.label}</span>
                    </button>
                );
            })}
        </nav>
    );
}

export default SettingBottomNav;
