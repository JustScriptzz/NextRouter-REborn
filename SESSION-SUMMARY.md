# Session Summary

**Final pushed commit:** `18a2d38` on `origin/main`

## Features shipped (verified live)

| Feature | Where |
|---|---|
| Rate limits (RPM 15, 500K token cap) with captcha + reason + models, accept/thinking/reject, decision banner | `/api/v1/*` + `/api/limits/*` + `/api/admin/limits/*` |
| Tool calling for every model (native passthrough + emulation fallback) | All `src/lib/upstream.ts` chat paths |
| Video endpoint `/v1/videos/generations` | `src/lib/upstream.ts` + `src/app/api/v1/videos/generations/route.ts` |
| Playground Video tab + persistence + streaming fallback | `src/app/playground/PlaygroundClient.tsx` |
| Crax provider (53+ new models, identity injection to fix "Notion" responses) | `src/lib/providers.ts` + `src/lib/identity-inject.ts` |
| Stable failover (cross-provider alias merging, 6h backoff on 429, single-pass unconditional cycling with rolling) | All chat paths |
| Disable <20% availability button | `src/app/api/admin/models/block-low-availability/route.ts` + `AdminModels.tsx` |
| Dynamic admins (KV) + Make-admin button | `src/lib/admin.ts` + `src/app/api/admin/users/admins/route.ts` + `AdminUserManagement.tsx` |
| Attribution & Credits section in docs | `src/app/docs/page.tsx` |

## Blocked

**Server migration to Pterodactyl:** Wings daemon crash-looped, panel file API writes don't reach the container (volume-mount divergence). `89.28.205.45:2008` is not reachable. SSH on port 2022 needs host-level credentials we don't have. **Needs the host platform owner (IPbnb) to reboot the VPS** — out of my hands.

**Sept 1 Neon DB migration:** Code paths are ready, but the Neon data-transfer quota blocks reads until reset on Sept 1.

## Next steps (when blocked on both)

1. Have host platform reboot the VPS → Wings restarts → `_run.py` (already uploaded + self-healing) runs → app boots on `89.28.205.45:2008`
2. Sept 1 → `pg_dump` Neon → restore to Render Postgres
