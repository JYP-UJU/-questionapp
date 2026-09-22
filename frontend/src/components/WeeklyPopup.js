import React, { useState } from 'react';

// 상품권 진행 바 (🟩⬜ 10칸) — /reports/exchange-status와 같은 필드를 그대로 재사용
function ProgressBar({ current, threshold }) {
    const pct = threshold > 0 ? Math.min(100, Math.max(0, (current / threshold) * 100)) : 0;
    const filled = Math.round(pct / 10);
    const bar = '🟩'.repeat(filled) + '⬜'.repeat(10 - filled);
    return <div style={{ fontSize: '20px', letterSpacing: '1px' }}>{bar}</div>;
}

// 이번 주 활동량(질문+의견)에 따라 달라지는 헤더 문구
// 헤더의 "OO의 물음송이 이야기"와 이어지도록 "이야기" 비유로 통일해서,
// 활동을 숫자로 보고하기보다 "이번 주 네 이야기가 어디까지 채워졌는지"로 느끼게끔 씀
// (2026-09-22 피오 피드백 반영, 여러 차례 다듬은 최종본)
function getWeeklySubtitle(totalActivity) {
    if (totalActivity === 0) return '이번 주 이야기의 주인공은 아직 등장 전이에요 — 질문 하나로 시작해볼까요?';
    if (totalActivity <= 2) return '이번 주 이야기, 벌써 시작됐네요! 이 질문 흐름, 이어가볼까요?';
    return '이번 주는 이야기가 술술 이어졌어요! 질문왕으로 인정합니다.';
}

// 주 1회 인앱 팝업 (첫 로그인 안내가 뜨는 경우엔 같이 안 띄움 - Test.js에서 순서 제어)
// data는 GET /reports/weekly-popup 응답 그대로
// (2026-09-22) 이야기는 이제 개인 주차가 아니라 달력 주(이번 주) 공통 콘텐츠라서,
// 헤더에 개인 weekNumber를 붙이면 이야기 내용과 안 맞아 보일 수 있어 헤더에서 뺌
function WeeklyPopup({ data, onClose, onSaveEmail }) {
    const [wantEmail, setWantEmail] = useState(false);
    const [emailInput, setEmailInput] = useState('');
    const [emailSaving, setEmailSaving] = useState(false);
    const [emailSaved, setEmailSaved] = useState(false);
    const [emailError, setEmailError] = useState('');

    if (!data) return null;

    const { username, summary, highlightQuestion, ranking, exchangeStatus, story, tagline, hasEmail } = data;

    const handleSaveEmail = async () => {
        if (!emailInput.trim()) {
            setEmailError('이메일을 입력해주세요');
            return;
        }
        setEmailSaving(true);
        setEmailError('');
        try {
            await onSaveEmail(emailInput.trim());
            setEmailSaved(true);
        } catch (err) {
            setEmailError(err.response?.data?.error || '저장에 실패했어요');
        } finally {
            setEmailSaving(false);
        }
    };

    const rankingLines = [];
    if (ranking?.weeklyHeroRank) rankingLines.push(`🏆 이주의 영웅 ${ranking.weeklyHeroRank}위`);
    if (ranking?.friendlyRank) rankingLines.push(`💛 다정한 친구 ${ranking.friendlyRank}위`);

    const totalActivity = (summary?.questionsCreated || 0) + (summary?.opinionsGiven || 0);

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
                maxWidth: '460px',
                maxHeight: '92vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
            }}>
                <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid #eee' }}>
                    <div style={{ fontWeight: 700, fontSize: '20px', lineHeight: 1.3 }}>
                        🌸 이번 주 {username}의 물음송이 이야기
                    </div>
                    <div style={{ fontSize: '16px', color: '#888', marginTop: '4px' }}>
                        {getWeeklySubtitle(totalActivity)}
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', fontSize: '18px', color: '#333', lineHeight: 1.55 }}>
                    {/* 활동 요약 */}
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '8px' }}>📊 이번 주 활동</div>
                        <div>질문 {summary.questionsCreated}개 · 의견 {summary.opinionsGiven}개</div>
                        {rankingLines.length > 0 && (
                            <div style={{ marginTop: '8px' }}>
                                {rankingLines.map((line, i) => <div key={i}>{line}</div>)}
                            </div>
                        )}
                    </div>

                    {/* 하이라이트 질문 */}
                    {highlightQuestion && (
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '8px' }}>✨ 이번 주 가장 반응 좋았던 질문</div>
                            <div style={{ background: '#f7f7f9', borderRadius: '10px', padding: '14px 16px' }}>
                                "{highlightQuestion.title}"
                            </div>
                        </div>
                    )}

                    {/* 상품권 진행 바 */}
                    {exchangeStatus && !exchangeStatus.eligible && (
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '8px' }}>🎁 상품권까지</div>
                            <ProgressBar current={exchangeStatus.lifetimeSongi} threshold={exchangeStatus.threshold} />
                            <div style={{ fontSize: '16px', color: '#888', marginTop: '6px' }}>
                                {Math.max(0, Math.ceil(exchangeStatus.songiNeeded))}송이 남았어요
                            </div>
                        </div>
                    )}
                    {exchangeStatus && exchangeStatus.eligible && (
                        <div style={{ marginBottom: '20px', background: '#fff7e6', borderRadius: '10px', padding: '14px 16px' }}>
                            🎉 지금 상품권 교환이 가능해요! 프로필에서 신청해보세요
                        </div>
                    )}

                    {/* 이번 주 이야기 */}
                    {story && (
                        <div style={{ marginBottom: '20px' }}>
                            <div style={{ fontWeight: 700, fontSize: '17px', marginBottom: '8px' }}>{story.icon} {story.name} 이야기</div>
                            <div style={{ background: '#f7f7f9', borderRadius: '10px', padding: '14px 16px' }}>
                                {story.body}
                            </div>
                        </div>
                    )}

                    {/* 이메일로 받기 (아직 이메일이 없는 계정만) */}
                    {!hasEmail && !emailSaved && (
                        <div style={{ marginBottom: '20px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '16px', color: '#555', marginBottom: '8px' }}>
                                <input
                                    type="checkbox"
                                    checked={wantEmail}
                                    onChange={(e) => setWantEmail(e.target.checked)}
                                    style={{ width: '18px', height: '18px' }}
                                />
                                다음부터 이메일로도 받아보기
                            </label>
                            {wantEmail && (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="email"
                                        value={emailInput}
                                        onChange={(e) => setEmailInput(e.target.value)}
                                        placeholder="이메일 주소"
                                        style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '16px' }}
                                    />
                                    <button
                                        onClick={handleSaveEmail}
                                        disabled={emailSaving}
                                        style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 16px', fontSize: '16px', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        {emailSaving ? '저장 중...' : '저장'}
                                    </button>
                                </div>
                            )}
                            {emailError && <div style={{ color: '#e11d48', fontSize: '15px', marginTop: '6px' }}>{emailError}</div>}
                        </div>
                    )}
                    {emailSaved && (
                        <div style={{ marginBottom: '20px', fontSize: '17px', color: '#3b82f6' }}>✅ 이메일이 저장됐어요</div>
                    )}

                    {/* 태그라인 — 흐린 회색이 아니라 진한 글씨 + 미색 배경으로 눈에 띄게 */}
                    {tagline && (
                        <div style={{
                            fontSize: '15px',
                            color: '#222',
                            background: '#fbf3dd',
                            borderRadius: '10px',
                            padding: '14px 16px',
                            marginTop: '18px',
                            lineHeight: 1.6,
                        }}>
                            {tagline}
                        </div>
                    )}
                </div>

                <div style={{ padding: '16px 20px', borderTop: '1px solid #eee', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onClose}
                        style={{
                            background: '#3b82f6',
                            color: 'white',
                            border: 'none',
                            borderRadius: '10px',
                            padding: '12px 22px',
                            fontSize: '17px',
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

export default WeeklyPopup;
