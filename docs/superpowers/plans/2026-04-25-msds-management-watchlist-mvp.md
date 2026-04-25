# MSDS Management Watchlist MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

## 2026-04-25 Product Direction Correction

This plan is not a one-off internal registration copy helper. The registration output is the first useful artifact, but the product goal is chemical/MSDS management:

```text
MSDS upload
→ PDF/OCR/AI component structuring
→ human confirmation only where automation needs help
→ official API lookup first
→ internal registration output
→ managed product/component/site/supplier records
→ CAS watchlist
→ monthly or manual batch re-query
→ regulatory-change candidate and MSDS revision-needed alerts
→ field MSDS replacement/share actions
```

Internal seed data is fallback/supporting data. It must not outrank official APIs. Review/attention queues should contain only automation blockers or management risks, not every extracted component.

**Goal:** Build a local web MVP that uploads MSDS PDFs, extracts registration candidates with table-aware parsing, matches CAS No. against official APIs first and seeded regulatory standards only as fallback/supporting evidence, compares product MSDS revisions, lets a 담당자 verify values, stores managed records, and creates a CAS No. watchlist for manual/monthly change monitoring.

**Architecture:** Use a Vite React frontend and an Express local backend in one workspace. The backend owns PDF storage, SQLite persistence, text/table extraction, scan detection, seed imports, Codex CLI invocation behind a security-gated adapter, regulatory lookup, revision diffing, backup, audit logs, and JSON APIs. The frontend is a dense work tool: upload, document list, grouped verification screen, queues, management lists, schedules, revision diffs, and watchlist.

**Tech Stack:** TypeScript, React, Vite, Express, SQLite via `better-sqlite3`, `zod`, `pdf-parse`, `pdfjs-dist`, `csv-parse`, `multer`, Vitest, Testing Library, Codex CLI.

---

## GStack Engineering Review

This plan keeps the MVP as a bounded system. The previous failed app tried to search the legal universe. This one must not. Every lookup starts from MSDS-extracted CAS No. and writes a field status: `해당`, `비해당`, `해당 후보`, `비해당 후보`, `확인필요`, `공급사 확인 필요`, or `내부 기준 확인 필요`.

The product has three connected jobs:

1. **등록 보조**: get values into the internal MSDS screen faster.
2. **관리자동화**: keep verified product, component, supplier, and site data.
3. **변경감시 기반**: create a CAS watchlist with last lookup metadata and support manual/monthly re-query comparison.

Do not build broad legal search in this MVP. Do build the closed, high-value lake: official API lookup by CAS, fallback regulatory seed data, table-aware SECTION 3 extraction, scan fallback, product revision diff, management queues, watchlist re-query history, audit log, and backup. Full automated regulatory surveillance across every official database is the ocean.

## Review-Driven Scope Corrections

The external review identified real product risks. This plan accepts most of them.

| # | Feedback | Decision | Plan Change |
|---:|---|---|---|
| 1 | Internal regulatory standards are undefined | Accept with correction | Add CSV seed import as fallback/supporting data, not primary official evidence |
| 2 | `pdf-parse` alone breaks SECTION 3 tables | Accept | Add table-aware extractor boundary |
| 3 | Scanned PDF fallback missing | Accept | Add scan detection, local OCR attempt, confidence status, and manual/supplier fallback |
| 4 | Copy buttons alone are weak value | Accept | Promote regulatory matching, queues, revision diff, schedules |
| 5 | Bulk import missing | Accept | Add management CSV import task |
| 6 | 19-column UI will collapse | Accept | Replace flat table with grouped row expansion |
| 7 | Product MSDS revision diff missing | Accept | Add product revision and diff model/task |
| 8 | Measurement/exam schedule underweighted | Accept | Add schedule fields and queue |
| 9 | Backup missing | Accept | Add SQLite backup task |
| 10 | External LLM security risk | Accept | Add security mode gate before Codex CLI use |
| 11 | Audit trail missing | Accept | Add audit log task |
| 12 | Trade secret policy missing | Accept | Add supplier follow-up handling |
| 13 | 확인필요 queue missing | Accept | Add queue dashboard for automation blockers and management risks only |
| 14 | MSDS 4~15 sections missing | Defer unless required | Keep schema extensible, do not add all by default |
| 15 | 검수완료 and 등록완료 conflated | Accept | Split review status and registration status |

## File Structure

Create this structure:

```text
package.json
tsconfig.json
vite.config.ts
vitest.config.ts
index.html
src/
  main.tsx
  App.tsx
  styles.css
  api/client.ts
  components/FieldRow.tsx
  components/ComponentTable.tsx
  components/ComponentReviewPanel.tsx
  components/StatusBadge.tsx
  pages/DashboardPage.tsx
  pages/UploadPage.tsx
  pages/ReviewPage.tsx
  pages/ProductsPage.tsx
  pages/QueuesPage.tsx
  pages/RevisionDiffPage.tsx
  pages/SchedulesPage.tsx
  pages/WatchlistPage.tsx
server/
  index.ts
  db/connection.ts
  db/schema.ts
  db/repositories.ts
  domain/registrationSchema.ts
  domain/status.ts
  importers/masterImport.ts
  importers/regulatorySeedImport.ts
  services/pdfExtractor.ts
  services/tableExtractor.ts
  services/scanDetector.ts
  services/ocrAdapter.ts
  services/codexAdapter.ts
  services/regulatoryLookup.ts
  services/revisionDiff.ts
  services/scheduleCalculator.ts
  services/auditLog.ts
  services/backup.ts
  services/processingPipeline.ts
  services/copyFormat.ts
  routes/documents.ts
  routes/imports.ts
  routes/products.ts
  routes/queues.ts
  routes/revisions.ts
  routes/schedules.ts
  routes/watchlist.ts
  storage/.gitkeep
data/
  regulatory-seeds/.gitkeep
shared/
  types.ts
tests/
  domain/registrationSchema.test.ts
  services/copyFormat.test.ts
  services/codexAdapter.test.ts
  services/tableExtractor.test.ts
  services/scanDetector.test.ts
  services/ocrAdapter.test.ts
  services/regulatoryLookup.test.ts
  services/revisionDiff.test.ts
  services/scheduleCalculator.test.ts
  services/backup.test.ts
  services/processingPipeline.test.ts
  importers/regulatorySeedImport.test.ts
  importers/masterImport.test.ts
  db/repositories.test.ts
  ui/FieldRow.test.tsx
  ui/ComponentReviewPanel.test.tsx
```

## Task 1: Project Scaffold

Before implementation, lock these 0순위 product constraints. They prevent the MVP from becoming a low-value copy helper. The code steps that depend on `server/db/schema.ts` are executed immediately after Task 3 creates the database layer, but they are listed here first because they change the MVP definition.

### Task 0A: Regulatory Seed Data Contract

**Files:**
- Create: `data/regulatory-seeds/.gitkeep`
- Create: `server/importers/regulatorySeedImport.ts`
- Test: `tests/importers/regulatorySeedImport.test.ts`

- [ ] **Step 1: Write the failing seed import test**

```ts
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migrate } from "../../server/db/schema";
import { importRegulatorySeedCsv } from "../../server/importers/regulatorySeedImport";

describe("regulatory seed import", () => {
  it("imports CAS-based regulatory standards from CSV", () => {
    const db = new Database(":memory:");
    migrate(db);
    const csv = [
      "category,cas_no,chemical_name_ko,chemical_name_en,synonyms,threshold_text,period_value,period_unit,source_name,source_url,source_revision_date,note",
      "workEnvironmentMeasurement,1344-28-1,산화 알루미늄,Aluminium oxide,,분진 노출 기준,6,개월,내부 기준표,internal://seed,2026-04-25,작업환경측정 후보",
      "specialHealthExam,1344-28-1,산화 알루미늄,Aluminium oxide,,특수건강검진 기준,12,개월,내부 기준표,internal://seed,2026-04-25,특수검진 후보"
    ].join("\\n");

    const result = importRegulatorySeedCsv(db, csv);
    const rows = db.prepare("SELECT category, cas_no AS casNo, period_value AS periodValue FROM regulatory_seeds ORDER BY category").all();

    expect(result.imported).toBe(2);
    expect(rows).toEqual([
      { category: "specialHealthExam", casNo: "1344-28-1", periodValue: "12" },
      { category: "workEnvironmentMeasurement", casNo: "1344-28-1", periodValue: "6" }
    ]);
  });
});
```

- [ ] **Step 2: Implement the importer**

```ts
import type Database from "better-sqlite3";
import { parse } from "csv-parse/sync";
import { nanoid } from "nanoid";

export function importRegulatorySeedCsv(db: Database.Database, csvText: string) {
  const records = parse(csvText, { columns: true, skip_empty_lines: true }) as Array<Record<string, string>>;
  const insert = db.prepare(`
    INSERT INTO regulatory_seeds (
      seed_id, category, cas_no, chemical_name_ko, chemical_name_en, synonyms,
      threshold_text, period_value, period_unit, source_name, source_url,
      source_revision_date, note
    ) VALUES (
      @seedId, @category, @casNo, @chemicalNameKo, @chemicalNameEn, @synonyms,
      @thresholdText, @periodValue, @periodUnit, @sourceName, @sourceUrl,
      @sourceRevisionDate, @note
    )
  `);

  const transaction = db.transaction(() => {
    for (const record of records) {
      insert.run({
        seedId: nanoid(),
        category: record.category,
        casNo: record.cas_no,
        chemicalNameKo: record.chemical_name_ko,
        chemicalNameEn: record.chemical_name_en,
        synonyms: record.synonyms,
        thresholdText: record.threshold_text,
        periodValue: record.period_value,
        periodUnit: record.period_unit,
        sourceName: record.source_name,
        sourceUrl: record.source_url,
        sourceRevisionDate: record.source_revision_date,
        note: record.note
      });
    }
  });

  transaction();
  return { imported: records.length };
}
```

- [ ] **Step 3: Add `regulatory_seeds` table to `server/db/schema.ts`**

```sql
CREATE TABLE IF NOT EXISTS regulatory_seeds (
  seed_id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  cas_no TEXT NOT NULL,
  chemical_name_ko TEXT NOT NULL,
  chemical_name_en TEXT NOT NULL,
  synonyms TEXT NOT NULL,
  threshold_text TEXT NOT NULL,
  period_value TEXT NOT NULL,
  period_unit TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_url TEXT NOT NULL,
  source_revision_date TEXT NOT NULL,
  note TEXT NOT NULL
);
```

- [ ] **Step 4: Verify seed import**

Run:

```bash
npm test -- tests/importers/regulatorySeedImport.test.ts
```

Expected: PASS.

### Task 0B: Table-Aware PDF Extraction and Scan Fallback

**Files:**
- Create: `server/services/scanDetector.ts`
- Create: `server/services/tableExtractor.ts`
- Create: `server/services/ocrAdapter.ts`
- Test: `tests/services/scanDetector.test.ts`
- Test: `tests/services/tableExtractor.test.ts`
- Test: `tests/services/ocrAdapter.test.ts`

- [ ] **Step 1: Write scan detector test**

```ts
import { describe, expect, it } from "vitest";
import { classifyPdfTextLayer } from "../../server/services/scanDetector";

describe("scan detector", () => {
  it("marks low-text PDFs as OCR-needed instead of returning blank extraction", () => {
    expect(classifyPdfTextLayer("")).toEqual({ kind: "scan", status: "OCR 필요" });
    expect(classifyPdfTextLayer("제품명 MY-M-11\\n3. 구성성분의 명칭 및 함유량")).toEqual({ kind: "text", status: "텍스트 추출 가능" });
  });
});
```

- [ ] **Step 2: Implement scan detector**

```ts
export function classifyPdfTextLayer(text: string) {
  const normalized = text.replace(/\s+/g, "");
  if (normalized.length < 40) {
    return { kind: "scan" as const, status: "OCR 필요" as const };
  }
  return { kind: "text" as const, status: "텍스트 추출 가능" as const };
}
```

- [ ] **Step 3: Write table extractor test**

```ts
import { describe, expect, it } from "vitest";
import { extractComponentRowsFromText } from "../../server/services/tableExtractor";

describe("table extractor", () => {
  it("keeps CAS, chemical name, and content in the same row", () => {
    const rows = extractComponentRowsFromText(`
      CAS No. 화학물질 MIN MAX
      60676-86-0 실리카, 퓨즈드 85 95
      1344-28-1 산화 알루미늄 1 5
    `);

    expect(rows).toEqual([
      {
        rowIndex: 0,
        rawRowText: "60676-86-0 실리카, 퓨즈드 85 95",
        casNoCandidate: "60676-86-0",
        chemicalNameCandidate: "실리카, 퓨즈드",
        contentMinCandidate: "85",
        contentMaxCandidate: "95",
        contentSingleCandidate: "",
        confidence: 0.8
      },
      {
        rowIndex: 1,
        rawRowText: "1344-28-1 산화 알루미늄 1 5",
        casNoCandidate: "1344-28-1",
        chemicalNameCandidate: "산화 알루미늄",
        contentMinCandidate: "1",
        contentMaxCandidate: "5",
        contentSingleCandidate: "",
        confidence: 0.8
      }
    ]);
  });
});
```

- [ ] **Step 4: Implement text-backed table extractor**

This is not the final coordinate extractor. It is the interface and fallback. Replace internals later with `pdfjs-dist` coordinate grouping without changing callers.

```ts
const casPattern = /\b\d{2,7}-\d{2}-\d\b/;

export function extractComponentRowsFromText(text: string) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => casPattern.test(line))
    .map((line, rowIndex) => {
      const casNoCandidate = line.match(casPattern)?.[0] ?? "";
      const afterCas = line.replace(casNoCandidate, "").trim();
      const numbers = afterCas.match(/\d+(?:\.\d+)?/g) ?? [];
      const contentMinCandidate = numbers[0] ?? "";
      const contentMaxCandidate = numbers[1] ?? "";
      const contentSingleCandidate = numbers.length === 1 ? numbers[0] : "";
      const chemicalNameCandidate = afterCas
        .replace(/\d+(?:\.\d+)?/g, "")
        .replace(/[%~<>≤≥-]/g, "")
        .trim();

      return {
        rowIndex,
        rawRowText: line,
        casNoCandidate,
        chemicalNameCandidate,
        contentMinCandidate,
        contentMaxCandidate,
        contentSingleCandidate,
        confidence: 0.8
      };
    });
}
```

- [ ] **Step 5: Verify extraction tests**

Run:

```bash
npm test -- tests/services/scanDetector.test.ts tests/services/tableExtractor.test.ts
```

Expected: PASS.

- [ ] **Step 6: Write OCR adapter test**

```ts
import { describe, expect, it } from "vitest";
import { createDisabledOcrAdapter, classifyOcrResult } from "../../server/services/ocrAdapter";

describe("ocr adapter", () => {
  it("returns a clear fallback when OCR is disabled", async () => {
    const adapter = createDisabledOcrAdapter();
    const result = await adapter.recognizePdf("scan.pdf");

    expect(result.status).toBe("OCR 실패");
    expect(result.nextAction).toContain("텍스트 PDF");
  });

  it("marks short OCR text as low confidence", () => {
    expect(classifyOcrResult("제품명")).toBe("OCR 신뢰도 낮음");
    expect(classifyOcrResult("제품명 MY-M-11\\n3. 구성성분의 명칭 및 함유량\\n60676-86-0 실리카 85 95")).toBe("OCR 완료");
  });
});
```

- [ ] **Step 7: Implement OCR adapter boundary**

`server/services/ocrAdapter.ts`:

```ts
export type OcrStatus = "OCR 진행중" | "OCR 완료" | "OCR 신뢰도 낮음" | "OCR 실패";

export interface OcrResult {
  status: OcrStatus;
  text: string;
  confidence: number;
  engine: string;
  evidenceLocation: string;
  nextAction: string;
}

export interface OcrAdapter {
  recognizePdf(filePath: string): Promise<OcrResult>;
}

export function classifyOcrResult(text: string): OcrStatus {
  const normalized = text.replace(/\s+/g, "");
  if (normalized.length < 40) return "OCR 신뢰도 낮음";
  return "OCR 완료";
}

export function createDisabledOcrAdapter(): OcrAdapter {
  return {
    async recognizePdf() {
      return {
        status: "OCR 실패",
        text: "",
        confidence: 0,
        engine: "disabled",
        evidenceLocation: "",
        nextAction: "공급사에 텍스트 PDF 요청 또는 수동입력 모드 사용"
      };
    }
  };
}

export function createLocalCliOcrAdapter(command: string): OcrAdapter {
  return {
    async recognizePdf() {
      return {
        status: "OCR 실패",
        text: "",
        confidence: 0,
        engine: command,
        evidenceLocation: "",
        nextAction: `${command} OCR 연동은 설치 확인 후 활성화`
      };
    }
  };
}
```

- [ ] **Step 8: Verify OCR adapter**

Run:

```bash
npm test -- tests/services/ocrAdapter.test.ts
```

Expected: PASS.

### Task 0C: Security Gate for AI Adapter

**Files:**
- Modify: `server/services/codexAdapter.ts`
- Test: `tests/services/codexAdapter.test.ts`

- [ ] **Step 1: Add test for security mode**

```ts
import { describe, expect, it } from "vitest";
import { createAiAdapterFromMode } from "../../server/services/codexAdapter";

describe("AI adapter mode", () => {
  it("does not allow Codex CLI unless explicitly enabled", () => {
    expect(() => createAiAdapterFromMode("codex_cli", { allowExternalLlm: false })).toThrow("External LLM use is not approved");
  });
});
```

- [ ] **Step 2: Implement adapter mode gate**

```ts
export type AiAdapterMode = "fixture" | "codex_cli" | "local_only_manual" | "local_llm_future";

export function createAiAdapterFromMode(mode: AiAdapterMode, options: { allowExternalLlm: boolean }): CodexAdapter {
  if (mode === "fixture") return createFixtureCodexAdapter();
  if (mode === "codex_cli") {
    if (!options.allowExternalLlm) throw new Error("External LLM use is not approved");
    return createCliCodexAdapter();
  }
  return {
    async structureMsds() {
      throw new Error("Manual/local-only structuring mode requires user-entered fields");
    }
  };
}
```

### Task 0D: Product Revision Diff

**Files:**
- Create: `server/services/revisionDiff.ts`
- Test: `tests/services/revisionDiff.test.ts`

- [ ] **Step 1: Write diff test**

```ts
import { describe, expect, it } from "vitest";
import { diffComponents } from "../../server/services/revisionDiff";

describe("revision diff", () => {
  it("detects CAS additions, removals, and content changes", () => {
    const diff = diffComponents(
      [{ casNo: "60676-86-0", chemicalName: "실리카", contentMin: "85", contentMax: "95" }],
      [
        { casNo: "60676-86-0", chemicalName: "실리카", contentMin: "80", contentMax: "90" },
        { casNo: "1344-28-1", chemicalName: "산화 알루미늄", contentMin: "1", contentMax: "5" }
      ]
    );

    expect(diff.map((item) => item.changeType)).toEqual(["content_changed", "cas_added"]);
  });
});
```

- [ ] **Step 2: Implement diff**

```ts
type DiffComponent = { casNo: string; chemicalName: string; contentMin: string; contentMax: string };

export function diffComponents(previousRows: DiffComponent[], nextRows: DiffComponent[]) {
  const previous = new Map(previousRows.map((row) => [row.casNo, row]));
  const next = new Map(nextRows.map((row) => [row.casNo, row]));
  const changes: Array<{ changeType: string; casNo: string; previousValue: string; newValue: string }> = [];

  for (const [casNo, nextRow] of next) {
    const previousRow = previous.get(casNo);
    if (!previousRow) {
      changes.push({ changeType: "cas_added", casNo, previousValue: "", newValue: JSON.stringify(nextRow) });
      continue;
    }
    if (previousRow.contentMin !== nextRow.contentMin || previousRow.contentMax !== nextRow.contentMax) {
      changes.push({ changeType: "content_changed", casNo, previousValue: `${previousRow.contentMin}-${previousRow.contentMax}`, newValue: `${nextRow.contentMin}-${nextRow.contentMax}` });
    }
  }

  for (const [casNo, previousRow] of previous) {
    if (!next.has(casNo)) {
      changes.push({ changeType: "cas_removed", casNo, previousValue: JSON.stringify(previousRow), newValue: "" });
    }
  }

  return changes;
}
```

### Task 0E: Audit Log and Backup

**Files:**
- Create: `server/services/auditLog.ts`
- Create: `server/services/backup.ts`
- Test: `tests/services/backup.test.ts`

- [ ] **Step 1: Add backup test**

```ts
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createBackupSnapshot } from "../../server/services/backup";

describe("backup", () => {
  it("copies sqlite database and records a hash", async () => {
    const dir = await mkdtemp(join(tmpdir(), "msds-backup-"));
    const dbPath = join(dir, "msds.sqlite");
    await writeFile(dbPath, "database");

    const snapshot = await createBackupSnapshot(dbPath, join(dir, "backups"));
    const copied = await readFile(snapshot.snapshotPath, "utf8");

    expect(copied).toBe("database");
    expect(snapshot.databaseHash).toHaveLength(64);
  });
});
```

- [ ] **Step 2: Implement backup**

```ts
import { createHash } from "node:crypto";
import { mkdir, readFile, copyFile } from "node:fs/promises";
import { basename, join } from "node:path";

export async function createBackupSnapshot(databasePath: string, backupDir: string) {
  await mkdir(backupDir, { recursive: true });
  const buffer = await readFile(databasePath);
  const databaseHash = createHash("sha256").update(buffer).digest("hex");
  const snapshotPath = join(backupDir, `${new Date().toISOString().replace(/[:.]/g, "-")}-${basename(databasePath)}`);
  await copyFile(databasePath, snapshotPath);
  return { snapshotPath, databaseHash, status: "success" as const };
}
```

- [ ] **Step 3: Implement audit helper**

```ts
import type Database from "better-sqlite3";
import { nanoid } from "nanoid";

export function writeAuditLog(db: Database.Database, input: {
  entityType: string;
  entityId: string;
  action: string;
  previousValue: string;
  newValue: string;
  actor: string;
  reason: string;
}) {
  const row = { auditId: nanoid(), createdAt: new Date().toISOString(), ...input };
  db.prepare(`
    INSERT INTO audit_logs VALUES (@auditId, @entityType, @entityId, @action, @previousValue, @newValue, @actor, @createdAt, @reason)
  `).run(row);
  return row;
}
```


**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `vitest.config.ts`
- Create: `index.html`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/styles.css`
- Create: `server/index.ts`
- Create: `server/storage/.gitkeep`

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "msds-management-watchlist-mvp",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "concurrently \"npm run dev:web\" \"npm run dev:api\"",
    "dev:web": "vite --host 127.0.0.1",
    "dev:api": "tsx watch server/index.ts",
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@vitejs/plugin-react": "latest",
    "better-sqlite3": "latest",
    "concurrently": "latest",
    "csv-parse": "latest",
    "express": "latest",
    "lucide-react": "latest",
    "multer": "latest",
    "nanoid": "latest",
    "pdf-parse": "latest",
    "pdfjs-dist": "latest",
    "react": "latest",
    "react-dom": "latest",
    "tsx": "latest",
    "vite": "latest",
    "zod": "latest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "latest",
    "@testing-library/react": "latest",
    "@testing-library/user-event": "latest",
    "@types/better-sqlite3": "latest",
    "@types/express": "latest",
    "@types/multer": "latest",
    "@types/node": "latest",
    "@types/react": "latest",
    "@types/react-dom": "latest",
    "jsdom": "latest",
    "typescript": "latest",
    "vitest": "latest"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run:

```bash
npm install
```

Expected: `node_modules/` and `package-lock.json` are created.

- [ ] **Step 3: Add TypeScript and Vite config**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "types": ["vitest/globals", "@testing-library/jest-dom"]
  },
  "include": ["src", "server", "shared", "tests"]
}
```

`vite.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:8787"
    }
  }
});
```

`vitest.config.ts`:

```ts
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: []
  }
});
```

- [ ] **Step 4: Add minimal app and server**

`index.html`:

```html
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MSDS Watcher MVP</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

`src/App.tsx`:

```tsx
export function App() {
  return (
    <main className="app-shell">
      <h1>MSDS 관리자동화·변경감시 MVP</h1>
      <p>로컬 MSDS 등록 검수 도구</p>
    </main>
  );
}
```

`src/styles.css`:

```css
body {
  margin: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #1f2933;
  background: #f6f8fa;
}

.app-shell {
  padding: 24px;
}
```

`server/index.ts`:

```ts
import express from "express";

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(8787, "127.0.0.1", () => {
  console.log("MSDS API listening on http://127.0.0.1:8787");
});
```

- [ ] **Step 5: Verify scaffold**

Run:

```bash
npm run typecheck
npm test
```

Expected: typecheck passes, Vitest reports no tests or passes once tests exist.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts vitest.config.ts index.html src server
git commit -m "chore: scaffold local MSDS app"
```

If the directory is not a Git repository, skip the commit and record that in the final implementation note.

## Task 2: Domain Schema and Status Rules

**Files:**
- Create: `shared/types.ts`
- Create: `server/domain/status.ts`
- Create: `server/domain/registrationSchema.ts`
- Test: `tests/domain/registrationSchema.test.ts`

- [ ] **Step 1: Write the failing schema test**

`tests/domain/registrationSchema.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { COMPONENT_COLUMNS, REGISTRATION_SECTIONS } from "../../server/domain/registrationSchema";
import { isActionableStatus } from "../../server/domain/status";

describe("registration schema", () => {
  it("keeps the internal MSDS screen section order", () => {
    expect(REGISTRATION_SECTIONS.map((section) => section.key)).toEqual([
      "basic",
      "components",
      "hazards",
      "revisions"
    ]);
  });

  it("keeps the component row copy order from the internal schema", () => {
    expect(COMPONENT_COLUMNS.map((column) => column.key)).toEqual([
      "casNo",
      "chemicalName",
      "contentMin",
      "contentMax",
      "contentSingle",
      "specialManagement",
      "controlledHazardous",
      "permissionRequired",
      "manufactureProhibited",
      "psm",
      "workEnvironmentMeasurement",
      "exposureLimit",
      "permissibleLimit",
      "specialHealthExam",
      "prohibited",
      "restricted",
      "permitted",
      "toxic",
      "accidentPreparedness"
    ]);
  });

  it("treats follow-up states as actionable results, not blanks", () => {
    expect(isActionableStatus("확인필요")).toBe(true);
    expect(isActionableStatus("공급사 확인 필요")).toBe(true);
    expect(isActionableStatus("")).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/domain/registrationSchema.test.ts
```

Expected: FAIL because `registrationSchema` and `status` modules do not exist.

- [ ] **Step 3: Implement shared types**

`shared/types.ts`:

```ts
export type FieldStatus =
  | "해당"
  | "비해당"
  | "해당 후보"
  | "비해당 후보"
  | "확인필요"
  | "공급사 확인 필요"
  | "내부 기준 확인 필요"
  | "자동추출"
  | "확인필요"
  | "확인완료"
  | "보류";

export type SourceType = "MSDS" | "OFFICIAL_DB" | "INTERNAL_RULE" | "USER_INPUT";

export interface RegistrationField {
  fieldId: string;
  documentId: string;
  section: "basic" | "components" | "hazards" | "revisions";
  fieldKey: string;
  fieldLabel: string;
  candidateValue: string;
  normalizedValue: string;
  status: FieldStatus;
  sourceType: SourceType;
  sourceName: string;
  sourceReference: string;
  lookupDate: string;
  evidenceText: string;
  evidenceLocation: string;
  nextAction: string;
  userReviewStatus: "unreviewed" | "confirmed" | "edited" | "pending";
  userNote: string;
}

export interface ComponentRow {
  componentId: string;
  documentId: string;
  casNo: string;
  chemicalName: string;
  contentMin: string;
  contentMax: string;
  contentSingle: string;
  contentOriginalText: string;
  tradeSecretFlag: boolean;
  rowCopyText: string;
  reviewStatus: FieldStatus;
}

export interface RegulatoryMatch {
  matchId: string;
  componentId: string;
  seedId: string;
  category: string;
  candidateValue: FieldStatus;
  periodValue: string;
  periodUnit: "개월" | "년" | "";
  status: FieldStatus;
  sourceName: string;
  sourceReference: string;
  lookupDate: string;
  evidenceText: string;
  nextAction: string;
  reviewerDecision: FieldStatus | "";
}
```

`server/domain/status.ts`:

```ts
import type { FieldStatus } from "../../shared/types";

export const FIELD_STATUSES: FieldStatus[] = [
  "해당",
  "비해당",
  "해당 후보",
  "비해당 후보",
  "확인필요",
  "공급사 확인 필요",
  "내부 기준 확인 필요",
  "자동추출",
  "확인필요",
  "확인완료",
  "보류"
];

export function isActionableStatus(value: string): value is FieldStatus {
  return FIELD_STATUSES.includes(value as FieldStatus);
}
```

- [ ] **Step 4: Implement registration schema**

`server/domain/registrationSchema.ts`:

```ts
export const REGISTRATION_SECTIONS = [
  {
    key: "basic",
    label: "물품 기본 정보",
    fields: [
      "공급사",
      "제조사",
      "대표전화",
      "E-mail",
      "제품명",
      "용도",
      "ITEM코드",
      "MSDS번호",
      "제조구분",
      "사업장",
      "최종개정일자",
      "구분",
      "검토자",
      "검토의견"
    ]
  },
  { key: "components", label: "함유량 및 법적규제 정보", fields: [] },
  { key: "hazards", label: "유해성 위험성 정보", fields: ["제품형태", "유해성 위험성"] },
  { key: "revisions", label: "개정이력", fields: ["개정일자", "개정번호/버전", "개정내용", "검토 상태"] }
] as const;

export const COMPONENT_COLUMNS = [
  { key: "casNo", label: "CAS No." },
  { key: "chemicalName", label: "화학물질" },
  { key: "contentMin", label: "MIN" },
  { key: "contentMax", label: "MAX" },
  { key: "contentSingle", label: "단일" },
  { key: "specialManagement", label: "특별관리물질" },
  { key: "controlledHazardous", label: "관리대상유해물질" },
  { key: "permissionRequired", label: "허가대상물질" },
  { key: "manufactureProhibited", label: "제조금지물질" },
  { key: "psm", label: "PSM" },
  { key: "workEnvironmentMeasurement", label: "작업환경측정 대상물질" },
  { key: "exposureLimit", label: "노출기준설정물질" },
  { key: "permissibleLimit", label: "허용기준설정물질" },
  { key: "specialHealthExam", label: "특수건강검진대상물질" },
  { key: "prohibited", label: "금지물질" },
  { key: "restricted", label: "제한물질" },
  { key: "permitted", label: "허가물질" },
  { key: "toxic", label: "유독물질" },
  { key: "accidentPreparedness", label: "사고대비물질" }
] as const;
```

- [ ] **Step 5: Run test**

Run:

```bash
npm test -- tests/domain/registrationSchema.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add shared server/domain tests/domain
git commit -m "feat: define MSDS registration schema"
```

## Task 3: SQLite Persistence

**Files:**
- Create: `server/db/connection.ts`
- Create: `server/db/schema.ts`
- Create: `server/db/repositories.ts`
- Test: `tests/db/repositories.test.ts`

- [ ] **Step 1: Write repository test**

`tests/db/repositories.test.ts`:

```ts
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migrate } from "../../server/db/schema";
import { createRepositories } from "../../server/db/repositories";

describe("repositories", () => {
  it("saves a verified document, component, product, and watchlist item", () => {
    const db = new Database(":memory:");
    migrate(db);
    const repos = createRepositories(db);

    const document = repos.documents.create({
      fileName: "sample.pdf",
      fileHash: "hash-1",
      sourcePdfPath: "server/storage/sample.pdf"
    });

    const product = repos.products.upsertFromDocument({
      documentId: document.documentId,
      productName: "MY-M-11 (MR-90)",
      supplier: "포스코퓨처엠",
      manufacturer: "포스코퓨처엠",
      msdsNumber: "AA00786-0000000090",
      latestRevisionDate: "2026-04-02"
    });

    const component = repos.components.create({
      documentId: document.documentId,
      casNo: "60676-86-0",
      chemicalName: "실리카, 퓨즈드",
      contentMin: "85",
      contentMax: "95",
      contentSingle: "",
      contentOriginalText: "85~95",
      tradeSecretFlag: false,
      rowCopyText: "60676-86-0\t실리카, 퓨즈드\t85\t95"
    });

    repos.regulatoryMatches.create({
      componentId: component.componentId,
      category: "workEnvironmentMeasurement",
      candidateValue: "해당 후보",
      periodValue: "6",
      periodUnit: "개월",
      status: "해당 후보",
      sourceName: "내부 기준표 test seed",
      sourceReference: "internal://test-seed/industrial-health-rules",
      lookupDate: "2026-04-25",
      evidenceText: "작업환경측정 대상물질, 6개월",
      nextAction: "측정 주기와 현장 노출 여부 확인",
      reviewerDecision: ""
    });
    repos.watchlist.upsertFromComponent(component, [product.productId], []);

    expect(repos.documents.list()).toHaveLength(1);
    expect(repos.products.list()[0].productName).toBe("MY-M-11 (MR-90)");
    expect(repos.regulatoryMatches.listByComponent(component.componentId)).toHaveLength(1);
    expect(repos.watchlist.list()[0].casNo).toBe("60676-86-0");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/db/repositories.test.ts
```

Expected: FAIL because database modules do not exist.

- [ ] **Step 3: Implement schema migration**

`server/db/schema.ts`:

```ts
import type Database from "better-sqlite3";

export function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      document_id TEXT PRIMARY KEY,
      file_name TEXT NOT NULL,
      file_hash TEXT NOT NULL,
      upload_date TEXT NOT NULL,
      processing_status TEXT NOT NULL,
      source_pdf_path TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      product_id TEXT PRIMARY KEY,
      current_document_id TEXT NOT NULL,
      product_name TEXT NOT NULL,
      supplier TEXT NOT NULL,
      manufacturer TEXT NOT NULL,
      item_code TEXT NOT NULL DEFAULT '',
      msds_number TEXT NOT NULL,
      latest_revision_date TEXT NOT NULL,
      review_status TEXT NOT NULL,
      registration_status TEXT NOT NULL DEFAULT '등록대기',
      latest_request_status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_revisions (
      revision_id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      document_id TEXT NOT NULL,
      msds_number TEXT NOT NULL,
      revision_date TEXT NOT NULL,
      revision_version TEXT NOT NULL,
      source_file_hash TEXT NOT NULL,
      promoted_at TEXT NOT NULL,
      promoted_by TEXT NOT NULL,
      review_status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_revision_diffs (
      diff_id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      previous_revision_id TEXT NOT NULL,
      new_revision_id TEXT NOT NULL,
      change_type TEXT NOT NULL,
      field_key TEXT NOT NULL,
      previous_value TEXT NOT NULL,
      new_value TEXT NOT NULL,
      evidence_text TEXT NOT NULL,
      review_status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS components (
      component_id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      cas_no TEXT NOT NULL,
      chemical_name TEXT NOT NULL,
      content_min TEXT NOT NULL,
      content_max TEXT NOT NULL,
      content_single TEXT NOT NULL,
      content_original_text TEXT NOT NULL,
      trade_secret_flag INTEGER NOT NULL,
      row_copy_text TEXT NOT NULL,
      review_status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS regulatory_matches (
      match_id TEXT PRIMARY KEY,
      component_id TEXT NOT NULL,
      seed_id TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL,
      candidate_value TEXT NOT NULL,
      period_value TEXT NOT NULL,
      period_unit TEXT NOT NULL,
      status TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_reference TEXT NOT NULL,
      lookup_date TEXT NOT NULL,
      evidence_text TEXT NOT NULL,
      next_action TEXT NOT NULL,
      reviewer_decision TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS regulatory_seeds (
      seed_id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      cas_no TEXT NOT NULL,
      chemical_name_ko TEXT NOT NULL,
      chemical_name_en TEXT NOT NULL,
      synonyms TEXT NOT NULL,
      threshold_text TEXT NOT NULL,
      period_value TEXT NOT NULL,
      period_unit TEXT NOT NULL,
      source_name TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_revision_date TEXT NOT NULL,
      note TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      audit_id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      action TEXT NOT NULL,
      previous_value TEXT NOT NULL,
      new_value TEXT NOT NULL,
      actor TEXT NOT NULL,
      created_at TEXT NOT NULL,
      reason TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS backup_snapshots (
      snapshot_id TEXT PRIMARY KEY,
      snapshot_path TEXT NOT NULL,
      created_at TEXT NOT NULL,
      database_hash TEXT NOT NULL,
      status TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sites (
      site_id TEXT PRIMARY KEY,
      site_name TEXT NOT NULL,
      process_name TEXT NOT NULL,
      department TEXT NOT NULL,
      owner TEXT NOT NULL,
      note TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_sites (
      product_site_id TEXT PRIMARY KEY,
      product_id TEXT NOT NULL,
      site_id TEXT NOT NULL,
      usage_purpose TEXT NOT NULL,
      storage_location TEXT NOT NULL,
      monthly_usage TEXT NOT NULL,
      posted_msds_location TEXT NOT NULL,
      active_flag INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS watchlist_items (
      watchlist_id TEXT PRIMARY KEY,
      cas_no TEXT NOT NULL UNIQUE,
      chemical_name TEXT NOT NULL,
      related_component_ids TEXT NOT NULL,
      related_product_ids TEXT NOT NULL,
      related_site_ids TEXT NOT NULL,
      source_name TEXT NOT NULL,
      last_lookup_date TEXT NOT NULL,
      last_result_hash TEXT NOT NULL,
      last_result_summary TEXT NOT NULL,
      watch_status TEXT NOT NULL
    );
  `);
}
```

- [ ] **Step 4: Implement connection**

`server/db/connection.ts`:

```ts
import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { migrate } from "./schema";

const dbPath = resolve("server/storage/msds.sqlite");
mkdirSync(dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
migrate(db);
```

- [ ] **Step 5: Implement repositories**

`server/db/repositories.ts`:

```ts
import type Database from "better-sqlite3";
import { nanoid } from "nanoid";
import type { ComponentRow, RegulatoryMatch } from "../../shared/types";

export function createRepositories(db: Database.Database) {
  return {
    documents: {
      create(input: { fileName: string; fileHash: string; sourcePdfPath: string }) {
        const row = {
          documentId: nanoid(),
          fileName: input.fileName,
          fileHash: input.fileHash,
          uploadDate: new Date().toISOString(),
          processingStatus: "uploaded",
          sourcePdfPath: input.sourcePdfPath
        };
        db.prepare(`
          INSERT INTO documents VALUES (@documentId, @fileName, @fileHash, @uploadDate, @processingStatus, @sourcePdfPath)
        `).run(row);
        return row;
      },
      list() {
        return db.prepare("SELECT document_id AS documentId, file_name AS fileName FROM documents ORDER BY upload_date DESC").all();
      }
    },
    products: {
      upsertFromDocument(input: {
        documentId: string;
        productName: string;
        supplier: string;
        manufacturer: string;
        msdsNumber: string;
        latestRevisionDate: string;
      }) {
        const existing = db.prepare("SELECT product_id AS productId FROM products WHERE product_name = ? AND supplier = ?").get(input.productName, input.supplier) as { productId: string } | undefined;
        const row = {
          productId: existing?.productId ?? nanoid(),
          currentDocumentId: input.documentId,
          productName: input.productName,
          supplier: input.supplier,
          manufacturer: input.manufacturer,
          msdsNumber: input.msdsNumber,
          latestRevisionDate: input.latestRevisionDate,
          reviewStatus: "확인필요",
          latestRequestStatus: "확인필요"
        };
        db.prepare(`
          INSERT INTO products VALUES (@productId, @currentDocumentId, @productName, @supplier, @manufacturer, @msdsNumber, @latestRevisionDate, @reviewStatus, @latestRequestStatus)
          ON CONFLICT(product_id) DO UPDATE SET
            current_document_id = excluded.current_document_id,
            msds_number = excluded.msds_number,
            latest_revision_date = excluded.latest_revision_date,
            review_status = excluded.review_status
        `).run(row);
        return row;
      },
      list() {
        return db.prepare("SELECT product_id AS productId, product_name AS productName, supplier, latest_revision_date AS latestRevisionDate FROM products ORDER BY product_name").all();
      }
    },
    components: {
      create(input: Omit<ComponentRow, "componentId" | "reviewStatus">) {
        const row = {
          componentId: nanoid(),
          ...input,
          tradeSecretFlag: input.tradeSecretFlag ? 1 : 0,
          reviewStatus: "확인필요"
        };
        db.prepare(`
          INSERT INTO components VALUES (@componentId, @documentId, @casNo, @chemicalName, @contentMin, @contentMax, @contentSingle, @contentOriginalText, @tradeSecretFlag, @rowCopyText, @reviewStatus)
        `).run(row);
        return { ...row, tradeSecretFlag: Boolean(row.tradeSecretFlag) };
      }
    },
    regulatoryMatches: {
      create(input: Omit<RegulatoryMatch, "matchId" | "seedId"> & { seedId?: string }) {
        const row = {
          matchId: nanoid(),
          componentId: input.componentId,
          seedId: input.seedId ?? "",
          category: input.category,
          candidateValue: input.candidateValue,
          periodValue: input.periodValue,
          periodUnit: input.periodUnit,
          status: input.status,
          sourceName: input.sourceName,
          sourceReference: input.sourceReference,
          lookupDate: input.lookupDate,
          evidenceText: input.evidenceText,
          nextAction: input.nextAction,
          reviewerDecision: input.reviewerDecision
        };
        db.prepare(`
          INSERT INTO regulatory_matches VALUES (@matchId, @componentId, @seedId, @category, @candidateValue, @periodValue, @periodUnit, @status, @sourceName, @sourceReference, @lookupDate, @evidenceText, @nextAction, @reviewerDecision)
        `).run(row);
        return row;
      },
      listByComponent(componentId: string) {
        return db.prepare(`
          SELECT match_id AS matchId, category, candidate_value AS candidateValue, period_value AS periodValue, period_unit AS periodUnit, status, source_name AS sourceName, evidence_text AS evidenceText
          FROM regulatory_matches
          WHERE component_id = ?
          ORDER BY category
        `).all(componentId);
      }
    },
    watchlist: {
      upsertFromComponent(component: ComponentRow, productIds: string[], siteIds: string[]) {
        const row = {
          watchlistId: nanoid(),
          casNo: component.casNo,
          chemicalName: component.chemicalName,
          relatedComponentIds: JSON.stringify([component.componentId]),
          relatedProductIds: JSON.stringify(productIds),
          relatedSiteIds: JSON.stringify(siteIds),
          sourceName: "",
          lastLookupDate: "",
          lastResultHash: "",
          lastResultSummary: "",
          watchStatus: "공식 출처 조회 필요"
        };
        db.prepare(`
          INSERT INTO watchlist_items VALUES (@watchlistId, @casNo, @chemicalName, @relatedComponentIds, @relatedProductIds, @relatedSiteIds, @sourceName, @lastLookupDate, @lastResultHash, @lastResultSummary, @watchStatus)
          ON CONFLICT(cas_no) DO UPDATE SET
            chemical_name = excluded.chemical_name,
            related_component_ids = excluded.related_component_ids,
            related_product_ids = excluded.related_product_ids,
            related_site_ids = excluded.related_site_ids
        `).run(row);
        return row;
      },
      list() {
        return db.prepare("SELECT cas_no AS casNo, chemical_name AS chemicalName, watch_status AS watchStatus FROM watchlist_items ORDER BY cas_no").all();
      }
    }
  };
}
```

- [ ] **Step 6: Run repository test**

Run:

```bash
npm test -- tests/db/repositories.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add server/db tests/db
git commit -m "feat: add local MSDS persistence"
```

## Task 4: Copy Formatting

**Files:**
- Create: `server/services/copyFormat.ts`
- Test: `tests/services/copyFormat.test.ts`

- [ ] **Step 1: Write failing copy-format test**

`tests/services/copyFormat.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatComponentRowCopy } from "../../server/services/copyFormat";

describe("copy formatting", () => {
  it("formats a component row in the internal schema order", () => {
    const text = formatComponentRowCopy({
      casNo: "60676-86-0",
      chemicalName: "실리카, 퓨즈드",
      contentMin: "85",
      contentMax: "95",
      contentSingle: "",
      flags: {
        specialManagement: "",
        controlledHazardous: "",
        permissionRequired: "",
        manufactureProhibited: "",
        psm: "",
        workEnvironmentMeasurement: "",
        exposureLimit: "Y",
        permissibleLimit: "",
        specialHealthExam: "",
        prohibited: "",
        restricted: "",
        permitted: "",
        toxic: "",
        accidentPreparedness: ""
      }
    });

    expect(text).toBe("60676-86-0\t실리카, 퓨즈드\t85\t95\t\t\t\t\t\t\t\tY\t\t\t\t\t\t\t");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/services/copyFormat.test.ts
```

Expected: FAIL because `copyFormat` does not exist.

- [ ] **Step 3: Implement formatter**

`server/services/copyFormat.ts`:

```ts
type ComponentFlagKey =
  | "specialManagement"
  | "controlledHazardous"
  | "permissionRequired"
  | "manufactureProhibited"
  | "psm"
  | "workEnvironmentMeasurement"
  | "exposureLimit"
  | "permissibleLimit"
  | "specialHealthExam"
  | "prohibited"
  | "restricted"
  | "permitted"
  | "toxic"
  | "accidentPreparedness";

export function formatComponentRowCopy(input: {
  casNo: string;
  chemicalName: string;
  contentMin: string;
  contentMax: string;
  contentSingle: string;
  flags: Record<ComponentFlagKey, string>;
}) {
  return [
    input.casNo,
    input.chemicalName,
    input.contentMin,
    input.contentMax,
    input.contentSingle,
    input.flags.specialManagement,
    input.flags.controlledHazardous,
    input.flags.permissionRequired,
    input.flags.manufactureProhibited,
    input.flags.psm,
    input.flags.workEnvironmentMeasurement,
    input.flags.exposureLimit,
    input.flags.permissibleLimit,
    input.flags.specialHealthExam,
    input.flags.prohibited,
    input.flags.restricted,
    input.flags.permitted,
    input.flags.toxic,
    input.flags.accidentPreparedness
  ].join("\t");
}
```

- [ ] **Step 4: Run test**

Run:

```bash
npm test -- tests/services/copyFormat.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/copyFormat.ts tests/services/copyFormat.test.ts
git commit -m "feat: format MSDS component copy rows"
```

## Task 5: Codex Adapter with Fixture Mode

**Files:**
- Create: `server/services/codexAdapter.ts`
- Test: `tests/services/codexAdapter.test.ts`

- [ ] **Step 1: Write failing adapter test**

`tests/services/codexAdapter.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { parseCodexJson, createFixtureCodexAdapter } from "../../server/services/codexAdapter";

describe("codex adapter", () => {
  it("rejects non-json responses", () => {
    expect(() => parseCodexJson("not json")).toThrow("Codex response was not valid JSON");
  });

  it("returns candidate values from fixture mode", async () => {
    const adapter = createFixtureCodexAdapter();
    const result = await adapter.structureMsds({
      text: "제품명: MY-M-11 (MR-90)\nCAS No. 60676-86-0 실리카, 퓨즈드 85~95%",
      schemaVersion: "mvp-1"
    });

    expect(result.basic.productName.candidateValue).toBe("MY-M-11 (MR-90)");
    expect(result.components[0].casNo).toBe("60676-86-0");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/services/codexAdapter.test.ts
```

Expected: FAIL because `codexAdapter` does not exist.

- [ ] **Step 3: Implement adapter**

`server/services/codexAdapter.ts`:

```ts
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";

const execFileAsync = promisify(execFile);

const CandidateFieldSchema = z.object({
  candidateValue: z.string(),
  status: z.string(),
  sourceName: z.string(),
  evidenceText: z.string(),
  nextAction: z.string()
});

const StructuredMsdsSchema = z.object({
  basic: z.object({
    productName: CandidateFieldSchema,
    supplier: CandidateFieldSchema,
    manufacturer: CandidateFieldSchema,
    msdsNumber: CandidateFieldSchema,
    latestRevisionDate: CandidateFieldSchema
  }),
  components: z.array(
    z.object({
      casNo: z.string(),
      chemicalName: z.string(),
      contentMin: z.string(),
      contentMax: z.string(),
      contentSingle: z.string(),
      contentOriginalText: z.string(),
      evidenceText: z.string()
    })
  ),
  hazards: z.object({
    productForm: CandidateFieldSchema,
    hazardText: CandidateFieldSchema
  }),
  revisions: z.array(
    z.object({
      revisionDate: z.string(),
      revisionVersion: z.string(),
      revisionText: z.string()
    })
  )
});

export type StructuredMsds = z.infer<typeof StructuredMsdsSchema>;

export function parseCodexJson(raw: string): StructuredMsds {
  try {
    return StructuredMsdsSchema.parse(JSON.parse(raw));
  } catch {
    throw new Error("Codex response was not valid JSON");
  }
}

export interface CodexAdapter {
  structureMsds(input: { text: string; schemaVersion: string }): Promise<StructuredMsds>;
}

export function createFixtureCodexAdapter(): CodexAdapter {
  return {
    async structureMsds() {
      return {
        basic: {
          productName: { candidateValue: "MY-M-11 (MR-90)", status: "자동추출", sourceName: "MSDS", evidenceText: "제품명: MY-M-11 (MR-90)", nextAction: "" },
          supplier: { candidateValue: "포스코퓨처엠", status: "자동추출", sourceName: "MSDS", evidenceText: "공급사: 포스코퓨처엠", nextAction: "" },
          manufacturer: { candidateValue: "포스코퓨처엠", status: "자동추출", sourceName: "MSDS", evidenceText: "제조사: 포스코퓨처엠", nextAction: "" },
          msdsNumber: { candidateValue: "AA00786-0000000090", status: "자동추출", sourceName: "MSDS", evidenceText: "MSDS번호: AA00786-0000000090", nextAction: "" },
          latestRevisionDate: { candidateValue: "2026-04-02", status: "자동추출", sourceName: "MSDS", evidenceText: "최종개정일자: 2026-04-02", nextAction: "" }
        },
        components: [
          {
            casNo: "60676-86-0",
            chemicalName: "실리카, 퓨즈드",
            contentMin: "85",
            contentMax: "95",
            contentSingle: "",
            contentOriginalText: "85~95",
            evidenceText: "CAS No. 60676-86-0 실리카, 퓨즈드 85~95%"
          }
        ],
        hazards: {
          productForm: { candidateValue: "분말", status: "자동추출", sourceName: "MSDS", evidenceText: "제품형태: 분말", nextAction: "" },
          hazardText: { candidateValue: "심한 눈 손상성/눈 자극성-구분 2", status: "자동추출", sourceName: "MSDS", evidenceText: "유해성 위험성", nextAction: "" }
        },
        revisions: [{ revisionDate: "2026-04-02", revisionVersion: "", revisionText: "최신 개정" }]
      };
    }
  };
}

export function createCliCodexAdapter(): CodexAdapter {
  return {
    async structureMsds(input) {
      const prompt = [
        "Return ONLY valid JSON for the MSDS registration schema.",
        "Do not make final legal determinations.",
        "Every field must have candidateValue, status, sourceName, evidenceText, nextAction.",
        `Schema version: ${input.schemaVersion}`,
        input.text
      ].join("\n\n");

      const { stdout } = await execFileAsync("codex", ["exec", "--json", prompt], {
        timeout: 120_000,
        maxBuffer: 10 * 1024 * 1024
      });
      return parseCodexJson(stdout);
    }
  };
}
```

- [ ] **Step 4: Run adapter test**

Run:

```bash
npm test -- tests/services/codexAdapter.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/codexAdapter.ts tests/services/codexAdapter.test.ts
git commit -m "feat: add Codex MSDS structuring adapter"
```

## Task 6: Regulatory Lookup Adapter

**Files:**
- Create: `server/services/regulatoryLookup.ts`
- Test: `tests/services/regulatoryLookup.test.ts`

- [ ] **Step 1: Write failing lookup test**

`tests/services/regulatoryLookup.test.ts`:

```ts
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migrate } from "../../server/db/schema";
import { createSeedRegulatoryLookup } from "../../server/services/regulatoryLookup";

describe("regulatory lookup", () => {
  it("returns source-backed candidates from regulatory seed rows", async () => {
    const db = new Database(":memory:");
    migrate(db);
    db.prepare(`
      INSERT INTO regulatory_seeds VALUES (
        'seed-1', 'workEnvironmentMeasurement', '1344-28-1', '산화 알루미늄',
        'Aluminium oxide', '', '분진 노출 기준', '6', '개월',
        '내부 기준표', 'internal://seed', '2026-04-25', '작업환경측정 후보'
      )
    `).run();

    const lookup = createSeedRegulatoryLookup(db);
    const matches = await lookup.lookupByCas("1344-28-1");

    expect(matches.some((match) => match.category === "workEnvironmentMeasurement")).toBe(true);
    expect(matches.find((match) => match.category === "workEnvironmentMeasurement")?.periodValue).toBe("6");
  });

  it("returns 확인필요 with next action for unknown CAS numbers", async () => {
    const db = new Database(":memory:");
    migrate(db);
    const lookup = createSeedRegulatoryLookup(db);
    const matches = await lookup.lookupByCas("0000-00-0");

    expect(matches[0].status).toBe("확인필요");
    expect(matches[0].nextAction).toContain("공식 출처");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/services/regulatoryLookup.test.ts
```

Expected: FAIL because `regulatoryLookup` does not exist.

- [ ] **Step 3: Implement seed-backed lookup**

`server/services/regulatoryLookup.ts`:

```ts
import type Database from "better-sqlite3";
import type { RegulatoryMatch } from "../../shared/types";

export interface RegulatoryLookup {
  lookupByCas(casNo: string): Promise<Omit<RegulatoryMatch, "matchId" | "componentId" | "seedId" | "reviewerDecision">[]>;
}

type SeedRow = {
  category: string;
  casNo: string;
  chemicalNameKo: string;
  thresholdText: string;
  periodValue: string;
  periodUnit: "개월" | "년" | "";
  sourceName: string;
  sourceUrl: string;
  sourceRevisionDate: string;
  note: string;
};

export function createSeedRegulatoryLookup(db: Database.Database): RegulatoryLookup {
  return {
    async lookupByCas(casNo: string) {
      const rows = db.prepare(`
        SELECT
          category,
          cas_no AS casNo,
          chemical_name_ko AS chemicalNameKo,
          threshold_text AS thresholdText,
          period_value AS periodValue,
          period_unit AS periodUnit,
          source_name AS sourceName,
          source_url AS sourceUrl,
          source_revision_date AS sourceRevisionDate,
          note
        FROM regulatory_seeds
        WHERE cas_no = ?
        ORDER BY category
      `).all(casNo) as SeedRow[];

      if (rows.length === 0) {
        return [
          {
            category: "all",
            candidateValue: "확인필요",
            periodValue: "",
            periodUnit: "",
            status: "확인필요",
            sourceName: "regulatory_seeds",
            sourceReference: "internal://regulatory-seeds/not-found",
            lookupDate: new Date().toISOString().slice(0, 10),
            evidenceText: "내부 기준표에서 CAS No.를 찾지 못함",
            nextAction: "공식 출처, 공급사 MSDS 15번 항목, 또는 내부 기준표 갱신 필요"
          }
        ];
      }

      return rows.map((row) => ({
        category: row.category,
        candidateValue: "해당 후보",
        periodValue: row.periodValue,
        periodUnit: row.periodUnit,
        status: "해당 후보",
        sourceName: row.sourceName,
        sourceReference: row.sourceUrl,
        lookupDate: new Date().toISOString().slice(0, 10),
        evidenceText: `${row.chemicalNameKo} / ${row.thresholdText} / 기준표 개정일 ${row.sourceRevisionDate}`,
        nextAction: row.note || "담당자가 기준표와 MSDS 원문을 검수"
      }));
    }
  };
}
```

- [ ] **Step 4: Run lookup test**

Run:

```bash
npm test -- tests/services/regulatoryLookup.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/regulatoryLookup.ts tests/services/regulatoryLookup.test.ts
git commit -m "feat: add CAS regulatory lookup adapter"
```

## Task 7: Processing Pipeline

**Files:**
- Create: `server/services/pdfExtractor.ts`
- Create: `server/services/processingPipeline.ts`
- Test: `tests/services/processingPipeline.test.ts`

- [ ] **Step 1: Write failing pipeline test**

`tests/services/processingPipeline.test.ts`:

```ts
import Database from "better-sqlite3";
import { describe, expect, it } from "vitest";
import { migrate } from "../../server/db/schema";
import { createRepositories } from "../../server/db/repositories";
import { createFixtureCodexAdapter } from "../../server/services/codexAdapter";
import { createSeedRegulatoryLookup } from "../../server/services/regulatoryLookup";
import { processExtractedMsds } from "../../server/services/processingPipeline";

describe("processing pipeline", () => {
  it("creates product, component, regulatory candidates, and watchlist item", async () => {
    const db = new Database(":memory:");
    migrate(db);
    const repos = createRepositories(db);
    db.prepare(`
      INSERT INTO regulatory_seeds VALUES (
        'seed-1', 'workEnvironmentMeasurement', '60676-86-0', '실리카, 퓨즈드',
        'Fused silica', '', '분진 노출 기준', '6', '개월',
        '내부 기준표', 'internal://seed', '2026-04-25', '작업환경측정 후보'
      )
    `).run();

    await processExtractedMsds({
      repos,
      codex: createFixtureCodexAdapter(),
      regulatoryLookup: createSeedRegulatoryLookup(db),
      fileName: "sample.pdf",
      fileHash: "hash",
      sourcePdfPath: "server/storage/sample.pdf",
      extractedText: "제품명: MY-M-11 (MR-90)"
    });

    expect(repos.products.list()).toHaveLength(1);
    const watchlist = repos.watchlist.list();
    expect(watchlist[0].casNo).toBe("60676-86-0");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npm test -- tests/services/processingPipeline.test.ts
```

Expected: FAIL because `processingPipeline` does not exist.

- [ ] **Step 3: Implement PDF extractor**

`server/services/pdfExtractor.ts`:

```ts
import { readFile } from "node:fs/promises";
import pdf from "pdf-parse";
import type { OcrAdapter } from "./ocrAdapter";
import { classifyPdfTextLayer } from "./scanDetector";
import { extractComponentRowsFromText } from "./tableExtractor";

export async function extractPdfText(filePath: string, ocr?: OcrAdapter) {
  const buffer = await readFile(filePath);
  const result = await pdf(buffer);
  const layer = classifyPdfTextLayer(result.text);
  if (layer.kind === "scan") {
    const ocrResult = ocr ? await ocr.recognizePdf(filePath) : undefined;
    return {
      text: ocrResult?.text ?? "",
      pageCount: result.numpages,
      extractionStatus: ocrResult?.status ?? "OCR 실패",
      nextAction: ocrResult?.nextAction ?? "공급사에 텍스트 PDF 요청 또는 수동입력 모드 사용",
      componentRows: ocrResult?.text ? extractComponentRowsFromText(ocrResult.text) : []
    };
  }

  return {
    text: result.text,
    pageCount: result.numpages,
    extractionStatus: "텍스트 추출 가능",
    nextAction: "",
    componentRows: extractComponentRowsFromText(result.text)
  };
}
```

- [ ] **Step 4: Implement pipeline**

`server/services/processingPipeline.ts`:

```ts
import type { createRepositories } from "../db/repositories";
import type { CodexAdapter } from "./codexAdapter";
import type { RegulatoryLookup } from "./regulatoryLookup";
import { formatComponentRowCopy } from "./copyFormat";

export async function processExtractedMsds(input: {
  repos: ReturnType<typeof createRepositories>;
  codex: CodexAdapter;
  regulatoryLookup: RegulatoryLookup;
  fileName: string;
  fileHash: string;
  sourcePdfPath: string;
  extractedText: string;
}) {
  const document = input.repos.documents.create({
    fileName: input.fileName,
    fileHash: input.fileHash,
    sourcePdfPath: input.sourcePdfPath
  });

  const structured = await input.codex.structureMsds({
    text: input.extractedText,
    schemaVersion: "mvp-1"
  });

  const product = input.repos.products.upsertFromDocument({
    documentId: document.documentId,
    productName: structured.basic.productName.candidateValue,
    supplier: structured.basic.supplier.candidateValue,
    manufacturer: structured.basic.manufacturer.candidateValue,
    msdsNumber: structured.basic.msdsNumber.candidateValue,
    latestRevisionDate: structured.basic.latestRevisionDate.candidateValue
  });

  for (const candidate of structured.components) {
    const regulatoryMatches = await input.regulatoryLookup.lookupByCas(candidate.casNo);
    const flags = Object.fromEntries(
      [
        "specialManagement",
        "controlledHazardous",
        "permissionRequired",
        "manufactureProhibited",
        "psm",
        "workEnvironmentMeasurement",
        "exposureLimit",
        "permissibleLimit",
        "specialHealthExam",
        "prohibited",
        "restricted",
        "permitted",
        "toxic",
        "accidentPreparedness"
      ].map((key) => [key, regulatoryMatches.some((match) => match.category === key && match.status.includes("해당")) ? "Y" : ""])
    ) as Record<string, string>;

    const component = input.repos.components.create({
      documentId: document.documentId,
      casNo: candidate.casNo,
      chemicalName: candidate.chemicalName,
      contentMin: candidate.contentMin,
      contentMax: candidate.contentMax,
      contentSingle: candidate.contentSingle,
      contentOriginalText: candidate.contentOriginalText,
      tradeSecretFlag: candidate.casNo.trim() === "",
      rowCopyText: formatComponentRowCopy({
        casNo: candidate.casNo,
        chemicalName: candidate.chemicalName,
        contentMin: candidate.contentMin,
        contentMax: candidate.contentMax,
        contentSingle: candidate.contentSingle,
        flags: flags as Parameters<typeof formatComponentRowCopy>[0]["flags"]
      })
    });

    for (const match of regulatoryMatches) {
      input.repos.regulatoryMatches.create({
        componentId: component.componentId,
        category: match.category,
        candidateValue: match.candidateValue,
        periodValue: match.periodValue,
        periodUnit: match.periodUnit,
        status: match.status,
        sourceName: match.sourceName,
        sourceReference: match.sourceReference,
        lookupDate: match.lookupDate,
        evidenceText: match.evidenceText,
        nextAction: match.nextAction,
        reviewerDecision: ""
      });
    }

    input.repos.watchlist.upsertFromComponent(component, [product.productId], []);
  }

  return { document, product };
}
```

- [ ] **Step 5: Run pipeline test**

Run:

```bash
npm test -- tests/services/processingPipeline.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add server/services/pdfExtractor.ts server/services/processingPipeline.ts tests/services/processingPipeline.test.ts
git commit -m "feat: process MSDS into managed records"
```

## Task 8: API Routes

**Files:**
- Create: `server/routes/documents.ts`
- Create: `server/routes/products.ts`
- Create: `server/routes/watchlist.ts`
- Modify: `server/index.ts`

- [ ] **Step 1: Add route modules**

`server/routes/documents.ts`:

```ts
import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import express from "express";
import multer from "multer";
import { createRepositories } from "../db/repositories";
import { db } from "../db/connection";

const upload = multer({ storage: multer.memoryStorage() });
const repos = createRepositories(db);

export const documentsRouter = express.Router();

documentsRouter.get("/", (_req, res) => {
  res.json(repos.documents.list());
});

documentsRouter.post("/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    res.status(400).json({ error: "file is required" });
    return;
  }

  mkdirSync(resolve("server/storage/uploads"), { recursive: true });
  const hash = createHash("sha256").update(req.file.buffer).digest("hex");
  const filePath = resolve("server/storage/uploads", `${hash}-${req.file.originalname}`);
  await writeFile(filePath, req.file.buffer);

  const document = repos.documents.create({
    fileName: req.file.originalname,
    fileHash: hash,
    sourcePdfPath: filePath
  });

  res.status(201).json(document);
});
```

`server/routes/products.ts`:

```ts
import express from "express";
import { db } from "../db/connection";
import { createRepositories } from "../db/repositories";

const repos = createRepositories(db);
export const productsRouter = express.Router();

productsRouter.get("/", (_req, res) => {
  res.json(repos.products.list());
});
```

`server/routes/watchlist.ts`:

```ts
import express from "express";
import { db } from "../db/connection";
import { createRepositories } from "../db/repositories";

const repos = createRepositories(db);
export const watchlistRouter = express.Router();

watchlistRouter.get("/", (_req, res) => {
  res.json(repos.watchlist.list());
});
```

- [ ] **Step 2: Wire routes**

Modify `server/index.ts`:

```ts
import express from "express";
import { documentsRouter } from "./routes/documents";
import { productsRouter } from "./routes/products";
import { watchlistRouter } from "./routes/watchlist";

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/documents", documentsRouter);
app.use("/api/products", productsRouter);
app.use("/api/watchlist", watchlistRouter);

app.listen(8787, "127.0.0.1", () => {
  console.log("MSDS API listening on http://127.0.0.1:8787");
});
```

- [ ] **Step 3: Verify typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add server/routes server/index.ts
git commit -m "feat: expose local MSDS API"
```

## Task 9: Frontend Shell and Pages

**Files:**
- Create: `src/api/client.ts`
- Create: `src/pages/DashboardPage.tsx`
- Create: `src/pages/UploadPage.tsx`
- Create: `src/pages/ProductsPage.tsx`
- Create: `src/pages/WatchlistPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add API client**

`src/api/client.ts`:

```ts
export async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return response.json() as Promise<T>;
}

export async function uploadMsds(file: File) {
  const form = new FormData();
  form.append("file", file);
  const response = await fetch("/api/documents/upload", { method: "POST", body: form });
  if (!response.ok) throw new Error(`Upload failed: ${response.status}`);
  return response.json();
}
```

- [ ] **Step 2: Add pages**

`src/pages/DashboardPage.tsx`:

```tsx
export function DashboardPage() {
  return (
    <section className="page">
      <h2>대시보드</h2>
      <div className="metric-grid">
        <div className="metric">전체 MSDS<br /><strong>0</strong></div>
        <div className="metric">확인 필요<br /><strong>0</strong></div>
        <div className="metric">Watchlist<br /><strong>0</strong></div>
      </div>
    </section>
  );
}
```

`src/pages/UploadPage.tsx`:

```tsx
import { useState } from "react";
import { uploadMsds } from "../api/client";

export function UploadPage() {
  const [message, setMessage] = useState("");

  return (
    <section className="page">
      <h2>MSDS 업로드</h2>
      <input
        type="file"
        accept="application/pdf"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          await uploadMsds(file);
          setMessage(`${file.name} 업로드 완료`);
        }}
      />
      {message && <p className="notice">{message}</p>}
    </section>
  );
}
```

`src/pages/ProductsPage.tsx`:

```tsx
export function ProductsPage() {
  return (
    <section className="page">
      <h2>제품/현장 관리</h2>
      <p>검수 완료된 MSDS가 제품, 성분, 공급사, 현장 데이터로 누적됩니다.</p>
    </section>
  );
}
```

`src/pages/WatchlistPage.tsx`:

```tsx
export function WatchlistPage() {
  return (
    <section className="page">
      <h2>CAS No. Watchlist</h2>
      <p>검수된 CAS No.와 관련 제품/현장이 여기에 연결됩니다.</p>
    </section>
  );
}
```

- [ ] **Step 3: Wire app navigation**

`src/App.tsx`:

```tsx
import { useState } from "react";
import { DashboardPage } from "./pages/DashboardPage";
import { ProductsPage } from "./pages/ProductsPage";
import { UploadPage } from "./pages/UploadPage";
import { WatchlistPage } from "./pages/WatchlistPage";

type Page = "dashboard" | "upload" | "products" | "watchlist";

export function App() {
  const [page, setPage] = useState<Page>("dashboard");

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>MSDS Watcher</h1>
        <button onClick={() => setPage("dashboard")}>대시보드</button>
        <button onClick={() => setPage("upload")}>MSDS 업로드</button>
        <button onClick={() => setPage("products")}>제품/현장</button>
        <button onClick={() => setPage("watchlist")}>Watchlist</button>
      </aside>
      <main className="content">
        {page === "dashboard" && <DashboardPage />}
        {page === "upload" && <UploadPage />}
        {page === "products" && <ProductsPage />}
        {page === "watchlist" && <WatchlistPage />}
      </main>
    </div>
  );
}
```

- [ ] **Step 4: Update styles**

`src/styles.css`:

```css
body {
  margin: 0;
  font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  color: #1f2933;
  background: #f6f8fa;
}

button {
  cursor: pointer;
}

.layout {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: 100vh;
}

.sidebar {
  background: #12343b;
  color: white;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.sidebar h1 {
  font-size: 20px;
  margin: 0 0 16px;
}

.sidebar button {
  border: 0;
  border-radius: 6px;
  padding: 10px 12px;
  text-align: left;
  background: #1f5f6b;
  color: white;
}

.content {
  padding: 24px;
}

.page {
  max-width: 1280px;
}

.metric-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(160px, 1fr));
  gap: 12px;
}

.metric {
  background: white;
  border: 1px solid #d8dee4;
  border-radius: 8px;
  padding: 16px;
}

.metric strong {
  font-size: 32px;
}

.notice {
  margin-top: 12px;
  color: #0f766e;
}
```

- [ ] **Step 5: Verify UI typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat: add MSDS MVP app shell"
```

## Task 10: Review Components

**Files:**
- Create: `src/components/StatusBadge.tsx`
- Create: `src/components/FieldRow.tsx`
- Create: `src/components/ComponentTable.tsx`
- Create: `tests/ui/FieldRow.test.tsx`
- Create: `tests/ui/ComponentTable.test.tsx`

- [ ] **Step 1: Write UI tests**

`tests/ui/FieldRow.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FieldRow } from "../../src/components/FieldRow";

describe("FieldRow", () => {
  it("shows candidate value, evidence, status, and copies the value", async () => {
    const writeText = vi.fn();
    Object.assign(navigator, { clipboard: { writeText } });

    render(
      <FieldRow
        label="제품명"
        value="MY-M-11 (MR-90)"
        evidence="MSDS 1번 제품명"
        status="자동추출"
      />
    );

    expect(screen.getByText("제품명")).toBeInTheDocument();
    expect(screen.getByText("MSDS 1번 제품명")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "제품명 복사" }));
    expect(writeText).toHaveBeenCalledWith("MY-M-11 (MR-90)");
  });
});
```

`tests/ui/ComponentTable.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ComponentTable } from "../../src/components/ComponentTable";

describe("ComponentTable", () => {
  it("renders component rows in the internal schema", () => {
    render(
      <ComponentTable
        rows={[
          {
            casNo: "60676-86-0",
            chemicalName: "실리카, 퓨즈드",
            contentMin: "85",
            contentMax: "95",
            contentSingle: "",
            rowCopyText: "60676-86-0\t실리카, 퓨즈드\t85\t95"
          }
        ]}
      />
    );

    expect(screen.getByText("CAS No.")).toBeInTheDocument();
    expect(screen.getByText("60676-86-0")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
npm test -- tests/ui/FieldRow.test.tsx tests/ui/ComponentTable.test.tsx
```

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement components**

`src/components/StatusBadge.tsx`:

```tsx
export function StatusBadge({ status }: { status: string }) {
  return <span className="status-badge">{status}</span>;
}
```

`src/components/FieldRow.tsx`:

```tsx
import { StatusBadge } from "./StatusBadge";

export function FieldRow(props: {
  label: string;
  value: string;
  evidence: string;
  status: string;
}) {
  return (
    <div className="field-row">
      <strong>{props.label}</strong>
      <input value={props.value} readOnly />
      <span>{props.evidence}</span>
      <StatusBadge status={props.status} />
      <button aria-label={`${props.label} 복사`} onClick={() => navigator.clipboard.writeText(props.value)}>
        복사
      </button>
    </div>
  );
}
```

`src/components/ComponentTable.tsx`:

```tsx
export function ComponentTable(props: {
  rows: Array<{
    casNo: string;
    chemicalName: string;
    contentMin: string;
    contentMax: string;
    contentSingle: string;
    rowCopyText: string;
  }>;
}) {
  return (
    <table className="component-table">
      <thead>
        <tr>
          <th>CAS No.</th>
          <th>화학물질</th>
          <th>MIN</th>
          <th>MAX</th>
          <th>단일</th>
          <th>행 복사</th>
        </tr>
      </thead>
      <tbody>
        {props.rows.map((row) => (
          <tr key={`${row.casNo}-${row.chemicalName}`}>
            <td>{row.casNo}</td>
            <td>{row.chemicalName}</td>
            <td>{row.contentMin}</td>
            <td>{row.contentMax}</td>
            <td>{row.contentSingle}</td>
            <td>
              <button onClick={() => navigator.clipboard.writeText(row.rowCopyText)}>복사</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

- [ ] **Step 4: Add component styles**

Append to `src/styles.css`:

```css
.field-row {
  display: grid;
  grid-template-columns: 160px minmax(220px, 1fr) minmax(260px, 1.4fr) 120px 80px;
  gap: 8px;
  align-items: center;
  padding: 8px;
  border-bottom: 1px solid #e5e7eb;
  background: white;
}

.field-row input {
  padding: 8px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-height: 28px;
  border-radius: 999px;
  padding: 0 10px;
  background: #eef6ff;
  color: #075985;
  font-size: 13px;
}

.component-table {
  width: 100%;
  border-collapse: collapse;
  background: white;
}

.component-table th,
.component-table td {
  border: 1px solid #d8dee4;
  padding: 8px;
  text-align: left;
}
```

- [ ] **Step 5: Run UI tests**

Run:

```bash
npm test -- tests/ui/FieldRow.test.tsx tests/ui/ComponentTable.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components src/styles.css tests/ui
git commit -m "feat: add MSDS verification components"
```

## Task 11: Review Page

**Files:**
- Create: `src/pages/ReviewPage.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create review page with fixture data**

`src/pages/ReviewPage.tsx`:

```tsx
import { ComponentTable } from "../components/ComponentTable";
import { FieldRow } from "../components/FieldRow";

export function ReviewPage() {
  return (
    <section className="page">
      <h2>MSDS 등록 검수</h2>

      <h3>물품 기본 정보</h3>
      <FieldRow label="공급사" value="포스코퓨처엠" evidence="MSDS 1번 공급자 정보" status="자동추출" />
      <FieldRow label="제품명" value="MY-M-11 (MR-90)" evidence="MSDS 1번 제품명" status="자동추출" />
      <FieldRow label="MSDS번호" value="AA00786-0000000090" evidence="MSDS 표지" status="자동추출" />
      <FieldRow label="최종개정일자" value="2026-04-02" evidence="MSDS 표지" status="자동추출" />

      <h3>함유량 및 법적규제 정보</h3>
      <ComponentTable
        rows={[
          {
            casNo: "60676-86-0",
            chemicalName: "실리카, 퓨즈드",
            contentMin: "85",
            contentMax: "95",
            contentSingle: "",
            rowCopyText: "60676-86-0\t실리카, 퓨즈드\t85\t95"
          }
        ]}
      />

      <h3>유해성 위험성 정보</h3>
      <FieldRow label="제품형태" value="분말" evidence="MSDS 9번 또는 1번" status="자동추출" />
      <FieldRow label="유해성 위험성" value="심한 눈 손상성/눈 자극성-구분 2" evidence="MSDS 2번" status="확인필요" />
    </section>
  );
}
```

- [ ] **Step 2: Wire review page**

Modify `src/App.tsx` so the page union includes `review`, the sidebar includes `등록 검수`, and the content renders `<ReviewPage />`.

Use this complete file:

```tsx
import { useState } from "react";
import { DashboardPage } from "./pages/DashboardPage";
import { ProductsPage } from "./pages/ProductsPage";
import { ReviewPage } from "./pages/ReviewPage";
import { UploadPage } from "./pages/UploadPage";
import { WatchlistPage } from "./pages/WatchlistPage";

type Page = "dashboard" | "upload" | "review" | "products" | "watchlist";

export function App() {
  const [page, setPage] = useState<Page>("dashboard");

  return (
    <div className="layout">
      <aside className="sidebar">
        <h1>MSDS Watcher</h1>
        <button onClick={() => setPage("dashboard")}>대시보드</button>
        <button onClick={() => setPage("upload")}>MSDS 업로드</button>
        <button onClick={() => setPage("review")}>등록 검수</button>
        <button onClick={() => setPage("products")}>제품/현장</button>
        <button onClick={() => setPage("watchlist")}>Watchlist</button>
      </aside>
      <main className="content">
        {page === "dashboard" && <DashboardPage />}
        {page === "upload" && <UploadPage />}
        {page === "review" && <ReviewPage />}
        {page === "products" && <ProductsPage />}
        {page === "watchlist" && <WatchlistPage />}
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Verify typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/pages/ReviewPage.tsx
git commit -m "feat: add internal registration review page"
```

## Task 11A: Management Queues, Revision Diff, and Schedule Surfaces

**Files:**
- Create: `src/pages/QueuesPage.tsx`
- Create: `src/pages/RevisionDiffPage.tsx`
- Create: `src/pages/SchedulesPage.tsx`
- Modify: `src/App.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Add queue page**

`src/pages/QueuesPage.tsx`:

```tsx
const queues = [
  { label: "확인필요", count: 0, description: "자동화가 확정하지 못해 담당자 확인이 필요한 항목" },
  { label: "공식조회 필요", count: 0, description: "공식 API 조회가 아직 필요하거나 실패한 항목" },
  { label: "공급사 확인 필요", count: 0, description: "CAS No., 함유량, 영업비밀 여부를 공급사에 물어봐야 하는 항목" },
  { label: "내부 기준 확인 필요", count: 0, description: "작업환경측정/특수검진 기준표 확인이 필요한 항목" },
  { label: "등록대기", count: 0, description: "검수완료 후 사내 시스템 입력이 남은 항목" }
];

export function QueuesPage() {
  return (
    <section className="page">
      <h2>관리 큐</h2>
      <div className="queue-grid">
        {queues.map((queue) => (
          <article className="queue-card" key={queue.label}>
            <strong>{queue.label}</strong>
            <span>{queue.count}</span>
            <p>{queue.description}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Add revision diff page**

`src/pages/RevisionDiffPage.tsx`:

```tsx
export function RevisionDiffPage() {
  return (
    <section className="page">
      <h2>MSDS 개정본 비교</h2>
      <table className="component-table">
        <thead>
          <tr>
            <th>변경유형</th>
            <th>CAS No.</th>
            <th>이전 값</th>
            <th>새 값</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={5}>같은 제품의 새 MSDS를 업로드하면 CAS/함유량/유해성 변경 후보가 여기에 표시됩니다.</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 3: Add schedule page**

`src/pages/SchedulesPage.tsx`:

```tsx
export function SchedulesPage() {
  return (
    <section className="page">
      <h2>측정·검진 일정</h2>
      <table className="component-table">
        <thead>
          <tr>
            <th>제품</th>
            <th>CAS No.</th>
            <th>구분</th>
            <th>주기</th>
            <th>마지막 실시일</th>
            <th>다음 예정일</th>
            <th>상태</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={7}>작업환경측정/특수건강검진 대상 물질의 일정 후보가 여기에 표시됩니다.</td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}
```

- [ ] **Step 4: Wire navigation**

Add `queues`, `revisions`, and `schedules` to the `Page` union in `src/App.tsx`, add sidebar buttons, and render the new pages.

- [ ] **Step 5: Add queue styles**

Append to `src/styles.css`:

```css
.queue-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.queue-card {
  background: white;
  border: 1px solid #d8dee4;
  border-radius: 8px;
  padding: 14px;
}

.queue-card span {
  display: block;
  margin-top: 8px;
  font-size: 28px;
  font-weight: 700;
}
```

- [ ] **Step 6: Verify typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

## Task 12: Final Verification

**Files:**
- Modify only if verification finds defects.

- [ ] **Step 1: Run full tests**

Run:

```bash
npm test
```

Expected: all tests PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Start dev server**

Run:

```bash
npm run dev
```

Expected:

```text
MSDS API listening on http://127.0.0.1:8787
VITE ... Local: http://127.0.0.1:5173/
```

- [ ] **Step 4: Browser QA**

Open:

```text
http://127.0.0.1:5173/
```

Check:

- Sidebar navigation works.
- Upload page accepts a PDF.
- Review page shows the same section order as the internal MSDS registration screen.
- Field copy buttons copy single values.
- Component row copy uses tab-separated order matching the attached schema.
- Products page and Watchlist page exist as first MVP management surfaces.

- [ ] **Step 5: Commit final fixes**

```bash
git add .
git commit -m "chore: verify MSDS MVP plan implementation"
```

## Spec Coverage Review

Covered:

- PDF upload and local storage: Tasks 1, 8
- Local PDF extraction: Task 7
- Codex CLI adapter boundary: Task 5
- Internal registration schema: Task 2
- Component row schema and copy order: Tasks 2, 4, 10
- Field status policy, no silent blanks: Tasks 2, 5, 6
- CAS-based regulatory lookup boundary: Task 6
- Verification/copy UI: Tasks 9, 10, 11
- Product/component persistence: Tasks 3, 7
- CAS watchlist foundation: Tasks 3, 7
- Management automation surface: Tasks 9, 11

Deferred by design:

- Periodic official DB re-query and change alerting.
- Production K-REACH/KOSHA API integration.
- Perfect OCR for every scanned PDF. MVP includes scan detection, local OCR adapter boundary, low-confidence status, and manual/supplier fallback.
- Internal system automatic registration or RPA.
- Excel export.

These are not skipped. They are outside the first lake.

## GSTACK REVIEW REPORT

**Status:** DONE_WITH_CONCERNS

**Architecture Review:** The important boundary is `RegulatoryLookup`. Keep it source-limited. If future code lets Codex browse arbitrary law sites, this app drifts back into the failed legal-search product.

**Data Flow Review:** The core flow is correct: PDF text → Codex structured candidates → regulatory lookup by CAS → verified records → watchlist. Watchlist is created in MVP, but automatic change monitoring is deliberately deferred.

**Risk Review:** The largest technical risk is PDF table extraction. The plan isolates raw PDF parsing in `server/services/pdfExtractor.ts` so it can be replaced without rewriting the product. Good.

**UX Review:** The review page must stay dense and operational. Do not turn it into a landing page. The user is doing data entry, not browsing marketing copy.

**Test Coverage Review:** The plan starts with unit tests for schema order, copy formatting, adapter behavior, lookup fallback, and persistence. Add integration tests for upload-to-review once real PDF fixtures are available.
