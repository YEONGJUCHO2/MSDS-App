export function RevisionDiffPage() {
  return (
    <main className="panel">
      <div className="panel-title">
        <h2>개정본 비교</h2>
        <span>CAS 추가·삭제·함유량 변경</span>
      </div>
      <p className="muted">백엔드 diff API가 준비되어 있어, 이전/신규 MSDS 성분 목록 연결 후 화면에 표시하면 됩니다.</p>
    </main>
  );
}
