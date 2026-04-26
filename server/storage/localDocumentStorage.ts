import crypto from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import type { DocumentStorage } from "./documentStorage";
import { resolveStorageDir } from "../db/connection";

function resolveSafeStoragePath(uploadsDir: string, documentId: string, fileName: string): string {
  if (!fileName.trim()) throw new Error("Document filename is required.");
  if (fileName.includes("/") || fileName.includes("\\")) {
    throw new Error("Document filename cannot contain path separators.");
  }

  const storagePath = path.resolve(uploadsDir, `${documentId}-${fileName}`);
  if (!storagePath.startsWith(`${uploadsDir}${path.sep}`)) {
    throw new Error("Document storage path must stay inside the uploads directory.");
  }
  return storagePath;
}

export function createLocalDocumentStorage(): DocumentStorage {
  return {
    async save(input) {
      const uploadsDir = path.resolve(resolveStorageDir(), "uploads");
      mkdirSync(uploadsDir, { recursive: true });
      const storagePath = resolveSafeStoragePath(uploadsDir, input.documentId, input.fileName);
      writeFileSync(storagePath, input.buffer);
      return {
        storagePath,
        fileHash: crypto.createHash("sha256").update(input.buffer).digest("hex")
      };
    },

    async remove(storagePath) {
      if (!storagePath) return;
      await unlink(storagePath).catch((error: unknown) => {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      });
    }
  };
}
