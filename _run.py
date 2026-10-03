#!/usr/bin/env python3
"""
_run.py — Next.js launcher for a Pterodactyl Python-3.12 egg.
This container has no Node by default, so we bootstrap a Node binary
(bundled tarball, no root), install deps, build, and run `next start`.

Pterodactyl injects SERVER_PORT (the allocation port). We bind there.
"""

import os
import shutil
import signal
import subprocess
import sys
import tarfile
import urllib.request

# ---------------------------------------------------------------------------
NODE_VERSION = "v20.19.0"
NODE_URL = (
    f"https://nodejs.org/dist/{NODE_VERSION}/node-{NODE_VERSION}-linux-x64.tar.xz"
)
RUNTIME_DIR = ".node_runtime"
NODE_BIN = os.path.join(RUNTIME_DIR, "node", "bin", "node")
NPM_BIN = os.path.join(RUNTIME_DIR, "node", "bin", "npm")

WORK_DIR = os.path.dirname(os.path.abspath(__file__)) or "."
os.chdir(WORK_DIR)


def log(msg):
    print(f"[_run.py] {msg}", flush=True)


def ensure_node():
    """Return the node executable to use, bootstrapping a bundled copy if needed."""
    on_path = shutil.which("node")
    if on_path:
        log(f"node on PATH: {on_path}")
        return "node"
    if os.path.exists(NODE_BIN):
        log("node bundled locally")
        return NODE_BIN
    log(f"no node found — downloading Node {NODE_VERSION} ...")
    tarball = f"node-{NODE_VERSION}-linux-x64.tar.xz"
    urllib.request.urlretrieve(NODE_URL, tarball)
    os.makedirs(RUNTIME_DIR, exist_ok=True)
    with tarfile.open(tarball) as tf:
        tf.extractall(RUNTIME_DIR)
    os.remove(tarball)
    log("node extracted")
    return NODE_BIN


def npm_cmd(node):
    # npm is a node script; prefer the bundled npm, fall back to `npm`
    if node == NODE_BIN and os.path.exists(NPM_BIN):
        return [node, NPM_BIN]
    return ["npm"]


def run(cmd, env=None, check=False):
    log("+ " + " ".join(cmd))
    e = dict(os.environ)
    if env:
        e.update(env)
    return subprocess.run(cmd, env=e, check=check)


def main():
    node = ensure_node()

    # 1) Install dependencies (prod + dev so Next can build/typescript)
    npm = npm_cmd(node)
    log("installing dependencies")
    run(npm + ["install"], check=False)

    # 2) Build production bundle. Bound V8 heap to survive modest containers.
    build_env = {
        "NODE_ENV": "production",
        "NODE_OPTIONS": "--max-old-space-size=1536",
    }
    log("building Next.js")
    build = run([node, "node_modules/next/dist/bin/next", "build"], env=build_env)
    if build.returncode != 0:
        log("BUILD FAILED")
        sys.exit(build.returncode)

    # 3) Start production server on the allocated port
    port = os.environ.get("SERVER_PORT") or os.environ.get("PORT") or "2008"
    log(f"starting Next.js on port {port}")
    proc = subprocess.Popen(
        [node, "node_modules/next/dist/bin/next", "start", "-p", port, "-H", "0.0.0.0"],
        env={**os.environ, "PORT": port, "NODE_ENV": "production"},
        stdout=sys.stdout,
        stderr=sys.stderr,
    )

    def _term(*_):
        log("signal received — shutting down")
        proc.terminate()

    signal.signal(signal.SIGTERM, _term)
    signal.signal(signal.SIGINT, _term)
    try:
        rc = proc.wait()
    except KeyboardInterrupt:
        proc.terminate()
        rc = proc.wait()
    log(f"server exited code {rc}")
    sys.exit(rc or 0)


if __name__ == "__main__":
    main()
