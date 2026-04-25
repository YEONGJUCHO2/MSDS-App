import type { DocumentSummary, ReviewQueueItem, Section3Row } from "../../shared/types";

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
  upload: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    return request<{ documentId: string; status: string; message: string }>("/api/documents/upload", { method: "POST", body: form });
  }
};
