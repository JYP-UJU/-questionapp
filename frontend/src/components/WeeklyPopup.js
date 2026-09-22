import React, { useState } from 'react';

// 상품권 진행 바 (🟩⬜ 10칸) — /reports/exchange-status와 같은 필드를 그대로 재사용
function ProgressBar({ current, threshold }) {
    const pct = threshold > 0 ? Math.min(100, Math.max(0, (current / threshold) * 100)) : 0;
    const filled = Math.round(pct / 10);
    const bar = '🟩'.repeat(filled) + '⬜'.repeat(10 - filled);
    return <div style={{ fontSize: '22px', letterSpacing: '1px' }}>{bar}</div>;
}

// 이번 주 활동량(질문+의견)에 따라 달라지는 헤더 문구
// 0개일 때도 "안 했네요"처럼 나무라는 느낌이 안 들게, 세 경우 다 "~볼까요?"로 끝내서
// 더 남기고 싶은 마음이 들게끔 가벼운 초대 톤으로 씀 (2026-09-22 피오 피드백 반영)
function getWeeklySubtitle(totalActivity) {
    if (totalActivity === 0) return '이번 주엔 어떤 게 궁금해질까요? 첫 질문을 기다리고 있어요!';
    if (totalActivity <= 2) return '이번 주에도 궁금한 게 있었네요! 하나 더 남겨볼까요?';
    return '이번 주는 유독 궁금한 게 많았네요! 이 기세로 계속 가볼까요?';
}

// 주 1회 인앱 팝업 (2주차부터 노출 — 1주차는 FirstLoginGuide가 담당)
// data는 GET /reports/weekly-popup 응답 그대로
function WeeklyPopup({ data, onClose, onSaveEmail }) {
    const [wantEmail, setWantEmail] = useState(false);
    const [emailInput, setEmailInput] = useState('');
    const [emailSaving, setEmailSaving] = useState(false);
    const [emailSaved, setEmailSaved] = useState(false);
    const [emailError, setEmailError] = useState('');

    if (!data) return null;

    const { weekNumber, username, summary, highlightQuestion, ranking, exchangeStatus, story, tagline, hasEmail } = data;

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
                    <div style={{ fontWeight: 700, fontSize: '23px', lineHeight: 1.3 }}>
                        🌸 {weekNumber}주차 {username}의 물음송이 이야기
                    </div>
                    <div style={{ fontSize: '17px', color: '#888', marginTop: '4px' }}>
                        {getWeeklySubtitle(totalActivity)}
                    </div>
                </div>

                <div style={{ flex: 1, overflowY: 'auto', padding: '20px', fontSize: '20px', color: '#333', lineHeight: 1.6 }}>
                    {/* 활동 요약 */}
                    <div style={{ marginBottom: '22px' }}>
                        <div style={{ fontWeight: 700, fontSize: '19px', marginBottom: '8px' }}>📊 이번 주 활동</div>
                        <div>질문 {summary.questionsCreated}개 · 의견 {summary.opinionsGiven}개</div>
                        {rankingLines.length > 0 && (
                            <div style={{ marginTop: '8px' }}>
                                {rankingLines.map((line, i) => <div key={i}>{line}</div>)}
                            </div>
                        )}
                    </div>

                    {/* 하이라이트 질문 */}
                    {highlightQuestion && (
                        <div style={{ marginBottom: '22px' }}>
                            <div style={{ fontWeight: 700, fontSize: '19px', marginBottom: '8px' }}>✨ 이번 주 가장 반응 좋았던 질문</div>
                            <div style={{ background: '#f7f7f9', borderRadius: '10px', padding: '14px 16px' }}>
                                "{highlightQuestion.title}"
                            </div>
                        </div>
                    )}

                    {/* 상품권 진행 바 */}
                    {exchangeStatus && !exchangeStatus.eligible && (
                        <div style={{ marginBottom: '22px' }}>
                            <div style={{ fontWeight: 700, fontSize: '19px', marginBottom: '8px' }}>🎁 상품권까지</div>
                            <ProgressBar current={exchangeStatus.lifetimeSongi} threshold={exchangeStatus.threshold} />
                            <div style={{ fontSize: '17px', color: '#888', marginTop: '6px' }}>
                                {Math.max(0, Math.ceil(exchangeStatus.songiNeeded))}송이 남았어요
                            </div>
                        </div>
                    )}
                    {exchangeStatus && exchangeStatus.eligible && (
                        <div style={{ marginBottom: '22px', background: '#fff7e6', borderRadius: '10px', padding: '14px 16px' }}>
                            🎉 지금 상품권 교환이 가능해요! 프로필에서 신청해보세요
                        </div>
                    )}

                    {/* 이번 주 이야기 */}
                    {story && (
                        <div style={{ marginBottom: '22px' }}>
                            <div style={{ fontWeight: 700, fontSize: '19px', marginBottom: '8px' }}>{story.icon} {story.name} 이야기</div>
                            <div style={{ background: '#f7f7f9', borderRadius: '10px', padding: '14px 16px' }}>
                                {story.body}
                            </div>
                        </div>
                    )}

                    {/* 이메일로 받기 (아직 이메일이 없는 계정만) */}
                    {!hasEmail && !emailSaved && (
                        <div style={{ marginBottom: '22px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '18px', color: '#555', marginBottom: '8px' }}>
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
                                        style={{ flex: 1, padding: '10px 12px', borderRadius: '8px', border: '1px solid #ddd', fontSize: '17px' }}
                                    />
                                    <button
                                        onClick={handleSaveEmail}
                                        disabled={emailSaving}
                                        style={{ background: '#3b82f6', color: 'white', border: 'none', borderRadius: '8px', padding: '10px 16px', fontSize: '17px', fontWeight: 700, cursor: 'pointer' }}
                                    >
                                        {emailSaving ? '저장 중...' : '저장'}
                                    </button>
                                </div>
                            )}
                            {emailError && <div style={{ color: '#e11d48', fontSize: '16px', marginTop: '6px' }}>{emailError}</div>}
                        </div>
                    )}
                    {emailSaved && (
                        <div style={{ marginBottom: '22px', fontSize: '18px', color: '#3b82f6' }}>✅ 이메일이 저장됐어요</div>
                    )}

                    {/* 태그라인 */}
                    {tagline && (
                        <div style={{ fontSize: '16px', color: '#999', borderTop: '1px solid #eee', paddingTop: '16px', marginTop: '6px' }}>
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
                            padding: '13px 24px',
                            fontSize: '19px',
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
