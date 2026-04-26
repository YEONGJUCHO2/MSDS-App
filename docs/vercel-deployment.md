# Vercel + Supabase Deployment

## Production Shape

The production MVP should not depend on the Mac mini, local SQLite, local uploads, or Codex CLI.

Use Vercel for the React/Vite app and Node.js API routes. Use Supabase for Postgres and PDF storage.

```text
Company PC browser
  -> Vercel frontend/API
  -> Supabase Postgres
  -> Supabase Storage
  -> OpenAI API
  -> KECO/KOSHA official APIs
```

## Vercel Project Settings

Set production secrets in Vercel. Do not expose them through `VITE_` variables.

```text
OPENAI_API_KEY=...
KECO_API_KEY=...
KOSHA_API_KEY=...
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
SUPABASE_STORAGE_BUCKET=msds-documents
```

The frontend should call same-origin Vercel API routes in production. `VITE_API_BASE_URL` remains useful for local development or temporary external API testing, but it should not point at a Mac mini for the production MVP.

## Supabase Project Settings

Create:

- A private Storage bucket for uploaded MSDS PDFs.
- Postgres tables for documents, basic info, components, official matches, products, sites, product-site links, watchlist entries, watchlist snapshots, and review events.
- Row Level Security policies before opening the app to more than one trusted tester.

## Local Development

Local development can continue to use the Express server and SQLite while the cloud adapters are being built.

```text
npm run dev
```

The Mac mini path is now a development/prototype path, not the production path.

## Production Smoke Test

After deployment, verify from a company PC:

- Vercel URL loads.
- PDF upload succeeds.
- PDF is stored in Supabase Storage.
- Basic information and component rows are extracted through the OpenAI adapter.
- KECO/KOSHA lookup updates component regulatory columns.
- User edit/add/remove/recheck actions persist.
- Internal input format reflects official lookup results.
- Product/site mapping persists.
- Watchlist manual recheck stores a new snapshot.

## Notes

Supabase Edge Functions are not the default backend choice for this MVP. They can be added later for small webhooks or scheduled tasks, but the first migration should keep the existing Node.js service code reusable in Vercel functions.
