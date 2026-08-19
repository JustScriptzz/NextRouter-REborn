# NextRouter REborn

A self-hostable AI provider gateway. Register an account, grab an API key, and use the OpenAI-compatible `/api/v1` endpoints backed by a catalog of free AI providers — plus your own custom upstream endpoints.

## Features

- Email/password accounts (bcrypt, JWT session cookie)
- **500,000 token/day** limit per user, combined across all models, resets at midnight UTC
- OpenAI-compatible API: `/api/v1/chat/completions`, `/images/generations`, `/audio/speech`, `/audio/transcriptions`, `/models`
- Catalog models from multiple free providers (configured server-side, never exposed to users)
- **My Models**: point a custom endpoint, test it, and expose it as `{username}/{model-name}` — private or public, with optional per-user RPM limits and a fallback model
- API key management with one-time display
- Usage dashboard with today/all-time stats and 7-day history

## Deploy to Vercel

1. Push this repo to GitHub and import it as a new Vercel project.
2. Provision a Postgres database (e.g. [Neon](https://neon.tech) free tier). Set `DATABASE_URL` in Vercel project settings.
3. Set the other environment variables (see `.env.example`). At minimum:
   - `DATABASE_URL`
   - `ENCRYPTION_KEY` — 64 hex chars (`openssl rand -hex 32`)
   - `SESSION_SECRET` — long random string
   - `NEXT_PUBLIC_APP_URL` — your Vercel app URL
   - `AQUADEVS_BASE_URL` / `AQUADEVS_API_KEY` / `AQUADEVS_MODELS` — your provider gateways (repeat for `LOGFARE_`, `SCRIPTZZ_`, `COGITO_`)
   - `AI_HORDE_API_KEY` (optional) — enables community text/image models
4. Run `npm run db:push` to create the tables (or run `drizzle-kit push` during a local `npm run db:generate` step first).

## Local development

```bash
npm install
cp .env.example .env   # fill in values
npm run db:push
npm run dev
```

## Using the API

```bash
curl https://<your-app>/api/v1/chat/completions \
  -H "Authorization: Bearer nr_..." \
  -H "Content-Type: application/json" \
  -d '{"model":"<model-id>","messages":[{"role":"user","content":"Hello"}]}'
```

Get a key on the **Keys** page and browse available model IDs on the **Models** page.

## Limits & security

- 500k tokens/day/user across all models (streaming responses are cut off mid-stream when the budget runs out)
- API keys are stored hashed (SHA-256) and masked; custom endpoint bearer tokens are encrypted (AES-256-GCM) with `ENCRYPTION_KEY`
- Catalog provider names/keys are server-side only and never exposed through the API