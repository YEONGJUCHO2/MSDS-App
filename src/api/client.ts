import type {
  ApiProviderStatus,
  BasicInfoField,
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
  documentId?: string;
  documentIds?: string[];
  productName: string;
  supplier: string;
  manufacturer: string;
  siteNames: string;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(resolveApiUrl(url), init);
  if (!response.ok) {
    throw new Error(await response.text());
  }
  return response.json() as Promise<T>;
}

export function resolveApiUrl(url: string) {
  if (/^https?:\/\//i.test(url)) return url;
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL?.trim().replace(/\/+$/, "");
  return apiBaseUrl ? `${apiBaseUrl}${url.startsWith("/") ? url : `/${url}`}` : url;
}

export const api = {
  documents: () => request<{ documents: DocumentSummary[] }>("/api/documents"),
  deleteDocument: (documentId: string) =>
    request<{ documentId: string; documents: DocumentSummary[] }>(`/api/documents/${documentId}`, { method: "DELETE" }),
  documentBasicInfo: (documentId: string) => request<DocumentBasicInfo>(`/api/documents/${documentId}/basic-info`),
  saveDocumentBasicInfo: (documentId: string, fields: BasicInfoField[]) =>
    request<DocumentBasicInfo>(`/api/documents/${documentId}/basic-info`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fields })
    }),
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
  deleteProduct: (productId: string) =>
    request<{ products: ProductSummary[] }>(`/api/products/${productId}`, { method: "DELETE" }),
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
  },
  uploadBatch: (files: File[]) => {
    const form = new FormData();
    for (const file of files) {
      form.append("files", file);
    }
    return request<{ results: Array<{ fileName: string; documentId: string; status: string; message: string }> }>("/api/documents/upload-batch", {
      method: "POST",
      body: form
    });
  }
};
