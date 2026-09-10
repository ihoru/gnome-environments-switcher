import test from 'node:test';
import assert from 'node:assert/strict';
import { loadRuntime } from './helpers.js';

function fixture(mode) {
  let parameters;
  let destroyed = 0;
  const children = [];
  const handlers = {};
  const preview = {
    set_style(style) {
      this.style = style;
    },
    add_child(actor) {
      children.push(actor);
    },
    connect(signal, callback) {
      handlers[signal] = callback;
    },
  };
  const { addPreviewBackground } = loadRuntime('previewBackground.js', ['addPreviewBackground'], {
    St: {
      Widget: class {
        constructor(props) {
          Object.assign(this, props);
        }
        set_scale(x, y) {
          this.scale = [x, y];
        }
      },
    },
    Clutter: { BinLayout: class {} },
    Background: {
      BackgroundManager: class {
        constructor(props) {
          parameters = props;
        }
        destroy() {
          destroyed++;
        }
      },
    },
  });
  addPreviewBackground(
    preview,
    { get_uint: () => mode },
    { index: 2, width: 1920, height: 1080 },
    190,
    115,
  );
  return { preview, children, handlers, parameters, destroyed: () => destroyed };
}

test('transparent and brighter previews do not allocate wallpaper resources', () => {
  for (const [mode, color] of [
    [0, 'transparent'],
    [2, '#e9e7e5'],
  ]) {
    const f = fixture(mode);
    assert.ok(f.preview.style.includes(color));
    assert.equal(f.children.length, 0);
    assert.equal(f.parameters, undefined);
  }
});

test('wallpaper uses the correct monitor, scales its full composition and releases resources', () => {
  const f = fixture(1);
  assert.equal(f.parameters.monitorIndex, 2);
  assert.equal(f.parameters.controlPosition, false);
  assert.equal(f.parameters.useContentSize, false);
  assert.equal(f.parameters.vignette, false);
  assert.equal(f.children[0].width, 1920);
  assert.equal(f.children[0].height, 1080);
  assert.deepEqual(f.children[0].scale, [190 / 1920, 115 / 1080]);
  assert.equal(f.parameters.container, f.children[0]);
  f.handlers.destroy();
  assert.equal(f.destroyed(), 1);
});

test('desktop wallpaper is the default when no background choice is available', () => {
  assert.equal(fixture(undefined).parameters.monitorIndex, 2);
});
