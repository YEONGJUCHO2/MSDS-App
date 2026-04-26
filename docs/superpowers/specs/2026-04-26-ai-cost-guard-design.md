# AI Cost Guard Design

## Purpose

Prevent accidental OpenAI API overuse when a user uploads many MSDS PDFs or repeatedly triggers AI analysis.

## Decisions

- A single upload batch is capped at 20 PDF files.
- The browser blocks selections above 20 and tells the user to upload in 20-file batches.
- The server exposes a batch upload endpoint and also enforces the 20-file maximum.
- OpenAI calls pass through an in-process daily request guard.
- Prompt text and output tokens are capped by environment variables.

## Defaults

```text
MAX_UPLOAD_FILES_PER_BATCH=20
MSDS_AI_DAILY_REQUEST_LIMIT=50
MSDS_AI_MAX_PROMPT_CHARS=20000
MSDS_AI_MAX_OUTPUT_TOKENS=3000
```

## Failure Behavior

If the upload batch is too large, the app rejects it before processing and tells the user to split the files.

If the AI daily limit is reached, OpenAI calls fail closed and the existing caller falls back to local parser candidates where possible. The app should keep showing usable extracted data instead of crashing.

## Later Cloud Upgrade

The in-process request guard is enough for the local MVP. After Supabase migration, AI usage events should be stored in Postgres so limits apply across serverless instances and can be reported monthly.
