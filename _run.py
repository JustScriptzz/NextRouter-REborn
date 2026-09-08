#!/usr/bin/env python3
"""
_run.py — Self-healing Next.js launcher for Pterodactyl.
If the repo is missing (no package.json), clones from GitHub.
Then bootstraps Node, builds, and runs Next.js.
"""

import os
import shutil
import signal
import subprocess
import sys
import tarfile
import urllib.request

NODE_VERSION = "v20.19.0"
NODE_URL = f"https://nodejs.org/dist/{NODE_VERSION}/node-{NODE_VERSION}-linux-x64.tar.xz"
RUNTIME_DIR = ".node_runtime"
NODE_BIN = os.path.join(RUNTIME_DIR, "node", "bin", "node")
NPM_BIN = os.path.join(RUNTIME_DIR, "node", "bin", "npm")
PORT = "2008"
REPO_URL = os.environ.get("GIT_ADDRESS", "https://github.com/JustScriptzz/NextRouter-REborn")
BRANCH = os.environ.get("BRANCH", "main")
GH_TOKEN = os.environ.get("ACCESS_TOKEN", "")

WORK_DIR = os.path.dirname(os.path.abspath(__file__)) or "."
os.chdir(WORK_DIR)

def log(msg):
    print(f"[_run.py] {msg}", flush=True)

def ensure_node():
    on_path = shutil.which("node")
    if on_path:
        return "node"
    if os.path.exists(NODE_BIN):
        return NODE_BIN
    log("downloading Node " + NODE_VERSION)
    urllib.request.urlretrieve(NODE_URL, "node.tar.xz")
    os.makedirs(RUNTIME_DIR, exist_ok=True)
    with tarfile.open("node.tar.xz") as tf:
        tf.extractall(RUNTIME_DIR)
    os.remove("node.tar.xz")
    log("node ready")
    return NODE_BIN

def ensure_repo():
    if os.path.isfile("package.json"):
        log("repo found (package.json exists)")
        return
    log("repo missing — cloning from " + REPO_URL)
    subprocess.run(["rm", "-rf", ".git", "_run.py", "run.py"], check=False)
    clone_url = REPO_URL
    if GH_TOKEN and clone_url.startswith("https://github.com/"):
        clone_url = clone_url.replace("https://github.com/", f"https://{GH_TOKEN}@github.com/")
    subprocess.run(["git", "clone", "--branch", BRANCH, "--depth", "1", clone_url, "."], check=True)
    log("repo cloned — " + BRANCH)

def main():
    ensure_repo()

    node = ensure_node()
    env = dict(os.environ)
    env.update({
        "NODE_ENV": "production",
        "NODE_OPTIONS": "--max-old-space-size=1024 --max-sem-space-size=128",
        "UV_THREADPOOL_SIZE": "2",
        "PORT": PORT,
        "NEXT_TELEMETRY_DISABLED": "1",
    })

    npm = [node, NPM_BIN] if os.path.exists(NPM_BIN) else ["npm"]

    log("installing deps")
    subprocess.run(npm + ["install"], env=env, check=False)

    log("building next.js")
    build = subprocess.run([node, "node_modules/next/dist/bin/next", "build"], env=env)
    if build.returncode != 0:
        log(f"build failed ({build.returncode})")

    log(f"starting on port {PORT}")
    proc = subprocess.Popen(
        [node, "node_modules/next/dist/bin/next", "start", "-p", PORT, "-H", "0.0.0.0"],
        env=env,
        stdout=sys.stdout,
        stderr=sys.stderr,
    )

    def _term(*_):
        log("shutting down")
        proc.terminate()

    signal.signal(signal.SIGTERM, _term)
    signal.signal(signal.SIGINT, _term)

    try:
        rc = proc.wait()
    except KeyboardInterrupt:
        proc.terminate()
        rc = proc.wait()
    log(f"exit {rc}")
    sys.exit(rc or 0)

if __name__ == "__main__":
    main()
