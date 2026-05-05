import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

const menus = [
    { path: '/icebreaking', emoji: '🏅', label: '질문올림픽' },
    { path: '/quiz', emoji: '🎯', label: '질문대기실' },
    { path: '/questions', emoji: '👥', label: '친구질문' },
    { path: '/saved', emoji: '📝', label: '내 활동' },
    { path: '/setting', emoji: '⚙️', label: '나의공간' },
];

function BottomNav() {
    const navigate = useNavigate();
    const location = useLocation();

    return (
        <>
            {/* 하단 메뉴바 */}
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

            {/* 질문만들기 플로팅 버튼 */}
            <button
                onClick={() => navigate('/create')}
                style={{
                    position: 'fixed',
                    bottom: '75px',
                    right: 'calc(50% - 290px)',
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #6ee7b7, #3b82f6)',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 14px rgba(59,130,246,0.4)',
                    zIndex: 101,
                    fontSize: '26px',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                }}
                onMouseEnter={e => {
                    e.currentTarget.style.transform = 'scale(1.1)';
                    e.currentTarget.style.boxShadow = '0 6px 18px rgba(59,130,246,0.5)';
                }}
                onMouseLeave={e => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(59,130,246,0.4)';
                }}
                title="질문 만들기"
            >
                ✏️
            </button>
        </>
    );
}

export default BottomNav;
