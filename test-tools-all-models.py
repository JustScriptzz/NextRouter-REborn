"""NextRouter tool-calling sweep across ALL catalog models.

Fetches the live model list from /api/v1/models, then sends each text model
the same get_current_weather tool test (OpenAI-compatible chat/completions).

No secrets in this file: set env vars before running.

Usage:
    set NEXTROUTER_API_KEY=nk_...   (Windows cmd)
    $env:NEXTROUTER_API_KEY="nk_..."  (PowerShell)
    python test-tools-all-models.py [--base-url URL] [--limit N] [--filter substr] [--timeout S]

Stdlib only.
"""

import argparse
import json
import os
import ssl
import sys
import time
import urllib.error
import urllib.request

DEFAULT_BASE = "https://nextrouterfree.duckdns.org"

TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_current_weather",
            "description": "Get the current weather for a specific city.",
            "parameters": {
                "type": "object",
                "properties": {
                    "location": {
                        "type": "string",
                        "description": "City name, e.g. Tokyo, Japan",
                    },
                    "unit": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "Temperature unit",
                    },
                },
                "required": ["location"],
            },
        },
    }
]

# Model types worth a tool-call probe; images/audio/embeddings can't call functions.
TEXT_TYPES = {"text", None, ""}


def make_ctx():
    ctx = ssl.create_default_context()
    return ctx


def api_get(url, api_key, timeout, ctx):
    req = urllib.request.Request(
        url,
        headers={
            "Authorization": f"Bearer {api_key}",
            "User-Agent": "NextRouter-Tool-Sweep/1.0",
        },
        method="GET",
    )
    with urllib.request.urlopen(req, context=ctx, timeout=timeout) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_models(api_base, api_key, timeout, ctx):
    data = api_get(f"{api_base}/api/v1/models", api_key, timeout, ctx)
    return data.get("data", [])


def test_model(api_base, api_key, model_id, timeout, ctx):
    payload = {
        "model": model_id,
        "messages": [
            {
                "role": "user",
                "content": (
                    "What is the weather in Tokyo right now? "
                    "You must call the get_current_weather tool."
                ),
            }
        ],
        "tools": TOOLS,
        "tool_choice": "auto",
        "max_tokens": 150,
    }
    req = urllib.request.Request(
        f"{api_base}/api/v1/chat/completions",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "NextRouter-Tool-Sweep/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="ignore")[:120].replace("\n", " ")
        return "HTTP_ERROR", f"HTTP {e.code}: {err}"
    except Exception as e:  # noqa: BLE001 - report per-model, keep sweeping
        return "EXCEPTION", str(e)[:120]

    choices = data.get("choices", [])
    if not choices:
        return "EMPTY_RESPONSE", "No choices returned."
    message = choices[0].get("message", {})
    tool_calls = message.get("tool_calls")
    if tool_calls:
        fn = tool_calls[0].get("function", {})
        return "SUCCESS", f"Called '{fn.get('name')}' args: {fn.get('arguments')}"
    # Native missing but emulation may have put it in reasoning/content JSON.
    blob = ((message.get("content") or "") + " " + (message.get("reasoning") or ""))[:200]
    if "tool_calls" in blob or "get_current_weather" in blob:
        return "EMULATED_TEXT", f"Tool JSON in text: {blob[:100].strip()}"
    text = (message.get("content") or "").strip().replace("\n", " ")
    preview = text[:80] + ("..." if len(text) > 80 else "")
    return "NO_TOOL_CALL", f"Text only: {preview}"


def main():
    ap = argparse.ArgumentParser(description="Sweep all NextRouter models for tool calling.")
    ap.add_argument("--base-url", default=os.environ.get("NEXTROUTER_BASE_URL", DEFAULT_BASE))
    ap.add_argument("--limit", type=int, default=0, help="Max models to test (0 = all).")
    ap.add_argument("--filter", default="", help="Only test model IDs containing this substring.")
    ap.add_argument("--timeout", type=int, default=25)
    ap.add_argument("--delay", type=float, default=0.5, help="Seconds between requests.")
    args = ap.parse_args()

    api_key = os.environ.get("NEXTROUTER_API_KEY", "")
    if not api_key:
        print("Set NEXTROUTER_API_KEY env var first (never paste keys into files).", file=sys.stderr)
        sys.exit(2)

    api_base = args.base_url.rstrip("/")
    ctx = make_ctx()

    print(f"Fetching catalog from {api_base}/api/v1/models ...")
    try:
        models = fetch_models(api_base, api_key, args.timeout, ctx)
    except Exception as e:  # noqa: BLE001
        print(f"Catalog fetch failed: {e}", file=sys.stderr)
        sys.exit(1)

    # Keep text-capable entries; API lists type per model.
    candidates = [
        m.get("id")
        for m in models
        if m.get("id")
        and m.get("type", "text") in TEXT_TYPES
        and (not args.filter or args.filter.lower() in m.get("id", "").lower())
    ]
    if args.limit > 0:
        candidates = candidates[: args.limit]
    print(f"Testing {len(candidates)} of {len(models)} catalog models.\n" + "=" * 70)

    results = []
    for model_id in candidates:
        print(f"Testing {model_id}...", end=" ", flush=True)
        status, details = test_model(api_base, api_key, model_id, args.timeout, ctx)
        tag = {
            "SUCCESS": "PASSED",
            "EMULATED_TEXT": "PARTIAL",
            "NO_TOOL_CALL": "TEXT-ONLY",
        }.get(status, "ERROR")
        print(f"[{tag}] {details[:100]}")
        results.append((model_id, status, details))
        time.sleep(args.delay)

    ok = [m for m, s, _ in results if s == "SUCCESS"]
    partial = [m for m, s, _ in results if s == "EMULATED_TEXT"]
    flat = [m for m, s, _ in results if s == "NO_TOOL_CALL"]
    errs = [m for m, s, _ in results if s not in ("SUCCESS", "EMULATED_TEXT", "NO_TOOL_CALL")]

    print("\n" + "=" * 70 + "\nSUMMARY")
    print(f"Total: {len(results)}  PASS: {len(ok)}  PARTIAL: {len(partial)}  "
          f"TEXT-ONLY: {len(flat)}  ERRORS: {len(errs)}")
    if ok:
        print("\nWorking tool calls:")
        for m in ok:
            print(f"  + {m}")
    if partial:
        print("\nTool JSON leaked into text (emulation parsed, not native):")
        for m in partial:
            print(f"  ~ {m}")
    if flat:
        print("\nText-only (no tool executed):")
        for m in flat:
            print(f"  - {m}")
    if errs:
        print("\nErrors:")
        for m in errs:
            print(f"  ! {m}")


if __name__ == "__main__":
    main()
