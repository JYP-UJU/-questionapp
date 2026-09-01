import React from 'react';
import { useNavigate } from 'react-router-dom';

// 질문을 올린 직후(처음 몇 번) 질문들 화면 맨 위에 보여주는 활동 안내 섹션.
// 나의공간(Setting.js)의 menu-grid/menu-btn 스타일을 그대로 재사용함.
function PostActivityGuide({ questionTitle }) {
    const navigate = useNavigate();

    return (
        <div style={{ marginBottom: '16px' }}>
            {questionTitle && (
                <div style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: '12px',
                    padding: '10px 14px',
                    marginBottom: '10px',
                }}>
                    <div style={{ fontWeight: 700, fontSize: '13px', color: '#92400e', marginBottom: '2px' }}>
                        🎉 방금 이 질문을 올렸어요
                    </div>
                    <div style={{ fontSize: '14px', color: '#78350f' }}>{questionTitle}</div>
                </div>
            )}

            <div className="menu-grid">
                <button className="menu-btn songi-btn" onClick={() => navigate('/saved')}>
                    <span className="menu-icon">📝</span>
                    <span className="menu-label">내 활동</span>
                    <span className="menu-desc">저장한 질문 보기</span>
                </button>
                <button className="menu-btn report-btn" onClick={() => navigate('/songi-history')}>
                    <span className="menu-icon">🌸</span>
                    <span className="menu-label">송이 내역</span>
                    <span className="menu-desc">내가 모은 송이 확인</span>
                </button>
                <button className="menu-btn olympic-btn" onClick={() => navigate('/olympic')}>
                    <span className="menu-icon">🏆</span>
                    <span className="menu-label">질문올림픽</span>
                    <span className="menu-desc">질문으로 겨뤄봐요</span>
                </button>
                <button className="menu-btn account-btn" onClick={() => navigate('/quiz')}>
                    <span className="menu-icon">📋</span>
                    <span className="menu-label">퀴즈</span>
                    <span className="menu-desc">재미있는 퀴즈 풀기</span>
                </button>
            </div>
        </div>
    );
}

export default PostActivityGuide;
