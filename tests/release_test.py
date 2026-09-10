import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('release', Path(__file__).resolve().parents[1] / 'scripts/release.py')
release = importlib.util.module_from_spec(spec)
spec.loader.exec_module(release)


class ReleaseVersionTests(unittest.TestCase):
    def test_only_increasing_versions_release(self):
        self.assertTrue(release.is_bump('0.2.0', '0.2.1'))
        self.assertTrue(release.is_bump('0.9.0', '0.10.0'))
        self.assertTrue(release.is_bump(None, '0.2.0'))
        self.assertFalse(release.is_bump('0.2.0', '0.2.0'))

    def test_downgrades_and_invalid_versions_fail(self):
        for previous, current in [('0.2.0', '0.1.9'), (None, '1.2'), (None, 'v1.2.3'), (None, '01.2.3'), (None, '1.2.3-beta'), (None, None)]:
            with self.assertRaises(ValueError):
                release.is_bump(previous, current)


class ReleasePublishTests(unittest.TestCase):
    def setUp(self):
        import tempfile
        import json
        import zipfile
        from unittest.mock import patch
        from types import SimpleNamespace
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        root = Path(self.temp.name)
        (root / 'src').mkdir()
        (root / 'dist').mkdir()
        (root / 'src/metadata.json').write_text(json.dumps({'uuid': 'test', 'version-name': '0.2.0'}))
        with zipfile.ZipFile(root / 'dist/test.shell-extension.zip', 'w') as archive:
            archive.writestr('metadata.json', '{}')
        self.root = root
        self.gh = self.enterContext(patch.object(release, 'gh'))
        self.enterContext(patch.object(release, 'ROOT', root))
        self.enterContext(patch.object(release, 'git', return_value='commit'))
        self.tag = self.enterContext(patch.object(release.subprocess, 'run', return_value=SimpleNamespace(returncode=1, stdout='')))
        self.remote = self.enterContext(patch.object(release, 'get_release', return_value=None))
        self.enterContext(patch.dict(release.os.environ, {'GITHUB_REPOSITORY': 'owner/repo'}))

    def test_upload_failure_never_publishes(self):
        def fail_upload(*args):
            if args[1] == 'upload':
                raise RuntimeError('upload failed')
        self.gh.side_effect = fail_upload
        with self.assertRaises(RuntimeError):
            release.publish('0.2.0', 'commit')
        self.assertEqual([call.args[1] for call in self.gh.call_args_list], ['create', 'upload'])
        self.assertIn('--draft', self.gh.call_args_list[0].args)

    def test_existing_draft_resumes_upload_before_publish(self):
        self.remote.return_value = {'draft': True, 'target_commitish': 'commit'}
        release.publish('0.2.0', 'commit')
        self.assertEqual([call.args[1] for call in self.gh.call_args_list], ['upload', 'edit'])
        self.assertIn('--draft=false', self.gh.call_args_list[-1].args)

    def test_conflicting_tag_cannot_publish(self):
        from types import SimpleNamespace
        self.tag.return_value = SimpleNamespace(returncode=0, stdout='other-commit')
        with self.assertRaises(ValueError):
            release.publish('0.2.0', 'commit')
        self.gh.assert_not_called()

    def test_published_release_is_verified_without_uploading(self):
        from types import SimpleNamespace
        import shutil
        self.tag.return_value = SimpleNamespace(returncode=0, stdout='commit')
        self.remote.return_value = {'draft': False}
        def download(*args):
            self.assertEqual(args[1], 'download')
            shutil.copy(self.root / 'dist/test.shell-extension.zip', Path(args[-1]))
        self.gh.side_effect = download
        release.publish('0.2.0', 'commit')
        self.assertEqual(self.gh.call_count, 1)
