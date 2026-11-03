-- 로그인 전 방문 기록(익명) — 랜딩/안내/초대장/동의서/로그인 화면
-- 이름·연락처·원본 IP는 저장하지 않음. anon_id(브라우저 임의 번호), ip_hash(IP를 되돌릴 수 없게 변환한 값)만 저장.
-- git push 전에 Railway Postgres에서 한 번 실행하세요.
CREATE TABLE IF NOT EXISTS page_visits (
  id SERIAL PRIMARY KEY,
  visit_id VARCHAR(40) UNIQUE,
  anon_id VARCHAR(40),
  page VARCHAR(60) NOT NULL,
  src VARCHAR(40),
  referrer_host VARCHAR(120),
  browser VARCHAR(20),
  device VARCHAR(10),
  ip_hash VARCHAR(16),
  started_at TIMESTAMPTZ DEFAULT NOW(),
  duration_seconds INTEGER,
  max_scroll_pct INTEGER,
  clicks TEXT
);
CREATE INDEX IF NOT EXISTS idx_page_visits_started ON page_visits(started_at);
