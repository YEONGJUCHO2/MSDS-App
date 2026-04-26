# OpenAI GPT Mini Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an OpenAI `gpt-5-mini` adapter as the production AI path for MSDS structuring while keeping Codex CLI as a development fallback.

**Architecture:** Introduce a focused OpenAI adapter that calls the Responses API with structured JSON output and maps the response into the existing `RegistrationCandidate` schema. Add a provider selector used by component review and basic-info enrichment so the rest of the app does not care whether AI is disabled, Codex CLI, or OpenAI.

**Tech Stack:** TypeScript, Node `fetch`, Vitest, existing Zod schemas, OpenAI Responses API.

---

### Task 1: OpenAI Adapter

**Files:**
- Create: `server/services/openAiAdapter.ts`
- Test: `tests/services/openAiAdapter.test.ts`

- [x] Write failing tests for default model selection, disabled mode, successful structured response parsing, and user-saved field preservation.
- [x] Run `npm test -- tests/services/openAiAdapter.test.ts` and confirm it fails because the file does not exist.
- [x] Implement `createOpenAiAdapter`, Responses API request building, response text extraction, JSON parsing, and basic-info merge.
- [x] Run `npm test -- tests/services/openAiAdapter.test.ts` and confirm it passes.

### Task 2: Provider Selection

**Files:**
- Create: `server/services/aiProvider.ts`
- Modify: `server/services/aiReviewer.ts`
- Modify: `server/routes/documents.ts`
- Test: `tests/services/aiProvider.test.ts`
- Test: `tests/services/aiReviewer.test.ts`

- [x] Write failing tests proving `MSDS_AI_PROVIDER=openai` selects OpenAI, `MSDS_AI_PROVIDER=codex` selects Codex, and unset provider stays local-only.
- [x] Run targeted tests and confirm provider selection fails before implementation.
- [x] Implement provider selection and wire component review/basic-info enrichment through it.
- [x] Run targeted tests and confirm they pass.

### Task 3: Configuration And Verification

**Files:**
- Modify: `.env.example`
- Modify: `docs/vercel-deployment.md`

- [x] Document `MSDS_AI_PROVIDER=openai`, `MSDS_AI_MODEL=gpt-5-mini`, and `OPENAI_API_KEY`.
- [x] Keep Codex CLI env vars documented as development fallback.
- [x] Run `npm test`.
- [x] Run `npm run build`.
- [ ] Commit and push.
