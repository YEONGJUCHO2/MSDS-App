# Vercel Deployment

## Production Shape

This app cannot run as a full SQLite + local file upload + Codex CLI backend inside Vercel Functions.

Use Vercel for the React/Vite frontend only. Keep the API server on a persistent machine, currently the Mac mini, or move it later to a VM/container host.

```text
Company PC browser
  -> Vercel frontend
  -> VITE_API_BASE_URL
  -> Mac mini Express API
  -> SQLite + storage/uploads + official APIs + Codex CLI
```

## Vercel Project Settings

Set this environment variable in Vercel:

```text
VITE_API_BASE_URL=https://YOUR_PUBLIC_BACKEND_HOST
```

Examples:

```text
VITE_API_BASE_URL=https://msds-api.company.example
VITE_API_BASE_URL=https://your-cloudflare-tunnel.trycloudflare.com
```

After changing it, redeploy Vercel. Vite bakes `VITE_` values into the frontend build.

## Mac Mini Backend Settings

Set this on the Mac mini backend process:

```text
MSDS_ALLOWED_ORIGINS=https://YOUR_VERCEL_APP.vercel.app
```

For preview deployments, add multiple origins separated by commas:

```text
MSDS_ALLOWED_ORIGINS=https://YOUR_VERCEL_APP.vercel.app,https://YOUR_VERCEL_APP-git-main-YOUR_ID.vercel.app
```

Only use `MSDS_ALLOWED_ORIGINS=*` for a temporary smoke test. This API currently has no login, so a wildcard on a public backend is too open for real company use.

## Backend Exposure

The backend must be reachable from the company PC browser. `localhost:8787` only works on the Mac mini itself.

Acceptable MVP options:

- Cloudflare Tunnel to `http://localhost:8787`
- Tailscale Funnel or VPN-only access
- Small VM/container host running `npm run dev:server` or a production server command

The backend must keep these local resources persistent:

- `storage/msds.db`
- `storage/uploads/`
- `.env` with official API keys and Codex CLI settings
- Codex CLI login/configuration on the host

## Local Smoke Test

```bash
npm run build
VITE_API_BASE_URL=http://localhost:8787 npm run build
```

Run the backend:

```bash
MSDS_ALLOWED_ORIGINS=http://localhost:5173 npm run dev:server
```

Check:

```bash
curl http://localhost:8787/api/health
```
