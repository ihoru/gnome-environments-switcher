"""Validate public metadata, imports and schemas without changing the source tree."""
import json
from pathlib import Path
import re
import subprocess
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "src"
UUID = "environments-switcher@ihoru.github.io"
SCHEMA = "org.gnome.shell.extensions.environments-switcher"
RUNTIME = ["extension.js", "directionalAnimation.js", "miniPicker.js",
           "workspacePicker.js", "previewBackground.js", "settingsTransaction.js", "diagnosticLog.js"]


PREFERENCES = ["prefs.js", "preferencesModel.js", "preferencesExtras.js",
               "settingsTransfer.js", "projectInfo.js", "preferencesDiagnostics.js"]


def validate():
    metadata = json.loads((SOURCE / "metadata.json").read_text())
    assert metadata["uuid"] == UUID
    assert metadata["name"] == "Environments Switcher"
    assert metadata["description"].strip()
    assert metadata["url"] == "https://github.com/ihoru/gnome-environments-switcher"
    assert metadata["shell-version"] == ["46"], "Expand only after runtime testing"
    assert metadata["settings-schema"] == SCHEMA
    version_name = metadata.get("version-name")
    assert isinstance(version_name, str) and re.fullmatch(r"[a-zA-Z0-9 .]{1,16}", version_name), "Invalid display version"
    assert re.search(r"[a-zA-Z0-9]", version_name), "Display version must contain a letter or number"
    assert "version" not in metadata, "EGO assigns the integer version"
    assert "gettext-domain" not in metadata, "No translations are shipped yet"
    schema = ET.parse(SOURCE / "schemas" / f"{SCHEMA}.gschema.xml").getroot().find("schema")
    assert schema.attrib["id"] == SCHEMA
    assert schema.attrib["path"] == "/org/gnome/shell/extensions/environments-switcher/"
    keys = [key.attrib["name"] for key in schema.findall("key")]
    assert len(keys) == len(set(keys))
    for name in [*RUNTIME, *PREFERENCES]:
        source = (SOURCE / name).read_text()
        for imported in re.findall(r'from\s+[\'"](\./[^\'"]+)[\'"]', source):
            assert imported[2:] in (RUNTIME if name in RUNTIME else PREFERENCES), f"Unpackaged import in {name}: {imported}"
        if name in RUNTIME:
            assert not re.search(r'from\s+[\'"]gi://(?:Gtk|Gdk|Adw)(?:[?\'"])', source)
        subprocess.run(["node", "--check", str(SOURCE / name)], check=True)
    subprocess.run(["glib-compile-schemas", "--strict", "--dry-run", str(SOURCE / "schemas")], check=True)
    print("Metadata, runtime imports, JavaScript syntax and strict schemas passed.")


if __name__ == "__main__":
    validate()
