import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI, setToken } from '../services/api';
import './Auth.css';

function Login() {
    const [searchParams] = useSearchParams();
    // URL에 ?tab=signup 이 붙어 있으면 회원가입 탭을 기본으로 보여줌
    const [isLogin, setIsLogin] = useState(searchParams.get('tab') !== 'signup');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [grade, setGrade] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [signupCode, setSignupCode] = useState(null); // 가입 완료 후 받은 코드
    const [codeCopied, setCodeCopied] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!isLogin && !agreed) {
            setError('연구 참여에 동의해 주세요.');
            return;
        }

        setLoading(true);
        try {
            let response;
            if (isLogin) {
                response = await authAPI.login(username, password);
                setToken(response.data.token);
                navigate('/create');   // 로그인 후 첫 화면 = 질문쓰기
            } else {
                response = await authAPI.signup(username, password, grade);
                setToken(response.data.token);
                // 바로 이동하지 않고, 부모 전달용 코드를 먼저 보여줌
                setSignupCode(response.data.user?.link_code || null);
            }
        } catch (err) {
            setError(err.response?.data?.message || '오류가 발생했습니다');
        } finally {
            setLoading(false);
        }
    };

    const handleCopyCode = () => {
        if (!signupCode) return;
        navigator.clipboard.writeText(signupCode).then(() => {
            setCodeCopied(true);
            setTimeout(() => setCodeCopied(false), 2000);
        });
    };

    const handleContinueAfterSignup = () => {
        navigate('/create');   // 가입 후 첫 화면 = 질문쓰기
    };

    const handleTabSwitch = (loginMode) => {
        setIsLogin(loginMode);
        setError('');
        setUsername('');
        setPassword('');
        setGrade('');
        setAgreed(false);
    };

    // 회원가입 성공 후: 폼 대신 완료 안내 화면을 보여줌
    // - 미성년(초/중/고): 부모님 동의서용 코드 전달 안내
    // - 성인(대학): 부모-자녀 매칭용 코드라 필요 없으므로 코드 안내 없이 바로 시작
    if (signupCode) {
        const isAdult = grade === '대학';
        return (
            <div className="auth-container">
                <div className="auth-box">
                    <h1 className="auth-title">🌱 물음송이</h1>
                    <p className="auth-subtitle">가입이 완료됐어요!</p>

                    {isAdult ? (
                        <div style={{
                            background: '#f0fdf4', border: '2px solid #86efac',
                            borderRadius: '14px', padding: '24px 20px', margin: '20px 0',
                            textAlign: 'center'
                        }}>
                            <p style={{ fontSize: '14px', color: '#333', lineHeight: 1.6 }}>
                                참여해주셔서 감사해요.<br/>바로 시작해보세요!
                            </p>
                        </div>
                    ) : (
                        <div style={{
                            background: '#f0fdf4', border: '2px solid #86efac',
                            borderRadius: '14px', padding: '24px 20px', margin: '20px 0',
                            textAlign: 'center'
                        }}>
                            <p style={{ fontSize: '14px', color: '#333', marginBottom: '14px', lineHeight: 1.6 }}>
                                이 코드를 <strong>부모님께 전달</strong>해주세요.<br/>
                                부모님 동의서 작성 시 필요해요.
                            </p>
                            <div style={{
                                fontSize: '32px', fontWeight: 800, letterSpacing: '4px',
                                color: '#16a34a', background: '#fff', border: '2px dashed #86efac',
                                borderRadius: '10px', padding: '14px', marginBottom: '12px'
                            }}>
                                {signupCode}
                            </div>
                            <button
                                onClick={handleCopyCode}
                                style={{
                                    padding: '10px 20px', border: 'none', borderRadius: '8px',
                                    background: '#16a34a', color: '#fff', fontWeight: 700,
                                    fontSize: '14px', cursor: 'pointer'
                                }}
                            >
                                {codeCopied ? '복사됐어요! ✓' : '코드 복사하기'}
                            </button>
                            <p style={{ fontSize: '12px', color: '#888', marginTop: '10px' }}>
                                설정 &gt; 내 코드 다시 보기에서 언제든 확인할 수 있어요.
                            </p>
                        </div>
                    )}

                    <button
                        onClick={handleContinueAfterSignup}
                        className="auth-button"
                    >
                        확인했어요, 시작하기
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="auth-container">
            <div className="auth-box">
                <h1 className="auth-title">🌱 물음송이</h1>
                <p className="auth-subtitle">호기심을 키우는 질문 플랫폼</p>

                <div className="auth-tabs">
                    <button
                        className={`auth-tab ${isLogin ? 'active' : ''}`}
                        onClick={() => handleTabSwitch(true)}
                    >
                        로그인
                    </button>
                    <button
                        className={`auth-tab ${!isLogin ? 'active' : ''}`}
                        onClick={() => handleTabSwitch(false)}
                    >
                        회원가입
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">

                    {/* 회원가입 전용 필드 */}
                    {!isLogin && (
                        <>
                            {/* 연구 참여 안내 */}
                            <div className="auth-research-notice">
                                <p>이 앱은 과학 질문 연구를 위해 개발되었습니다.</p>
                                <a
                                    href="https://meticulous-enchantment-production-f653.up.railway.app/land/muleumsongi-landing.html#join"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="auth-research-link"
                                >
                                    참여 안내 및 동의서 보기 →
                                </a>
                            </div>

                            <select
                                value={grade}
                                onChange={(e) => setGrade(e.target.value)}
                                required
                                className="auth-input auth-select"
                            >
                                <option value="">학년 선택</option>
                                <optgroup label="초등학교">
                                    <option value="초5">초등학교 5학년</option>
                                    <option value="초6">초등학교 6학년</option>
                                </optgroup>
                                <optgroup label="중학교">
                                    <option value="중1">중학교 1학년</option>
                                    <option value="중2">중학교 2학년</option>
                                    <option value="중3">중학교 3학년</option>
                                </optgroup>
                                <optgroup label="고등학교">
                                    <option value="고1">고등학교 1학년</option>
                                    <option value="고2">고등학교 2학년</option>
                                    <option value="고3">고등학교 3학년</option>
                                </optgroup>
                                <optgroup label="대학교">
                                    <option value="대학">대학생</option>
                                </optgroup>
                            </select>
                        </>
                    )}

                    <input
                        type="text"
                        placeholder="아이디 (닉네임)"
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

                    {/* 동의 체크박스 */}
                    {!isLogin && (
                        <label className="auth-agree-label">
                            <input
                                type="checkbox"
                                checked={agreed}
                                onChange={(e) => setAgreed(e.target.checked)}
                                className="auth-agree-checkbox"
                            />
                            <span>연구 참여에 동의합니다 <span className="auth-required">*</span></span>
                        </label>
                    )}

                    {error && <p className="auth-error">{error}</p>}

                    <button type="submit" disabled={loading} className="auth-button">
                        {loading ? '로딩 중...' : (isLogin ? '로그인' : '회원가입')}
                    </button>

                    {isLogin && (
                        <p style={{ textAlign: 'center', marginTop: '14px', fontSize: '13px' }}>
                            <a
                                href="https://open.kakao.com/o/sglH1SIi"
                                target="_blank"
                                rel="noopener noreferrer"
                                style={{ color: '#888', textDecoration: 'underline' }}
                            >
                                아이디/비밀번호를 잊으셨나요?
                            </a>
                        </p>
                    )}
                </form>
            </div>
        </div>
    );
}

export default Login;
