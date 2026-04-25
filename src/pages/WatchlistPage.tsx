import { useEffect, useState } from "react";
import type { ApiProviderStatus, WatchlistItem } from "../../shared/types";
import { regulatoryMatchStatusLabels } from "../../shared/status";
import { api } from "../api/client";

export function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [providers, setProviders] = useState<ApiProviderStatus[]>([]);
  const [selectedWatchIds, setSelectedWatchIds] = useState<string[]>([]);
  const [rechecking, setRechecking] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    void Promise.all([api.watchlist(), api.officialLookupStatus()]).then(([watchlistResult, statusResult]) => {
      setItems(watchlistResult.items);
      setProviders(statusResult.providers);
    });
  }, []);

  const latestCheckedAt = items
    .map((item) => item.lastCheckedAt)
    .filter(Boolean)
    .sort()
    .at(-1);
  const allSelected = items.length > 0 && selectedWatchIds.length === items.length;

  function toggleSelection(watchId: string) {
    setSelectedWatchIds((current) => current.includes(watchId) ? current.filter((id) => id !== watchId) : [...current, watchId]);
  }

  function toggleAll() {
    setSelectedWatchIds(allSelected ? [] : items.map((item) => item.watchId));
  }

  async function recheck(watchIds?: string[]) {
    setRechecking(true);
    setFeedback("");
    try {
      const result = await api.recheckWatchlist(watchIds);
      setItems(result.items);
      setSelectedWatchIds((current) => current.filter((watchId) => result.items.some((item) => item.watchId === watchId)));
      const changedCount = result.results.filter((item) => item.changed).length;
      setFeedback(`${result.results.length}건 재조회 완료 · 변경 후보 ${changedCount}건`);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : "재조회에 실패했습니다.");
    } finally {
      setRechecking(false);
    }
  }

  return (
    <main className="watchlist-page">
      <section className="panel">
        <div className="panel-title">
          <h2>공식조회 상태</h2>
          <span>{providers.filter((provider) => provider.configured).length}/{providers.length} 연결</span>
        </div>
        <div className="provider-grid">
          {providers.map((provider) => (
            <article className="provider-card" key={provider.provider}>
              <strong>{provider.label}</strong>
              <span>{provider.configured ? "연결됨" : "API키 필요"}</span>
              <code>cache {provider.cacheCount}</code>
            </article>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panel-title">
          <h2>CAS Watchlist</h2>
          <span>{items.length}건 · 최근 재조회 {formatCheckedAt(latestCheckedAt)}</span>
          <button disabled={items.length === 0 || rechecking} onClick={() => void recheck()} type="button">
            전체 재조회
          </button>
          <button disabled={selectedWatchIds.length === 0 || rechecking} onClick={() => void recheck(selectedWatchIds)} type="button">
            선택 재조회
          </button>
        </div>
        <div className="watchlist-controls">
          <label>
            <input checked={allSelected} disabled={items.length === 0 || rechecking} onChange={toggleAll} type="checkbox" />
            전체 선택
          </label>
          <span>{selectedWatchIds.length}건 선택</span>
          {feedback ? <strong>{feedback}</strong> : null}
        </div>
        <div className="watchlist-table">
          {items.length === 0 ? <div className="empty">확인 완료된 CAS No.가 쌓이면 감시 대상이 여기에 표시됩니다.</div> : null}
          {items.map((item) => (
            <article className="watchlist-row" key={item.watchId}>
              <label className="watchlist-select">
                <input
                  checked={selectedWatchIds.includes(item.watchId)}
                  disabled={rechecking}
                  onChange={() => toggleSelection(item.watchId)}
                  type="checkbox"
                />
                선택
              </label>
              <div>
                <strong>{item.casNo}</strong>
                <span>{item.chemicalName || "물질명 확인필요"}</span>
                <span>최근 재조회 {formatCheckedAt(item.lastCheckedAt)}</span>
              </div>
              <span>{item.lastSourceName}</span>
              <span>{regulatoryMatchStatusLabels[item.status as keyof typeof regulatoryMatchStatusLabels] ?? item.status}</span>
              <button className="table-action" disabled={rechecking} onClick={() => void recheck([item.watchId])} type="button">재조회</button>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

function formatCheckedAt(value?: string) {
  if (!value) return "이력 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "이력 없음";
  const daysAgo = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  const formatted = date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
  return `${formatted} · ${daysAgo}일 전`;
}
