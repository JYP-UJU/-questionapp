import { useEffect, useRef } from 'react';
import { getToken, sessionsAPI, API_URL } from '../services/api';

// 하트비트 간격 (45초)
const HEARTBEAT_INTERVAL_MS = 45 * 1000;
// 세션이 아직 없는 동안(로그인 대기 중이거나, 시작에 실패해서 재시도하는 동안) 확인하는 간격.
// 세션이 이미 있으면 이 틱은 즉시 리턴하고 아무 요청도 안 보내므로 부담이 없음.
const ENSURE_SESSION_INTERVAL_MS = 5 * 1000;

function SessionTracker() {
    const sessionIdRef = useRef(null);
    const heartbeatTimerRef = useRef(null);

    useEffect(() => {
        let ensureTimer = null;
        let starting = false;
        let ended = false;

        const stopHeartbeat = () => {
            if (heartbeatTimerRef.current) {
                clearInterval(heartbeatTimerRef.current);
                heartbeatTimerRef.current = null;
            }
        };

        const startHeartbeat = () => {
            stopHeartbeat();
            heartbeatTimerRef.current = setInterval(() => {
                if (!sessionIdRef.current) return;
                // 탭이 백그라운드면 하트비트 생략 (실제 몰입 시간만 반영)
                if (document.visibilityState === 'visible') {
                    sessionsAPI.heartbeat(sessionIdRef.current).catch(() => {
                        // 하트비트 실패 = 세션이 유효하지 않아졌을 수 있음(서버 재배포 등).
                        // 세션을 잃은 것으로 보고 즉시 새 세션 시작을 시도해서, 방문 내내
                        // 기록이 끊기는 걸 막는다.
                        sessionIdRef.current = null;
                        stopHeartbeat();
                        ensureSession();
                    });
                }
            }, HEARTBEAT_INTERVAL_MS);
        };

        // 로그인 되어있는데 세션이 아직 없으면 시작을 시도. 실패해도 조용히 무시하고
        // ensureTimer가 주기적으로 다시 불러주기 때문에, 예전처럼 "한 번 재시도하고 그걸로
        // 끝"나는 일이 없다 — 성공할 때까지(또는 로그아웃할 때까지) 계속 재시도한다.
        const ensureSession = () => {
            if (ended || starting || sessionIdRef.current || !getToken()) return;
            starting = true;
            sessionsAPI.start()
                .then((res) => {
                    sessionIdRef.current = res.data.session_id;
                    startHeartbeat();
                })
                .catch((e) => {
                    console.error('세션 시작 실패, 잠시 후 재시도:', e);
                })
                .finally(() => {
                    starting = false;
                });
        };

        ensureSession();
        ensureTimer = setInterval(ensureSession, ENSURE_SESSION_INTERVAL_MS);

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
            ended = true;
            if (ensureTimer) clearInterval(ensureTimer);
            stopHeartbeat();
            window.removeEventListener('pagehide', handleUnload);
            window.removeEventListener('beforeunload', handleUnload);
        };
    }, []);

    return null; // 화면에 아무것도 그리지 않는 순수 로직 컴포넌트
}

export default SessionTracker;
