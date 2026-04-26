import { createLocalDocumentStorage } from "./localDocumentStorage";
import { createSupabaseDocumentStorage } from "./supabaseDocumentStorage";

export type DocumentStorageProvider = "local" | "supabase";

export interface StoredDocumentFile {
  storagePath: string;
  fileHash: string;
}

export interface DocumentStorage {
  save(input: { documentId: string; fileName: string; buffer: Buffer }): Promise<StoredDocumentFile>;
  remove(storagePath: string): Promise<void>;
}

export type StorageEnv = Record<string, string | undefined>;

export function resolveDocumentStorageProvider(env: StorageEnv = process.env): DocumentStorageProvider {
  return env.MSDS_STORAGE_PROVIDER === "supabase" ? "supabase" : "local";
}

export function createDocumentStorage(env: StorageEnv = process.env): DocumentStorage {
  const provider = resolveDocumentStorageProvider(env);
  if (provider === "supabase") {
    if (!env.SUPABASE_URL?.trim()) throw new Error("SUPABASE_URL is required for Supabase storage.");
    if (!env.SUPABASE_SERVICE_ROLE_KEY?.trim()) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required for Supabase storage.");
    if (!env.SUPABASE_STORAGE_BUCKET?.trim()) throw new Error("SUPABASE_STORAGE_BUCKET is required for Supabase storage.");
    return createSupabaseDocumentStorage({
      supabaseUrl: env.SUPABASE_URL,
      serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
      bucket: env.SUPABASE_STORAGE_BUCKET
    });
  }
  return createLocalDocumentStorage();
}
