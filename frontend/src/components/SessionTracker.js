import { useEffect, useRef } from 'react';
import { getToken, sessionsAPI, API_URL } from '../services/api';

// 하트비트 간격 (45초)
const HEARTBEAT_INTERVAL_MS = 45 * 1000;
// 로그인 안 된 상태에서 토큰이 생기는지 확인하는 폴링 간격 (2초)
const TOKEN_POLL_INTERVAL_MS = 2 * 1000;

function SessionTracker() {
    const sessionIdRef = useRef(null);
    const heartbeatTimerRef = useRef(null);

    useEffect(() => {
        let tokenPollTimer = null;
        let ended = false;

        const startSession = async () => {
            try {
                const res = await sessionsAPI.start();
                sessionIdRef.current = res.data.session_id;

                // 하트비트 시작
                heartbeatTimerRef.current = setInterval(() => {
                    // 탭이 백그라운드면 하트비트 생략 (실제 몰입 시간만 반영)
                    if (document.visibilityState === 'visible' && sessionIdRef.current) {
                        sessionsAPI.heartbeat(sessionIdRef.current).catch(() => {});
                    }
                }, HEARTBEAT_INTERVAL_MS);
            } catch (e) {
                // 세션 시작 실패는 조용히 무시 (핵심 기능이 아니므로 사용자 경험에 영향 없게)
                console.error('세션 시작 실패:', e);
            }
        };

        const tryStart = () => {
            if (getToken() && !sessionIdRef.current) {
                startSession();
                if (tokenPollTimer) {
                    clearInterval(tokenPollTimer);
                    tokenPollTimer = null;
                }
            }
        };

        // 이미 로그인 되어있으면 바로 시작, 아니면 로그인될 때까지 폴링
        tryStart();
        if (!sessionIdRef.current) {
            tokenPollTimer = setInterval(tryStart, TOKEN_POLL_INTERVAL_MS);
        }

        // 탭을 닫거나 새로고침할 때 종료시각 기록 (sendBeacon은 커스텀 헤더를 못 붙이므로
        // 인증 없는 /sessions/end-beacon 엔드포인트로 session_id만 전송)
        const handleUnload = () => {
            if (ended || !sessionIdRef.current) return;
            ended = true;
            const blob = new Blob(
                [JSON.stringify({ session_id: sessionIdRef.current })],
                { type: 'application/json' }
            );
            navigator.sendBeacon(`${API_URL}/sessions/end-beacon`, blob);
        };

        window.addEventListener('pagehide', handleUnload);
        window.addEventListener('beforeunload', handleUnload);

        return () => {
            if (tokenPollTimer) clearInterval(tokenPollTimer);
            if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
            window.removeEventListener('pagehide', handleUnload);
            window.removeEventListener('beforeunload', handleUnload);
        };
    }, []);

    return null; // 화면에 아무것도 그리지 않는 순수 로직 컴포넌트
}

export default SessionTracker;
