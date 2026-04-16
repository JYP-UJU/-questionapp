import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Main from './pages/Main';
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
import Admin from './pages/Admin';  // 상단 import에
import MonthlyReport from './pages/MonthlyReport';


// 보호된 라우트 컴포넌트
function ProtectedRoute({ children }) {
    const token = getToken();
    return token ? children : <Navigate to="/login" />;
}

function App() {
    return (
        <Router>
            <Routes>
                
// routes 안에:
<Route path="/monthly-report" element={<ProtectedRoute><MonthlyReport /></ProtectedRoute>} />
<Route path="/admin" element={<ProtectedRoute><Admin /></ProtectedRoute>} />
                <Route
    path="/profile"
    element={
        <ProtectedRoute>
            <Profile />
        </ProtectedRoute>
    }
/>
                <Route path="/login" element={<Login />} />
                <Route 
                    path="/main" 
                    element={
                        <ProtectedRoute>
                            <Main />
                        </ProtectedRoute>
                    } 
                />
                <Route 
                    path="/create" 
                    element={
                        <ProtectedRoute>
                            <Test />
                        </ProtectedRoute>
                    } 
                />
                <Route 
                    path="/icebreaking" 
                    element={
                        <ProtectedRoute>
                            <IcebreakingNew />
                        </ProtectedRoute>
                    } 
                />
                <Route 
                    path="/quiz" 
                    element={
                        <ProtectedRoute>
                            <Quiz />
                        </ProtectedRoute>
                    } 
                />
                <Route 
                    path="/saved" 
                    element={
                        <ProtectedRoute>
                            <SavedQuestions />
                        </ProtectedRoute>
                    } 
                />
                <Route 
                    path="/questions" 
                    element={
                        <ProtectedRoute>
                           <Friends />
                        </ProtectedRoute>
                    } 
                />
                <Route 
                    path="/create-related" 
                    element={
                        <ProtectedRoute>
                            <RelatedQuestion />
                        </ProtectedRoute>
                    } 
                />
                <Route 
                    path="/setting" 
                    element={
                        <ProtectedRoute>
                            <Setting />
                        </ProtectedRoute>
                    } 
                />
                <Route 
    path="/songi-status" 
    element={
        <ProtectedRoute>
            <SongiStatus />
        </ProtectedRoute>
    } 
/>
<Route 
    path="/songi-history" 
    element={
        <ProtectedRoute>
            <SongiHistory />
        </ProtectedRoute>
    } 
/>
                <Route 
                    path="/weekly-report" 
                    element={
                        <ProtectedRoute>
                            <WeeklyReport />
                        </ProtectedRoute>
                    } 
                />
                <Route path="/" element={<Navigate to="/login" />} />
                <Route path="*" element={<div style={{padding: '40px', textAlign: 'center'}}>
                    <h2>🚧 페이지 준비 중...</h2>
                    <p>곧 완성될 예정입니다!</p>
                    <button onClick={() => window.location.href = '/main'} style={{
                        padding: '10px 20px',
                        background: '#87CEEB',
                        color: 'white',
                        border: 'none',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '16px',
                        marginTop: '20px'
                    }}>
                        메인으로 돌아가기
                    </button>
                </div>} />
            </Routes>
        </Router>
    );
}

export default App;