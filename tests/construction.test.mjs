import test from 'node:test';
import assert from 'node:assert/strict';
import { signedDistance, constructionGeometry, createConstructionCache } from '../src/construction.js';
import { fakeCanvas } from './helpers/glyph-environment.mjs';

test('construction distance follows the nearest opposing pixel, including empty and concave shapes', () => {
  const width = 7, height = 6;
  for (const shape of [[], [8, 9, 10, 15, 22, 23, 24], Array.from({ length: 42 }, (_, i) => i)]) {
    const ink = Uint8Array.from({ length: width * height }, (_, i) => shape.includes(i) ? 1 : 0);
    const result = signedDistance(ink, width, height);
    for (let i = 0; i < ink.length; i += 1) {
      let nearest = width + height + 1;
      for (let j = 0; j < ink.length; j += 1) if (ink[j] !== ink[i]) {
        nearest = Math.min(nearest, Math.abs(i % width - j % width) + Math.abs(Math.floor(i / width) - Math.floor(j / width)));
      }
      assert.equal(result[i], ink[i] ? nearest : -nearest);
    }
  }
});

test('the bar and unfolding clip scale with punctuation while retaining the chosen glyph aspect', () => {
  const bounds = [440, 86, 956, 229];
  const numeral = constructionGeometry({ width: 450, height: 700, characterScale: 1 }, bounds);
  const mark = constructionGeometry({ width: 4096, height: 284, characterScale: 0.14 }, bounds);
  assert.equal(mark.visibleHeight / numeral.visibleHeight, 0.14);
  assert.equal(mark.barWidth / numeral.barWidth, 0.14);
  assert.equal(mark.width / mark.height, 4096 / 284);
  assert.equal(numeral.top, 86);
  assert.equal(numeral.x, 698);
});

test('construction cache is bounded, retains exact sample/color identity, and limits wide masks', () => {
  let created = 0;
  const get = createConstructionCache(() => { created += 1; return fakeCanvas(); });
  const mask = { width: 4096, height: 20, characterScale: 1 };
  const bounds = [440, 86, 956, 229];
  const first = get(mask, '#123456', bounds, 7);
  assert.ok(first.canvas.width <= 512 && first.canvas.height <= 512);
  assert.equal(get(mask, '#123456', bounds, 7), first);
  assert.equal(created, 1);
  assert.notEqual(get(mask, '#abcdef', bounds, 7), first);
  assert.equal(first.canvas.color, '#123456');
  for (let i = 0; i < 16; i += 1) get(mask, '#123456', bounds, 6.1 + i / 20);
  assert.notEqual(get(mask, '#123456', bounds, 7), first);
  const original = get({ ...mask }, '#123456', bounds, 7);
  assert.notEqual(original, first);
});
