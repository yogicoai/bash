'use client';

/** 로딩 / 에러 / 빈 상태 공통 표시 */
export default function DataState({ loading, error, empty, emptyText = '표시할 데이터가 없습니다.', onRetry }) {
  if (loading) {
    return (
      <div className="state">
        <div className="spinner" />
        <p>데이터를 불러오는 중…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="state">
        <p className="state-icon">📭</p>
        <p className="state-title">{error.message}</p>
        {onRetry && (
          <button type="button" className="btn" onClick={onRetry}>
            다시 시도
          </button>
        )}
      </div>
    );
  }

  if (empty) {
    return (
      <div className="state">
        <p className="state-title">{emptyText}</p>
      </div>
    );
  }

  return null;
}
