import test from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTIVITY_MESSAGES as settingsMessages } from '../src/projectInfo.js';
import { PRODUCTIVITY_MESSAGES, startEncouragement } from '../site/encouragement.js';

function fixture(reduced = false) {
  let now = 0;
  let id = 0;
  const tasks = new Map();
  const schedule = (fn, ms, repeat) => {
    tasks.set(++id, { fn, at: now + ms, ms, repeat });
    return id;
  };
  const clock = {
    setInterval: (fn, ms) => schedule(fn, ms, true),
    setTimeout: (fn, ms) => schedule(fn, ms, false),
    clearInterval: (id) => tasks.delete(id),
    clearTimeout: (id) => tasks.delete(id),
  };
  const advance = (ms) => {
    const end = now + ms;
    for (;;) {
      const entry = [...tasks].sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry || entry[1].at > end) break;
      const [key, task] = entry;
      now = task.at;
      if (task.repeat) task.at += task.ms;
      else tasks.delete(key);
      task.fn();
    }
    now = end;
  };
  const listeners = new Map();
  const doc = {
    hidden: false,
    createElement: () => {
      const classes = new Set();
      return {
        classList: {
          add: (s) => classes.add(s),
          remove: (s) => classes.delete(s),
          contains: (s) => classes.has(s),
        },
        setAttribute() {},
      };
    },
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: (name) => listeners.delete(name),
  };
  const container = {
    children: [],
    replaceChildren(...nodes) {
      this.children = nodes;
    },
    append(node) {
      this.children.push(node);
    },
  };
  const stop = startEncouragement(container, {
    random: () => 0,
    document: doc,
    clock,
    reducedMotion: { matches: reduced },
  });
  return {
    active: container.children[0],
    container,
    advance,
    stop,
    tasks,
    hide(value) {
      doc.hidden = value;
      listeners.get('visibilitychange')();
    },
  };
}

test('website encouragement matches all ten settings messages', () => {
  assert.deepEqual(PRODUCTIVITY_MESSAGES, settingsMessages);
  assert.equal(PRODUCTIVITY_MESSAGES.length, 10);
});

test('rotates every 30 seconds with a 200 ms fade and never immediately repeats', () => {
  const f = fixture();
  const initial = f.active.textContent;
  assert.equal(f.container.children.length, 11);
  f.advance(29999);
  assert.equal(f.active.textContent, initial);
  f.advance(1);
  assert.ok(f.active.classList.contains('is-fading'));
  f.advance(199);
  assert.equal(f.active.textContent, initial);
  f.advance(1);
  assert.notEqual(f.active.textContent, initial);
  assert.ok(!f.active.classList.contains('is-fading'));
  let previous = f.active.textContent;
  for (let i = 0; i < 20; i++) {
    f.advance(30000);
    assert.notEqual(f.active.textContent, previous);
    previous = f.active.textContent;
  }
  f.stop();
  assert.equal(f.tasks.size, 0);
});

test('hidden tabs cancel pending fades and restart a full countdown on return', () => {
  const f = fixture();
  f.advance(30000);
  f.hide(true);
  assert.equal(f.tasks.size, 0);
  assert.ok(!f.active.classList.contains('is-fading'));
  const previous = f.active.textContent;
  f.advance(120000);
  assert.equal(f.active.textContent, previous);
  f.hide(false);
  f.advance(29999);
  assert.equal(f.active.textContent, previous);
  f.advance(201);
  assert.notEqual(f.active.textContent, previous);
  f.stop();
});

test('reduced motion swaps immediately without fading', () => {
  const f = fixture(true);
  const previous = f.active.textContent;
  f.advance(30000);
  assert.notEqual(f.active.textContent, previous);
  assert.ok(!f.active.classList.contains('is-fading'));
  assert.equal(f.tasks.size, 1);
  f.stop();
});
