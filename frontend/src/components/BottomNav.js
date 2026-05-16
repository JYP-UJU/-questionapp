import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const menus = [
    { path: '/olympic', emoji: '🏅', label: '질문올림픽' },
    { path: '/quiz', emoji: '🎯', label: '질문대기실' },
    { path: '/create', emoji: null, label: '질문쓰기', isCenter: true },
    { path: '/questions', emoji: '👥', label: '친구질문' },
    { path: '/setting', emoji: '⚙️', label: '나의공간' },
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
                                fontSize: '24px',
                            }}>
                                ✏️
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
                            background: isActive ? '#eff6ff' : 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '4px 8px',
                            borderRadius: '10px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            gap: '1px',
                            transition: 'all 0.2s',
                        }}
                    >
                        <span style={{ fontSize: '20px' }}>{menu.emoji}</span>
                        <span style={{
                            fontSize: '11px',
                            fontWeight: isActive ? '700' : '400',
                            color: isActive ? '#3b82f6' : '#888',
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
