# NextRouter

One endpoint for every model you use. NextRouter is a self-hostable AI gateway — OpenAI-compatible and Anthropic-compatible APIs backed by a catalog of upstream providers you configure yourself. Black and white, no noise.

```
curl https://YOUR_DEPLOYMENT/api/v1/chat/completions \
  -H "Authorization: Bearer nr_YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model": "example-chat", "messages": [{"role": "user", "content": "Hello"}]}'
```

## What you get

- **OpenAI-compatible API** — `/api/v1/chat/completions` (streaming via SSE), images, audio (TTS/STT), embeddings, video
- **Anthropic-compatible API** — `/api/v1/messages` with `x-api-key`, block content, system field, SSE events. Drop-in for the Anthropic SDK and Claude-shaped clients
- **Failover pipes** — each model id can sit behind multiple upstreams; the gateway tries each in turn within a tight budget
- **Catalog pins** — the public model list is exactly what you pin in env. Nothing upstream advertises leaks through
- **Key system your way** — Discord bot issuance (included under `discord-bot/`), Postgres-backed keys, demo key, or bring your own
- **Usage caps** — daily token limit across all models, per-key RPM, `429` + `Retry-After` when the bucket's empty
- **Live model health** — the Models tab probes every id and shows green / amber / red with auto-retest
- **Playground, docs, usage dashboard** — the whole shell, no accounts required

## Quickstart

```bash
npm install
cp .env.example .env   # fill in your upstreams + secrets
npm run db:push        # push the Drizzle schema (needs DATABASE_URL)
npm run dev
```

Open `http://localhost:3000`. Paste a key in the Playground, pick a model, talk.

## Wiring providers

Every upstream is OpenAI-compatible. Three generic slots, copy a block to add more:

```bash
PRIMARY_BASE_URL=https://your-upstream-one/v1
PRIMARY_API_KEY=...
PRIMARY_MODELS=model-id-a,model-id-b
```

Model IDs are pinned exactly — comma-separated upstream IDs. Ugly upstream IDs get renamed to clean public IDs in `src/lib/providers.ts` (`rename` map + `MODEL_ALIASES`). Display names, context windows, and capability flags live in `src/lib/shell-config.ts` (one file, everything else reads from it).

Known-good upstream types: OpenRouter, Together AI, Groq, Fireworks, DeepInfra, Nebius, Hyperbolic, Mistral La Plateforme, Google AI Studio, Anthropic direct, OpenAI direct — anything speaking `/v1`.

## Keys

Pick one, the gateway accepts all of them as `Bearer` (or `x-api-key` on `/v1/messages`):

| Source | How |
|---|---|
| Discord bot | `discord-bot/` — users `/claim` a key, bot owns the ledger via `BOT_VALIDATOR_URL` + `BOT_SHARED_SECRET` |
| Postgres | Email accounts + website-issued keys (hashed, masked) |
| Demo key | Literal `demo` — shared bucket, for trying it out |
| System key | `SYSTEM_TEST_KEY` env-only, unlimited RPM for sweeps |

## Deploy

Cloudflare Workers (primary):

```bash
npm run deploy   # opennext build + wrangler deploy
```

Set each env var as a Worker secret (`wrangler secret put <NAME>`). Never commit `.env.local` / `.dev.vars` — both are gitignored.

## Project layout

```
src/app/            landing, dashboard, models, playground, keys, usage, docs
src/app/api/v1/     chat, messages (Anthropic), images, audio, embeddings, video, models
src/lib/            providers (slots + catalog), upstream (pipeline), auth, usage,
                    bot-ledger, shell-config (display catalog — edit this file)
discord-bot/        optional Discord key bot + validator API
```

## Limits & security

- Daily token cap (default 50M, tune `DAILY_TOKEN_LIMIT`), resets 00:00 UTC
- API keys stored hashed (SHA-256); custom bearer tokens encrypted (AES-256-GCM)
- Upstream names and keys are server-side only — never exposed through the API
- `GET /api/v1/models` returns public IDs only

## License

MIT recommended — add a `LICENSE` file before distributing.
