"""Install the checked ZIP locally; never restart Shell or log out the user."""
import os
from pathlib import Path
import subprocess

from validate import ROOT, UUID

PROTOTYPE = "environments-switcher@local"


def run(*args):
    return subprocess.run(["gnome-extensions", *args], check=True, text=True, capture_output=True)


def install():
    if os.geteuid() == 0:
        raise RuntimeError("Run npm run dev:install as your desktop user, without sudo.")
    archive = ROOT / "dist" / f"{UUID}.shell-extension.zip"
    if not archive.is_file():
        raise RuntimeError("Build the bundle first with npm run check.")
    extension_dir = Path(os.environ.get("XDG_DATA_HOME") or Path.home() / ".local/share") / "gnome-shell/extensions"
    if (extension_dir / UUID).is_symlink():
        raise RuntimeError("The public installation is a symlink. Keep using that development link or move it aside before installing a ZIP.")

    registered = set(run("list").stdout.splitlines())
    for uuid in (PROTOTYPE, UUID):
        if uuid in registered:
            run("disable", uuid)
    run("install", "--force", str(archive))
    print(f"Installed {archive}")
    if UUID in registered:
        run("enable", UUID)
        print("Re-enabled the public extension; the current session may still use cached code.")
    else:
        print(f"After reloading the session, run: gnome-extensions enable {UUID}")
    if os.environ.get("XDG_SESSION_TYPE") == "x11":
        print("Load the new code: press Alt+F2, type r, and press Enter.")
    else:
        print("Load the new code: save your work, then log out and back in. On X11, Alt+F2 → r also works.")


if __name__ == "__main__":
    try:
        install()
    except subprocess.CalledProcessError as error:
        raise SystemExit(error.stderr.strip() or str(error)) from error
    except (OSError, RuntimeError) as error:
        raise SystemExit(str(error)) from error
