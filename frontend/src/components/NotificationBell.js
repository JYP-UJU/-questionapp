import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsAPI } from '../services/api';

const POLL_INTERVAL_MS = 30 * 1000;

function NotificationBell() {
    const navigate = useNavigate();
    const [unreadCount, setUnreadCount] = useState(0);

    const loadCount = async () => {
        try {
            const res = await notificationsAPI.getUnreadCount();
            setUnreadCount(res.data.count || 0);
        } catch (err) {
            // 조용히 무시 - 알림은 부가 기능이라 실패해도 화면을 막지 않음
        }
    };

    useEffect(() => {
        loadCount();
        const timer = setInterval(loadCount, POLL_INTERVAL_MS);
        return () => clearInterval(timer);
    }, []);

    return (
        <button
            onClick={() => navigate('/notifications')}
            style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                position: 'relative',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
            }}
            aria-label="알림"
        >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            {unreadCount > 0 && (
                <span style={{
                    position: 'absolute',
                    top: '2px',
                    right: '2px',
                    background: '#ef4444',
                    color: 'white',
                    fontSize: '10px',
                    fontWeight: '700',
                    borderRadius: '9px',
                    minWidth: '16px',
                    height: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 3px',
                }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                </span>
            )}
        </button>
    );
}

export default NotificationBell;
