"""Zip the files CodeBuild needs (tracked and new, minus caches and node_modules).

    python infra/plot/pack_source.py <out.zip>
"""

import subprocess
import sys
import zipfile
from pathlib import Path

INCLUDE = ("pipeline/", "infra/plot/", "data/catalog/india.json", "data/floods/", "data/lakes/")
SKIP = ("/.venv/", "/__pycache__/", "/.pytest_cache/")


def main(out: str) -> None:
    files = subprocess.run(
        ["git", "ls-files", "--cached", "--others", "--exclude-standard"],
        capture_output=True, text=True, check=True,
    ).stdout.splitlines()
    keep = [f for f in files if f.startswith(INCLUDE) and not any(s in f"/{f}" for s in SKIP)]
    with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as z:
        for f in keep:
            if Path(f).is_file():
                z.write(f, f)
        if not any(f.startswith("data/floods/") for f in keep):
            z.writestr("data/floods/.keep", "")  # the Dockerfile copies this folder
    print(f"packed {len(keep)} files into {out}")


if __name__ == "__main__":
    main(sys.argv[1])
