"""Build from an allowlist in a temporary directory; verify every archive entry."""
from pathlib import Path
import shutil
import subprocess
import tempfile
import zipfile
from validate import ROOT, SOURCE, UUID, SCHEMA, RUNTIME, validate

validate()
files = {name: SOURCE / name for name in [*RUNTIME, "metadata.json", f"schemas/{SCHEMA}.gschema.xml"]}
files["LICENSE"] = ROOT / "LICENSE"
output = ROOT / "dist"
output.mkdir(exist_ok=True)
with tempfile.TemporaryDirectory(prefix="environments-switcher-pack-") as temporary:
    stage = Path(temporary) / UUID
    stage.mkdir()
    for name in files:
        target = stage / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(files[name], target)
    command = ["gnome-extensions", "pack", "--force", f"--out-dir={output}"]
    command.extend(f"--extra-source={name}" for name in [*RUNTIME[1:], "LICENSE"])
    subprocess.run([*command, str(stage)], check=True)
archive = output / f"{UUID}.shell-extension.zip"
with zipfile.ZipFile(archive) as bundle:
    assert bundle.testzip() is None
    members = [item.filename for item in bundle.infolist() if not item.is_dir()]
    assert len(members) == len(set(members)), "Duplicate archive members"
    assert set(files) <= set(members), f"Missing files: {set(files) - set(members)}"
    assert set(members) <= set(files) | {"schemas/gschemas.compiled"}, "Unexpected archive content"
    for name in files:
        assert bundle.read(name) == files[name].read_bytes(), f"Stale packaged file: {name}"
print(f"Verified extension bundle: {archive}")
