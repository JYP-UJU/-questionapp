import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { notificationsAPI, getToken } from '../services/api';

// 접속 중일 때만 동작하는 실시간(준실시간) 알림 팝업.
// - 화면이 보이는 동안 POLL_MS마다 "새로 도착한 알림"만 확인한다.
// - 접속 직후에는 기준선(현재 최대 알림 id)만 잡고, 예전 알림은 팝업으로 띄우지 않는다.
// - 접속하지 않은 사람은 기존처럼 종 아이콘의 빨간 숫자로 확인한다.
const POLL_MS = 15 * 1000;
const SHOW_MS = 7 * 1000;

const typeIcon = (type) => {
    switch (type) {
        case 'reaction': return '💛';
        case 'opinion': return '💬';
        case 'followup': return '❓';
        case 'admin': return '📢';
        default: return '🔔';
    }
};

function NotificationToast() {
    const navigate = useNavigate();
    const location = useLocation();
    const [toasts, setToasts] = useState([]);
    const lastIdRef = useRef(null); // null = 아직 기준선 없음
    const busyRef = useRef(false);

    const dismiss = (id) => setToasts((prev) => prev.filter((t) => t.id !== id));

    useEffect(() => {
        let cancelled = false;

        const tick = async () => {
            if (cancelled || busyRef.current) return;
            if (document.visibilityState !== 'visible') return;
            if (!getToken()) {
                lastIdRef.current = null; // 로그아웃 상태면 기준선 초기화
                return;
            }
            busyRef.current = true;
            try {
                const res = await notificationsAPI.getLatest(lastIdRef.current);
                if (cancelled) return;
                const { max_id, notifications } = res.data;
                const firstTime = lastIdRef.current === null;
                lastIdRef.current = max_id;
                if (!firstTime && notifications && notifications.length > 0) {
                    setToasts((prev) => [...prev, ...notifications].slice(-3));
                    notifications.forEach((n) => {
                        setTimeout(() => dismiss(n.id), SHOW_MS);
                    });
                }
            } catch (err) {
                // 조용히 무시 - 부가 기능이라 실패해도 화면을 막지 않음
            } finally {
                busyRef.current = false;
            }
        };

        tick();
        const timer = setInterval(tick, POLL_MS);
        const onVisible = () => {
            if (document.visibilityState === 'visible') tick();
        };
        document.addEventListener('visibilitychange', onVisible);
        return () => {
            cancelled = true;
            clearInterval(timer);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, []);

    // 알림 화면에서는 팝업이 겹치지 않도록 숨김 (목록에서 바로 보이므로)
    if (location.pathname === '/login' || location.pathname === '/notifications') return null;
    if (toasts.length === 0) return null;

    const handleClick = async (t) => {
        dismiss(t.id);
        try {
            await notificationsAPI.markRead(t.id);
        } catch (err) {
            // 무시
        }
        if (t.related_question_id) {
            navigate(`/questions?highlight=${t.related_question_id}`);
        } else {
            navigate('/notifications');
        }
    };

    return (
        <div style={{
            position: 'fixed',
            top: '12px',
            left: 0,
            right: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '8px',
            zIndex: 9999,
            pointerEvents: 'none',
        }}>
            <style>{`@keyframes toastIn { from { opacity: 0; transform: translateY(-12px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            {toasts.map((t) => (
                <div
                    key={t.id}
                    onClick={() => handleClick(t)}
                    style={{
                        pointerEvents: 'auto',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '10px',
                        width: 'calc(100% - 24px)',
                        maxWidth: '420px',
                        background: 'white',
                        border: '1px solid #cfe3ff',
                        borderRadius: '14px',
                        boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
                        padding: '12px 14px',
                        animation: 'toastIn 0.25s ease-out',
                    }}
                >
                    <span style={{ fontSize: '20px', flexShrink: 0 }}>{typeIcon(t.type)}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ margin: 0, fontSize: '14px', color: '#333', lineHeight: 1.4 }}>
                            {t.message}
                        </p>
                        <span style={{ fontSize: '12px', color: '#3b82f6' }}>눌러서 보기</span>
                    </div>
                    <button
                        onClick={(e) => { e.stopPropagation(); dismiss(t.id); }}
                        aria-label="닫기"
                        style={{ background: 'none', border: 'none', color: '#aaa', fontSize: '16px', cursor: 'pointer', padding: 0 }}
                    >
                        ✕
                    </button>
                </div>
            ))}
        </div>
    );
}

export default NotificationToast;
