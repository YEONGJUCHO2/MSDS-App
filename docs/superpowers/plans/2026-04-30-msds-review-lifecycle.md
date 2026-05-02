# MSDS Review Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement document-level MSDS review lifecycle where only replacement upload clears review-needed state.

**Architecture:** Add review lifecycle columns to `documents`, expose focused repository/API helpers, and drive Dashboard, MSDS, and Site Management UI from the same document summary fields. Keep `review_queue` for extraction quality, but use document `reviewState` as the source of truth for regulatory revision status.

**Tech Stack:** TypeScript, React, Express, better-sqlite3, Vitest, Testing Library.

---

### Task 1: Document Lifecycle Model

**Files:**
- Modify: `server/db/schema.ts`
- Modify: `server/db/repositories.ts`
- Modify: `shared/types.ts`
- Test: `tests/services/documentRepository.test.ts`
- Test: `tests/services/regulatoryMatcher.test.ts`

- [ ] Add migration columns for document review metadata.
- [ ] Extend `DocumentSummary`.
- [ ] Add repository helpers for rename, mark review-needed, mark approved after replacement.
- [ ] Write failing tests for migration defaults and recheck transition.
- [ ] Implement repository and matcher changes.

### Task 2: Replacement Upload API

**Files:**
- Modify: `server/routes/documents.ts`
- Modify: `src/api/client.ts`
- Test: `tests/api/uploadStorage.test.ts`

- [ ] Add `PATCH /api/documents/:documentId` for rename.
- [ ] Add `POST /api/documents/:documentId/replacement`.
- [ ] Ensure replacement clears old components, queue rows, matches, and basic info for that document before re-processing.
- [ ] Return refreshed document list.

### Task 3: Shared Document List UI

**Files:**
- Create: `src/components/DocumentListPanel.tsx`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/ReviewPage.tsx`
- Modify: `src/styles.css`
- Test: `tests/ui/DashboardPage.test.tsx`
- Test: `tests/ui/ReviewPage.test.tsx`

- [ ] Extract common table/filter/actions.
- [ ] Add name search, date range, review-state filter, rename, paperclip attachment, and title tooltip.
- [ ] Add per-document replacement upload control when review state is `needs_review`.

### Task 4: Site Management MSDS Handling

**Files:**
- Modify: `src/pages/ProductsPage.tsx`
- Modify: `src/styles.css`
- Test: `tests/ui/ProductsPage.test.tsx`

- [ ] Add document search/status filters to site picker and site list.
- [ ] Add attachment open button with paperclip.
- [ ] Show the required warning before opening review-needed MSDS.

### Task 5: Verification

**Files:**
- No production files.

- [ ] Run targeted tests for changed areas.
- [ ] Run `npm test`.
- [ ] Run `npm run build`.
- [ ] Start dev server and verify Dashboard/MSDS/Site Management in the in-app browser.
