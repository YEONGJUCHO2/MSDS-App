export function RevisionDiffPage() {
  return (
    <main className="watchlist-page">
      <section className="panel">
        <div className="panel-title">
          <h2>개정본 비교</h2>
          <span>MVP 다음 단계</span>
        </div>
        <p className="lookup-feedback compact">
          이 탭은 기존 MSDS와 신규 MSDS를 같은 제품으로 묶은 뒤, 성분 변화와 공식 API 변경 후보를 확인하기 위한 준비 화면입니다. 현재 MVP에서는 등록값 작성, 제품/현장 연결, 감시/재조회를 우선 사용합니다.
        </p>
        <div className="explain-flow">
          <article>
            <strong>1. 제품/현장 연결</strong>
            <span>사용자가 제품/현장 관리에서 같은 자재의 기존 MSDS와 신규 MSDS를 같은 제품으로 묶습니다.</span>
          </article>
          <article>
            <strong>2. 기존본과 신규본 선택</strong>
            <span>같은 제품에 등록된 이전 확인본과 새 업로드본을 선택합니다.</span>
          </article>
          <article>
            <strong>3. 성분 행 비교</strong>
            <span>이전 확인본과 신규 추출본의 CAS No., 화학물질명, MIN/MAX/단일 함량을 비교합니다.</span>
          </article>
          <article>
            <strong>4. 조치 큐 생성</strong>
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
          아직 자동 비교 UI는 연결하지 않았습니다. 같은 제품의 기존본/신규본 선택 기능을 붙이면 이 영역에 CAS 추가, 삭제, 함량 변경, 공식 API 변경 후보가 표시됩니다.
        </div>
      </section>
    </main>
  );
}
