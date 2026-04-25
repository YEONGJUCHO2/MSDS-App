export function RevisionDiffPage() {
  return (
    <main className="watchlist-page">
      <section className="panel">
        <div className="panel-title">
          <h2>개정본 비교</h2>
          <span>CAS 추가·삭제·함유량 변경</span>
        </div>
        <div className="explain-flow">
          <article>
            <strong>1. 같은 제품 판별</strong>
            <span>제품명, 공급사, ITEM코드, 사용자가 선택한 제품 연결값으로 기존 MSDS와 신규 MSDS를 묶습니다.</span>
          </article>
          <article>
            <strong>2. 성분 행 비교</strong>
            <span>이전 확인본과 신규 추출본의 CAS No., 화학물질명, MIN/MAX/단일 함량을 비교합니다.</span>
          </article>
          <article>
            <strong>3. 조치 큐 생성</strong>
            <span>CAS 추가·삭제, 함량 변경, 공식 API 결과 변경이 있으면 MSDS 개정/현장 게시본 교체 확인 대상으로 올립니다.</span>
          </article>
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>비교 결과</h2>
          <span>이전/신규 MSDS 연결 대기</span>
        </div>
        <div className="empty">
          현재 백엔드 diff API는 준비되어 있습니다. 다음 단계에서 제품 마스터와 업로드 문서를 연결하면, 같은 제품의 새 MSDS 업로드 시 변경 후보가 이 화면에 표시됩니다.
        </div>
      </section>
    </main>
  );
}
