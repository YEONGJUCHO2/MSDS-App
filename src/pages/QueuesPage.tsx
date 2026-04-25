import type { ReviewQueueItem } from "../../shared/types";
import { StatusBadge } from "../components/StatusBadge";

export function QueuesPage({ items }: { items: ReviewQueueItem[] }) {
  return (
    <main className="panel">
      <div className="panel-title">
        <h2>검수/관리 큐</h2>
        <span>{items.length}건</span>
      </div>
      <div className="queue-list">
        {items.map((item) => (
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
