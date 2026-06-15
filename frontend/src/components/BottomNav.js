import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const menus = [
    {
        path: '/olympic',
        label: '질문올림픽',
        icon: (active) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#3b82f6' : '#aaa'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="5"/>
                <path d="M7 13l-2 6h14l-2-6"/>
                <path d="M9 13v3m6-3v3"/>
            </svg>
        )
    },
    {
        path: '/quiz',
        label: '퀴즈',
        icon: (active) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#3b82f6' : '#aaa'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <rect x="4" y="3" width="16" height="18" rx="2"/>
                <path d="M8 7h8M8 11h8M8 15h5"/>
            </svg>
        )
    },
    {
        path: '/create',
        label: '질문쓰기',
        isCenter: true,
    },
    {
        path: '/questions',
        label: '질문들',
        icon: (active) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#3b82f6' : '#aaa'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7a2 2 0 0 1 4 0c0 1.5-2 1.5-2 3.5"/>
                <circle cx="6" cy="13" r="0.6" fill={active ? '#3b82f6' : '#aaa'} stroke="none"/>
                <path d="M10 7a2 2 0 0 1 4 0c0 1.5-2 1.5-2 3.5"/>
                <circle cx="12" cy="13" r="0.6" fill={active ? '#3b82f6' : '#aaa'} stroke="none"/>
                <path d="M16 7a2 2 0 0 1 4 0c0 1.5-2 1.5-2 3.5"/>
                <circle cx="18" cy="13" r="0.6" fill={active ? '#3b82f6' : '#aaa'} stroke="none"/>
            </svg>
        )
    },
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
];

function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();

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
            padding: '3px 0 5px',
            boxShadow: '0 -2px 12px rgba(0,0,0,0.1)',
            zIndex: 100,
            borderTop: '1px solid #e5e7eb',
        }}>
            {menus.map((menu) => {
                const isActive = location.pathname === menu.path;

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

export default BottomNav;
