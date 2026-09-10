import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRuntime } from './helpers.js';

test('enabled diagnostics append runtime events to the file sink without opening preferences', () => {
  const { EnvironmentsSwitcherExtension: Extension } = loadRuntime(
    'extension.js',
    ['EnvironmentsSwitcherExtension'],
    { console: { log() {} } },
  );
  const ext = new Extension();
  const lines = [];
  let enabled = true;
  ext._settings = { get_boolean: () => enabled };
  ext._activeWorkspaceIndex = () => 0;
  ext._workspaceCount = () => 18;
  ext._diagnosticLog = { write: (text) => lines.push(text) };
  ext._log('workspace-changed', { logicalWorkspace: 2 });
  ext._log('picker-opened');
  assert.equal(lines.length, 2);
  assert.match(lines[0], /workspace-changed/);
  enabled = false;
  ext._log('workspace-changed');
  ext._log('navigation-failed');
  assert.equal(lines.length, 2);
});
