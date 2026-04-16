import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Main from './pages/Main';
import Test from './pages/Test';
import Icebreaking from './pages/Icebreaking';
import Quiz from './pages/Quiz';
import { getToken } from './services/api';

// 보호된 라우트 컴포넌트
function ProtectedRoute({ children }) {
    const token = getToken();
    return token ? children : <Navigate to="/login" />;
}

function App() {
    return (
        <Router>
            <Routes>
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
                            <Icebreaking />
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
