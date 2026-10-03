"""NextRouter Discord key bot — SQLite edition, no database server needed.

Owns keys and the usage ledger in a single local file. The gateway has no
database at all: it validates keys and reads/writes usage through this bot's
validator HTTP API, so the bot must stay online for the gateway to work.

Commands (all answers are ephemeral except the DM with the key):
  /claim   - issue your key (one active key per person, DM'd to you)
  /usage   - today's tokens/calls against the daily cap
  /rotate  - kill your current key(s) and DM you a fresh one
  /revoke  - kill your current key(s) entirely

Validator API (Bearer BOT_SHARED_SECRET, gateway use only):
  POST /validate {"key": "nr_..."} -> {"valid": bool, "user": {...}, "today": {...}}
  GET  /usage/<user_id>            -> {"tokens": N, "calls": M}
  GET  /summary/<user_id>          -> {"today": {}, "total": {}, "last7": [...]}
  GET  /limits/<user_id>           -> {"cap": N|null, "rpm": N|null} (null = default)
  POST /log {"user_id": ..., "tokens": N} -> {"ok": true}

Setup:
  1. https://discord.com/developers -> New Application -> Bot -> copy token.
     No privileged intents needed.
  2. Invite it: OAuth2 -> URL Generator -> scopes `bot` +
     `applications.commands` -> open the URL.
  3. Environment:
       DISCORD_TOKEN=...       # bot token (required)
       BOT_SHARED_SECRET=...   # password between bot and gateway (required
                               # for the validator; WITHOUT it the validator
                               # stays off and the gateway 401s everything)
       GUILD_ID=...            # your server id: instant command sync.
                               # omit for global commands (up to 1h to appear)
       DB_PATH=keys.db         # sqlite file (default: keys.db next to bot.py)
       BOT_PORT=8787           # validator listen port (default 8787)
       DAILY_CAP=50000000      # default cap /usage shows (per-user overrides win)
       OWNER_ID=...            # your discord user id: enables owner-only /demo
  4. pip install -r requirements.txt && python bot.py

  5. Gateway env (web app / Worker secrets):
       BOT_VALIDATOR_URL=http://<bot-host>:8787   # must be PUBLIC for Workers
       BOT_SHARED_SECRET=<same value as here>
       DAILY_CAP=5000000
"""

from __future__ import annotations

import asyncio
import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import sqlite3
import threading
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse

import aiosqlite
import discord
from discord import app_commands

log = logging.getLogger("nextrouter-bot")

# --- quick config: paste your values between the quotes, save, run.
# Env vars still win if both are set. Don't share this file once filled.
CONFIG_TOKEN = ""
CONFIG_SECRET = ""
CONFIG_GUILD = ""
CONFIG_PORT = ""
CONFIG_OWNER = ""

DISCORD_TOKEN = os.environ.get("DISCORD_TOKEN", "") or CONFIG_TOKEN
_GUILD_RAW = os.environ.get("GUILD_ID", "") or CONFIG_GUILD
try:
    GUILD_ID = int(_GUILD_RAW or 0)
except ValueError:
    GUILD_ID = 0
_OWNER_RAW = os.environ.get("OWNER_ID", "") or CONFIG_OWNER
try:
    OWNER_ID = int(_OWNER_RAW or 0)
except ValueError:
    OWNER_ID = 0
DAILY_CAP = int(os.environ.get("DAILY_CAP", "50000000") or 50000000)


def db_path() -> str:
    return os.environ.get("DB_PATH", os.path.join(os.path.dirname(__file__), "keys.db"))


def shared_secret() -> str:
    return os.environ.get("BOT_SHARED_SECRET", "") or CONFIG_SECRET


def validator_port() -> int:
    raw = (os.environ.get("BOT_PORT", "") or CONFIG_PORT or "8787").strip()
    return int(raw) if raw.isdigit() else 8787


SCHEMA = """
PRAGMA journal_mode=WAL;
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default key',
  key_hash TEXT NOT NULL,
  masked TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_used_at TEXT,
  revoked_at TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS api_keys_key_hash_idx ON api_keys (key_hash);
CREATE INDEX IF NOT EXISTS api_keys_user_id_idx ON api_keys (user_id);
CREATE TABLE IF NOT EXISTS daily_usage (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  tokens INTEGER NOT NULL DEFAULT 0,
  calls INTEGER NOT NULL DEFAULT 0
);
CREATE UNIQUE INDEX IF NOT EXISTS daily_usage_user_date_idx ON daily_usage (user_id, date);
"""


# --------------------------------------------------------------------------
# key helpers (same shape the gateway has always used)
# --------------------------------------------------------------------------

def mint_key(prefix: str = "nr_") -> tuple[str, str, str]:
    raw = prefix + base64.urlsafe_b64encode(secrets.token_bytes(32)).decode().rstrip("=")
    digest = hashlib.sha256(raw.encode()).hexdigest()
    masked = f"{raw[:8]}...{raw[-4:]}"
    return raw, digest, masked


def today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


# --------------------------------------------------------------------------
# async db (discord command side, aiosqlite)
# --------------------------------------------------------------------------

async def init_db() -> None:
    async with aiosqlite.connect(db_path()) as conn:
        await conn.executescript(SCHEMA)
        await conn.commit()
        # Migrate older databases: per-user limits. Missing columns are added,
        # existing ones raise OperationalError which we ignore. Data untouched.
        for stmt in (
            "ALTER TABLE users ADD COLUMN daily_cap INTEGER",
            "ALTER TABLE users ADD COLUMN rpm INTEGER",
        ):
            try:
                await conn.execute(stmt)
                await conn.commit()
            except sqlite3.OperationalError:
                pass


async def get_or_create_user(conn: aiosqlite.Connection, discord_id: int) -> str:
    username = f"dc_{discord_id}"
    email = f"dc_{discord_id}@discord.local"
    async with conn.execute("SELECT id FROM users WHERE username = ?", (username,)) as cur:
        row = await cur.fetchone()
    if row:
        return str(row[0])
    user_id = str(uuid.uuid4())
    await conn.execute(
        "INSERT INTO users (id, username, email, password_hash) VALUES (?, ?, ?, ?)",
        (user_id, username, email, "!" + secrets.token_hex(32)),
    )
    await conn.commit()
    return user_id


async def active_keys(conn: aiosqlite.Connection, user_id: str):
    async with conn.execute(
        "SELECT id, masked, created_at FROM api_keys"
        " WHERE user_id = ? AND revoked_at IS NULL ORDER BY created_at",
        (user_id,),
    ) as cur:
        return await cur.fetchall()


async def revoke_all(conn: aiosqlite.Connection, user_id: str) -> int:
    cur = await conn.execute(
        "UPDATE api_keys SET revoked_at = datetime('now')"
        " WHERE user_id = ? AND revoked_at IS NULL",
        (user_id,),
    )
    await conn.commit()
    return cur.rowcount if cur.rowcount is not None else 0


async def insert_key(conn: aiosqlite.Connection, user_id: str) -> tuple[str, str]:
    raw, digest, masked = mint_key()
    await conn.execute(
        "INSERT INTO api_keys (id, user_id, name, key_hash, masked)"
        " VALUES (?, ?, 'Discord', ?, ?)",
        (str(uuid.uuid4()), user_id, digest, masked),
    )
    await conn.commit()
    return raw, masked


async def usage_sums(conn: aiosqlite.Connection, user_id: str) -> tuple[int, int]:
    async with conn.execute(
        "SELECT COALESCE(SUM(tokens), 0), COALESCE(SUM(calls), 0)"
        " FROM daily_usage WHERE user_id = ? AND date = ?",
        (user_id, today_utc()),
    ) as cur:
        row = await cur.fetchone()
    return (int(row[0] or 0), int(row[1] or 0))


def key_dm(raw: str) -> str:
    return (
        "Your NextRouter key (keep it secret — it shows **once**):\n"
        f"```\n{raw}\n```\n"
        f"Use it as `Authorization: Bearer {raw[:8]}...` against `/api/v1`. "
        f"Cap is {DAILY_CAP:,} tokens/day, resets 00:00 UTC.\n"
        "Leaked it? Run `/rotate`. Done with it? Run `/revoke`."
    )


# --------------------------------------------------------------------------
# delivery helpers — a slow host can miss Discord's 3s interaction window
# (error 10062 Unknown interaction). These never raise: the key work already
# happened, so a dead reply window must not crash the command.
# --------------------------------------------------------------------------

async def safe_defer(interaction: discord.Interaction) -> None:
    try:
        await interaction.response.defer(ephemeral=True, thinking=True)
    except (discord.NotFound, discord.HTTPException):
        log.warning("defer failed for %s (stale interaction); continuing", interaction.user.id)


async def safe_followup(interaction: discord.Interaction, text: str) -> None:
    try:
        await interaction.followup.send(text, ephemeral=True)
    except (discord.NotFound, discord.HTTPException):
        log.warning("followup failed for %s (interaction expired)", interaction.user.id)


async def safe_dm(user: discord.abc.User, text: str) -> bool:
    try:
        await user.send(text)
        return True
    except (discord.Forbidden, discord.NotFound, discord.HTTPException):
        return False


# --------------------------------------------------------------------------
# sync db (validator HTTP side, one sqlite3 connection per request)
# --------------------------------------------------------------------------

def _vconn() -> sqlite3.Connection:
    conn = sqlite3.connect(db_path())
    conn.row_factory = sqlite3.Row
    return conn


def v_validate(raw: str):
    digest = hashlib.sha256(raw.encode()).hexdigest()
    conn = _vconn()
    try:
        row = conn.execute(
            "SELECT k.user_id, u.username, u.email FROM api_keys k"
            " JOIN users u ON u.id = k.user_id"
            " WHERE k.key_hash = ? AND k.revoked_at IS NULL",
            (digest,),
        ).fetchone()
        if not row:
            return None
        user_id = str(row["user_id"])
        use = conn.execute(
            "SELECT COALESCE(SUM(tokens), 0) AS t, COALESCE(SUM(calls), 0) AS c"
            " FROM daily_usage WHERE user_id = ? AND date = ?",
            (user_id, today_utc()),
        ).fetchone()
        return {
            "id": user_id,
            "username": str(row["username"]),
            "email": str(row["email"]),
            "tokens": int(use["t"] or 0),
            "calls": int(use["c"] or 0),
        }
    finally:
        conn.close()


def v_log(user_id: str, tokens: int) -> bool:
    amount = max(0, int(tokens or 0))
    conn = _vconn()
    try:
        exists = conn.execute("SELECT 1 FROM users WHERE id = ?", (user_id,)).fetchone()
        if not exists:
            return False
        conn.execute(
            "INSERT INTO daily_usage (id, user_id, date, tokens, calls)"
            " VALUES (?, ?, ?, ?, 1)"
            " ON CONFLICT (user_id, date) DO UPDATE SET"
            " tokens = tokens + excluded.tokens, calls = calls + 1",
            (str(uuid.uuid4()), user_id, today_utc(), amount),
        )
        conn.commit()
        return True
    finally:
        conn.close()


def v_usage(user_id: str) -> tuple[int, int]:
    conn = _vconn()
    try:
        row = conn.execute(
            "SELECT COALESCE(SUM(tokens), 0) AS t, COALESCE(SUM(calls), 0) AS c"
            " FROM daily_usage WHERE user_id = ? AND date = ?",
            (user_id, today_utc()),
        ).fetchone()
        return (int(row["t"] or 0), int(row["c"] or 0))
    finally:
        conn.close()


def v_limits(user_id: str) -> dict:
    """Per-user cap/rpm overrides. None means 'use the gateway default'."""
    conn = _vconn()
    try:
        row = conn.execute(
            "SELECT daily_cap, rpm FROM users WHERE id = ?", (user_id,)
        ).fetchone()
        if not row:
            return {"cap": None, "rpm": None}
        return {
            "cap": int(row["daily_cap"]) if row["daily_cap"] is not None else None,
            "rpm": int(row["rpm"]) if row["rpm"] is not None else None,
        }
    finally:
        conn.close()


def v_summary(user_id: str) -> dict:
    conn = _vconn()
    try:
        t, c = v_usage(user_id)
        total = conn.execute(
            "SELECT COALESCE(SUM(tokens), 0) AS t, COALESCE(SUM(calls), 0) AS c"
            " FROM daily_usage WHERE user_id = ?",
            (user_id,),
        ).fetchone()
        rows = conn.execute(
            "SELECT date, tokens, calls FROM daily_usage"
            " WHERE user_id = ? ORDER BY date DESC LIMIT 7",
            (user_id,),
        ).fetchall()
        last7 = [
            {"date": str(r["date"]), "tokens": int(r["tokens"]), "calls": int(r["calls"])}
            for r in reversed(rows)
        ]
        return {
            "today": {"tokens": t, "calls": c},
            "total": {"tokens": int(total["t"] or 0), "calls": int(total["c"] or 0)},
            "last7": last7,
        }
    finally:
        conn.close()


class ValidatorHandler(BaseHTTPRequestHandler):
    server_version = "NRBot/1"

    def log_message(self, format, *args):  # keep validator chatter in logging
        log.debug("validator: %s", format % args if args else format)

    def _authed(self) -> bool:
        secret = shared_secret()
        if not secret:
            return False
        auth = self.headers.get("Authorization", "")
        if not auth.startswith("Bearer "):
            return False
        return hmac.compare_digest(auth[7:].strip(), secret)

    def _json(self, code: int, obj: dict) -> None:
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _body(self) -> dict:
        try:
            length = int(self.headers.get("Content-Length", "0") or 0)
        except ValueError:
            length = 0
        if length <= 0 or length > 65536:
            return {}
        try:
            return json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except (ValueError, UnicodeDecodeError):
            return {}

    def do_POST(self) -> None:
        if not self._authed():
            self._json(401, {"error": "unauthorized"})
            return
        path = urlparse(self.path).path
        if path == "/validate":
            raw = str(self._body().get("key", ""))
            if not raw.startswith("nr_"):
                self._json(200, {"valid": False})
                return
            found = v_validate(raw)
            if not found:
                self._json(200, {"valid": False})
                return
            self._json(200, {
                "valid": True,
                "user": {"id": found["id"], "username": found["username"], "email": found["email"]},
                "today": {"tokens": found["tokens"], "calls": found["calls"]},
            })
            return
        if path == "/log":
            body = self._body()
            ok = v_log(str(body.get("user_id", "")), body.get("tokens", 0))
            self._json(200 if ok else 404, {"ok": ok})
            return
        self._json(404, {"error": "not found"})

    def do_GET(self) -> None:
        if not self._authed():
            self._json(401, {"error": "unauthorized"})
            return
        parts = urlparse(self.path).path.strip("/").split("/")
        if len(parts) == 2 and parts[0] == "usage" and parts[1]:
            t, c = v_usage(parts[1])
            self._json(200, {"tokens": t, "calls": c})
            return
        if len(parts) == 2 and parts[0] == "summary" and parts[1]:
            self._json(200, v_summary(parts[1]))
            return
        if len(parts) == 2 and parts[0] == "limits" and parts[1]:
            self._json(200, v_limits(parts[1]))
            return
        self._json(404, {"error": "not found"})


def start_validator() -> threading.Thread | None:
    secret = shared_secret()
    if not secret:
        log.warning("BOT_SHARED_SECRET not set — validator OFF, gateway will 401 everything")
        return None
    server = ThreadingHTTPServer(("0.0.0.0", validator_port()), ValidatorHandler)
    thread = threading.Thread(target=server.serve_forever, name="validator", daemon=True)
    thread.start()
    log.info("validator listening on 0.0.0.0:%s", validator_port())
    return thread


# --------------------------------------------------------------------------
# bot
# --------------------------------------------------------------------------

class NextRouterBot(discord.Client):
    def __init__(self) -> None:
        super().__init__(intents=discord.Intents.default())
        self.tree = app_commands.CommandTree(self)

    async def setup_hook(self) -> None:
        await init_db()
        if GUILD_ID:
            guild = discord.Object(id=GUILD_ID)
            self.tree.copy_global_to(guild=guild)
            self.tree.clear_commands(guild=None)
            await self.tree.sync(guild=guild)
            # Push the now-empty global tree: deletes the global dupes
            # left over from launches without GUILD_ID.
            await self.tree.sync()
            log.info("commands synced to guild %s (global dupes cleared)", GUILD_ID)
        else:
            await self.tree.sync()
            log.info("commands synced globally (can take up to 1h to appear)")


bot = NextRouterBot()


@bot.tree.command(name="claim", description="Get your NextRouter API key (DM'd to you)")
async def claim(interaction: discord.Interaction):
    await safe_defer(interaction)
    try:
        async with aiosqlite.connect(db_path()) as conn:
            user_id = await get_or_create_user(conn, interaction.user.id)
            existing = await active_keys(conn, user_id)
            if existing:
                await safe_followup(
                    interaction,
                    f"You already have an active key (`{existing[0][1]}`). "
                    "Use `/rotate` to replace it or `/revoke` to kill it.",
                )
                return
            raw, _masked = await insert_key(conn, user_id)
    except Exception:
        log.exception("claim failed for %s", interaction.user.id)
        await safe_followup(interaction, "Couldn't mint your key — try again.")
        return
    if await safe_dm(interaction.user, key_dm(raw)):
        await safe_followup(
            interaction,
            "Sent — check your DMs. The key shows **once**, save it somewhere safe.",
        )
    else:
        await safe_followup(
            interaction,
            "Your DMs are closed, so here it is **in this message only** — save it now, "
            "then turn DMs on and run `/rotate` to be safe:\n"
            f"```\n{raw}\n```",
        )


@bot.tree.command(name="usage", description="Today's token usage against the daily cap")
async def usage(interaction: discord.Interaction):
    await safe_defer(interaction)
    try:
        async with aiosqlite.connect(db_path()) as conn:
            user_id = await get_or_create_user(conn, interaction.user.id)
            tokens, calls = await usage_sums(conn, user_id)
        left = max(0, DAILY_CAP - tokens)
        pct = min(100, round(tokens / DAILY_CAP * 100)) if DAILY_CAP else 0
        await safe_followup(
            interaction,
            f"Today (UTC): **{tokens:,}** tokens in **{calls:,}** calls — "
            f"**{pct}%** of your {DAILY_CAP:,} cap, **{left:,}** left. Resets 00:00 UTC.",
        )
    except Exception:
        log.exception("usage failed for %s", interaction.user.id)
        await safe_followup(interaction, "Couldn't read usage — try again.")


@bot.tree.command(name="rotate", description="Replace your key with a fresh one (old dies instantly)")
async def rotate(interaction: discord.Interaction):
    await safe_defer(interaction)
    try:
        async with aiosqlite.connect(db_path()) as conn:
            user_id = await get_or_create_user(conn, interaction.user.id)
            killed = await revoke_all(conn, user_id)
            if not killed:
                await safe_followup(interaction, "You have no active key — run `/claim` first.")
                return
            raw, _masked = await insert_key(conn, user_id)
    except Exception:
        log.exception("rotate failed for %s", interaction.user.id)
        await safe_followup(interaction, "Rotation failed — try again.")
        return
    if await safe_dm(
        interaction.user,
        "Your old key is dead. New one (shows **once**):\n" f"```\n{raw}\n```",
    ):
        await safe_followup(
            interaction,
            "Rotated — old key stopped working instantly, new one is in your DMs.",
        )
    else:
        await safe_followup(
            interaction,
            "Rotated, but your DMs are closed — new key **in this message only**, save it now:\n"
            f"```\n{raw}\n```",
        )


@bot.tree.command(name="revoke", description="Kill all your active keys immediately")
async def revoke(interaction: discord.Interaction):
    await safe_defer(interaction)
    try:
        async with aiosqlite.connect(db_path()) as conn:
            user_id = await get_or_create_user(conn, interaction.user.id)
            killed = await revoke_all(conn, user_id)
    except Exception:
        log.exception("revoke failed for %s", interaction.user.id)
        await safe_followup(interaction, "Couldn't revoke — try again.")
        return
    await safe_followup(
        interaction,
        f"Done — {killed} key(s) revoked, they stop working instantly."
        if killed else "You have no active keys.",
    )


DEMO_CAP = 40_000_000
DEMO_RPM = 30


@bot.tree.command(name="demo", description="Mint the public demo key (40M/day, 30 rpm). Owner only.")
async def demo(interaction: discord.Interaction):
    await safe_defer(interaction)
    if not OWNER_ID or interaction.user.id != OWNER_ID:
        await safe_followup(interaction, "Owner only.")
        return
    try:
        async with aiosqlite.connect(db_path()) as conn:
            async with conn.execute(
                "SELECT id FROM users WHERE username = ?", ("demo",)
            ) as cur:
                row = await cur.fetchone()
            if row:
                demo_id = str(row[0])
            else:
                demo_id = str(uuid.uuid4())
                await conn.execute(
                    "INSERT INTO users (id, username, email, password_hash)"
                    " VALUES (?, 'demo', 'demo@local', ?)",
                    (demo_id, "!" + secrets.token_hex(32)),
                )
            await conn.execute(
                "UPDATE users SET daily_cap = ?, rpm = ? WHERE id = ?",
                (DEMO_CAP, DEMO_RPM, demo_id),
            )
            await revoke_all(conn, demo_id)
            raw, masked = await insert_key(conn, demo_id)
            await conn.execute(
                "UPDATE api_keys SET name = 'Demo' WHERE key_hash = ?",
                (hashlib.sha256(raw.encode()).hexdigest(),),
            )
            await conn.commit()
    except Exception:
        log.exception("demo failed")
        await safe_followup(interaction, "Couldn't mint the demo key — try again.")
        return
    if await safe_dm(
        interaction.user,
        "Public demo key (40M tokens/day, 30 rpm — shows **once**, publish it anywhere):\n"
        f"```\n{raw}\n```",
    ):
        await safe_followup(
            interaction,
            f"Demo key minted (`{masked}`) — old demo keys revoked. It's in your DMs, publish away.",
        )
    else:
        await safe_followup(
            interaction,
            "Demo key minted, but your DMs are closed — here it is **in this message only**:\n"
            f"```\n{raw}\n```",
        )


@bot.event
async def on_ready():
    log.info("logged in as %s (%s)", bot.user, bot.user.id if bot.user else "?")
    log.info("guilds: %s", [(g.id, g.name) for g in bot.guilds])


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    if not DISCORD_TOKEN:
        raise SystemExit("Set DISCORD_TOKEN env var first (see top of bot.py).")
    asyncio.run(_run())


async def _run() -> None:
    await init_db()
    start_validator()
    async with bot:
        await bot.start(DISCORD_TOKEN)


if __name__ == "__main__":
    main()
