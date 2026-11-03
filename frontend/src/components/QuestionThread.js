import React from 'react';
import './QuestionThread.css';

// 질문 한 줄: 왼쪽(글) 6 : 오른쪽(아이콘 3개) 4
// 아이콘: 👍 관심있음, 💬 의견쓰기, ❓ 관련질문 (숫자는 0보다 클 때만 표시)
export function ActionIcons({ likes, opinions, liked, onLike, onOpinion, onRelated, onDelete, deleteTitle, extra }) {
    return (
        <div className="qt-icons">
            <button type="button" className={`qt-icon ${liked ? 'qt-on' : ''}`} onClick={onLike} aria-label="관심있음">
                <span className="qt-emoji">👍</span>
                {likes > 0 && <span className="qt-num">{likes}</span>}
            </button>
            <button type="button" className="qt-icon" onClick={onOpinion} aria-label="의견쓰기">
                <span className="qt-emoji">💬</span>
                {opinions > 0 && <span className="qt-num">{opinions}</span>}
            </button>
            <button type="button" className="qt-icon" onClick={onRelated} aria-label="관련질문">
                <span className="qt-emoji">❓</span>
            </button>
            {onDelete && (
                <button type="button" className="qt-icon qt-del" onClick={onDelete} title={deleteTitle || '삭제'} aria-label="삭제">
                    <span className="qt-emoji">🗑️</span>
                </button>
            )}
            {extra}
        </div>
    );
}

// 관련질문 트리: 카드 없이 텍스트 줄로 죽 펼침 (깊이만큼 왼쪽 세로선으로 들여쓰기)
//  props:
//   nodes        - 트리 전체 노드 배열
//   parentId     - 이 목록의 부모 id (최상위는 원질문 id 또는 null)
//   myUserId, isAdmin
//   onLike(node), onOpinion(node), onRelated(node), onDelete(node)
//   expandedOpinions, allOpinions, onToggleOpinions(node), renderOpinionRow(op)
//   refsMap, highlightId  (선택: 알림에서 넘어온 하이라이트)
export default function QuestionThread({
    nodes, parentId, depth = 0, myUserId, isAdmin,
    onLike, onOpinion, onRelated, onDelete,
    expandedOpinions, allOpinions, onToggleOpinions, renderOpinionRow,
    refsMap, highlightId,
}) {
    const children = (nodes || [])
        .filter(n => n.parent_question_id === parentId
            || (depth === 0 && n.parent_question_id === null))
        .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    if (children.length === 0) return null;

    return (
        <div className={`qt-thread ${depth === 0 ? 'qt-root' : ''}`}>
            {children.map(node => {
                const mine = myUserId !== null && myUserId !== undefined && node.user_id === myUserId;
                const canDelete = mine || isAdmin || (node.is_ai && myUserId !== null && node.parent_owner_id === myUserId);
                return (
                    <div key={node.id}>
                        <div
                            className={`qt-row ${highlightId === node.id ? 'qt-highlight' : ''}`}
                            ref={(el) => { if (el && refsMap) refsMap.current[`user_question:${node.id}`] = el; }}
                        >
                            <div className="qt-text">
                                <div className="qt-title">
                                    {node.title}
                                    <span className="qt-author">{mine ? '✏️ 나' : node.username}</span>
                                </div>
                                {node.is_ai && (
                                    <div className="qt-ai">🤖 물음송이 AI도 궁금해졌어요. AI가 쓴 질문이에요.</div>
                                )}
                                {(node.opinionCount || 0) > 0 && (
                                    <button type="button" className="qt-opinion-toggle" onClick={() => onToggleOpinions(node)}>
                                        {expandedOpinions[node.id] ? '▲ 의견 접기' : '의견 보기 ▼'}
                                    </button>
                                )}
                                {expandedOpinions[node.id] && (allOpinions[node.id] || []).map((op, i) => (
                                    <div key={i} className="qt-opinion">{renderOpinionRow(op)}</div>
                                ))}
                            </div>
                            <ActionIcons
                                likes={node.likesCount || 0}
                                opinions={node.opinionCount || 0}
                                liked={node.userReaction === 'like'}
                                onLike={() => onLike(node)}
                                onOpinion={() => onOpinion(node)}
                                onRelated={() => onRelated(node)}
                                onDelete={canDelete ? () => onDelete(node) : null}
                            />
                        </div>
                        <QuestionThread
                            nodes={nodes} parentId={node.id} depth={depth + 1}
                            myUserId={myUserId} isAdmin={isAdmin}
                            onLike={onLike} onOpinion={onOpinion} onRelated={onRelated} onDelete={onDelete}
                            expandedOpinions={expandedOpinions} allOpinions={allOpinions}
                            onToggleOpinions={onToggleOpinions} renderOpinionRow={renderOpinionRow}
                            refsMap={refsMap} highlightId={highlightId}
                        />
                    </div>
                );
            })}
        </div>
    );
}
