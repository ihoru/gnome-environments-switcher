import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../site/theme.js', import.meta.url), 'utf8');
function setup({ saved, dark = false, blocked = false } = {}) {
  const listeners = {};
  const icons = ['system', 'light', 'dark'].map((themeIcon) => ({ dataset: { themeIcon } }));
  const button = {
    hidden: true,
    querySelectorAll: () => icons,
    setAttribute(name, value) {
      this[name] = value;
    },
    addEventListener(name, fn) {
      listeners[name] = fn;
    },
  };
  const meta = [{}, {}];
  const document = {
    documentElement: { dataset: {} },
    querySelectorAll: () => meta,
    querySelector: () => button,
    addEventListener(name, fn) {
      listeners[name] = fn;
    },
  };
  const media = {
    matches: dark,
    addEventListener(name, fn) {
      listeners[name] = fn;
    },
  };
  const storage = {
    getItem() {
      if (blocked) throw new Error('Storage blocked');
      return saved;
    },
    setItem(key, value) {
      if (blocked) throw new Error('Storage blocked');
      saved = value;
    },
  };
  runInNewContext(source, { document, localStorage: storage, matchMedia: () => media });
  const initial = { ...document.documentElement.dataset };
  assert.equal(button.hidden, true);
  listeners.DOMContentLoaded();
  return {
    initial,
    root: document.documentElement.dataset,
    button,
    icons,
    meta,
    click: () => listeners.click(),
    saved: () => saved,
    system(value) {
      media.matches = value;
      listeners.change();
    },
  };
}

test('theme cycles system/light/dark with matching icons, labels, and persistence', () => {
  const f = setup();
  assert.equal(f.initial.themeMode, 'system');
  assert.equal(f.button.hidden, false);
  for (const [mode, next] of [
    ['system', 'light'],
    ['light', 'dark'],
    ['dark', 'system'],
    ['system', 'light'],
  ]) {
    assert.equal(f.root.themeMode, mode);
    assert.equal(f.button['aria-label'], `Theme: ${mode}. Switch to ${next} theme`);
    assert.equal(f.button.title, f.button['aria-label']);
    assert.deepEqual(
      f.icons.filter((icon) => !icon.hidden).map((icon) => icon.dataset.themeIcon),
      [mode],
    );
    f.click();
    assert.equal(f.saved(), next);
  }
});

test('saved preference applies before DOM ready and survives reload', () => {
  const f = setup({ saved: 'dark' });
  assert.equal(f.initial.theme, 'dark');
  assert.ok(f.meta.every((meta) => meta.content === '#211E22' && meta.media === 'all'));
  f.click();
  f.click();
  assert.equal(setup({ saved: f.saved(), dark: true }).initial.theme, 'light');
});

test('only system mode follows OS changes', () => {
  const f = setup();
  f.system(true);
  assert.equal(f.root.theme, 'dark');
  f.click();
  assert.equal(f.root.theme, 'light');
  f.system(false);
  f.system(true);
  assert.equal(f.root.theme, 'light');
  f.click();
  f.system(false);
  assert.equal(f.root.theme, 'dark');
  f.click();
  assert.equal(f.root.theme, 'light');
});

test('invalid saved values and blocked storage preserve a working switch', () => {
  assert.equal(setup({ saved: 'invalid' }).initial.themeMode, 'system');
  const f = setup({ blocked: true, dark: true });
  assert.equal(f.initial.theme, 'dark');
  f.click();
  assert.equal(f.root.theme, 'light');
  f.click();
  assert.equal(f.root.theme, 'dark');
});
