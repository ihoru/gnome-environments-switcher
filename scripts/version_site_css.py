"""Refresh the stylesheet URL whenever its contents change."""

import hashlib
from pathlib import Path
import re


def version_stylesheet(site):
    digest = hashlib.sha256((site / "styles.css").read_bytes()).hexdigest()[:16]
    index = site / "index.html"
    original = index.read_text()
    updated, count = re.subn(
        r'href="styles\.css(?:\?v=[a-f0-9]+)?"',
        f'href="styles.css?v={digest}"',
        original,
    )
    if count != 1:
        raise ValueError("Expected exactly one styles.css link in site/index.html")
    if updated != original:
        index.write_text(updated)


if __name__ == "__main__":
    version_stylesheet(Path(__file__).resolve().parents[1] / "site")
