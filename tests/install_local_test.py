"""Exercise installer safety without touching GNOME or the user's installation."""
import contextlib
import io
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
import install_local


class InstallerTests(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        self.root = Path(temporary.name)
        archive = self.root / "dist" / f"{install_local.UUID}.shell-extension.zip"
        archive.parent.mkdir()
        archive.write_bytes(b"checked bundle placeholder")
        self.extensions = self.root / "data/gnome-shell/extensions"
        self.output = io.StringIO()
        for context in (
            patch.object(install_local, "ROOT", self.root),
            patch.object(os, "geteuid", return_value=1000),
            patch.dict(os.environ, {"XDG_DATA_HOME": str(self.root / "data"),
                                    "XDG_STATE_HOME": str(self.root / "state"),
                                    "XDG_SESSION_TYPE": "x11"}),
            contextlib.redirect_stdout(self.output),
        ):
            self.enterContext(context)

    def existing(self, uuid):
        directory = self.extensions / uuid
        directory.mkdir(parents=True)
        (directory / "extension.js").write_text("original code")
        return directory

    def test_update_does_not_back_up_and_keeps_prototype_disabled(self):
        for uuid in (install_local.PROTOTYPE, install_local.UUID):
            self.existing(uuid)
        with patch.object(install_local, "run") as run:
            run.return_value.stdout = f"{install_local.PROTOTYPE}\n{install_local.UUID}\n"
            install_local.install()
        self.assertEqual([call.args[:2] for call in run.call_args_list], [
            ("list",), ("disable", install_local.PROTOTYPE),
            ("disable", install_local.UUID), ("install", "--force"),
            ("enable", install_local.UUID),
        ])
        self.assertFalse((self.root / "state").exists())

    def test_symlink_is_rejected_before_any_gnome_command(self):
        self.extensions.mkdir(parents=True)
        (self.extensions / install_local.UUID).symlink_to(self.root, target_is_directory=True)
        with patch.object(install_local, "run") as run:
            with self.assertRaisesRegex(RuntimeError, "symlink"):
                install_local.install()
        run.assert_not_called()

    def test_first_install_prints_enable_after_reload(self):
        with patch.object(install_local, "run") as run:
            run.return_value.stdout = ""
            install_local.install()
        self.assertEqual([call.args[0] for call in run.call_args_list], ["list", "install"])
        self.assertIn("After reloading the session, run:", self.output.getvalue())

    def test_install_failure_does_not_enable(self):
        self.existing(install_local.UUID)

        def command(*args):
            if args[0] == "install":
                raise subprocess.CalledProcessError(1, args, stderr="install failed")
            return subprocess.CompletedProcess(args, 0, stdout=install_local.UUID)

        with patch.object(install_local, "run", side_effect=command) as run:
            with self.assertRaises(subprocess.CalledProcessError):
                install_local.install()
        self.assertNotIn("enable", [call.args[0] for call in run.call_args_list])
        self.assertFalse((self.root / "state").exists())


if __name__ == "__main__":
    unittest.main()
