import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { questionsAPI, getToken, weeklyPopupAPI, usersAPI } from '../services/api';
import './Test.css';
import BottomNav from '../components/BottomNav';
import TopHeader from '../components/TopHeader';
import FirstLoginGuide from '../components/FirstLoginGuide';
import WeeklyPopup from '../components/WeeklyPopup';

// 토큰 안의 userId만 가볍게 꺼내옴 (서버 검증용이 아니라 "이 계정이 안내를 봤는지" 로컬 저장 키로만 씀)
function getUserIdFromToken() {
    try {
        const token = getToken();
        if (!token) return null;
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.userId || payload.id || null;
    } catch {
        return null;
    }
}

function Test() {
    const randomDefaultImages = [
        'https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?w=800',
        'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=800',
        'https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=800',
        'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=800',
        'https://images.unsplash.com/photo-1433086966358-54859d0ed716?w=800'
    ];

    const instructionMessages = [
        "과학과 관련한 호기심을 나눠볼까요?",
        "자연을 보며 궁금했던 게 있나요?",
        "일상 속 과학 질문을 적어보아요!"
    ];

    // 질문 등록 후 보여줄 피드백 문구
    // - rare: 비슷한 질문이 거의 없을 때 (독창성 강조)
    // - resonant: 비슷한 질문이 많을 때 (공감/연결 강조)
    // - typeTag: 매칭 개수가 애매할 때, 질문 문장 자체의 특징으로 판단
    const RARE_MESSAGES = [
        '이 질문을 처음 물어보셨어요!',
        '아직 아무도 이렇게 물어본 적 없어요',
        '독특한 시각이 돋보여요',
        '나만의 궁금증이네요, 멋져요',
    ];
    const RESONANT_MESSAGES = (n) => [
        `${n}명이 비슷한 궁금증을 갖고 있어요`,
        '많은 친구들도 이 질문을 궁금해했어요',
        '공감가는 질문이에요',
        '같은 생각을 한 친구들이 있어요',
    ];
    const TYPE_MESSAGES = {
        whatif: '상상력 넘치는 질문이네요!',
        observation: '생각이 깊네요. 계속 볼까요?',
    };
    const FALLBACK_MESSAGES = ['멋진 질문이에요', '좋은 질문이에요'];

    const pickRandom = (arr) => arr[Math.floor(Math.random() * arr.length)];

    // matchCount(비슷한 질문 개수)와 typeTag로 보여줄 문구 하나를 고른다
    const getFeedbackMessage = (feedback) => {
        if (!feedback) return pickRandom(FALLBACK_MESSAGES);
        const { matchCount = 0, typeTag } = feedback;

        if (matchCount === 0) return pickRandom(RARE_MESSAGES);
        if (matchCount >= 3) return pickRandom(RESONANT_MESSAGES(matchCount));
        // 애매한 구간(1~2개)은 질문 유형 문구로 대체
        if (typeTag && TYPE_MESSAGES[typeTag]) return TYPE_MESSAGES[typeTag];
        return pickRandom(FALLBACK_MESSAGES);
    };

    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [thumbnail, setThumbnail] = useState(
        randomDefaultImages[Math.floor(Math.random() * randomDefaultImages.length)]
    );
    const [thumbnails, setThumbnails] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentMessageIndex, setCurrentMessageIndex] = useState(0);
    const navigate = useNavigate();

    // 첫 로그인 안내(사용법) - 계정별로 한 번만, "다음에 또 보기"를 고르면 다음 로그인 때 다시 뜸
    const [showGuide, setShowGuide] = useState(false);
    const [guideChecked, setGuideChecked] = useState(false); // 안내 노출 여부를 이미 판단했는지 (주간 팝업과 동시에 안 뜨게 순서를 맞추는 용도)
    useEffect(() => {
        const userId = getUserIdFromToken();
        if (!userId) { setGuideChecked(true); return; }
        const seen = localStorage.getItem(`guideSeen_${userId}`);
        if (!seen) setShowGuide(true);
        setGuideChecked(true);
    }, []);
    const handleCloseGuide = (seeAgainNextTime) => {
        const userId = getUserIdFromToken();
        if (userId && !seeAgainNextTime) {
            localStorage.setItem(`guideSeen_${userId}`, 'true');
        }
        setShowGuide(false);
    };

    // 주 1회 인앱 팝업 - 로그인 시점에 한 번만 확인
    // 첫 로그인 안내가 뜨는 경우엔 같이 띄우지 않음 (동시에 두 개 뜨는 것 방지)
    // (2026-09-22 변경) 이야기는 이제 개인 가입일 주차가 아니라 "진짜 이번 주"(달력 기준)로 전체
    // 학생에게 동일하게 도는 콘텐츠라서, 신규 가입 학생도 유예 없이 바로 합류함(예전의 weekNumber>=2
    // 체크 제거). 대신 "이번 주 이미 봤는지"는 개인 weekNumber가 아니라 서버가 내려주는
    // storyWeekKey(그 주 월요일 날짜, KST)로 구분함 — 뜨문뜨문 접속하는 학생도 언제 오든
    // "지금 진행 중인 이야기"를 놓치지 않고 볼 수 있음.
    const [weeklyPopupData, setWeeklyPopupData] = useState(null);
    const [showWeeklyPopup, setShowWeeklyPopup] = useState(false);
    useEffect(() => {
        if (!guideChecked || showGuide) return;
        const userId = getUserIdFromToken();
        if (!userId) return;

        weeklyPopupAPI.get()
            .then((res) => {
                const data = res.data;
                if (!data) return;
                const lastSeenWeekKey = localStorage.getItem(`weeklyPopupWeek_${userId}`);
                if (lastSeenWeekKey !== data.storyWeekKey) {
                    setWeeklyPopupData(data);
                    setShowWeeklyPopup(true);
                }
            })
            .catch((err) => {
                console.error('주간 팝업 데이터 조회 실패:', err);
            });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [guideChecked, showGuide]);

    const handleCloseWeeklyPopup = () => {
        const userId = getUserIdFromToken();
        if (userId && weeklyPopupData) {
            localStorage.setItem(`weeklyPopupWeek_${userId}`, weeklyPopupData.storyWeekKey);
        }
        setShowWeeklyPopup(false);
    };

    const handleSaveWeeklyEmail = async (email) => {
        await usersAPI.updateEmail(email);
    };

    const searchThumbnails = async (keyword) => {
        if (!keyword) return;
        try {
            const response = await fetch(
                `https://api.unsplash.com/search/photos?query=${encodeURIComponent(keyword)}&per_page=10&orientation=landscape`,
                {
                    headers: {
                        'Authorization': 'Client-ID 06qLGIItpIaULUkxufSAVxFq_WQfo97EvUqOMlPhBNw'
                    }
                }
            );
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                setThumbnails(data.results);
                setThumbnail(data.results[0].urls.regular);
            } else {
                setThumbnails([]);
            }
        } catch (err) {
            console.error('Thumbnail error:', err);
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            if (title.length > 2) {
                searchThumbnails(title);
            }
        }, 1000);
        return () => clearTimeout(timer);
    }, [title]);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentMessageIndex(prev => (prev + 1) % instructionMessages.length);
        }, 4000);
        return () => clearInterval(interval);
    }, []);

    // eslint-disable-next-line no-unused-vars
    const refreshThumbnail = () => {
        if (thumbnails.length > 0) {
            const randomIndex = Math.floor(Math.random() * thumbnails.length);
            setThumbnail(thumbnails[randomIndex].urls.regular);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!title.trim()) {
            setError('제목을 입력해 주세요');
            return;
        }
        setLoading(true);
        setError('');
        try {
            const res = await questionsAPI.create(title, content, thumbnail);
            const feedbackLine = getFeedbackMessage(res.data?.feedback);
            alert(`${feedbackLine}\n+5송이 획득!`);
            // 방금 올린 질문을 질문들 화면에서 강조 표시하기 위해 id/제목/누적 개수를 함께 전달
            // (누적 개수는 처음 몇 번만 활동 안내 섹션을 보여줄지 판단하는 용도)
            navigate('/questions', {
                state: {
                    justPostedId: res.data?.question?.id ?? null,
                    justPostedTitle: res.data?.question?.title ?? title,
                    myQuestionCount: res.data?.myQuestionCount ?? null,
                }
            }); // ✅ /saved → /questions 로 변경
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to post question');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="create-container">
            {showGuide && <FirstLoginGuide onClose={handleCloseGuide} />}
            {showWeeklyPopup && (
                <WeeklyPopup
                    data={weeklyPopupData}
                    onClose={handleCloseWeeklyPopup}
                    onSaveEmail={handleSaveWeeklyEmail}
                />
            )}
            <TopHeader
                icon="✏️"
                title="내 질문하기"
                messages={[]}
                backTo="/questions"
            />

            <div className="create-content">
                <div className="instruction instruction-animated">
                    {instructionMessages[currentMessageIndex]}
                </div>

                <form onSubmit={handleSubmit} className="create-form">
                    <div className="input-section-with-icon">
                        <div className="icon-label">
                            <span className="input-icon">☁️</span>
                            <label className="form-label-bright">질문이 있어요.</label>
                        </div>
                        <textarea
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="예) 지렁이는 들을 수 있어요?"
                            maxLength={500}
                            rows={4}
                            className="form-input-bright-large"
                        />
                        <span className="char-count">{title.length}/500</span>
                    </div>

                    <div className="input-section-with-icon input-section-tight">
                        <div className="icon-label">
                            <span className="input-icon">❓</span>
                            <label className="form-label-bright">이렇게 궁금했어요</label>
                        </div>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            placeholder="예) 피하지 못하고 밟혀있는 지렁이를 보면서 그런 질문이 생겼어요"
                            maxLength={500}
                            rows={2}
                            className="form-textarea-bright-small"
                        />
                        <span className="char-count">{content.length}/500</span>
                    </div>

                    {error && <p className="error-message">{error}</p>}

                    <div className="form-actions">
                        <button
                            type="submit"
                            disabled={loading || !title.trim()}
                            className="submit-button-bright"
                        >
                            {loading ? '올리는 중...' : '질문 올리기 ✨ (+5 송이)'}
                        </button>
                    </div>
                </form>

                <div className="bottom-info-row">
                    <button
                        type="button"
                        className="friends-link-box"
                        onClick={() => navigate('/questions')}
                    >
                        <span className="friends-link-icon">👥</span>
                        <span>친구질문<br />보러가기</span>
                    </button>

                    <div className="reward-info-bright">
                        <p>💐 질문하면 5송이가 주어져요!</p>
                    </div>
                </div>
            </div>

            <BottomNav />
        </div>
    );
}

export default Test;
