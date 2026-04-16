import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usersAPI } from '../services/api';
import './Main.css';
import BottomNav from '../components/BottomNav';

function Main() {
    const [user, setUser] = useState(null);
    const navigate = useNavigate();

    useEffect(() => {
        loadUserProfile();
    }, []);

    const loadUserProfile = async () => {
        try {
            const response = await usersAPI.getProfile();
            setUser(response.data.user);
        } catch (error) {
            console.error('프로필 로드 실패:', error);
            // 로그인 페이지로 이동
            if (error.response?.status === 401) {
                navigate('/login');
            }
        }
    };

    return (
        <div className="main-container">
            <header className="main-header">
                <h1>🌸 물음송이</h1>
                {user && (
                    <div className="user-info">
                        <span className="username">{user.username}</span>
                        <span className="songi">🌸 {user.songi_count}송이</span>
                    </div>
                )}
            </header>

            <div className="main-content">
                <div className="button-grid">
                    <button 
                        className="main-button blue"
                        onClick={() => navigate('/icebreaking')}
                    >
                        <div className="button-icon">🤔</div>
                        <div className="button-title">재미있는 질문 고르기</div>
                        <div className="button-reward">+5송이</div>
                    </button>

                    <button 
                        className="main-button green"
                        onClick={() => navigate('/quiz')}
                    >
                        <div className="button-icon">🎯</div>
                        <div className="button-title">재미있는 퀴즈 풀기</div>
                        <div className="button-reward">+5송이</div>
                    </button>

                    <button 
                        className="main-button purple"
                        onClick={() => navigate('/create')}
                    >
                        <div className="button-icon">✏️</div>
                        <div className="button-title">내 질문하기</div>
                        <div className="button-reward">+5송이</div>
                    </button>

                    <button 
                        className="main-button orange"
                        onClick={() => navigate('/questions')}
                    >
                        <div className="button-icon">👥</div>
                        <div className="button-title">친구들의 질문 보기</div>
                        <div className="button-reward"></div>
                    </button>
                </div>
            </div>

            <BottomNav />
        </div>
    );
}

export default Main;