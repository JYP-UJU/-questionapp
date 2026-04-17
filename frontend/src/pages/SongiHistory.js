import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import BottomNav from '../components/BottomNav';
import './SongiHistory.css';

const ACTIVITY_LABELS = {
  question:       { label: '질문 작성',     icon: '&#10067;' },
  opinion:        { label: '의견 작성',      icon: '&#128172;' },
  interest:       { label: '관심 표시',      icon: '&#10084;' },
  related:        { label: '관련질문 작성',  icon: '&#128279;' },
  icebreaking:    { label: '질문고르기 완료', icon: '&#127381;' },
  quiz:           { label: '퀴즈 완료',      icon: '&#10067;' },
  weekly_journal: { label: '주간 일지 완료', icon: '&#128211;' },
  monthly_journal:{ label: '월간 일지 완료', icon: '&#128200;' },
  admin_deduct:   { label: '관리자 조정',    icon: '&#9888;' },
};

function groupByDate(transactions) {
  const groups = {};
  transactions.forEach(t => {
    const date = new Date(t.created_at);
    const key = date.toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
    });
    if (!groups[key]) groups[key] = [];
    groups[key].push(t);
  });
  return groups;
}

function SongiHistory() {
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState([]);
  const [totalSongi, setTotalSongi] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadHistory();
  }, []);

  const loadHistory = async () => {
    try {
      const response = await api.get('/users/songi-history');
      setTransactions(response.data.transactions || []);
      setTotalSongi(response.data.total_songi || 0);
    } catch (err) {
      console.error('송이 내역 로드 오류:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="sh-loading">로딩 중...</div>;
  }

  const grouped = groupByDate(transactions);

  return (
    <div className="sh-container">
      <header className="sh-header">
        <button className="sh-back-btn" onClick={() => navigate('/settings')}>&#8592;</button>
        <h1>&#127800; 송이 내역</h1>
        <div style={{ width: 32 }} />
      </header>

      <div className="sh-user-bar">
        <span>누적 {totalSongi}송이</span>
      </div>

      <div className="sh-content">
        {Object.keys(grouped).length === 0 ? (
          <div className="sh-empty">아직 활동 내역이 없어요.</div>
        ) : (
          Object.entries(grouped).map(([date, items]) => (
            <div key={date} className="sh-date-group">
              <div className="sh-date-label">{date}</div>
              {items.map(t => {
                const info = ACTIVITY_LABELS[t.activity_type] || { label: t.activity_type, icon: '&#127800;' };
                const isPlus = t.amount > 0;
                return (
                  <div key={t.id} className="sh-item">
                    <div className="sh-item-left">
                      <span
                        className="sh-icon"
                        dangerouslySetInnerHTML={{ __html: info.icon }}
                      />
                      <div className="sh-item-info">
                        <span className="sh-item-label">{info.label}</span>
                        {t.question_text && (
                          <span className="sh-item-question">{t.question_text}</span>
                        )}
                        {t.description && !t.question_text && (
                          <span className="sh-item-question">{t.description}</span>
                        )}
                      </div>
                    </div>
                    <span className={`sh-amount ${isPlus ? 'plus' : 'minus'}`}>
                      {isPlus ? '+' : ''}{t.amount}
                    </span>
                  </div>
                );
              })}
              <div className="sh-date-total">
                일일 합계: {items.reduce((sum, t) => sum + t.amount, 0)}송이
              </div>
            </div>
          ))
        )}
      </div>

      <BottomNav />
    </div>
  );
}

export default SongiHistory;
