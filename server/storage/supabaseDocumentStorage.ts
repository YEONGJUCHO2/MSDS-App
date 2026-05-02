import crypto from "node:crypto";
import type { DocumentStorage } from "./documentStorage";

interface SupabaseStorageOptions {
  supabaseUrl: string;
  serviceRoleKey: string;
  bucket: string;
  fetcher?: typeof fetch;
}

export function createSupabaseDocumentStorage(options: SupabaseStorageOptions): DocumentStorage {
  const fetcher = options.fetcher ?? fetch;
  const baseUrl = options.supabaseUrl.replace(/\/+$/, "");

  return {
    async save(input) {
      const fileHash = crypto.createHash("sha256").update(input.buffer).digest("hex");
      const storagePath = `${input.documentId}/${input.fileName}`;
      const body = input.buffer.buffer.slice(
        input.buffer.byteOffset,
        input.buffer.byteOffset + input.buffer.byteLength
      ) as ArrayBuffer;
      const response = await fetcher(`${baseUrl}/storage/v1/object/${options.bucket}/${encodeURIComponent(storagePath)}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${options.serviceRoleKey}`,
          "Content-Type": "application/pdf",
          "x-upsert": "false"
        },
        body
      });
      if (!response.ok) {
        const message = await response.text().catch(() => "");
        throw new Error(`Supabase Storage upload failed: ${response.status} ${message}`.trim());
      }
      return { storagePath, fileHash };
    },

    async read(storagePath) {
      const response = await fetcher(`${baseUrl}/storage/v1/object/${options.bucket}/${encodeURIComponent(storagePath)}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${options.serviceRoleKey}`
        }
      });
      if (!response.ok) {
        const message = await response.text().catch(() => "");
        throw new Error(`Supabase Storage download failed: ${response.status} ${message}`.trim());
      }
      return Buffer.from(await response.arrayBuffer());
    },

    async remove(storagePath) {
      if (!storagePath) return;
      const response = await fetcher(`${baseUrl}/storage/v1/object/${options.bucket}/${encodeURIComponent(storagePath)}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${options.serviceRoleKey}`
        }
      });
      if (!response.ok && response.status !== 404) {
        const message = await response.text().catch(() => "");
        throw new Error(`Supabase Storage delete failed: ${response.status} ${message}`.trim());
      }
    }
  };
}
