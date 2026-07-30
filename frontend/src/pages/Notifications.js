import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsAPI } from '../services/api';
import BottomNav from '../components/BottomNav';

const typeIcon = (type) => {
    switch (type) {
        case 'reaction': return '💛';
        case 'opinion': return '💬';
        case 'followup': return '❓';
        default: return '🔔';
    }
};

const timeAgo = (dateStr) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
};

function Notifications() {
    const navigate = useNavigate();
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadNotifications();
    }, []);

    const loadNotifications = async () => {
        try {
            const res = await notificationsAPI.getAll();
            setNotifications(res.data.notifications || []);
        } catch (err) {
            console.error('알림 조회 오류:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleClickItem = async (item) => {
        if (!item.is_read) {
            try {
                await notificationsAPI.markRead(item.id);
                setNotifications((prev) =>
                    prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
                );
            } catch (err) {
                console.error('읽음 처리 오류:', err);
            }
        }

        if (item.related_question_id) {
            navigate(`/questions?highlight=${item.related_question_id}`);
        }
    };

    const handleMarkAllRead = async () => {
        try {
            await notificationsAPI.markAllRead();
            setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        } catch (err) {
            console.error('전체 읽음 처리 오류:', err);
        }
    };

    const hasUnread = notifications.some((n) => !n.is_read);

    return (
        <div style={{ minHeight: '100vh', background: '#fafafa', paddingBottom: '80px' }}>
            <header style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '14px 16px',
                background: 'white',
                borderBottom: '1px solid #eee',
                position: 'sticky',
                top: 0,
                zIndex: 10,
            }}>
                <button
                    onClick={() => navigate(-1)}
                    style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer' }}
                >
                    &#8592;
                </button>
                <h1 style={{ fontSize: '17px', margin: 0 }}>🔔 알림</h1>
                <button
                    onClick={handleMarkAllRead}
                    disabled={!hasUnread}
                    style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '13px',
                        color: hasUnread ? '#3b82f6' : '#ccc',
                        cursor: hasUnread ? 'pointer' : 'default',
                    }}
                >
                    모두 읽음
                </button>
            </header>

            <div style={{ padding: '8px 12px' }}>
                {loading && (
                    <p style={{ textAlign: 'center', color: '#999', marginTop: '40px' }}>불러오는 중...</p>
                )}

                {!loading && notifications.length === 0 && (
                    <p style={{ textAlign: 'center', color: '#999', marginTop: '60px' }}>
                        아직 도착한 알림이 없어요 🌱
                    </p>
                )}

                {notifications.map((item) => (
                    <div
                        key={item.id}
                        onClick={() => handleClickItem(item)}
                        style={{
                            display: 'flex',
                            gap: '10px',
                            alignItems: 'flex-start',
                            background: item.is_read ? 'white' : '#eef6ff',
                            border: '1px solid #eee',
                            borderRadius: '12px',
                            padding: '12px 14px',
                            marginBottom: '8px',
                            cursor: 'pointer',
                        }}
                    >
                        <span style={{ fontSize: '20px', flexShrink: 0 }}>{typeIcon(item.type)}</span>
                        <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: '14px', color: '#333', lineHeight: '1.4' }}>
                                {item.message}
                            </p>
                            <span style={{ fontSize: '12px', color: '#999' }}>
                                {timeAgo(item.created_at)}
                            </span>
                        </div>
                        {!item.is_read && (
                            <span style={{
                                width: '8px', height: '8px', borderRadius: '50%',
                                background: '#3b82f6', marginTop: '4px', flexShrink: 0,
                            }} />
                        )}
                    </div>
                ))}
            </div>

            <BottomNav />
        </div>
    );
}

export default Notifications;
