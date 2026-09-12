import test from 'node:test';
import assert from 'node:assert/strict';
import { createGlyphStore } from '../src/glyphs.js';
import { fakeCanvas } from './helpers/glyph-environment.mjs';

function environment(overrides = {}) {
  return { createCanvas: () => fakeCanvas(), createFontFace: (family, source, options) => ({ family, source, options, async load() { return this; } }), addFont() {}, ...overrides };
}

test('font failures block missing masks and retry only the failed subset', async () => {
  const requested = [], added = [];
  let failGreek = true;
  const store = createGlyphStore(environment({
    createFontFace(family, source, options) {
      requested.push({ family, source, options });
      return { family, async load() { if (family.endsWith('-greek') && failGreek) throw new Error('offline'); return this; } };
    }, addFont: face => added.push(face.family),
  }));
  await store.loadGlyphs(['A']);
  await assert.rejects(store.loadGlyphs(['A', 'Ω']), /Inter Medium kon niet worden geladen/);
  assert.equal(store.hasGlyphs(['A', 'Ω']), false);
  assert.equal(store.getGlyph('Ω', '#000000'), null);
  failGreek = false;
  await store.loadGlyphs(['A', 'Ω']);
  assert.equal(store.hasGlyphs(['A', 'Ω']), true);
  assert.deepEqual(requested.map(row => row.family), ['NumberMotionInter500-latin', 'NumberMotionInter500-greek', 'NumberMotionInter500-greek']);
  assert.equal(requested.every(row => row.options.weight === '500' && row.source.includes('-500-normal.woff')), true);
  assert.deepEqual(added, ['NumberMotionInter500-latin', 'NumberMotionInter500-greek']);
});

test('one cached mask uses the complete cluster and preserves the same shape across colors and callers', async () => {
  const store = createGlyphStore(environment());
  await store.loadGlyphs(['q\u0301', 'e\u0301']);
  const first = store.getGlyph('q\u0301', '#123456');
  assert.equal(first, store.getGlyph('q\u0301', '#123456'));
  assert.equal(first.character, 'q\u0301');
  assert.match(first.font, /500 1024px "NumberMotionInter500-latin"/);
  assert.equal(first.height, 700);
  assert.equal(first.width, 467);
  const otherColor = store.getGlyph('q\u0301', '#abcdef');
  assert.notEqual(first, otherColor);
  assert.equal(first.source, otherColor.source);
  assert.equal(otherColor.color, '#abcdef');
  assert.equal(store.getGlyph('é', '#000000').character, 'é');
});

test('pending fonts cannot expose a mask, and unsupported content never reaches a font or canvas', async () => {
  let resolveFont, calls = 0;
  const store = createGlyphStore(environment({ createFontFace: () => { calls += 1; return { load: () => new Promise(resolve => { resolveFont = resolve; }) }; } }));
  await assert.rejects(store.loadGlyphs(['😀']), /niet beschikbaar/);
  assert.equal(calls, 0);
  const pending = store.loadGlyphs(['A']);
  assert.equal(store.hasGlyphs(['A']), false);
  assert.equal(store.getGlyph('A', '#000000'), null);
  await new Promise(resolve => setImmediate(resolve));
  resolveFont({}); await pending;
  assert.equal(store.hasGlyphs(['A']), true);
});

test('blank or oversized raster bounds fail before they can be exported', async () => {
  const blank = createGlyphStore(environment({ createCanvas: () => fakeCanvas({ blank: true }) }));
  await assert.rejects(blank.loadGlyphs(['A']), /geen zichtbare vorm/);
  assert.equal(blank.hasGlyphs(['A']), false);
  const oversized = createGlyphStore(environment({ createCanvas: () => fakeCanvas({ metrics: { actualBoundingBoxLeft: 0, actualBoundingBoxRight: 5000, actualBoundingBoxAscent: 72, actualBoundingBoxDescent: 0 } }) }));
  await assert.rejects(oversized.loadGlyphs(['A']), /te groot/);
  assert.equal(oversized.hasGlyphs(['A']), false);
});

test('wide punctuation fits the mask cache by proportional scaling instead of being rejected', async () => {
  const store = createGlyphStore(environment({ createCanvas: () => fakeCanvas({ metrics: character => ({
    actualBoundingBoxLeft: 0, actualBoundingBoxRight: character === '0' ? 48 : 1000,
    actualBoundingBoxAscent: character === '0' ? 72 : 20, actualBoundingBoxDescent: 0,
  }) }) }));
  await store.loadGlyphs(['—', '-', '_']);
  for (const character of ['—', '-', '_']) {
    const mask = store.getGlyph(character, '#000000');
    assert.equal(mask.width, 4096);
    assert.equal(mask.height, 82);
    assert.equal(mask.character, character);
    assert.equal(mask.characterScale, 20 / 72);
  }
});

test('a timed-out font has a retryable error and never becomes ready by resolving late', async () => {
  let resolveFont, added = 0;
  const store = createGlyphStore(environment({ timeout: 5, createFontFace: () => ({ load: () => new Promise(resolve => { resolveFont = resolve; }) }), addFont: () => { added += 1; } }));
  await assert.rejects(store.loadGlyphs(['A']), /duurt te lang/);
  resolveFont({}); await new Promise(resolve => setImmediate(resolve));
  assert.equal(added, 0);
  assert.equal(store.hasGlyphs(['A']), false);
});
