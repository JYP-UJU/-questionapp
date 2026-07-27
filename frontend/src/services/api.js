import axios from 'axios';

const API_URL = 'https://meticulous-enchantment-production-f653.up.railway.app/api';

// 토큰 저장/가져오기
export const setToken = (token) => {
    localStorage.setItem('token', token);
};

export const getToken = () => {
    return localStorage.getItem('token');
};

export const removeToken = () => {
    localStorage.removeItem('token');
};

// Axios 인스턴스 생성
const api = axios.create({
    baseURL: API_URL,
});

// 요청 인터셉터 (모든 요청에 토큰 자동 추가)
api.interceptors.request.use(
    (config) => {
        const token = getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// 인증 API
export const authAPI = {
    signup: (username, password, grade) => api.post('/auth/register', { username, password, grade }),
    login: (username, password) => api.post('/auth/login', { username, password }),
    getLinkCode: () => api.get('/auth/link-code'),
};

// 질문 고르기 API
export const icebreakingAPI = {
    getRandom: () => api.get('/icebreaking/random'),
    submitInterest: (data) => api.post('/icebreaking/submit', data),
};

// 퀴즈 API
export const quizAPI = {
    getRandom: () => api.get('/quiz/random'),
    submit: (data) => api.post('/quiz/submit', data),
    getHistory: (limit, offset) => api.get(`/quiz/my-history?limit=${limit}&offset=${offset}`),
};

// 질문 작성 API
export const questionsAPI = {
    create: (title, content, thumbnail) => api.post('/questions', { title, content, thumbnail_url: thumbnail }),
    getAll: (limit, offset) => api.get(`/questions?limit=${limit}&offset=${offset}`),
    getMy: (limit, offset) => api.get(`/questions/my?limit=${limit}&offset=${offset}`),
};

// 질문 담기 API
export const savedAPI = {
    save: (questionId, questionType) => api.post('/saved', { questionId, questionType }),
    getMySaved: (limit, offset, questionType) => {
        let url = `/saved/my-saved?limit=${limit}&offset=${offset}`;
        if (questionType) url += `&questionType=${questionType}`;
        return api.get(url);
    },
    check: (questionId, questionType) => api.get(`/saved/check/${questionId}/${questionType}`),
    delete: (id) => api.delete(`/saved/${id}`),
};

// 반응 API
export const reactionsAPI = {
    react: (questionId, reactionType) => api.post('/reactions', { question_id: questionId, reaction_type: reactionType }),
};

// 댓글 API
export const followupAPI = {
    create: (parentQuestionId, question) => api.post('/followup', { parent_question_id: parentQuestionId, question }),
    getByQuestion: (questionId) => api.get(`/followup/${questionId}`),
};

// 랭킹 API
export const rankingAPI = {
    getTop: (limit) => api.get(`/ranking/top?limit=${limit}`),
};

// 사용자 API
export const usersAPI = {
    getProfile: () => api.get('/users/me'),
};

// 세션(체류시간) API
export const sessionsAPI = {
    start: () => api.post('/sessions/start'),
    heartbeat: (sessionId) => api.post('/sessions/heartbeat', { session_id: sessionId }),
};

// 알림 API
export const notificationsAPI = {
    getAll: () => api.get('/notifications'),
    getUnreadCount: () => api.get('/notifications/unread-count'),
    markAllRead: () => api.put('/notifications/read-all'),
    markRead: (id) => api.put(`/notifications/${id}/read`),
};

export { API_URL };

export default api;
