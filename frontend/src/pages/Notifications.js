import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { notificationsAPI } from '../services/api';
import BottomNav from '../components/BottomNav';

const typeIcon = (type) => {
    switch (type) {
        case 'reaction': return '💛';
        case 'opinion': return '💬';
        case 'followup': return '❓';
        case 'related': return '❓';
        case 'opinion_seen': return '👀';
        case 'helpful': return '💛';
        case 'admin': return '📢';
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

    // 친구가 남긴 의견에 "도움이 됐어요"
    const handleHelpful = async (e, item) => {
        e.stopPropagation();
        try {
            await api.post(item.opinion_id
                ? `/questions/opinions/${item.opinion_id}/helpful`
                : `/questions/related/${item.related_id}/helpful`);
            setNotifications((prev) => prev.map((n) => (n.id === item.id ? { ...n, helpful: true } : n)));
        } catch (err) {
            alert(err.response?.data?.error || '눌러지지 않았어요. 잠시 뒤에 다시 해 주세요');
        }
    };

    // 물음송이 AI가 쓴 의견 삭제 (내 질문에 달린 AI 의견만)
    const handleDeleteAi = async (e, item) => {
        e.stopPropagation();
        if (!window.confirm('물음송이 AI가 쓴 의견을 지울까요?')) return;
        try {
            await api.delete(`/questions/opinions/${item.opinion_id}/ai`);
            setNotifications((prev) => prev.filter((n) => n.opinion_id !== item.opinion_id));
        } catch (err) {
            alert(err.response?.data?.error || '지우지 못했어요. 잠시 뒤에 다시 해 주세요');
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
                        <span style={{ fontSize: '24px', flexShrink: 0 }}>{typeIcon(item.type)}</span>
                        <div style={{ flex: 1 }}>
                            <p style={{ margin: 0, fontSize: '16px', color: '#333', lineHeight: '1.5' }}>
                                {item.message}
                            </p>
                            <span style={{ fontSize: '13px', color: '#999' }}>
                                {timeAgo(item.created_at)}
                            </span>

                            {item.type === 'opinion' && item.opinion_text && (
                                <p style={{ margin: '8px 0 0', padding: '8px 10px', background: 'rgba(0,0,0,0.04)', borderRadius: '8px', fontSize: '15px', color: '#444', lineHeight: 1.55 }}>
                                    {item.opinion_text}
                                </p>
                            )}
                            {item.type === 'opinion' && item.opinion_text && item.actor_is_ai && (
                                <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#999' }}>
                                    🤖 AI가 쓴 글이에요. 틀릴 수 있어요.
                                </p>
                            )}

                            {((item.type === 'opinion' && item.opinion_id) || (item.type === 'related' && item.related_id)) && (
                                <div style={{ marginTop: '8px' }}>
                                    {item.type === 'opinion' && item.actor_is_ai ? (
                                        <button
                                            type="button"
                                            onClick={(e) => handleDeleteAi(e, item)}
                                            style={{ padding: '6px 14px', fontSize: '14px', border: '1px solid #ddd', background: 'white', color: '#888', borderRadius: '999px', cursor: 'pointer' }}
                                        >
                                            🗑 AI 의견 지우기
                                        </button>
                                    ) : item.helpful ? (
                                        <span style={{ fontSize: '14px', color: '#d97706' }}>💛 도움이 됐어요</span>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={(e) => handleHelpful(e, item)}
                                            style={{ padding: '6px 14px', fontSize: '14px', border: '1px solid #f59e0b', background: '#fffbeb', color: '#b45309', borderRadius: '999px', cursor: 'pointer' }}
                                        >
                                            👍 도움이 됐어요
                                        </button>
                                    )}
                                </div>
                            )}
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
