"""Refresh local CSS and JavaScript URLs in dependency order."""

import hashlib
from pathlib import Path
import re


# The site uses static relative ES module imports (including side-effect imports).
IMPORT = re.compile(
    r'''((?:\bfrom\s*|\bimport\s*)["'])(\.{1,2}/[^"'?]+\.js)(?:\?v=[a-f0-9]+)?(["'])'''
)


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def write_changed(path, text):
    if path.read_text() != text:
        path.write_text(text)


def version_stylesheet(site):
    """Keep the existing command entry point; version the site's module graph too."""
    site = site.resolve()
    visited = {}
    visiting = set()

    def version_module(path):
        path = path.resolve()
        if not path.is_relative_to(site):
            raise ValueError(f"Module outside site: {path}")
        if path in visiting:
            raise ValueError(f"Circular site module import: {path}")
        if path in visited:
            return visited[path]
        visiting.add(path)

        def replace(match):
            version = version_module(path.parent / match[2])
            return f"{match[1]}{match[2]}?v={version}{match[3]}"

        write_changed(path, IMPORT.sub(replace, path.read_text()))
        visiting.remove(path)
        visited[path] = digest(path)
        return visited[path]

    versions = {"styles.css": digest(site / "styles.css"), "app.js": version_module(site / "app.js")}
    if (site / "theme.js").exists():
        versions["theme.js"] = version_module(site / "theme.js")
    index = site / "index.html"
    updated = index.read_text()
    for asset, version in versions.items():
        attr = "href" if asset.endswith(".css") else "src"
        updated, count = re.subn(
            rf'{attr}="{re.escape(asset)}(?:\?v=[a-f0-9]+)?"',
            f'{attr}="{asset}?v={version}"',
            updated,
        )
        if count != 1:
            raise ValueError(f"Expected exactly one {asset} link in site/index.html")
    write_changed(index, updated)


if __name__ == "__main__":
    version_stylesheet(Path(__file__).resolve().parents[1] / "site")
