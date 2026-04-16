import React, { useState } from 'react';
import './OpinionModal.css';

/**
 * 공통 관련질문 모달 컴포넌트
 * 
 * Props:
 * - questionTitle: 원본 질문 제목
 * - onSubmit: (relatedTitle) => void
 * - onClose: () => void
 * - songi: 송이 포인트 (기본 5)
 */
function RelatedModal({ questionTitle, onSubmit, onClose, songi = 5 }) {
    const [relatedTitle, setRelatedTitle] = useState('');

    const handleSubmit = () => {
        if (!relatedTitle.trim()) return;
        onSubmit(relatedTitle.trim());
    };

    return (
        <div className="opinion-modal-overlay" onClick={onClose}>
            <div className="opinion-modal-content" onClick={e => e.stopPropagation()}>
                <h3 className="opinion-modal-title">❓ 이 질문과 관련된 궁금증이 있나요?</h3>

                {questionTitle && (
                    <p className="opinion-modal-question">{questionTitle}</p>
                )}

                <textarea
                    className="opinion-modal-textarea"
                    value={relatedTitle}
                    onChange={e => setRelatedTitle(e.target.value)}
                    placeholder="떠오르는 궁금증을 적어보세요!"
                    rows={4}
                    maxLength={200}
                    autoFocus
                />
                <div className="opinion-modal-charcount">
                    {relatedTitle.length} / 200자
                </div>

                <div className="opinion-modal-buttons">
                    <button className="opinion-modal-cancel" onClick={onClose}>
                        취소
                    </button>
                    <button
                        className="opinion-modal-submit related"
                        onClick={handleSubmit}
                        disabled={!relatedTitle.trim()}
                    >
                        등록 (+{songi}송이)
                    </button>
                </div>
            </div>
        </div>
    );
}

export default RelatedModal;
