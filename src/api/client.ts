import type { ApiProviderStatus, DocumentSummary, RegulatoryRecheckResult, ReviewQueueItem, ReviewStatus, Section3Row, WatchlistItem } from "../../shared/types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export const api = {
  documents: () => request<{ documents: DocumentSummary[] }>("/api/documents"),
  queues: () => request<{ items: ReviewQueueItem[] }>("/api/queues"),
  components: (documentId: string) => request<{ rows: Section3Row[] }>(`/api/documents/${documentId}/components`),
  recheckComponent: (documentId: string, rowId: string) =>
    request<{ result: RegulatoryRecheckResult; rows: Section3Row[] }>(`/api/documents/${documentId}/components/${rowId}/recheck`, { method: "POST" }),
  reviewComponent: (documentId: string, rowId: string, reviewStatus: ReviewStatus) =>
    request<{ rows: Section3Row[] }>(`/api/documents/${documentId}/components/${rowId}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewStatus })
    }),
  officialLookupStatus: () => request<{ providers: ApiProviderStatus[] }>("/api/official-lookups/status"),
  watchlist: () => request<{ items: WatchlistItem[] }>("/api/watchlist"),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ documentId: string; status: string; message: string }>("/api/documents/upload", { method: "POST", body: form });
  }
};
