// 로그인 화면 익명 방문 기록 (backend/public/track.js와 같은 방식)
// 이름·연락처·원본 IP는 보내지 않음. 내 방문 제외: 주소 끝에 ?notrack=1 을 붙여 한 번 열기.
import { API_URL } from './api';

const rnd = (n) => {
    const a = new Uint8Array(n);
    window.crypto.getRandomValues(a);
    return Array.from(a, (x) => (x % 36).toString(36)).join('');
};

export function trackPage(page) {
    try {
        const q = new URLSearchParams(window.location.search);
        if (q.get('notrack') === '1') localStorage.setItem('mm_notrack', '1');
        if (q.get('notrack') === '0') localStorage.removeItem('mm_notrack');
        if (localStorage.getItem('mm_notrack') === '1') return () => {};
    } catch (e) {}

    let anon;
    try { anon = localStorage.getItem('mm_aid'); if (!anon) { anon = rnd(20); localStorage.setItem('mm_aid', anon); } }
    catch (e) { anon = rnd(20); }

    const visitId = rnd(20);
    const q = new URLSearchParams(window.location.search);
    let refHost = '';
    try { refHost = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
    if (refHost === window.location.hostname) refHost = '';

    const post = (path, data) => {
        try {
            fetch(`${API_URL}/track${path}`, {
                method: 'POST', headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data), keepalive: true,
            }).catch(() => {});
        } catch (e) {}
    };
    post('/visit', { visit_id: visitId, anon_id: anon, page, src: q.get('src') || q.get('utm_source') || '', referrer_host: refHost });

    let visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
    let visibleMs = 0;
    const report = () => {
        if (visibleSince) { visibleMs += Date.now() - visibleSince; visibleSince = null; }
        post('/leave', { visit_id: visitId, duration_seconds: Math.round(visibleMs / 1000), max_scroll_pct: 0 });
    };
    const onVis = () => { if (document.visibilityState === 'hidden') report(); else visibleSince = Date.now(); };
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pagehide', report);
    return () => {
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('pagehide', report);
        report();
    };
}
