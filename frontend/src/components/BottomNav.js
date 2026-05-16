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
        label: '질문대기실',
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
        label: '친구질문',
        icon: (active) => (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={active ? '#3b82f6' : '#aaa'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="7" r="3"/>
                <circle cx="15" cy="7" r="3"/>
                <path d="M3 19c0-3 2.7-5 6-5m6 0c3.3 0 6 2 6 5"/>
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
            padding: '5px 0 8px',
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
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
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
