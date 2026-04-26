# Cloud MVP Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first Vercel + Supabase foundation for the trusted-tester MSDS Watcher cloud MVP without breaking the local Express + SQLite development path.

**Architecture:** Add narrow provider boundaries for storage and persistence, then introduce a reviewable Supabase schema behind those boundaries. Keep the React client API shape stable and keep local development on SQLite/local disk until the Supabase upload/review path passes tests.

**Tech Stack:** TypeScript, Express, Vercel Node functions, Supabase Postgres, Supabase Storage REST client, better-sqlite3, Vitest, existing OpenAI adapter.

---

## File Structure

- Create `server/storage/documentStorage.ts`: shared storage interface and provider resolver.
- Create `server/storage/localDocumentStorage.ts`: local disk implementation used by Express/local dev.
- Create `server/storage/supabaseDocumentStorage.ts`: Supabase Storage implementation used by production.
- Create `server/db/documentRepository.ts`: narrow repository interface for upload/review data.
- Create `server/db/sqliteDocumentRepository.ts`: adapter around existing `server/db/repositories.ts`.
- Modify `server/services/processingPipeline.ts`: depend on repository interface instead of raw `better-sqlite3` where upload/review needs it.
- Modify `server/routes/documents.ts`: use storage provider for upload/delete and keep route responses stable.
- Create `supabase/migrations/20260426_cloud_mvp_foundation.sql`: repeatable schema for trusted-tester MVP.
- Modify `docs/vercel-deployment.md`: add exact Supabase setup and trusted-tester security notes.

## Scope Boundary

This plan implements the first cloud foundation only. It does not add login, RLS policies, every API route, scheduled recheck, or full Supabase repository coverage for products/sites/watchlist. Those come after upload/review works in Supabase.

### Task 1: Storage Provider Boundary

**Files:**
- Create: `server/storage/documentStorage.ts`
- Create: `server/storage/localDocumentStorage.ts`
- Create: `server/storage/supabaseDocumentStorage.ts`
- Test: `tests/services/documentStorage.test.ts`

- [ ] **Step 1: Write the failing storage resolver tests**

Create `tests/services/documentStorage.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { createDocumentStorage, resolveDocumentStorageProvider } from "../../server/storage/documentStorage";

describe("document storage provider", () => {
  it("uses local storage by default", () => {
    expect(resolveDocumentStorageProvider({})).toBe("local");
  });

  it("uses Supabase storage only when explicitly selected", () => {
    expect(resolveDocumentStorageProvider({ MSDS_STORAGE_PROVIDER: "supabase" })).toBe("supabase");
  });

  it("rejects Supabase storage without required server secrets", () => {
    expect(() => createDocumentStorage({
      MSDS_STORAGE_PROVIDER: "supabase",
      SUPABASE_URL: "https://example.supabase.co"
    })).toThrow("SUPABASE_SERVICE_ROLE_KEY is required");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/services/documentStorage.test.ts`

Expected: FAIL because `server/storage/documentStorage.ts` does not exist.

- [ ] **Step 3: Add the shared storage interface and resolver**

Create `server/storage/documentStorage.ts`:

```ts
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
```

- [ ] **Step 4: Add local storage implementation**

Create `server/storage/localDocumentStorage.ts`:

```ts
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
```

- [ ] **Step 5: Add Supabase storage implementation**

Create `server/storage/supabaseDocumentStorage.ts`:

```ts
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
      const response = await fetcher(`${baseUrl}/storage/v1/object/${options.bucket}/${encodeURIComponent(storagePath)}`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${options.serviceRoleKey}`,
          "Content-Type": "application/pdf",
          "x-upsert": "false"
        },
        body: input.buffer
      });
      if (!response.ok) {
        const message = await response.text().catch(() => "");
        throw new Error(`Supabase Storage upload failed: ${response.status} ${message}`.trim());
      }
      return { storagePath, fileHash };
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
```

- [ ] **Step 6: Run targeted storage tests**

Run: `npm test -- tests/services/documentStorage.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit storage boundary**

```bash
git add server/storage tests/services/documentStorage.test.ts
git commit -m "feat: add document storage providers"
```

### Task 2: Route Upload Through Storage Provider

**Files:**
- Modify: `server/routes/documents.ts`
- Test: `tests/api/uploadStorage.test.ts`

- [ ] **Step 1: Write failing route-level storage test**

Create `tests/api/uploadStorage.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { normalizeUploadedFileName } from "../../server/services/fileName";

describe("upload storage behavior", () => {
  it("normalizes file names before storage paths are generated", () => {
    expect(normalizeUploadedFileName("  위험 물질.pdf  ")).toBe("위험 물질.pdf");
  });

  it("keeps per-file batch results independent", async () => {
    const files = [
      { originalname: "ok.pdf", buffer: Buffer.from("%PDF ok") },
      { originalname: "bad.pdf", buffer: Buffer.from("bad") }
    ];
    const processFile = vi.fn(async (file: { originalname: string }) => {
      if (file.originalname === "bad.pdf") throw new Error("PDF text extraction failed");
      return { fileName: file.originalname, documentId: "doc-ok", status: "needs_review" };
    });

    const results = [];
    for (const file of files) {
      try {
        results.push({ success: true, ...(await processFile(file)) });
      } catch (error) {
        results.push({
          success: false,
          fileName: file.originalname,
          error: error instanceof Error ? error.message : "Unknown upload error"
        });
      }
    }

    expect(results).toEqual([
      { success: true, fileName: "ok.pdf", documentId: "doc-ok", status: "needs_review" },
      { success: false, fileName: "bad.pdf", error: "PDF text extraction failed" }
    ]);
  });
});
```

- [ ] **Step 2: Run the test**

Run: `npm test -- tests/api/uploadStorage.test.ts`

Expected: PASS after file creation. This locks expected partial-result behavior before route refactor.

- [ ] **Step 3: Refactor `documents.ts` imports**

In `server/routes/documents.ts`, remove these imports:

```ts
import crypto from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { unlink } from "node:fs/promises";
import path from "node:path";
```

Add:

```ts
import { createDocumentStorage } from "../storage/documentStorage";
```

- [ ] **Step 4: Update delete route to use storage provider**

Replace the local `unlink` block in `documentsRouter.delete("/:documentId", ...)` with:

```ts
if (deleted.storagePath) {
  await createDocumentStorage().remove(deleted.storagePath);
}
```

- [ ] **Step 5: Update single upload to use storage provider**

Inside `documentsRouter.post("/upload", ...)`, replace local path/hash/write code with:

```ts
const db = getDb();
const documentId = nanoid();
const fileName = normalizeUploadedFileName(req.file.originalname);
const stored = await createDocumentStorage().save({
  documentId,
  fileName,
  buffer: req.file.buffer
});

insertDocument(db, {
  documentId,
  fileName,
  fileHash: stored.fileHash,
  storagePath: stored.storagePath,
  status: "uploaded"
});

const extracted = await extractPdfText(req.file.buffer);
const result = await processExtractedText(db, {
  documentId,
  fileName,
  fileHash: stored.fileHash,
  storagePath: stored.storagePath,
  text: extracted.text,
  pageCount: extracted.pageCount
});
```

- [ ] **Step 6: Update batch upload for partial results**

Replace `handleUploadBatch` results loop with:

```ts
const results = [];
for (const file of files) {
  try {
    results.push({ success: true, ...(await processUploadedFile(file)) });
  } catch (error) {
    results.push({
      success: false,
      fileName: normalizeUploadedFileName(file.originalname),
      error: error instanceof Error ? error.message : "Unknown upload error"
    });
  }
}
res.json({ results });
```

- [ ] **Step 7: Update `processUploadedFile` to use storage provider**

Replace local path/hash/write code in `processUploadedFile` with the same `createDocumentStorage().save(...)` pattern used by single upload.

- [ ] **Step 8: Run upload and existing deletion tests**

Run:

```bash
npm test -- tests/api/uploadStorage.test.ts tests/services/documentDeletion.test.ts tests/services/processingPipeline.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit route storage refactor**

```bash
git add server/routes/documents.ts tests/api/uploadStorage.test.ts
git commit -m "feat: route uploads through storage provider"
```

### Task 3: Supabase Schema Migration

**Files:**
- Create: `supabase/migrations/20260426_cloud_mvp_foundation.sql`
- Test: `tests/services/supabaseSchema.test.ts`

- [ ] **Step 1: Write schema smoke test**

Create `tests/services/supabaseSchema.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("Supabase cloud MVP schema", () => {
  const sql = readFileSync("supabase/migrations/20260426_cloud_mvp_foundation.sql", "utf8");

  it("creates the upload and review tables used by the first cloud slice", () => {
    for (const tableName of [
      "documents",
      "document_basic_info",
      "components",
      "regulatory_matches",
      "chemical_api_cache",
      "review_queue"
    ]) {
      expect(sql).toContain(`create table if not exists public.${tableName}`);
    }
  });

  it("does not enable public storage access by policy", () => {
    expect(sql).not.toMatch(/for all\s+using\s+\(true\)/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/services/supabaseSchema.test.ts`

Expected: FAIL because the migration file does not exist.

- [ ] **Step 3: Add Supabase migration**

Create `supabase/migrations/20260426_cloud_mvp_foundation.sql`:

```sql
create table if not exists public.documents (
  document_id text primary key,
  file_name text not null,
  file_hash text not null,
  storage_path text not null,
  status text not null,
  uploaded_at timestamptz not null default now(),
  text_content text not null default '',
  page_count integer not null default 0
);

create table if not exists public.document_basic_info (
  document_id text not null references public.documents(document_id) on delete cascade,
  info_key text not null,
  label text not null,
  value text not null,
  source text not null,
  updated_at timestamptz not null default now(),
  primary key (document_id, info_key)
);

create table if not exists public.components (
  row_id text primary key,
  document_id text not null references public.documents(document_id) on delete cascade,
  row_index integer not null,
  raw_row_text text not null,
  cas_no_candidate text not null,
  chemical_name_candidate text not null,
  content_min_candidate text not null,
  content_max_candidate text not null,
  content_single_candidate text not null,
  content_text text not null,
  confidence double precision not null,
  evidence_location text not null,
  review_status text not null,
  ai_review_status text not null default 'not_reviewed',
  ai_review_note text not null default '',
  regulatory_match_status text not null default 'not_checked'
);

create table if not exists public.regulatory_matches (
  match_id text primary key,
  row_id text not null references public.components(row_id) on delete cascade,
  document_id text not null references public.documents(document_id) on delete cascade,
  cas_no text not null,
  category text not null,
  status text not null,
  source_type text not null,
  source_name text not null,
  source_url text not null,
  evidence_text text not null,
  checked_at timestamptz not null default now()
);

create table if not exists public.chemical_api_cache (
  cache_id text primary key,
  provider text not null,
  cas_no text not null,
  request_url text not null,
  response_text text not null,
  status text not null,
  fetched_at timestamptz not null,
  expires_at timestamptz not null,
  unique(provider, cas_no)
);

create table if not exists public.review_queue (
  queue_id text primary key,
  document_id text not null references public.documents(document_id) on delete cascade,
  entity_id text not null default '',
  field_type text not null,
  label text not null,
  candidate_value text not null,
  evidence text not null,
  review_status text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_components_document_id on public.components(document_id);
create index if not exists idx_review_queue_status on public.review_queue(review_status);
create index if not exists idx_regulatory_matches_row_id on public.regulatory_matches(row_id);
create index if not exists idx_regulatory_matches_document_id on public.regulatory_matches(document_id);
create index if not exists idx_chemical_api_cache_provider_cas on public.chemical_api_cache(provider, cas_no);

alter table public.documents enable row level security;
alter table public.document_basic_info enable row level security;
alter table public.components enable row level security;
alter table public.regulatory_matches enable row level security;
alter table public.chemical_api_cache enable row level security;
alter table public.review_queue enable row level security;
```

- [ ] **Step 4: Run schema test**

Run: `npm test -- tests/services/supabaseSchema.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit schema migration**

```bash
git add supabase/migrations/20260426_cloud_mvp_foundation.sql tests/services/supabaseSchema.test.ts
git commit -m "feat: add supabase cloud mvp schema"
```

### Task 4: Narrow Document Repository Boundary

**Files:**
- Create: `server/db/documentRepository.ts`
- Create: `server/db/sqliteDocumentRepository.ts`
- Modify: `server/services/processingPipeline.ts`
- Test: `tests/services/documentRepository.test.ts`

- [ ] **Step 1: Write failing repository adapter test**

Create `tests/services/documentRepository.test.ts`:

```ts
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { createSqliteDocumentRepository } from "../../server/db/sqliteDocumentRepository";
import { migrate } from "../../server/db/schema";

describe("sqlite document repository", () => {
  it("creates, updates, and counts review data through the narrow repository boundary", () => {
    const db = new Database(":memory:");
    migrate(db);
    const repo = createSqliteDocumentRepository(db);

    const documentId = repo.insertDocument({
      documentId: "doc-1",
      fileName: "sample.pdf",
      fileHash: "hash",
      storagePath: "doc-1/sample.pdf",
      status: "uploaded"
    });

    repo.upsertDocumentText(documentId, "3. 구성성분", 1, "needs_review");

    expect(documentId).toBe("doc-1");
    expect(repo.findDocumentId(documentId)).toBe("doc-1");
    expect(repo.countNeedsReview(documentId)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/services/documentRepository.test.ts`

Expected: FAIL because repository files do not exist.

- [ ] **Step 3: Add repository interface**

Create `server/db/documentRepository.ts`:

```ts
import type { Section3Row } from "../../shared/types";

export interface DocumentInsertInput {
  documentId?: string;
  fileName: string;
  fileHash: string;
  storagePath: string;
  status: string;
  textContent?: string;
  pageCount?: number;
}

export interface DocumentRepository {
  findDocumentId(documentId: string): string | undefined;
  insertDocument(input: DocumentInsertInput): string;
  upsertDocumentText(documentId: string, textContent: string, pageCount: number, status: string): void;
  insertComponentRows(documentId: string, rows: Section3Row[]): void;
  countNeedsReview(documentId: string): number;
}
```

- [ ] **Step 4: Add SQLite implementation**

Create `server/db/sqliteDocumentRepository.ts`:

```ts
import type Database from "better-sqlite3";
import type { DocumentInsertInput, DocumentRepository } from "./documentRepository";
import { insertComponentRows, insertDocument, upsertDocumentText } from "./repositories";

export function createSqliteDocumentRepository(db: Database.Database): DocumentRepository {
  return {
    findDocumentId(documentId) {
      const row = db.prepare("SELECT document_id AS documentId FROM documents WHERE document_id = ?").get(documentId) as { documentId: string } | undefined;
      return row?.documentId;
    },

    insertDocument(input: DocumentInsertInput) {
      return insertDocument(db, input);
    },

    upsertDocumentText(documentId, textContent, pageCount, status) {
      upsertDocumentText(db, documentId, textContent, pageCount, status);
    },

    insertComponentRows(documentId, rows) {
      insertComponentRows(db, documentId, rows);
    },

    countNeedsReview(documentId) {
      const row = db.prepare(`
        SELECT COUNT(*) AS count
        FROM review_queue
        WHERE document_id = ?
          AND review_status = 'needs_review'
      `).get(documentId) as { count: number };
      return row.count;
    }
  };
}
```

- [ ] **Step 5: Update `processingPipeline.ts` to accept DB or repository**

Keep the existing public signature working. Inside `processExtractedText`, create a repository from the `db` argument and replace direct calls for document insert/text/component/count with repository calls:

```ts
const repo = createSqliteDocumentRepository(db);
const existingDocumentId = input.documentId ? repo.findDocumentId(input.documentId) : undefined;
const activeDocumentId =
  existingDocumentId ??
  repo.insertDocument({
    documentId: documentId || undefined,
    fileName: input.fileName,
    fileHash: input.fileHash ?? "",
    storagePath: input.storagePath ?? "",
    status: "uploaded"
  });
repo.upsertDocumentText(activeDocumentId, input.text, input.pageCount, classification.status);
repo.insertComponentRows(activeDocumentId, componentRows);
repo.upsertDocumentText(activeDocumentId, input.text, input.pageCount, "needs_review");
const queueCount = repo.countNeedsReview(activeDocumentId);
```

- [ ] **Step 6: Run repository and pipeline tests**

Run:

```bash
npm test -- tests/services/documentRepository.test.ts tests/services/processingPipeline.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit repository boundary**

```bash
git add server/db/documentRepository.ts server/db/sqliteDocumentRepository.ts server/services/processingPipeline.ts tests/services/documentRepository.test.ts
git commit -m "feat: add document repository boundary"
```

### Task 5: Deployment Documentation

**Files:**
- Modify: `docs/vercel-deployment.md`

- [ ] **Step 1: Add trusted-tester setup section**

Add this section after "Production Shape":

```md
## Trusted-Tester Release

The first cloud MVP is for the user and a small number of trusted testers who know the Vercel URL. It does not include login, user roles, or Supabase RLS policies that allow browser access.

Supabase access uses `SUPABASE_SERVICE_ROLE_KEY` only inside Vercel server functions. Never expose this value through `VITE_` variables.

Before wider company rollout, add:

- Supabase Auth
- owner or organization columns
- RLS policies
- audit log review
- access-controlled downloads
```

- [ ] **Step 2: Add Supabase Storage setup**

Add:

```md
## Supabase Storage

Create a private bucket:

```text
msds-documents
```

The bucket must not be public. Uploaded PDFs are sensitive business documents. Use signed URLs or server-mediated downloads when file download is added.
```

- [ ] **Step 3: Add migration command notes**

Add:

```md
## Supabase Schema

Apply the checked-in SQL migration:

```text
supabase/migrations/20260426_cloud_mvp_foundation.sql
```

The first migration creates the upload/review tables only. Products, site assignment, watchlist snapshots, and revision comparison move after the upload/review path is stable in Supabase.
```

- [ ] **Step 4: Run markdown and full verification**

Run:

```bash
git diff --check
npm test
npm run build
```

Expected: no whitespace errors, all tests pass, build passes.

- [ ] **Step 5: Commit docs**

```bash
git add docs/vercel-deployment.md
git commit -m "docs: document trusted tester cloud setup"
```

### Task 6: Final Review Checkpoint

**Files:**
- Inspect all files changed by Tasks 1-5.

- [ ] **Step 1: Review final diff**

Run:

```bash
git status --short
git log --oneline -8
git diff HEAD~5..HEAD --stat
```

Expected: five focused commits, no unstaged changes.

- [ ] **Step 2: Run final verification**

Run:

```bash
npm test
npm run build
```

Expected: PASS.

- [ ] **Step 3: Save checkpoint**

Run `/checkpoint` with title `cloud mvp foundation complete`.

Expected: checkpoint records current branch, clean git state, verification commands, and next work.

## Next Plan After This One

The next implementation plan should cover the real Supabase Postgres repository and multipart Vercel upload parsing. It should not start until this foundation lands and local Express still passes tests.
