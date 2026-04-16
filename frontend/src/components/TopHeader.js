import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function TopHeader({ title, icon, messages = [], backTo = -1 }) {
    const navigate = useNavigate();
    const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        if (messages.length < 2) return;
        const interval = setInterval(() => {
            setVisible(false);
            setTimeout(() => {
                setCurrentMessageIndex(prev => (prev + 1) % messages.length);
                setVisible(true);
            }, 600);
        }, 4000);
        return () => clearInterval(interval);
    }, [messages.length]);

    return (
        <div style={{ background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}>
            <div style={{
                display: 'flex',
                alignItems: 'center',
                padding: '16px 16px 16px',
            }}>
                <button
                    onClick={() => typeof backTo === 'string' ? navigate(backTo) : navigate(-1)}
                    style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '14px',
                        color: '#888',
                        cursor: 'pointer',
                        padding: '4px 8px',
                        width: '60px',
                        textAlign: 'left',
                    }}
                >
                    {"← 뒤로"}
                </button>
                <h1 style={{
                    flex: 1,
                    textAlign: 'center',
                    margin: 0,
                    fontSize: '26px',
                    fontWeight: '800',
                    color: '#333',
                }}>
                    {icon} {title}
                </h1>
                <div style={{ width: '60px' }} />
            </div>

            {messages.length > 0 && (
                <div style={{
                    textAlign: 'center',
                    padding: '2px 16px 2px',
                    fontSize: '13px',
                    color: '#555',
                    minHeight: '28px',
                    transition: 'opacity 0.6s ease',
                    opacity: visible ? 1 : 0,
                }}>
                    {messages[currentMessageIndex]}
                </div>
            )}
        </div>
    );
}

export default TopHeader;
