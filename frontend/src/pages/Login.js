import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI, setToken } from '../services/api';
import './Auth.css';

function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            let response;
            if (isLogin) {
                response = await authAPI.login(username, password);
            } else {
                response = await authAPI.signup(username, password);
            }

            setToken(response.data.token);
            navigate('/main');
        } catch (err) {
            setError(err.response?.data?.message || '오류가 발생했습니다');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-box">
                <h1 className="auth-title">🌸 물음송이</h1>
                <p className="auth-subtitle">궁금증을 키우는 질문 플랫폼</p>

                <div className="auth-tabs">
                    <button
                        className={`auth-tab ${isLogin ? 'active' : ''}`}
                        onClick={() => setIsLogin(true)}
                    >
                        로그인
                    </button>
                    <button
                        className={`auth-tab ${!isLogin ? 'active' : ''}`}
                        onClick={() => setIsLogin(false)}
                    >
                        회원가입
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <input
                        type="text"
                        placeholder="아이디"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        className="auth-input"
                    />
                    <input
                        type="password"
                        placeholder="비밀번호"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="auth-input"
                    />

                    {error && <p className="auth-error">{error}</p>}

                    <button type="submit" disabled={loading} className="auth-button">
                        {loading ? '처리 중...' : (isLogin ? '로그인' : '회원가입')}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Login;
