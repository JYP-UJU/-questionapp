import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

function SettingBottomNav() {
    const navigate = useNavigate();
    const location = useLocation();
    const currentPath = location.pathname;

    const isWeekly = currentPath === '/weekly-report';
    const journalLabel = isWeekly ? '월간일지' : '주간일지';
    const journalPath = isWeekly ? '/monthly-report' : '/weekly-report';

    const menus = [
        {
            path: '/setting',
            label: '나의공간',
            icon: (active) => (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#3b82f6' : '#aaa'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="3.5"/>
                    <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/>
                </svg>
            )
        },
        {
            path: '/questions',
            label: '질문들',
            icon: (active) => (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#3b82f6' : '#aaa'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
            )
        },
        {
            path: '/create',
            label: '질문쓰기',
            isCenter: true,
        },
        {
            path: journalPath,
            label: journalLabel,
            icon: (active) => (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#3b82f6' : '#aaa'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
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
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#3b82f6' : '#aaa'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
            )
        },
    ];

    return (
        <nav style={{
            position: 'fixed',
            bottom: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '100%',
            maxWidth: '600px',
            background: 'white',
            display: 'flex',
            justifyContent: 'space-around',
            alignItems: 'flex-end',
            padding: '2px 0 4px',
            boxShadow: '0 -2px 12px rgba(0,0,0,0.1)',
            zIndex: 100,
            borderTop: '1px solid #e5e7eb',
        }}>
            {menus.map((menu) => {
                const isActive = currentPath === menu.path;

                if (menu.isCenter) {
                    return (
                        <button
                            key={menu.path}
                            onClick={() => navigate(menu.path)}
                            style={{
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                gap: '2px',
                                position: 'relative',
                                top: '-14px',
                            }}
                        >
                            <div style={{
                                width: '52px',
                                height: '52px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #6ee7b7, #3b82f6)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                boxShadow: '0 4px 14px rgba(59,130,246,0.4)',
                            }}>
                                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M12 20h9"/>
                                    <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                                </svg>
                            </div>
                            <span style={{
                                fontSize: '11px',
                                fontWeight: '500',
                                color: '#3b82f6',
                            }}>
                                {menu.label}
                            </span>
                        </button>
                    );
                }

                return (
                    <button
                        key={menu.path}
                        onClick={() => navigate(menu.path)}
                        style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '3px',
                            transition: 'all 0.2s',
                        }}
                    >
                        {menu.icon(isActive)}
                        <span style={{
                            fontSize: '11px',
                            fontWeight: isActive ? '700' : '400',
                            color: isActive ? '#3b82f6' : '#aaa',
                        }}>
                            {menu.label}
                        </span>
                    </button>
                );
            })}
        </nav>
    );
}

export default SettingBottomNav;
