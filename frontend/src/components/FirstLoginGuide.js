import React, { useState } from 'react';
import { API_URL } from '../services/api';

// 이미 만들어둔 "물음송이 앱 설명" 페이지를 그대로 iframe으로 보여줌
// (내용을 따로 다시 만들지 않고 한 군데(랜딩용 HTML)만 고치면 여기도 같이 업데이트됨)
const GUIDE_URL = `${API_URL.replace(/\/api\/?$/, '')}/land/muleumsongi-guide.html`;

function FirstLoginGuide({ onClose }) {
    const [seeAgain, setSeeAgain] = useState(false);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 500,
            background: 'rgba(0,0,0,0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
        }}>
            <div style={{
                background: 'white',
                borderRadius: '16px',
                width: '100%',
                maxWidth: '420px',
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}>
                <div style={{ padding: '14px 16px 10px', borderBottom: '1px solid #eee' }}>
                    <div style={{ fontWeight: 700, fontSize: '16px' }}>📖 물음송이는 이렇게 써요</div>
                    <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>
                        이 안내는 처음 로그인했을 때만 떠요
                    </div>
                </div>

                <iframe
                    title="물음송이 사용법"
                    src={GUIDE_URL}
                    style={{ flex: 1, border: 'none', width: '100%', minHeight: '360px' }}
                />

                <div style={{
                    padding: '12px 16px',
                    borderTop: '1px solid #eee',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px',
                    flexWrap: 'wrap',
                }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#555' }}>
                        <input
                            type="checkbox"
                            checked={seeAgain}
                            onChange={(e) => setSeeAgain(e.target.checked)}
                        />
                        다음 로그인 때 또 보기
                    </label>
                    <button
                        onClick={() => onClose(seeAgain)}
                        style={{
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '10px 18px',
                            fontSize: '14px',
                            fontWeight: 700,
                            cursor: 'pointer',
                        }}
                    >
                        확인
                    </button>
                </div>
            </div>
        </div>
    );
}

export default FirstLoginGuide;
