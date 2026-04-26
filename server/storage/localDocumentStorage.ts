import crypto from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
import type { DocumentStorage } from "./documentStorage";

export function createLocalDocumentStorage(): DocumentStorage {
  return {
    async save(input) {
      const uploadsDir = path.resolve(process.cwd(), "storage", "uploads");
      mkdirSync(uploadsDir, { recursive: true });
      const storagePath = path.join(uploadsDir, `${input.documentId}-${input.fileName}`);
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
