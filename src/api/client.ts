import type {
  ApiProviderStatus,
  DocumentBasicInfo,
  DocumentSummary,
  ProductSummary,
  RegulatoryRecheckResult,
  ReviewQueueItem,
  ReviewStatus,
  Section3Row,
  WatchlistItem,
  WatchlistRecheckResult
} from "../../shared/types";

export type ComponentCandidatePayload = Pick<
  Section3Row,
  "casNoCandidate" | "chemicalNameCandidate" | "contentMinCandidate" | "contentMaxCandidate" | "contentSingleCandidate"
>;

export interface ProductLinkPayload {
  documentId: string;
  productName: string;
  supplier: string;
  manufacturer: string;
  siteNames: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export const api = {
  documents: () => request<{ documents: DocumentSummary[] }>("/api/documents"),
  documentBasicInfo: (documentId: string) => request<DocumentBasicInfo>(`/api/documents/${documentId}/basic-info`),
  queues: () => request<{ items: ReviewQueueItem[] }>("/api/queues"),
  components: (documentId: string) => request<{ rows: Section3Row[] }>(`/api/documents/${documentId}/components`),
  addComponent: (documentId: string, payload: ComponentCandidatePayload) =>
    request<{ rowId: string; rows: Section3Row[] }>(`/api/documents/${documentId}/components`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  updateComponent: (documentId: string, rowId: string, payload: ComponentCandidatePayload) =>
    request<{ rows: Section3Row[] }>(`/api/documents/${documentId}/components/${rowId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  removeComponent: (documentId: string, rowId: string) =>
    request<{ rows: Section3Row[] }>(`/api/documents/${documentId}/components/${rowId}`, { method: "DELETE" }),
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
  recheckWatchlist: (watchIds?: string[]) =>
    request<{ results: WatchlistRecheckResult[]; items: WatchlistItem[] }>("/api/watchlist/recheck", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ watchIds })
    }),
  products: () => request<{ products: ProductSummary[] }>("/api/products"),
  linkProductToDocument: (payload: ProductLinkPayload) =>
    request<{ product: ProductSummary; products: ProductSummary[] }>("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }),
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ documentId: string; status: string; message: string }>("/api/documents/upload", { method: "POST", body: form });
  }
};
