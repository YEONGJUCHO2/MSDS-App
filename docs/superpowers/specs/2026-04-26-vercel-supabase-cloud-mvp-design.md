# MSDS Watcher Cloud MVP Design

## Decision

The product direction is now a cloud-hosted MVP:

```text
Company PC browser
→ Vercel frontend and API functions
→ Supabase Postgres
→ Supabase Storage
→ OpenAI API for document structuring
→ KECO/KOSHA official APIs for regulatory lookup
```

The previous Mac mini + SQLite + local uploads + Codex CLI design remains useful for local development and prototype reference, but it is no longer the target production operating model.

## Why This Direction

Company PCs may block access to a home Mac mini, private tunnels, arbitrary ports, VPN clients, or unapproved local servers. If the app must be usable from a company PC with only a browser, the backend and storage must be reachable from standard HTTPS endpoints.

Vercel + Supabase is the preferred MVP stack because it keeps the deployment shape small:

- Vercel hosts the React app and Node.js API routes.
- Supabase Postgres stores products, MSDS documents, components, official lookup results, review states, site mappings, and watchlist snapshots.
- Supabase Storage stores uploaded PDF files and later generated exports.
- OpenAI replaces Codex CLI for production document structuring.
- KECO/KOSHA public APIs remain the authoritative first source for chemical/regulatory lookup.

## Product Scope That Stays The Same

The product is still an MSDS management and change-monitoring tool, not a legal final-decision engine.

The user workflow stays:

```text
MSDS upload
→ PDF text extraction and AI-assisted structuring
→ human review and correction
→ official API lookup
→ internal input format generation
→ product/site/MSDS/component storage
→ CAS watchlist creation
→ manual or scheduled recheck
→ change candidates and revision-needed alerts
```

The app should still optimize for the user's real goal:

- Make the values needed for the internal system.
- Keep registered MSDS and chemicals manageable over time.
- Connect products to sites.
- Detect when official chemical information changes and a person should review the MSDS or site posting.

## Architecture

### Frontend

The existing Vite/React app should remain the frontend. It will be deployed to Vercel and call same-origin API routes where possible.

For local development, the app may still call the Express server, but production should not depend on the Mac mini.

### API Layer

Production API routes should run on Vercel Node.js functions.

The current Express route logic should be migrated incrementally into reusable service functions so that both local Express and Vercel functions can call the same core logic during the transition.

Do not put API keys in the browser. These belong only in Vercel environment variables:

- `OPENAI_API_KEY`
- `KECO_API_KEY`
- `KOSHA_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET`

### Database

SQLite is not the production target. Supabase Postgres is the production target.

Tables should preserve the current product concepts:

- `documents`
- `document_basic_info`
- `components`
- `component_official_matches`
- `products`
- `sites`
- `product_sites`
- `watchlist`
- `watchlist_snapshots`
- `review_events`

The migration should happen behind a repository interface so the UI and processing pipeline do not need to know whether the backing store is SQLite or Postgres.

### File Storage

Uploaded PDFs should be stored in Supabase Storage.

The API stores only metadata and storage paths in Postgres. Vercel functions must not rely on local persistent disk.

### AI Processing

Production AI processing should use OpenAI API, not Codex CLI.

The cost-control rule is:

```text
Extract text first
→ send only relevant text sections to OpenAI
→ ask for strict JSON
→ cache the result by document hash
```

OpenAI is used to structure messy MSDS text into fields and component rows. It should not be used as the final regulatory authority.

Codex CLI can remain as a development-only adapter while the OpenAI adapter is introduced.

### Official API Lookup

KECO and KOSHA remain the primary regulatory sources.

Lookup results should be cached by CAS No. and source. A document upload should not force repeated official API calls for a CAS No. that was recently looked up unless the user explicitly rechecks it.

### Scheduled Monitoring

MVP monitoring can start with a manual "전체 재조회" button.

Scheduled monitoring can later be implemented using Vercel Cron or another scheduled worker. The monitoring job should:

1. Load the business CAS watchlist.
2. Recheck official APIs.
3. Store a new snapshot.
4. Compare the latest snapshot with the previous snapshot.
5. Create change candidates, not final legal conclusions.

## Migration Plan

### Phase 1: Provider Boundary

Introduce production-ready interfaces while keeping the current local app working:

- AI adapter interface: Codex CLI and OpenAI implementations.
- Storage adapter interface: local disk and Supabase Storage implementations.
- Repository interface: SQLite now, Postgres next.

### Phase 2: OpenAI Adapter

Add OpenAI API document structuring for:

- Basic product information.
- Section 3 component rows.
- MSDS revision/basic metadata.

Keep prompts narrow and JSON-only. Tests should mock the API.

### Phase 3: Supabase Schema

Create Supabase/Postgres schema and migrations matching the current app data model.

Add a Postgres repository implementation while keeping SQLite available for local development until the cutover is stable.

### Phase 4: Supabase Storage

Move uploaded PDFs to Supabase Storage in production.

Keep local file storage only for local development.

### Phase 5: Vercel API Routes

Move API entrypoints to Vercel functions. Reuse the same services used by the Express server.

At this point the production data flow is no longer dependent on the Mac mini.

### Phase 6: Deployment And Smoke Test

Deploy the Vercel app with Supabase and API keys configured.

Smoke test from a company PC:

- Upload one text PDF.
- Confirm basic info extraction.
- Confirm component extraction.
- Confirm KECO/KOSHA lookup.
- Edit/add/remove a component.
- Re-run official lookup.
- Confirm internal input format updates.
- Confirm product/site mapping.
- Confirm watchlist recheck.

## Non-Goals For This Migration

- Do not build a general legal chatbot.
- Do not send every page image to AI by default.
- Do not auto-submit data to the internal company system.
- Do not make Supabase Edge Functions the main processing backend unless Vercel functions hit a real limit.
- Do not remove the local development path until the cloud flow is working.

## Risks And Controls

### AI Cost

Control cost by extracting text locally in the API function, sending only relevant sections, caching by document hash, and using official API/cache for repeat chemical lookups.

### Long-Running PDF Processing

Start with synchronous processing for normal text PDFs. If processing time becomes unreliable, change upload to create a pending job and poll for status.

### Security

MSDS PDFs can be sensitive business documents. Storage buckets must not be public by default. Use signed URLs or server-mediated downloads.

### Company Network

The production app must use HTTPS on standard ports. Avoid dependence on home-hosted services, custom ports, or local VPN clients.

## Acceptance Criteria

The cloud MVP is successful when:

- A company PC can use the deployed Vercel URL without reaching the Mac mini.
- Uploaded PDFs persist in Supabase Storage.
- Extracted MSDS data persists in Supabase Postgres.
- OpenAI API structures basic info and component rows.
- Official API matching updates the internal input format.
- User edits, additions, deletions, and rechecks persist.
- Registered products can be linked to sites.
- Watchlist recheck can detect and save change candidates.
