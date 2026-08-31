#!/usr/bin/env python3
"""run.py — alias entrypoint that delegates to _run.py."""
import subprocess
import sys
import os

here = os.path.dirname(os.path.abspath(__file__))
entry = os.path.join(here, "_run.py")
sys.exit(subprocess.call([sys.executable, entry] + sys.argv[1:]))
