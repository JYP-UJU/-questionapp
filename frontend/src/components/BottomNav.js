import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const menus = [
    { path: '/create', emoji: '✏️', label: '질문하기' },
    { path: '/icebreaking', emoji: '🤔', label: '질문고르기' },
    { path: '/quiz', emoji: '🎯', label: '퀴즈' },
    { path: '/questions', emoji: '👥', label: '친구질문' },
    { path: '/saved', emoji: '📚', label: '내활동' },
    { path: '/setting', emoji: '👤', label: 'MY' },
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
            alignItems: 'center',
            padding: '5px 0 8px',
            boxShadow: '0 -2px 12px rgba(0,0,0,0.1)',
            zIndex: 100,
            borderTop: '1px solid #e5e7eb',
        }}>
            {menus.map((menu) => {
                const isActive = location.pathname === menu.path;
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
