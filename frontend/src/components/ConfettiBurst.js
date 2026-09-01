import React, { useMemo } from 'react';

// 질문을 올렸을 때 잠깐(1~2초) 화면에 터지는 폭죽/색종이 효과.
// 순수 CSS 애니메이션이라 별도 라이브러리 설치 없이 동작함.
const COLORS = ['#f87171', '#fbbf24', '#34d399', '#60a5fa', '#a78bfa', '#f472b6', '#fb923c'];
const PIECE_COUNT = 42;

function ConfettiBurst() {
    const pieces = useMemo(() => {
        return Array.from({ length: PIECE_COUNT }).map((_, i) => ({
            id: i,
            left: Math.random() * 100,
            color: COLORS[i % COLORS.length],
            delay: Math.random() * 0.25,
            duration: 1.1 + Math.random() * 0.6,
            rotate: Math.floor(Math.random() * 360),
            drift: (Math.random() - 0.5) * 60,
            size: 6 + Math.random() * 5,
        }));
    }, []);

    return (
        <div style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            pointerEvents: 'none',
            overflow: 'hidden',
        }}>
            <style>{`
                @keyframes confetti-fall {
                    0% { transform: translateY(-10vh) translateX(0) rotate(0deg); opacity: 1; }
                    100% { transform: translateY(105vh) translateX(var(--drift)) rotate(540deg); opacity: 0; }
                }
                @keyframes confetti-pop-text {
                    0% { transform: translate(-50%, -8px) scale(0.8); opacity: 0; }
                    15% { transform: translate(-50%, 0) scale(1.05); opacity: 1; }
                    30% { transform: translate(-50%, 0) scale(1); opacity: 1; }
                    100% { transform: translate(-50%, 0) scale(1); opacity: 0; }
                }
            `}</style>

            {pieces.map((p) => (
                <span
                    key={p.id}
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: `${p.left}%`,
                        width: `${p.size}px`,
                        height: `${p.size * 1.6}px`,
                        background: p.color,
                        borderRadius: '2px',
                        '--drift': `${p.drift}px`,
                        animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
                    }}
                />
            ))}

            <div style={{
                position: 'absolute',
                top: '90px',
                left: '50%',
                background: 'white',
                color: '#3b82f6',
                fontWeight: 700,
                fontSize: '16px',
                padding: '10px 20px',
                borderRadius: '20px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                whiteSpace: 'nowrap',
                animation: 'confetti-pop-text 1.6s ease-out forwards',
            }}>
                질문 등록 완료! 🎉 잘했어요
            </div>
        </div>
    );
}

export default ConfettiBurst;
