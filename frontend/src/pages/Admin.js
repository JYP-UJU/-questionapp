import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';

// CSV 다운로드 함수 (wide format)
function downloadExcel(activities) {
  const TYPE_CODE = {
    question: 'QST',
    related: 'REL',
    opinion: 'OPN',
    reaction_like: 'LIK',
    reaction_dislike: 'DIS',
    quiz: 'QIZ'
  };

  const headers = [
    '날짜', '사용자', '유형', '질문ID', '원본질문',
    'QST', 'REL', 'OPN', 'LIK', 'DIS',
    'QIZ_선택', 'QIZ_정답', 'QIZ_정오'
  ];

  const rows = activities.map(a => {
    const date = new Date(a.created_at);
    const dateStr = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')} ${String(date.getHours()).padStart(2,'0')}:${String(date.getMinutes()).padStart(2,'0')}`;

    // 유형 코드 결정
    let typeCode = '';
    if (a.activity_type === 'reaction') {
      typeCode = a.content === '관심있음' ? 'LIK' : 'DIS';
    } else {
      typeCode = TYPE_CODE[a.activity_type] || a.activity_type;
    }

    // 퀴즈 파싱 ("정답|선택|정답번호" 형식)
    let qizSelected = '', qizAnswer = '', qizCorrect = '';
    if (a.activity_type === 'quiz' && a.content) {
      const parts = a.content.split('|');
      qizCorrect = parts[0] === '정답' ? 'Y' : 'N';
      qizSelected = parts[1] || '';
      qizAnswer = parts[2] || '';
    }

    return [
      dateStr,
      a.username,
      typeCode,
      a.question_ref || '',
      a.question_text || '',
      typeCode === 'QST' ? (a.content || '') : '',
      typeCode === 'REL' ? (a.content || '') : '',
      typeCode === 'OPN' ? (a.content || '') : '',
      typeCode === 'LIK' ? '1' : '',
      typeCode === 'DIS' ? '1' : '',
      qizSelected,
      qizAnswer,
      qizCorrect
    ];
  });

  const csvContent = [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const now = new Date();
  const ts = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}${String(now.getHours()).padStart(2,'0')}${String(now.getMinutes()).padStart(2,'0')}`;
  link.download = `question${ts}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}



const ACTIVITY_LABELS = {
  all: '전체',
  question: '만든 질문',
  related: '관련질문',
  opinion: '의견',
  reaction: '관심표시',
  quiz: '퀴즈'
};

const ACTIVITY_COLORS = {
  question: '#6b84c4',
  related: '#3bb36e',
  opinion: '#f5a623',
  reaction: '#e87c7c',
  quiz: '#9b6fc4'
};

function Admin() {
  const navigate = useNavigate();
  const [tab, setTab] = useState('activities'); // 'activities' | 'users'
  const [activities, setActivities] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // 필터
  const [typeFilter, setTypeFilter] = useState('all');
  const [userFilter, setUserFilter] = useState('');
  const [order, setOrder] = useState('desc');
  const [selectedUser, setSelectedUser] = useState(null);

  // 송이 회수 모달
  const [deductModal, setDeductModal] = useState(null); // { userId, username }
  const [deductAmount, setDeductAmount] = useState('');
  const [deductReason, setDeductReason] = useState('');


  const loadActivities = useCallback(async () => {
    setLoading(true);
    try {
      const params = { type: typeFilter, order };
      if (selectedUser) params.user_id = selectedUser.id;
      const res = await api.get('/admin/activities', { params });
      setActivities(res.data.activities || []);
    } catch (err) {
      if (err.response?.status === 403) {
        alert('관리자 권한이 없어요');
        navigate('/setting');
      }
    } finally {
      setLoading(false);
    }
  }, [typeFilter, order, selectedUser]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/users');
      setUsers(res.data.users || []);
    } catch (err) {
      if (err.response?.status === 403) {
        alert('관리자 권한이 없어요');
        navigate('/setting');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'activities') loadActivities();
    else loadUsers();
  }, [tab, loadActivities, loadUsers]);

  const handleDelete = async (type, id) => {
    if (!window.confirm('이 항목을 삭제할까요?')) return;
    try {
      await api.delete('/admin/activity', { params: { type, id } });
      setActivities(prev => prev.filter(a => !(a.id === id && a.activity_type === type)));
    } catch (err) {
      alert('삭제 실패');
    }
  };

  const handleDeduct = async () => {
    if (!deductAmount || isNaN(deductAmount) || parseInt(deductAmount) <= 0) {
      alert('올바른 송이 수를 입력해주세요');
      return;
    }
    try {
      await api.post('/admin/deduct-songi', {
        userId: deductModal.userId,
        amount: parseInt(deductAmount),
        reason: deductReason || '관리자 회수'
      });
      alert(`${deductAmount}송이 회수 완료`);
      setDeductModal(null);
      setDeductAmount('');
      setDeductReason('');
      loadUsers();
    } catch (err) {
      alert('회수 실패');
    }
  };

  const formatDate = (d) => {
    if (!d) return '-';
    const dt = new Date(d);
    return `${dt.getMonth()+1}/${dt.getDate()} ${dt.getHours().toString().padStart(2,'0')}:${dt.getMinutes().toString().padStart(2,'0')}`;
  };

  const filteredUsers = users.filter(u =>
    u.username.toLowerCase().includes(userFilter.toLowerCase())
  );

  return (
    <div style={styles.container}>
      {/* 헤더 */}
      <div style={styles.header}>
        <button style={styles.backBtn} onClick={() => navigate('/setting')}>← 설정</button>
        <h1 style={styles.title}>🔧 관리자</h1>
        <button style={styles.downloadBtn} onClick={() => downloadExcel(activities)}>⬇ CSV</button>
      </div>

      {/* 탭 */}
      <div style={styles.tabs}>
        <button style={{...styles.tab, ...(tab === 'activities' ? styles.tabActive : {})}}
          onClick={() => setTab('activities')}>활동 피드</button>
        <button style={{...styles.tab, ...(tab === 'users' ? styles.tabActive : {})}}
          onClick={() => setTab('users')}>사용자 목록</button>
      </div>

      {/* ===== 활동 피드 탭 ===== */}
      {tab === 'activities' && (
        <div>
          {/* 필터 바 */}
          <div style={styles.filterBar}>
            {/* 활동 타입 */}
            <div style={styles.filterRow}>
              {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
                <button key={key}
                  style={{...styles.filterBtn, ...(typeFilter === key ? styles.filterBtnActive : {})}}
                  onClick={() => setTypeFilter(key)}>
                  {label}
                </button>
              ))}
            </div>

            {/* 사용자 필터 + 정렬 */}
            <div style={styles.filterRow2}>
              <select style={styles.select}
                value={selectedUser?.id || ''}
                onChange={e => {
                  const u = users.find(u => u.id === parseInt(e.target.value));
                  setSelectedUser(u || null);
                }}>
                <option value=''>전체 사용자</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.username}</option>
                ))}
              </select>
              <select style={styles.select} value={order} onChange={e => setOrder(e.target.value)}>
                <option value='desc'>최신순</option>
                <option value='asc'>오래된순</option>
              </select>
              <button style={styles.applyBtn} onClick={loadActivities}>조회</button>
            </div>
          </div>

          {/* 활동 목록 */}
          {loading ? (
            <div style={styles.loading}>로딩 중...</div>
          ) : (
            <div style={styles.list}>
              {activities.length === 0 && <div style={styles.empty}>활동 내역이 없어요</div>}
              {activities.map((a, i) => (
                <div key={i} style={styles.activityItem}>
                  <div style={{...styles.activityBadge, background: ACTIVITY_COLORS[a.activity_type] || '#999'}}>
                    {ACTIVITY_LABELS[a.activity_type] || a.activity_type}
                  </div>
                  <div style={styles.activityBody}>
                    <div style={styles.activityUser}>{a.username}</div>
                    {a.question_text && (
                      <div style={styles.activityQuestion}>💬 {a.question_text}</div>
                    )}
                  <div style={styles.activityContent}>
                    {a.activity_type === 'quiz' && a.content
                      ? (() => {
                          const parts = a.content.split('|');
                          return `${parts[0] === '정답' ? '✓' : '✗'} 선택: ${parts[1] || '-'} / 정답: ${parts[2] || '-'}`;
                        })()
                      : a.content}
                  </div>
                    <div style={styles.activityDate}>{formatDate(a.created_at)}</div>
                  </div>
                  <button style={styles.deleteBtn}
                    onClick={() => handleDelete(a.activity_type, a.id)}>삭제</button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===== 사용자 목록 탭 ===== */}
      {tab === 'users' && (
        <div>
          <div style={styles.filterBar}>
            <input
              style={styles.searchInput}
              placeholder="닉네임 검색..."
              value={userFilter}
              onChange={e => setUserFilter(e.target.value)}
            />
          </div>

          {loading ? (
            <div style={styles.loading}>로딩 중...</div>
          ) : (
            <div style={styles.list}>
              {filteredUsers.map(u => (
                <div key={u.id} style={styles.userItem}>
                  <div style={styles.userTop}>
                    <div style={styles.userName}>
                      {u.username}
                      {u.is_admin && <span style={styles.adminBadge}>관리자</span>}
                    </div>
                    <div style={styles.userSongi}>🌸 {u.songi_count}송이</div>
                  </div>
                  <div style={styles.userStats}>
                    <span>질문 {u.question_count}</span>
                    <span>관련 {u.related_count}</span>
                    <span>의견 {u.opinion_count}</span>
                    <span>관심 {u.reaction_count}</span>
                    <span>퀴즈 {u.quiz_count}</span>
                  </div>
                  <div style={styles.userBottom}>
                    <span style={styles.userDate}>가입 {formatDate(u.created_at)}</span>
                    <div style={styles.userActions}>
                      <button style={styles.feedBtn}
                        onClick={() => {
                          setSelectedUser(u);
                          setTab('activities');
                        }}>활동 보기</button>
                      {!u.is_admin && (
                        <button style={styles.deductBtn}
                          onClick={() => setDeductModal({ userId: u.id, username: u.username })}>
                          송이 회수
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 송이 회수 모달 */}
      {deductModal && (
        <div style={styles.overlay} onClick={() => setDeductModal(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={{margin: '0 0 16px', fontSize: 16}}>🌸 송이 회수 — {deductModal.username}</h3>
            <input style={styles.modalInput} type="number" min="1"
              placeholder="회수할 송이 수"
              value={deductAmount} onChange={e => setDeductAmount(e.target.value)} />
            <input style={styles.modalInput} type="text"
              placeholder="사유 (선택)"
              value={deductReason} onChange={e => setDeductReason(e.target.value)} />
            <div style={{display:'flex', gap:8, marginTop:4}}>
              <button style={styles.cancelBtn} onClick={() => setDeductModal(null)}>취소</button>
              <button style={styles.confirmBtn} onClick={handleDeduct}>회수하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { maxWidth: 480, margin: '0 auto', minHeight: '100vh', background: '#f8f9ff', paddingBottom: 40 },
  header: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'white', borderBottom: '1px solid #eee', position: 'sticky', top: 0, zIndex: 10 },
  title: { fontSize: 17, fontWeight: 700, margin: 0, color: '#1a1a2e' },
  backBtn: { background: 'none', border: 'none', color: '#6b84c4', fontSize: 14, cursor: 'pointer' },
  downloadBtn: { background: '#6b84c4', color: 'white', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 13, cursor: 'pointer', fontWeight: 600 },
  tabs: { display: 'flex', background: 'white', borderBottom: '1px solid #eee' },
  tab: { flex: 1, padding: '12px', background: 'none', border: 'none', fontSize: 14, cursor: 'pointer', color: '#888', fontWeight: 500 },
  tabActive: { color: '#6b84c4', borderBottom: '2px solid #6b84c4', fontWeight: 700 },
  filterBar: { padding: '12px 16px', background: 'white', borderBottom: '1px solid #f0f0f0' },
  filterRow: { display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 },
  filterRow2: { display: 'flex', gap: 8, alignItems: 'center' },
  filterBtn: { padding: '4px 10px', borderRadius: 20, border: '1px solid #ddd', background: 'white', fontSize: 12, cursor: 'pointer', color: '#666' },
  filterBtnActive: { background: '#6b84c4', color: 'white', borderColor: '#6b84c4' },
  select: { flex: 1, padding: '6px 8px', borderRadius: 8, border: '1px solid #ddd', fontSize: 13, background: 'white' },
  applyBtn: { padding: '6px 14px', background: '#6b84c4', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, cursor: 'pointer', whiteSpace: 'nowrap' },
  searchInput: { width: '100%', padding: '8px 12px', borderRadius: 8, border: '1px solid #ddd', fontSize: 14, boxSizing: 'border-box' },
  list: { padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 },
  loading: { textAlign: 'center', padding: 40, color: '#aaa', fontSize: 14 },
  empty: { textAlign: 'center', padding: 40, color: '#aaa', fontSize: 14 },

  // 활동 아이템
  activityItem: { background: 'white', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'flex-start', gap: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  activityBadge: { color: 'white', fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 10, whiteSpace: 'nowrap', marginTop: 2 },
  activityBody: { flex: 1, minWidth: 0 },
  activityUser: { fontSize: 12, fontWeight: 700, color: '#6b84c4', marginBottom: 3 },
  activityQuestion: { fontSize: 11, color: '#888', marginBottom: 4, fontStyle: 'italic', background: '#f5f5f5', padding: '3px 7px', borderRadius: 6, display: 'inline-block' },
  activityContent: { fontSize: 13, color: '#333', lineHeight: 1.4, wordBreak: 'break-all' },
  activityDate: { fontSize: 11, color: '#aaa', marginTop: 4 },
  deleteBtn: { background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 },

  // 사용자 아이템
  userItem: { background: 'white', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  userTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  userName: { fontSize: 15, fontWeight: 700, color: '#1a1a2e', display: 'flex', alignItems: 'center', gap: 6 },
  adminBadge: { background: '#6b84c4', color: 'white', fontSize: 10, padding: '2px 7px', borderRadius: 10 },
  userSongi: { fontSize: 13, color: '#6b84c4', fontWeight: 600 },
  userStats: { display: 'flex', gap: 10, fontSize: 12, color: '#888', marginBottom: 10 },
  userBottom: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  userDate: { fontSize: 11, color: '#bbb' },
  userActions: { display: 'flex', gap: 6 },
  feedBtn: { background: '#eff3ff', color: '#6b84c4', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 },
  deductBtn: { background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 12, cursor: 'pointer', fontWeight: 600 },

  // 모달
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 },
  modal: { background: 'white', borderRadius: 16, padding: 24, width: '100%', maxWidth: 320 },
  modalInput: { width: '100%', padding: '10px 12px', border: '1.5px solid #e5e7eb', borderRadius: 8, fontSize: 14, boxSizing: 'border-box', marginBottom: 10, fontFamily: 'inherit', outline: 'none' },
  cancelBtn: { flex: 1, padding: 10, background: '#f3f4f6', border: 'none', borderRadius: 8, fontSize: 14, cursor: 'pointer', color: '#666' },
  confirmBtn: { flex: 1, padding: 10, background: '#dc2626', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: 'white' },
};

export default Admin;
