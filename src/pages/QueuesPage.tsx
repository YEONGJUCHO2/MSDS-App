import type { ReviewQueueItem } from "../../shared/types";
import { StatusBadge } from "../components/StatusBadge";

export function QueuesPage({ items }: { items: ReviewQueueItem[] }) {
  const pendingItems = items.filter((item) => item.reviewStatus === "needs_review");

  return (
    <main className="panel">
      <div className="panel-title">
        <h2>검수 필요 큐</h2>
        <span>{pendingItems.length}건 대기 · 전체 {items.length}건</span>
      </div>
      <div className="queue-list">
        {pendingItems.length === 0 ? <div className="empty">검수 필요한 항목이 없습니다.</div> : null}
        {pendingItems.map((item) => (
          <article className="queue-item" key={item.queueId}>
            <div>
              <strong>{item.label}</strong>
              <span>{item.evidence}</span>
            </div>
            <code>{item.candidateValue || "값 확인 필요"}</code>
            <StatusBadge status={item.reviewStatus} />
          </article>
        ))}
      </div>
    </main>
  );
}
