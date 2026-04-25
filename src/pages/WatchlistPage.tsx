import { useEffect, useState } from "react";
import type { ApiProviderStatus, WatchlistItem } from "../../shared/types";
import { regulatoryMatchStatusLabels } from "../../shared/status";
import { api } from "../api/client";

export function WatchlistPage() {
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [providers, setProviders] = useState<ApiProviderStatus[]>([]);

  useEffect(() => {
    void Promise.all([api.watchlist(), api.officialLookupStatus()]).then(([watchlistResult, statusResult]) => {
      setItems(watchlistResult.items);
      setProviders(statusResult.providers);
    });
  }, []);

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
          <span>{items.length}건</span>
        </div>
        <div className="watchlist-table">
          {items.map((item) => (
            <article className="watchlist-row" key={item.watchId}>
              <div>
                <strong>{item.casNo}</strong>
                <span>{item.chemicalName || "물질명 확인필요"}</span>
              </div>
              <span>{item.lastSourceName}</span>
              <span>{regulatoryMatchStatusLabels[item.status as keyof typeof regulatoryMatchStatusLabels] ?? item.status}</span>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
