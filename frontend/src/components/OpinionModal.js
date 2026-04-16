import React, { useState, useEffect } from 'react';
import './OpinionModal.css';

/**
 * 공통 의견 모달 컴포넌트
 * 
 * Props:
 * - questionTitle: 질문 제목 (모달 상단에 표시)
 * - initialValue: 기존 의견 (수정 시)
 * - onSubmit: (opinionText) => void
 * - onClose: () => void
 * - songi: 송이 포인트 (기본 3)
 */
function OpinionModal({ questionTitle, initialValue = '', onSubmit, onClose, songi = 3 }) {
    const [opinionText, setOpinionText] = useState(initialValue);

    useEffect(() => {
        setOpinionText(initialValue);
    }, [initialValue]);

    const handleSubmit = () => {
        if (!opinionText.trim()) return;
        onSubmit(opinionText.trim());
    };

    return (
        <div className="opinion-modal-overlay" onClick={onClose}>
            <div className="opinion-modal-content" onClick={e => e.stopPropagation()}>
                <h3 className="opinion-modal-title">💬 내 생각을 남겨요</h3>

                {questionTitle && (
                    <p className="opinion-modal-question">{questionTitle}</p>
                )}

                <textarea
                    className="opinion-modal-textarea"
                    value={opinionText}
                    onChange={e => setOpinionText(e.target.value)}
                    placeholder="제 생각에는요..."
                    rows={4}
                    maxLength={500}
                    autoFocus
                />
                <div className="opinion-modal-charcount">
                    {opinionText.length} / 500자
                </div>

                <div className="opinion-modal-buttons">
                    <button className="opinion-modal-cancel" onClick={onClose}>
                        취소
                    </button>
                    <button
                        className="opinion-modal-submit"
                        onClick={handleSubmit}
                        disabled={!opinionText.trim()}
                    >
                        등록 (+{songi}송이)
                    </button>
                </div>
            </div>
        </div>
    );
}

export default OpinionModal;
