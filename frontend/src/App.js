import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Test from './pages/Test';
import IcebreakingNew from './pages/IcebreakingNew';
import Quiz from './pages/Quiz';
import SavedQuestions from './pages/SavedQuestions';
import Friends from './pages/Friends';
import RelatedQuestion from './pages/RelatedQuestion';
import Setting from './pages/Setting';
import WeeklyReport from './pages/WeeklyReport';
import SongiStatus from './pages/SongiStatus';
import SongiHistory from './pages/SongiHistory';
import { getToken } from './services/api';
import Profile from './pages/Profile';
import Admin from './pages/Admin';
import QuizOlympics from './pages/QuizOlympics';
import MonthlyReport from './pages/MonthlyReport';
import SessionTracker from './components/SessionTracker';
import Notifications from './pages/Notifications';

// 보호된 라우트 컴포넌트
function ProtectedRoute({ children }) {
    const token = getToken();
    return token ? children : <Navigate to="/login" />;
}

function App() {
    return (
        <Router>
            <SessionTracker />
            <Routes>
                <Route path="/login" element={<Login />} />

                {/* /main은 질문쓰기로 리디렉션 (Main 페이지 제거) */}
                <Route path="/main" element={<Navigate to="/create" />} />

                <Route path="/create" element={<ProtectedRoute><Test /></ProtectedRoute>} />
                <Route path="/icebreaking" element={<ProtectedRoute><IcebreakingNew /></ProtectedRoute>} />
                <Route path="/olympic" element={<ProtectedRoute><QuizOlympics /></ProtectedRoute>} />
                <Route path="/quiz" element={<ProtectedRoute><Quiz /></ProtectedRoute>} />
                <Route path="/saved" element={<ProtectedRoute><SavedQuestions /></ProtectedRoute>} />
                <Route path="/questions" element={<ProtectedRoute><Friends /></ProtectedRoute>} />
                <Route path="/create-related" element={<ProtectedRoute><RelatedQuestion /></ProtectedRoute>} />
                <Route path="/setting" element={<ProtectedRoute><Setting /></ProtectedRoute>} />
                <Route path="/weekly-report" element={<ProtectedRoute><WeeklyReport /></ProtectedRoute>} />
                <Route path="/monthly-report" element={<ProtectedRoute><MonthlyReport /></ProtectedRoute>} />
                <Route path="/songi-status" element={<ProtectedRoute><SongiStatus /></ProtectedRoute>} />
                <Route path="/songi-history" element={<ProtectedRoute><SongiHistory /></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                <Route path="/notifications" element={<ProtectedRoute><Notifications /></ProtectedRoute>} />

                <Route path="/" element={<Navigate to="/login" />} />
                <Route path="*" element={
                    <div style={{ padding: '40px', textAlign: 'center' }}>
                        <h2>없는 페이지예요 🌱</h2>
                        <p>주소를 확인해주세요</p>
                        <button
                            onClick={() => window.location.href = '/create'}
                            style={{
                                padding: '10px 20px',
                                background: '#87CEEB',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                fontSize: '16px',
                                marginTop: '20px'
                            }}
                        >
                            메인으로 돌아가기
                        </button>
                    </div>
                } />
            </Routes>
        </Router>
    );
}

export default App;
