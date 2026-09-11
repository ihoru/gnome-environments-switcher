import importlib.util
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location(
    "version_site", Path(__file__).resolve().parents[1] / "scripts/version_site_css.py"
)
version_site = importlib.util.module_from_spec(spec)
spec.loader.exec_module(version_site)


class SiteAssetsTest(unittest.TestCase):
    def test_dependency_changes_propagate_and_unchanged_runs_are_stable(self):
        with tempfile.TemporaryDirectory() as directory:
            site = Path(directory)
            files = {
                "index.html": '<link href="styles.css"><script src="app.js"></script><script src="theme.js"></script>',
                "styles.css": "body {}",
                "theme.js": "(() => {})();",
                "app.js": "import { child } from './child.js';\n",
                "child.js": "import './leaf.js';\nexport const child = 1;\n",
                "leaf.js": "export const leaf = 1;\n",
            }
            for name, contents in files.items():
                (site / name).write_text(contents)
            version_site.version_stylesheet(site)
            snapshot = {name: (site / name).read_text() for name in files}
            mtimes = {name: (site / name).stat().st_mtime_ns for name in files}
            version_site.version_stylesheet(site)
            self.assertEqual(snapshot, {name: (site / name).read_text() for name in files})
            self.assertEqual(mtimes, {name: (site / name).stat().st_mtime_ns for name in files})
            (site / "leaf.js").write_text("export const leaf = 2;\n")
            version_site.version_stylesheet(site)
            for name in ("child.js", "app.js", "index.html"):
                self.assertNotEqual(snapshot[name], (site / name).read_text())
            self.assertEqual(snapshot["styles.css"], (site / "styles.css").read_text())
            self.assertIn(version_site.digest(site / "leaf.js"), (site / "child.js").read_text())
            self.assertIn(version_site.digest(site / "child.js"), (site / "app.js").read_text())
            self.assertIn(version_site.digest(site / "app.js"), (site / "index.html").read_text())

            before_theme = (site / "index.html").read_text()
            (site / "theme.js").write_text("(() => { /* theme changed */ })();")
            version_site.version_stylesheet(site)
            self.assertNotEqual(before_theme, (site / "index.html").read_text())
            self.assertIn(version_site.digest(site / "theme.js"), (site / "index.html").read_text())
