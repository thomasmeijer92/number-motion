import test from 'node:test';
import assert from 'node:assert/strict';
import { loadGlyphs, getGlyph } from '../src/glyphs.js';

test('missing required glyphs block readiness and retry only the missing images', async () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const requested = [];
  let failFive = true;
  class TestImage {
    set src(value) {
      requested.push(value);
      queueMicrotask(() => value.endsWith('/5.png') && failFive ? this.onerror() : this.onload());
    }
  }
  Object.defineProperty(globalThis, 'Image', { value: TestImage, configurable: true });
  try {
    await assert.rejects(loadGlyphs(), /Cijfers 5 konden niet worden geladen/);
    assert.equal(getGlyph('5', '#000000'), null);
    assert.equal(requested.length, 10);
    failFive = false;
    assert.equal(await loadGlyphs(), true);
    assert.deepEqual(requested.slice(10), ['/glyphs/5.png']);
    await loadGlyphs();
    assert.equal(requested.length, 11);
  } finally {
    if (original) Object.defineProperty(globalThis, 'Image', original);
    else delete globalThis.Image;
  }
});
