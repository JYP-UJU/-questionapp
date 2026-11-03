/* 물음송이 익명 방문 기록 (랜딩/안내/초대장/동의서 화면용)
   - 이름·연락처·원본 IP는 보내지 않음. 브라우저 임의 번호와 화면 이름, 머문 시간, 스크롤, 누른 링크만 보냄.
   - 내 방문 제외: 주소 끝에 ?notrack=1 을 붙여 한 번 열면 이 브라우저는 기록 안 함 (?notrack=0 으로 해제) */
(function () {
  try {
    var q = new URLSearchParams(location.search);
    if (q.get('notrack') === '1') localStorage.setItem('mm_notrack', '1');
    if (q.get('notrack') === '0') localStorage.removeItem('mm_notrack');
    if (localStorage.getItem('mm_notrack') === '1') return;
  } catch (e) {}

  var rnd = function (n) {
    var a = new Uint8Array(n), s = '';
    (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i = 0; i < n; i++) s += (a[i] % 36).toString(36);
    return s;
  };
  var anon;
  try { anon = localStorage.getItem('mm_aid'); if (!anon) { anon = rnd(20); localStorage.setItem('mm_aid', anon); } }
  catch (e) { anon = rnd(20); }

  var visitId = rnd(20);
  var page = (location.pathname.split('/').pop() || 'home').replace('.html', '');
  var q2 = new URLSearchParams(location.search);
  var src = q2.get('src') || q2.get('utm_source') || '';
  var refHost = '';
  try { refHost = document.referrer ? new URL(document.referrer).hostname : ''; } catch (e) {}
  if (refHost === location.hostname) refHost = '';

  var post = function (path, data) {
    try {
      var body = JSON.stringify(data);
      if (navigator.sendBeacon && path !== '/visit') {
        navigator.sendBeacon('/api/track' + path, new Blob([body], { type: 'application/json' }));
      } else {
        fetch('/api/track' + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: body, keepalive: true });
      }
    } catch (e) {}
  };

  post('/visit', { visit_id: visitId, anon_id: anon, page: page, src: src, referrer_host: refHost });

  // 보고 있던 시간(화면이 보이는 동안만) + 가장 깊이 내려간 위치
  var visibleSince = document.visibilityState === 'visible' ? Date.now() : null;
  var visibleMs = 0, maxScroll = 0;
  var measureScroll = function () {
    var de = document.documentElement;
    var total = Math.max(de.scrollHeight, document.body.scrollHeight) - window.innerHeight;
    var pct = total <= 0 ? 100 : Math.round(((window.pageYOffset || de.scrollTop) / total) * 100);
    if (pct > maxScroll) maxScroll = Math.min(pct, 100);
  };
  window.addEventListener('scroll', measureScroll, { passive: true });
  measureScroll();

  var report = function () {
    if (visibleSince) { visibleMs += Date.now() - visibleSince; visibleSince = null; }
    measureScroll();
    post('/leave', { visit_id: visitId, duration_seconds: Math.round(visibleMs / 1000), max_scroll_pct: maxScroll });
  };
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') report();
    else visibleSince = Date.now();
  });
  window.addEventListener('pagehide', report);

  // 어느 링크를 눌렀는지 (앱/동의서/다른 화면)
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a') : null;
    if (!a || !a.href) return;
    var target = '';
    try {
      var u = new URL(a.href, location.href);
      if (u.hostname !== location.hostname) target = u.hostname.indexOf('queapp') === 0 ? 'app(' + u.pathname + ')' : u.hostname;
      else target = (u.pathname.split('/').pop() || u.pathname).replace('.html', '') + (u.hash || '');
    } catch (err) { return; }
    if (target) post('/click', { visit_id: visitId, target: target });
  }, true);
})();
