"""Detect version bumps and publish a checked ZIP from GitHub Actions."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
METADATA = 'src/metadata.json'


def version_tuple(value):
    if not isinstance(value, str) or not re.fullmatch(r'(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)', value):
        raise ValueError('Releases require a version-name in MAJOR.MINOR.PATCH format.')
    return tuple(map(int, value.split('.')))


def is_bump(previous, current):
    current_version = version_tuple(current)
    if previous is None:
        return True
    previous_version = version_tuple(previous)
    if current_version < previous_version:
        raise ValueError('Release versions must increase; refusing a version downgrade.')
    return current_version > previous_version


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, text=True).strip()


def detect(before, after):
    current = json.loads(git('show', f'{after}:{METADATA}'))['version-name']
    previous = None
    if before and set(before) != {'0'}:
        # A missing previous metadata file is a first release; a missing commit is an error.
        git('cat-file', '-e', f'{before}^{{commit}}')
        if METADATA in git('ls-tree', '--name-only', before, METADATA).splitlines():
            previous = json.loads(git('show', f'{before}:{METADATA}'))['version-name']
    bump = is_bump(previous, current)
    package = json.loads((ROOT / 'package.json').read_text())
    lock = json.loads((ROOT / 'package-lock.json').read_text())
    if bump and not (package['version'] == lock['version'] == lock['packages']['']['version'] == current):
        raise ValueError('Synchronize metadata, package.json, and package-lock.json versions before release.')
    return current, bump


def gh(*args):
    subprocess.run(['gh', *args], cwd=ROOT, check=True)


def get_release(repo, tag):
    request = urllib.request.Request(
        f'https://api.github.com/repos/{repo}/releases/tags/{tag}',
        headers={'Authorization': f'Bearer {os.environ["GH_TOKEN"]}', 'Accept': 'application/vnd.github+json'},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.load(response)
    except urllib.error.HTTPError as error:
        if error.code == 404:
            return None
        raise


def publish(version, commit):
    version_tuple(version)
    if git('rev-parse', 'HEAD') != commit:
        raise ValueError('Checkout does not match the release commit.')
    metadata = json.loads((ROOT / METADATA).read_text())
    if metadata['version-name'] != version:
        raise ValueError('Release version does not match the checked source.')
    archive = ROOT / 'dist' / f'{metadata["uuid"]}.shell-extension.zip'
    if not archive.is_file():
        raise ValueError('Checked extension ZIP is missing.')
    tag = f'v{version}'
    repo = os.environ['GITHUB_REPOSITORY']
    # Never reuse a version tag for another commit, including on workflow reruns.
    existing_tag = subprocess.run(['git', 'rev-parse', '--verify', f'refs/tags/{tag}^{{commit}}'], cwd=ROOT, capture_output=True, text=True)
    if existing_tag.returncode == 0 and existing_tag.stdout.strip() != commit:
        raise ValueError(f'{tag} already points to another commit.')
    release = get_release(repo, tag)
    if release and not release['draft']:
        if existing_tag.returncode != 0:
            raise ValueError('Published release tag is missing from checkout.')
        # Preserve published assets. Confirm a retry refers to the identical artifact.
        with tempfile.TemporaryDirectory() as directory:
            gh('release', 'download', tag, '--repo', repo, '--pattern', archive.name, '--dir', directory)
            downloaded = Path(directory) / archive.name
            # ZIP timestamps can differ between builds; compare the packaged file contents.
            import zipfile
            with zipfile.ZipFile(archive) as expected, zipfile.ZipFile(downloaded) as actual:
                if sorted(expected.namelist()) != sorted(actual.namelist()) or any(expected.read(name) != actual.read(name) for name in expected.namelist()):
                    raise ValueError('Published ZIP differs; refusing to overwrite it.')
        print(f'{tag} already published with matching contents.')
        return
    if release and release['target_commitish'] != commit and existing_tag.returncode != 0:
        raise ValueError('Existing draft targets another commit.')
    checksum = archive.with_name(archive.name + '.sha256')
    checksum.write_text(f'{hashlib.sha256(archive.read_bytes()).hexdigest()}  {archive.name}\n')
    if not release:
        gh('release', 'create', tag, '--repo', repo, '--target', commit, '--title', f'Environments Switcher {version}', '--generate-notes', '--draft')
    gh('release', 'upload', tag, str(archive), str(checksum), '--repo', repo, '--clobber')
    # Only publish after both assets have uploaded successfully.
    gh('release', 'edit', tag, '--repo', repo, '--draft=false')


if __name__ == '__main__':
    if sys.argv[1] == 'detect':
        version, bump = detect(os.environ.get('BEFORE_SHA', ''), os.environ['GITHUB_SHA'])
        with open(os.environ['GITHUB_OUTPUT'], 'a') as output:
            output.write(f'version={version}\nrelease={str(bump).lower()}\n')
        print(f'Version {version}: {"release required" if bump else "no version bump"}')
    elif sys.argv[1] == 'publish':
        publish(os.environ['RELEASE_VERSION'], os.environ['GITHUB_SHA'])
    else:
        raise ValueError('Expected detect or publish.')
