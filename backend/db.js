const { Pool } = require('pg');

const pool = new Pool({
    user: process.env.DB_USER || 'postgres',
    host: process.env.DB_HOST || 'localhost',
    database: process.env.DB_NAME || 'muleumsongi',
    password: process.env.DB_PASSWORD || '964800',
    port: process.env.DB_PORT || 5432,
    // 기본값(10)이면 여러 명이 동시에 접속했을 때 항목별로 여러 번 쏘는 조회들이
    // 금방 자리를 다 채워서 뒷사람 요청이 줄서게 됨 - 임시 완화용으로 늘려둠.
    // (진짜 해결은 항목별 개별 조회를 줄이는 것 - 추후 진행 예정)
    max: 20,
});

pool.on('connect', () => {
    console.log('✅ Database connected successfully');
});

pool.on('error', (err) => {
    console.error('❌ Unexpected database error:', err);
    process.exit(-1);
});

module.exports = pool;
