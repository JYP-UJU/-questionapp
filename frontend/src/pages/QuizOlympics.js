import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './QuizOlympics.css';
import BottomNav from '../components/BottomNav';
import TopHeader from '../components/TopHeader';

// ── 질문 16개는 백엔드에서 review_stage='final_reviewed'인 것 중
//    랜덤으로 받아온다 (예전 하드코딩 155개 샘플 데이터는 제거함) ──

// ── 토너먼트 브래킷 생성 ──────────────────────────────────────
function makeBracket(questions) {
  const pairs = [];
  for (let i = 0; i < 16; i += 2) {
    pairs.push([questions[i], questions[i + 1]]);
  }
  return pairs;
}

// 카테고리(물리/화학/생물/지구과학) 기준 성향 문구
// DB 카테고리에는 "화학/물리 경계" 같은 경계형 값도 있어서, 포함 여부로 매칭한다.
const PROFILES = [
  { match: '물리', text: '자연의 원리를 파고드는 물리현상 탐구자예요!' },
  { match: '화학', text: '자연의 원리를 파고드는 화학현상 탐구자예요!' },
  { match: '생물', text: '자연의 원리를 파고드는 생명현상 탐구자예요!' },
  { match: '지구과학', text: '자연의 원리를 파고드는 지구우주 탐구자예요!' },
  { match: '지학', text: '자연의 원리를 파고드는 지구우주 탐구자예요!' },
];

function getProfile(subject) {
  const found = PROFILES.find(p => subject && subject.includes(p.match));
  return found ? found.text : '과학의 신비를 탐구하는 탐구자예요!';
}

const ROUND_LABELS = { 8: '8강', 4: '4강', 2: '결승' };

function QuizOlympics() {
  const navigate = useNavigate();

  const [rounds, setRounds] = useState(null); // 로딩 끝나면 [makeBracket(questions)]로 채움
  const [loadError, setLoadError] = useState(null);
  const [currentRound, setCurrentRound] = useState(0);
  const [selections, setSelections] = useState({});
  const [finished, setFinished] = useState(false);
  const [winner, setWinner] = useState(null);

  // ── 라운드별 노출/선택 기록 누적 ─────────────────────────────
  // { roundNumber, roundLabel, questions: [{...q, selected}] } 배열
  const [allRoundsData, setAllRoundsData] = useState([]);

  // ── 시작할 때 백엔드에서 16개 질문 받아오기 ──────────────────
  useEffect(() => {
    api.get('/olympic/questions')
      .then(res => {
        const questions = res.data.questions || [];
        setRounds([makeBracket(questions)]);
      })
      .catch(err => {
        console.error('올림픽 질문 로딩 오류:', err);
        setLoadError('질문을 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
      });
  }, []);

  const currentPairs = (rounds && rounds[currentRound]) || [];
  const roundSize = currentPairs.length * 2;
  const roundLabel = ROUND_LABELS[roundSize] || `${roundSize}강`;
  const allSelected = currentPairs.every((_, i) => selections[`${currentRound}-${i}`] !== undefined);

  const handleSelect = (pairIdx, question) => {
    setSelections(prev => ({ ...prev, [`${currentRound}-${pairIdx}`]: question.id }));
  };

  const handleNext = () => {
    const winners = currentPairs.map((pair, i) => {
      const selId = selections[`${currentRound}-${i}`];
      return pair.find(q => q.id === selId) || pair[0];
    });

    // ── 현재 라운드 노출/선택 데이터 저장 ──
    const roundQuestions = currentPairs.flatMap((pair, i) => {
      const selId = selections[`${currentRound}-${i}`];
      return pair.map(q => ({ ...q, selected: q.id === selId }));
    });
    const roundRecord = {
      roundNumber: currentRound,
      roundLabel,
      questions: roundQuestions,
    };
    const updatedRoundsData = [...allRoundsData, roundRecord];
    setAllRoundsData(updatedRoundsData);

    if (winners.length === 1) {
      // 결승 끝 → 최애 탄생
      setWinner(winners[0]);
      setFinished(true);
      handleFinish(winners[0], updatedRoundsData);
      return;
    }

    const nextPairs = [];
    for (let i = 0; i < winners.length; i += 2) {
      nextPairs.push([winners[i], winners[i + 1]]);
    }
    setRounds(prev => [...prev, nextPairs]);
    setCurrentRound(prev => prev + 1);
    setSelections({});
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleBack = () => {
    if (currentRound === 0) return;
    // 뒤로 가면 마지막 라운드 기록도 취소
    setAllRoundsData(prev => prev.slice(0, -1));
    setRounds(prev => prev.slice(0, -1));
    setCurrentRound(prev => prev - 1);
    setSelections({});
  };

  const handleFinish = async (winnerQ, roundsData) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;
      await api.post('/olympic/complete', {
        winnerId: winnerQ.id,
        winnerText: winnerQ.text,
        winnerSubject: winnerQ.subject,
        roundsData,   // 전체 라운드 노출/선택 데이터
      });
    } catch (err) {
      console.error('올림픽 결과 저장 오류:', err);
    }
  };

  // ── 결과 화면 컴포넌트 ───────────────────────────────────────
  if (finished && winner) {
    // 4강 선택 질문 2개 추출 (roundNumber === 1)
    const semifinalRound = allRoundsData.find(r => r.roundNumber === 1);
    const semifinalSelected = semifinalRound
      ? semifinalRound.questions.filter(q => q.selected && q.id !== winner.id).slice(0, 2)
      : [];

    return <OlympicsResult
      winner={winner}
      allRoundsData={allRoundsData}
      navigate={navigate}
    />;
  }

  if (loadError) {
    return (
      <div className="olympics-container">
        <TopHeader icon="🏅" title="질문올림픽" messages={[]} backTo="/main" />
        <div className="olympics-content">
          <p style={{ textAlign: 'center', marginTop: 40 }}>{loadError}</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!rounds) {
    return (
      <div className="olympics-container">
        <TopHeader icon="🏅" title="질문올림픽" messages={[]} backTo="/main" />
        <div className="olympics-content">
          <p style={{ textAlign: 'center', marginTop: 40 }}>질문을 불러오는 중...</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="olympics-container">
      <TopHeader icon="🏅" title="질문올림픽" messages={[]} backTo="/main" />

      <div className="olympics-content">
        {/* 라운드 헤더 */}
        <div className="round-header">
          <div className="round-badge">{roundLabel}</div>
          <div className="round-sub">마음에 드는 질문 카드를 눌러 선택하세요</div>
        </div>

        {/* 페어 목록 */}
        <div className="pairs-list">
          {currentPairs.map((pair, pairIdx) => {
            const selId = selections[`${currentRound}-${pairIdx}`];
            return (
              <div key={pairIdx} className={`pair-row ${pairIdx % 2 === 0 ? 'pair-even' : 'pair-odd'}`}>
                {pair.map((q, qi) => (
                  <React.Fragment key={q.id}>
                    <div
                      className={`q-card ${selId === q.id ? 'selected' : ''}`}
                      onClick={() => handleSelect(pairIdx, q)}
                    >
                      <div className="q-card-text">{q.text}</div>
                    </div>
                    {qi === 0 && <div className="pair-num">{pairIdx + 1}</div>}
                  </React.Fragment>
                ))}
              </div>
            );
          })}
        </div>

        {/* 하단 버튼 */}
        <div className="olympics-actions">
          {currentRound > 0 && (
            <button className="back-btn" onClick={handleBack}>← 뒤로</button>
          )}
          <button
            className={`next-btn ${allSelected ? 'active' : ''}`}
            onClick={handleNext}
            disabled={!allSelected}
          >
            {currentPairs.length === 1 ? '🏆 최애 질문 확정!' : `다음 라운드 →`}
          </button>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}

// ── 라운드별 점수 가중치 ─────────────────────────────────────
// roundNumber: 0=16강, 1=8강, 2=4강, 3=결승
const ROUND_SCORES = { 0: 1, 1: 10, 2: 100, 3: 1000 };

function calcRanking(allRoundsData) {
  const scoreMap = {}; // id → { text, score }
  for (const round of allRoundsData) {
    const weight = ROUND_SCORES[round.roundNumber] ?? 1;
    for (const q of round.questions) {
      if (!scoreMap[q.id]) scoreMap[q.id] = { text: q.text, score: 0 };
      if (q.selected) scoreMap[q.id].score += weight;
    }
  }
  return Object.entries(scoreMap)
    .map(([id, v]) => ({ id: Number(id), text: v.text, score: v.score }))
    .sort((a, b) => b.score - a.score);
}

// ── 결과 화면 컴포넌트 ────────────────────────────────────────
function OlympicsResult({ winner, allRoundsData, navigate }) {
  const MESSAGE = "내가 고른 질문, 다른 친구들도 궁금해했을까요? 친구들이 남긴 의견과 관련 질문들을 보면서 더 깊이 생각해 보세요! 🔍";
  const [scores, setScores] = useState([]);
  const [totalParticipants, setTotalParticipants] = useState(0);

  // 내가 선택한 4개 질문 추출
  // 결승 우승, 결승 준우승, 4강 선택 2개
  const getMyTop4 = () => {
    const result = [];
    // 결승(roundNumber=3)
    const finalRound = allRoundsData.find(r => r.roundNumber === 3);
    if (finalRound) {
      const won = finalRound.questions.find(q => q.selected);
      const lost = finalRound.questions.find(q => !q.selected);
      if (won) result.push({ ...won, label: '🥇 우승' });
      if (lost) result.push({ ...lost, label: '🥈 준우승' });
    }
    // 4강(roundNumber=2) 선택된 것 중 결승 진출자 제외
    const semifinal = allRoundsData.find(r => r.roundNumber === 2);
    if (semifinal) {
      const finalIds = result.map(q => q.id);
      const picked = semifinal.questions.filter(q => q.selected && !finalIds.includes(q.id)).slice(0, 2);
      picked.forEach((q, i) => result.push({ ...q, label: i === 0 ? '🥉 4강' : '4강' }));
    }
    return result;
  };

  const myTop4 = getMyTop4();
  const myIds = myTop4.map(q => q.id);

  useEffect(() => {
    if (myIds.length === 0) return;
    import('../services/api').then(({ default: api }) => {
      api.get(`/olympic/question-scores?ids=${myIds.join(',')}`)
        .then(res => {
          setScores(res.data.scores || []);
          setTotalParticipants(res.data.totalParticipants || 0);
        })
        .catch(() => {});
    });
  }, []);

  const profile = getProfile(winner.subject);

  // 내 질문별 점수 찾기
  const getScore = (id) => scores.find(s => s.questionId === id);

  return (
    <div className="olympics-container">
      <TopHeader icon="🏅" title="질문올림픽" messages={[]} backTo="/main" />
      <div className="olympics-winner">

        {/* 트로피 */}
        <div className="winner-crown">🏆</div>
        <div className="winner-label">나의 최애 질문!</div>

        {/* 우승 질문 */}
        <div className="winner-card">
          <div className="winner-text">{winner.text}</div>
          {winner.hookLine && (
            <div className="winner-hookline">🤔 {winner.hookLine}</div>
          )}
        </div>

        {/* 성향 문구 */}
        <div className="winner-profile-box">
          {profile}
        </div>

        {/* 내 선택 4개 + 순위 */}
        <div className="ranking-section">
          <div className="ranking-title">내가 선택한 질문들</div>
          {totalParticipants > 0 && (
            <div className="ranking-desc">총 {totalParticipants}명 참여 기준</div>
          )}
          <div className="ranking-list">
            {myTop4.map((q) => {
              const s = getScore(q.id);
              return (
                <div key={q.id} className={`ranking-item ${q.id === winner.id ? 'ranking-mine' : ''}`}>
                  <span className="ranking-pos">{q.label}</span>
                  <span className="ranking-text">{q.text}</span>
                  {s && (
                    <span className="ranking-rank">{s.rank}위</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 전광판 애니메이션 */}
        <div className="marquee-box">
          <div className="marquee-track">
            <span className="marquee-text">{MESSAGE}&nbsp;&nbsp;&nbsp;&nbsp;{MESSAGE}</span>
          </div>
        </div>

        {/* 송이 지급 */}
        <div className="winner-sub">올림픽 완주 보상이 지급되었어요 🌸</div>

        {/* 버튼 두 개 나란히 */}
        <div className="winner-btn-row">
          <button className="winner-again-btn" onClick={() => window.location.reload()}>
            🔄 다시 하기
          </button>
          <button className="winner-quiz-btn" onClick={() => navigate('/quiz')}>
            🎯 퀴즈로 가기
          </button>
        </div>

      </div>
      <BottomNav />
    </div>
  );
}

export default QuizOlympics;
