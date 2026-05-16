import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import './QuizOlympics.css';
import BottomNav from '../components/BottomNav';
import TopHeader from '../components/TopHeader';

// ── 155개 질문 (물화생지 × 수렴/발산) ──────────────────────────
// 추후 검수 완료 후 교체 예정. 현재는 샘플 데이터.
const ALL_QUESTIONS = [
  // 물리-수렴
  { id:1,  text:"녹음한 목소리는 왜 내 목소리와 달라요?",                         subject:"물리", type:"수렴" },
  { id:2,  text:"마이크는 어떻게 소리를 크게 만들어요?",                           subject:"물리", type:"수렴" },
  { id:3,  text:"물속에서 소리가 다르게 들려요?",                                   subject:"물리", type:"수렴" },
  { id:4,  text:"층간 소음이 어디서 오는 걸까요?",                                  subject:"물리", type:"수렴" },
  { id:5,  text:"동전은 금속인데 왜 자석에 안 붙어요?",                             subject:"물리", type:"수렴" },
  { id:7,  text:"나침반 바늘이 철인지 자석인지 어떻게 확인할 수 있어요?",           subject:"물리", type:"수렴" },
  { id:8,  text:"달은 크기가 변하지 않는데 왜 어떤 날은 더 크게 보일까요?",        subject:"물리", type:"수렴" },
  { id:9,  text:"지구에서 강력한 레이저를 쏘면 달까지 갈 수 있을까요?",            subject:"물리", type:"수렴" },
  { id:10, text:"왜 거울 속 모습은 좌우가 바뀌어 보여요?",                          subject:"물리", type:"수렴" },
  { id:12, text:"누가 온도계를 만들었어요?",                                         subject:"물리", type:"수렴" },
  { id:13, text:"100℃ 물과 0℃ 물을 섞으면 몇 ℃가 될까요?",                       subject:"물리", type:"수렴" },
  { id:14, text:"보온병 안에 은이 들어 있어요?",                                    subject:"물리", type:"수렴" },
  { id:16, text:"KTX와 치타 중에 누가 더 빠를까요?",                                subject:"물리", type:"수렴" },
  { id:17, text:"안전띠는 어떻게 갑작스러운 속도변화를 알아차리고 당겨질까요?",    subject:"물리", type:"수렴" },
  { id:18, text:"끓는 기름에 쇳물을 부으면 어떻게 될까요?",                        subject:"물리", type:"수렴" },
  { id:20, text:"자석을 전등처럼 껐다 켰다 할 수 있어요?",                          subject:"물리", type:"수렴" },
  { id:21, text:"풍력발전 바람개비는 천천히 도는데 어떻게 전기를 모아요?",         subject:"물리", type:"수렴" },
  { id:23, text:"습도가 낮으면 컵 옆면에 이슬이 맺히지 않을까요?",                 subject:"물리", type:"수렴" },
  { id:29, text:"물은 투명한데 김은 왜 하얗게 보여요?",                             subject:"물리", type:"수렴" },
  { id:31, text:"고기압·저기압일 때 측정한 무게에 차이가 없는 이유?",              subject:"물리", type:"수렴" },
  { id:32, text:"헬륨 풍선을 놓치면 우주까지 날아갈까요?",                          subject:"물리", type:"수렴" },
  { id:33, text:"열기구는 얼마나 높이 올라갈 수 있을까요?",                         subject:"물리", type:"수렴" },
  { id:35, text:"우주에 진공청소기를 들고 가면 작동 안 하나요?",                   subject:"물리", type:"수렴" },
  { id:38, text:"바닷물에서 스티로폼이 버틸 무게는 어떻게 계산해요?",              subject:"물리", type:"수렴" },
  { id:89, text:"바닷속에서도 전화통화를 할 수 있을까요?",                          subject:"물리", type:"수렴" },
  { id:108,text:"안개로 손을 씻을 수 있을까요?",                                    subject:"물리", type:"수렴" },
  { id:117,text:"왜 무거운 물체를 움직이는 게 더 힘든가요?",                       subject:"물리", type:"수렴" },
  { id:119,text:"비행기의 빵봉투는 왜 빵빵하게 부풀어 오를까요?",                  subject:"물리", type:"수렴" },
  { id:124,text:"같은 냉동고에 있는 얼음과 아이스크림 온도가 다를까요?",           subject:"물리", type:"수렴" },
  { id:129,text:"비눗방울이나 기름막은 어떻게 불규칙한 무지개색을 보일까요?",     subject:"물리", type:"수렴" },
  // 물리-발산
  { id:6,  text:"자석은 아무리 작게 잘라도 N극과 S극으로 구분되나요?",             subject:"물리", type:"발산" },
  { id:11, text:"거울이 실제와 얼마나 다른지 어떻게 확인해요?",                    subject:"물리", type:"발산" },
  // 화학-수렴
  { id:15, text:"광부가 캐는 금은 어떤 형태에요?",                                  subject:"화학", type:"수렴" },
  { id:22, text:"우유를 구성성분으로 분리할 수 있어요?",                            subject:"화학", type:"수렴" },
  { id:24, text:"드라이아이스 옆의 허연 김은 수증기에요 이산화탄소에요?",          subject:"화학", type:"수렴" },
  { id:25, text:"유리는 기체가 될 수도 있어요?",                                    subject:"화학", type:"수렴" },
  { id:26, text:"연필심으로 다이아몬드를 만들 수 있어요?",                          subject:"화학", type:"수렴" },
  { id:27, text:"물이 항상 100도에서 끓어요?",                                      subject:"화학", type:"수렴" },
  { id:28, text:"물을 그냥 두면 왜 허옇게 남으면서 말라요?",                       subject:"화학", type:"수렴" },
  { id:34, text:"과자 봉지 안에 왜 질소를 넣어요?",                                 subject:"화학", type:"수렴" },
  { id:36, text:"설탕과 소금 중 물에 더 많이 녹는 건?",                             subject:"화학", type:"수렴" },
  { id:37, text:"설탕은 어떻게 솜사탕도 되고 탕후루 코팅도 되나요?",               subject:"화학", type:"수렴" },
  { id:39, text:"콜라의 톡 쏘는 맛이 여름·겨울에 다를까요?",                       subject:"화학", type:"수렴" },
  { id:42, text:"우유는 어떻게 치즈가 되요?",                                       subject:"화학", type:"수렴" },
  { id:43, text:"재활용 플라스틱은 어떻게 분류하나요?",                             subject:"화학", type:"수렴" },
  { id:44, text:"바닷물을 천일 동안 말리면 천일염이 되나요?",                      subject:"화학", type:"수렴" },
  { id:45, text:"산성은 다 셔요?",                                                   subject:"화학", type:"수렴" },
  { id:46, text:"염기성과 산성을 어떻게 구분하나요?",                               subject:"화학", type:"수렴" },
  { id:47, text:"염기성 치약은 어떻게 이빨 닦는데 도움이 되요?",                   subject:"화학", type:"수렴" },
  { id:49, text:"불에 타면 왜 모두 까맣게 될까요?",                                 subject:"화학", type:"수렴" },
  { id:50, text:"플라스틱 타는 냄새 나는 곳에 있으면 몸에 안 좋을까요?",           subject:"화학", type:"수렴" },
  { id:51, text:"플라스틱이 썩고 있다는 건 어떻게 변하는 거예요?",                 subject:"화학", type:"수렴" },
  { id:85, text:"바닷물을 마시는 물로 정수할 수 있을까요?",                         subject:"화학", type:"수렴" },
  { id:120,text:"왜 핫초코는 불투명하고 콜라는 투명해요?",                          subject:"화학", type:"수렴" },
  { id:126,text:"젤리는 어떻게 말랑말랑해요?",                                      subject:"화학", type:"수렴" },
  { id:136,text:"탈취제는 어떻게 냄새를 없앨까요?",                                 subject:"화학", type:"수렴" },
  { id:140,text:"설탕은 썩지 않나요? 유효기간이 있나요?",                           subject:"화학", type:"수렴" },
  { id:150,text:"새우와 게를 삶으면 왜 빨갛게 변할까요?",                           subject:"화학", type:"수렴" },
  // 화학-발산
  { id:48, text:"세상에서 가장 강한 산이 있어요?",                                  subject:"화학", type:"발산" },
  { id:52, text:"100년도 못 사는 인간이 300년 걸려 썩는다는 걸 어떻게 알아요?",   subject:"화학", type:"발산" },
  // 생물-수렴
  { id:40, text:"숨쉴 때 이산화탄소와 질소도 몸으로 들어가나요?",                  subject:"생물", type:"수렴" },
  { id:56, text:"숫사자 갈기는 음식 먹을 때 불편하지 않을까요?",                   subject:"생물", type:"수렴" },
  { id:58, text:"공포영화 후 어두운 곳이 더 무서운 이유?",                          subject:"생물", type:"수렴" },
  { id:59, text:"다육이도 줄기 속에 물이 가득한가요?",                              subject:"생물", type:"수렴" },
  { id:60, text:"매미 애벌레는 성충으로 한 달만 살다 죽나요?",                     subject:"생물", type:"수렴" },
  { id:62, text:"성별에 영향을 주는 환경조건이 있을까요?",                          subject:"생물", type:"수렴" },
  { id:63, text:"작은 씨앗들이 어떻게 크게 자랄 수 있을까요?",                    subject:"생물", type:"수렴" },
  { id:64, text:"대나무는 정말 꽃이 피면 죽어요?",                                  subject:"생물", type:"수렴" },
  { id:65, text:"청국장을 먹으면 방귀 냄새도 고약할까요?",                          subject:"생물", type:"수렴" },
  { id:67, text:"버섯은 기생생물이에요?",                                            subject:"생물", type:"수렴" },
  { id:68, text:"꿀벌은 흰색·검은색 물체에 공격성 차이를 보일까요?",               subject:"생물", type:"수렴" },
  { id:69, text:"모기가 더 선호하는 사람이 따로 있을까요?",                         subject:"생물", type:"수렴" },
  { id:71, text:"멸종위기종의 숫자를 어떻게 세요?",                                 subject:"생물", type:"수렴" },
  { id:72, text:"파리는 육식이에요 채식이에요?",                                    subject:"생물", type:"수렴" },
  { id:73, text:"손가락은 어떻게 움직이는 걸까요?",                                 subject:"생물", type:"수렴" },
  { id:75, text:"밥을 빨리 먹으면 밥을 더 많이 먹나요?",                            subject:"생물", type:"수렴" },
  { id:76, text:"피가 말단에 도착하면 사라질까요 다시 혈관으로 갈까요?",           subject:"생물", type:"수렴" },
  { id:77, text:"마취는 감각세포를 속이는 거에요?",                                 subject:"생물", type:"수렴" },
  { id:78, text:"소는 풀만 먹는데 어떻게 근육이 많이 생길 수 있어요?",             subject:"생물", type:"수렴" },
  { id:82, text:"백신 맞은 후 바로 병원균에 감염되면 어떻게 될까요?",              subject:"생물", type:"수렴" },
  { id:84, text:"세균을 키우는 직업이 있다고요? 세균을 왜 키워요?",                subject:"생물", type:"수렴" },
  { id:88, text:"바퀴벌레는 핵폭발에도 생존할 수 있을까요?",                       subject:"생물", type:"수렴" },
  { id:92, text:"달팽이 껍질은 달팽이가 만드는 거예요?",                            subject:"생물", type:"수렴" },
  { id:121,text:"땅에 닿지 않는 겨우살이는 어떻게 살아요?",                        subject:"생물", type:"수렴" },
  { id:131,text:"연습하면 매운 음식을 더 잘 먹을 수 있어요?",                      subject:"생물", type:"수렴" },
  { id:132,text:"바나나가 익으면 껍질에 왜 검은 반점이 생길까?",                   subject:"생물", type:"수렴" },
  { id:137,text:"반딧불이는 어떻게 빛을 낼까요?",                                   subject:"생물", type:"수렴" },
  { id:139,text:"어른이 되면 왜 키가 자라지 않을까?",                               subject:"생물", type:"수렴" },
  { id:141,text:"모기에게 물리고 나면 왜 가려울까?",                                subject:"생물", type:"수렴" },
  { id:144,text:"거미는 거미줄에 걸리지 않을까?",                                   subject:"생물", type:"수렴" },
  { id:145,text:"심장은 항상 박동하는데 근육통이 없을까?",                          subject:"생물", type:"수렴" },
  { id:149,text:"박쥐는 거꾸로 매달려 있어도 어지럽지 않을까?",                    subject:"생물", type:"수렴" },
  { id:151,text:"긴장하면 왜 심장이 두근거릴까?",                                   subject:"생물", type:"수렴" },
  { id:153,text:"게임을 오래하면 눈이 나빠질까?",                                   subject:"생물", type:"수렴" },
  // 생물-발산
  { id:53, text:"지하철은 두더지를 본따 만든 걸까요?",                              subject:"생물", type:"발산" },
  { id:54, text:"헬리콥터는 단풍나무 열매를 본따 만든 걸까요?",                    subject:"생물", type:"발산" },
  { id:55, text:"비행기는 새를 본따 만든 걸까요?",                                  subject:"생물", type:"발산" },
  { id:57, text:"딸기는 과일이 아니에요? 과일 구분 방법은?",                        subject:"생물", type:"발산" },
  { id:70, text:"모기가 모두 없어져도 문제가 될까요?",                              subject:"생물", type:"발산" },
  { id:83, text:"인간도 변이되어서 코로나에 안 걸릴 수는 없어요?",                 subject:"생물", type:"발산" },
  { id:154,text:"어린이는 왜 술을 마시면 안될까?",                                  subject:"생물", type:"발산" },
  // 지학-수렴
  { id:41, text:"섬은 바닷물이 많은데 왜 물이 부족해요?",                           subject:"지학", type:"수렴" },
  { id:86, text:"왜 강물은 짜지 않아요?",                                            subject:"지학", type:"수렴" },
  { id:90, text:"행성들은 어떻게 궤도를 지키면서 돌아요?",                          subject:"지학", type:"수렴" },
  { id:91, text:"서해와 동해 바닷물의 짠 정도가 달라요?",                           subject:"지학", type:"수렴" },
  { id:94, text:"바닷속에 햇빛은 어디까지 들어갈 수 있나요?",                      subject:"지학", type:"수렴" },
  { id:95, text:"바다에서 파도 높이의 차이는 왜 생기나요?",                         subject:"지학", type:"수렴" },
  { id:96, text:"화산이 폭발하면 뭉뚝해질까요 뾰족해질까요?",                      subject:"지학", type:"수렴" },
  { id:97, text:"제주도 현무암은 어떻게 구멍이 숭숭 뚫렸을까요?",                  subject:"지학", type:"수렴" },
  { id:99, text:"달에도 육지와 바다가 있을까요?",                                   subject:"지학", type:"수렴" },
  { id:101,text:"일식과 월식이 동시에 일어날 수는 없을까요?",                      subject:"지학", type:"수렴" },
  { id:102,text:"유성우가 떨어지는 확률을 계산할 수 있나요?",                      subject:"지학", type:"수렴" },
  { id:104,text:"돌은 어떻게 생기나요?",                                             subject:"지학", type:"수렴" },
  { id:106,text:"공룡과 사람이 한 번도 만난 적 없다고요?",                          subject:"지학", type:"수렴" },
  { id:107,text:"내 발자국을 화석으로 보존할 수 있을까요?",                         subject:"지학", type:"수렴" },
  { id:109,text:"기분이 안 좋을 때 저기압이라고 하는 게 기압이랑 관련이 있어요?", subject:"지학", type:"수렴" },
  { id:110,text:"도시에서 별을 보기 어려운 이유는?",                                subject:"지학", type:"수렴" },
  { id:113,text:"계절은 어떻게 생길까요?",                                           subject:"지학", type:"수렴" },
  { id:114,text:"대한민국과 계절이 반대인 나라가 있을까요?",                        subject:"지학", type:"수렴" },
  { id:115,text:"기후 변화 때문에 날씨가 변하고 있다고요?",                         subject:"지학", type:"수렴" },
  { id:118,text:"영하의 온도 개념을 처음 제시한 과학자는?",                         subject:"지학", type:"수렴" },
  { id:122,text:"세계 어느 곳에서도 북두칠성을 볼 수 있어요?",                     subject:"지학", type:"수렴" },
  { id:123,text:"별은 별모양이에요 동그란 모양이에요?",                             subject:"지학", type:"수렴" },
  { id:127,text:"해가 나는데도 비가 올 수도 있어요?",                               subject:"지학", type:"수렴" },
  { id:128,text:"별이 계절에 따라 더 잘 보일 수도 있어요?",                         subject:"지학", type:"수렴" },
  { id:135,text:"우리나라 최초의 인공위성은 무엇일까?",                             subject:"지학", type:"수렴" },
  { id:147,text:"우리나라에서는 왜 오로라를 볼 수 없을까?",                         subject:"지학", type:"수렴" },
  // 지학-발산
  { id:87, text:"바닷물의 짠맛은 어디서 나오는 거예요? 무한한 거예요?",            subject:"지학", type:"발산" },
  { id:100,text:"명왕성은 태양계 행성에서 왜 빠졌나요?",                            subject:"지학", type:"발산" },
  { id:103,text:"왜 태양계에서 지구에만 바다가 있나요?",                            subject:"지학", type:"발산" },
  { id:105,text:"지구상의 돌의 개수는 무한대일까요?",                               subject:"지학", type:"발산" },
  { id:111,text:"날짜변경선 방향으로 이동하면 나이를 안 먹을 수 있을까요?",        subject:"지학", type:"발산" },
  { id:116,text:"인간이 없으면 지구온난화가 발생하지 않았을까요?",                 subject:"지학", type:"발산" },
  { id:125,text:"하늘과 우주를 나누는 경계는 어디일까요?",                          subject:"지학", type:"발산" },
  { id:130,text:"땅을 계속 파면 지구 중심에 도착할 수 있을까요?",                  subject:"지학", type:"발산" },
  { id:152,text:"외계인이 있을까?",                                                  subject:"지학", type:"발산" },
];

// ── 유틸: 8차원에서 각 2개 랜덤 추출 → 16개 ──────────────────
function pickQuestions() {
  const dimensions = [
    { subject:'물리', type:'수렴' },
    { subject:'물리', type:'발산' },
    { subject:'화학', type:'수렴' },
    { subject:'화학', type:'발산' },
    { subject:'생물', type:'수렴' },
    { subject:'생물', type:'발산' },
    { subject:'지학', type:'수렴' },
    { subject:'지학', type:'발산' },
  ];
  let picked = [];
  for (const dim of dimensions) {
    const pool = ALL_QUESTIONS.filter(q => q.subject === dim.subject && q.type === dim.type);
    const shuffled = [...pool].sort(() => Math.random() - 0.5);
    picked.push(...shuffled.slice(0, 2));
  }
  return picked.sort(() => Math.random() - 0.5);
}

// ── 토너먼트 브래킷 생성 ──────────────────────────────────────
function makeBracket(questions) {
  const pairs = [];
  for (let i = 0; i < 16; i += 2) {
    pairs.push([questions[i], questions[i + 1]]);
  }
  return pairs;
}

const PROFILES = {
  '물리-수렴': '자연의 원리를 파고드는 물리현상 탐구자예요!',
  '물리-발산': '물리의 경계를 넘어 의미를 생각하는 탐구자예요!',
  '화학-수렴': '자연의 원리를 파고드는 화학현상 탐구자예요!',
  '화학-발산': '화학의 경계를 넘어 의미를 생각하는 탐구자예요!',
  '생물-수렴': '자연의 원리를 파고드는 생명현상 탐구자예요!',
  '생물-발산': '생명의 경계를 넘어 의미를 생각하는 탐구자예요!',
  '지학-수렴': '자연의 원리를 파고드는 지구우주 탐구자예요!',
  '지학-발산': '지구우주의 경계를 넘어 의미를 생각하는 탐구자예요!',
};

function getProfile(subject, type) {
  return PROFILES[`${subject}-${type}`] || '과학의 신비를 탐구하는 탐구자예요!';
}

const ROUND_LABELS = { 8: '8강', 4: '4강', 2: '결승' };

function QuizOlympics() {
  const navigate = useNavigate();

  const [rounds, setRounds] = useState(() => [makeBracket(pickQuestions())]);
  const [currentRound, setCurrentRound] = useState(0);
  const [selections, setSelections] = useState({});
  const [finished, setFinished] = useState(false);
  const [winner, setWinner] = useState(null);

  // ── 라운드별 노출/선택 기록 누적 ─────────────────────────────
  // { roundNumber, roundLabel, questions: [{...q, selected}] } 배열
  const [allRoundsData, setAllRoundsData] = useState([]);

  const currentPairs = rounds[currentRound] || [];
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
        winnerType: winnerQ.type,
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
    const token = localStorage.getItem('token');
    fetch(`/api/olympic/question-scores?ids=${myIds.join(',')}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        setScores(data.scores || []);
        setTotalParticipants(data.totalParticipants || 0);
      })
      .catch(() => {});
  }, []);

  const profile = getProfile(winner.subject, winner.type);

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
