# NextRouter REborn

A self-hostable AI provider gateway. Register an account, grab an API key, and use the OpenAI-compatible `/api/v1` endpoints backed by a catalog of free AI providers — plus your own custom upstream endpoints. Production deployment uses Render backend, Supabase database, and VDROS proxy for enhanced routing.

## Architecture

- **Frontend**: Vercel (Next.js 15 App Router)
- **Backend/API**: Render (Node.js, always-on service with keep-alive pings)
- **Database**: Supabase PostgreSQL (Drizzle ORM with connection pooling)
- **Proxy**: VDROS (optional, for intelligent request routing and failover)
- **DNS/HTTPS**: Vercel DNS pointing to Render API endpoint

## Features

- Email/password accounts (bcrypt, JWT session cookie)
- **500,000 token/day** limit per user, combined across all models, resets at midnight UTC
- OpenAI-compatible API: `/api/v1/chat/completions`, `/images/generations`, `/audio/speech`, `/audio/transcriptions`, `/models`
- Catalog models from multiple free providers (configured server-side, never exposed to users)
- **My Models**: point a custom endpoint, test it, and expose it as `{username}/{model-name}` — private or public, with an optional per-user RPM limit and a required fallback model from the catalog
- API key management with one-time display
- Usage dashboard with today/all-time stats and 7-day history

## Production Deployment (Render + Supabase)

### Prerequisites

1. **Render Account** (free tier works; paid recommended for production)
2. **Supabase Account** (free tier PostgreSQL, 10GB storage)
3. **Vercel Project** (linked to GitHub repo)
4. **GitHub Repository** (this one, pushed and accessible)

### Setup Steps

#### 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note the project **Reference ID**, **Region**, and **Organization ID**
3. In the SQL editor, run migrations or use Drizzle ORM to push schema:
   ```bash
   DATABASE_URL=postgresql://[user]:[password]@[pooler-host]:6543/postgres npm run db:push
   ```
4. Create API keys and enable Row Level Security (RLS) if needed
5. **Important**: Use the **Supavisor connection pooler** endpoint (`*.pooler.supabase.com:6543` in transaction mode), not the direct PostgreSQL endpoint. The direct endpoint may be IPv6-only and unreachable from some networks.

#### 2. Deploy Backend on Render

1. Create a new **Web Service** on Render
2. Connect your GitHub repository
3. Build command: `npm install && npm run db:push && npm run build`
4. Start command: `npm start` (or `node .next/standalone/server.js` for Next.js)
5. Environment variables to set:
   - `DATABASE_URL`: Supabase pooler connection string (e.g., `postgresql://postgres:[password]@aws-0-[region].pooler.supabase.com:6543/postgres`)
   - `ENCRYPTION_KEY`: 64-char hex (generate: `openssl rand -hex 32`)
   - `SESSION_SECRET`: Long random string
   - `NEXT_PUBLIC_API_URL`: Public Render service URL (e.g., `https://nextrouter-api.onrender.com`)
   - `NODE_ENV`: `production`
   - `LOG_LEVEL`: `info` or `warn`
   - Provider keys: `AQUADEVS_BASE_URL`, `AQUADEVS_API_KEY`, `AQUADEVS_MODELS`, etc. (repeat for `LOGFARE_`, `SCRIPTII_`, `COGITO_`, etc.)
   - `KV_DISABLE`: `1` (Cloudflare Durable Objects not available on Render; app must handle gracefully)
6. Deploy and monitor logs. Health check: `GET /api/health` should return `{"status":"ok"}`

#### 3. Connect Vercel Frontend to Render Backend

1. In your Vercel project settings, add environment variable:
   - `NEXT_PUBLIC_API_URL`: Set to your Render service public URL (e.g., `https://nextrouter-api.onrender.com`)
2. Update `next.config.mjs` to proxy API calls to Render when on Vercel:
   ```javascript
   rewrites: async () => [{
     source: '/api/:path*',
     destination: process.env.RENDER_API_URL
       ? `${process.env.RENDER_API_URL}/api/:path*`
       : 'http://localhost:3000/api/:path*'
   }]
   ```
3. Redeploy Vercel frontend

#### 4. Keep Render Awake (Optional but Recommended)

Render's free tier spins down after 15 minutes of inactivity. Use GitHub Actions to ping `/api/health` every 10 minutes:

```yaml
# .github/workflows/keep-render-awake.yml
name: Keep Render Awake
on:
  schedule:
    - cron: '*/10 * * * *'
jobs:
  ping:
    runs-on: ubuntu-latest
    steps:
      - name: Ping Render
        run: |
          curl -f https://nextrouter-api.onrender.com/api/health || exit 0
```

### Render Troubleshooting

- **Build fails with "tailwindcss not found"**: Ensure all dependencies are in `package.json`, not just `devDependencies`
- **App crashes on startup**: Check logs for missing env vars or hard crashes (e.g., KV dependency issues). Set `KV_DISABLE=1`
- **Database connection fails**: Verify you're using the Supabase **pooler endpoint** (`:6543`), not the direct PostgreSQL endpoint (`:5432`). The direct endpoint is IPv6-only
- **Health check timeout**: Render may take 1-2 min to boot. Increase `initialDelaySeconds` or adjust SIGTERM/SIGKILL timeouts

## VDROS Proxy Integration (Optional)

For production reliability, route requests through [VDROS](https://vdros.io) for intelligent failover and load balancing:

1. Set up a VDROS account and create a new proxy
2. Add your Render service URL as the upstream
3. Update `NEXT_PUBLIC_API_URL` in Vercel to point to your VDROS proxy URL
4. VDROS handles retries, caching, and failover transparently

## Local Development

```bash
npm install
cp .env.example .env  # fill in values
npm run db:push      # push Drizzle schema to local/Supabase DB
npm run dev
```

### Local Database Setup

For local development, use a local PostgreSQL instance or spin up Supabase locally:

```bash
# Option 1: Supabase CLI
npx supabase start

# Option 2: Docker PostgreSQL
docker run --name postgres -e POSTGRES_PASSWORD=password -d -p 5432:5432 postgres
```

Then set `DATABASE_URL` and run `npm run db:push`.

## Using the API

```bash
curl https://nextrouter-api.onrender.com/api/v1/chat/completions \
  -H "Authorization: Bearer nk_..." \
  -H "Content-Type: application/json" \
  -d '{"model":"<model-id>","messages":[{"role":"user","content":"Hello"}]}'
```

Get a key on the **Keys** page and browse available model IDs on the **Models** page.

## Limits & Security

- 500k tokens/day/user across all models (streaming responses are cut off mid-stream when the budget runs out)
- API keys are stored hashed (SHA-256) and masked; custom endpoint bearer tokens are encrypted (AES-256-GCM) with `ENCRYPTION_KEY`
- Catalog provider names/keys are server-side only and never exposed through the API
- Rate limits and usage tracking per key per model
