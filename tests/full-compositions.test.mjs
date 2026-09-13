import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { loadGlyphs } from '../src/glyphs.js';
import { renderFullComposition, sampleFullComposition } from '../src/full-compositions.js';
import { installGlyphEnvironment } from './helpers/glyph-environment.mjs';

const restoreGlyphEnvironment = installGlyphEnvironment();
after(restoreGlyphEnvironment);
await loadGlyphs(['0', 'A', 'q\u0301', '-']);

function context() {
  const draws = [], stack = [];
  let state = { x: 0, y: 0, angle: 0 };
  return {
    draws,
    save() { stack.push({ ...state }); },
    restore() { assert.ok(stack.length); state = stack.pop(); },
    translate(x, y) { state.x += x; state.y += y; },
    rotate(angle) { state.angle += angle; },
    drawImage(mask, x, y, width, height) {
      assert.ok([x, y, width, height, ...Object.values(state)].every(Number.isFinite));
      draws.push({ mask, x, y, width, height, ...state });
    },
    balanced() { return stack.length === 0; },
  };
}

const scene = (effect, digit = '0', fg = '#123456') => ({ effect, digit, fg });
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) < tolerance, `${actual} differs from ${expected}`);

test('full compositions retain every stable glyph identity through their fifteen exposures', () => {
  for (const [effect, count] of [['quad', 4], ['pattern', 42], ['scroll', 46]]) {
    const ids = sampleFullComposition(effect, 0).map(pose => pose.id);
    assert.equal(ids.length, count);
    assert.equal(new Set(ids).size, count);
    for (let frame = 0; frame <= 14; frame += 0.5) {
      const poses = sampleFullComposition(effect, frame / 15);
      assert.deepEqual(poses.map(pose => pose.id), ids);
      assert.ok(poses.every(pose => ['x', 'y', 'height', 'width', 'rotation'].every(key => Number.isFinite(pose[key]))));
    }
  }
});

test('sampling interpolates each tracked pose and holds the final exposure without extrapolation', () => {
  for (const effect of ['quad', 'pattern', 'scroll']) {
    assert.deepEqual(sampleFullComposition(effect, -1), sampleFullComposition(effect, 0));
    assert.deepEqual(sampleFullComposition(effect, Number.NaN), sampleFullComposition(effect, 0));
    assert.deepEqual(sampleFullComposition(effect, 1), sampleFullComposition(effect, 14 / 15));
    assert.deepEqual(sampleFullComposition(effect, 20), sampleFullComposition(effect, 1));
    const left = sampleFullComposition(effect, 7 / 15);
    const right = sampleFullComposition(effect, 8 / 15);
    const halfway = sampleFullComposition(effect, 7.5 / 15);
    for (let i = 0; i < halfway.length; i += 1) {
      for (const key of ['x', 'y', 'height', 'rotation', 'width']) near(halfway[i][key], (left[i][key] + right[i][key]) / 2);
    }
    assert.deepEqual(sampleFullComposition(effect, 7 / 15 - 1e-12), left);
  }
  assert.throws(() => sampleFullComposition('missing', 0), /Unknown full composition/);
});

test('the quartet grows around its source center with four fixed face orientations', () => {
  const start = sampleFullComposition('quad', 0);
  const end = sampleFullComposition('quad', 1);
  assert.deepEqual(start.map(pose => pose.rotation), [0, Math.PI, Math.PI / 2, -Math.PI / 2]);
  assert.deepEqual(end.map(pose => pose.rotation), start.map(pose => pose.rotation));
  assert.deepEqual(start[0], { id: 'normal', x: 777.77, y: 506.68, height: 208.85, rotation: 0, width: 0 });
  assert.deepEqual(end[0], { id: 'normal', x: 496.97, y: 599.79, height: 443.9, rotation: 0, width: 0 });
  for (let frame = 0; frame <= 14; frame += 1) {
    const poses = sampleFullComposition('quad', frame / 15);
    near((poses[0].x + poses[1].x) / 2, 700);
    near((poses[0].y + poses[1].y) / 2, 394);
    assert.ok(poses.slice(2).every(pose => pose.width > 0));
  }
});

test('sideways quartet members fit the measured postrotation box, including unequal stretches', () => {
  for (const progress of [0, 0.5, 1]) {
    const ctx = context();
    renderFullComposition(ctx, scene('quad', 'A'), progress, 1400, 788);
    const poses = sampleFullComposition('quad', progress);
    assert.equal(ctx.draws.length, 4);
    for (const i of [2, 3]) {
      const draw = ctx.draws[i];
      near(draw.angle, i === 2 ? Math.PI / 2 : -Math.PI / 2);
      near(draw.height, poses[i].width);
      near(draw.width, poses[i].height);
    }
    assert.ok(ctx.balanced());
  }
});

test('the sliding pattern keeps six staggered columns with distinct measured downward travel', () => {
  const first = sampleFullComposition('pattern', 0);
  const last = sampleFullComposition('pattern', 1);
  const travel = [];
  for (let column = 0; column < 6; column += 1) {
    const rows = first.filter(pose => pose.id.startsWith(`c${column}r`));
    assert.equal(rows.length, 7);
    for (let i = 1; i < rows.length; i += 1) {
      near(rows[i].x, rows[0].x);
      near(rows[i].y - rows[i - 1].y, 342.2, 0.1);
    }
    const id = `c${column}r0`;
    const a = first.find(pose => pose.id === id), b = last.find(pose => pose.id === id);
    near(a.x, b.x, 0.05);
    travel.push(b.y - a.y);
  }
  assert.ok(travel.every(distance => distance > 160));
  assert.ok(Math.max(...travel) - Math.min(...travel) > 120);
  assert.ok(first.concat(last).every(pose => pose.rotation === 0));
});

test('the zooming pattern preserves grouped gaps and independent row movement as it shrinks', () => {
  const first = sampleFullComposition('scroll', 0);
  const last = sampleFullComposition('scroll', 1);
  const row = ['r-1g0', 'r-1g1', 'r-1g2', 'r-1g3', 'r-1g4'].map(id => first.find(pose => pose.id === id));
  const gaps = row.slice(1).map((pose, i) => pose.x - row[i].x);
  near(gaps[0], 408.2508);
  near(gaps[1], 264.084);
  assert.ok(gaps[0] > gaps[1] * 1.5 && gaps[3] > gaps[2] * 1.5);
  assert.ok(first.every(pose => pose.height > 367 && pose.height < 369));
  assert.ok(last.every(pose => pose.height > 189 && pose.height < 191));
  const travel = ['r-2g0', 'r-1g0', 'r0g0', 'r1g0'].map(id => last.find(pose => pose.id === id).x - first.find(pose => pose.id === id).x);
  assert.ok(Math.max(...travel) - Math.min(...travel) > 140);
  assert.ok(first.concat(last).every(pose => pose.rotation === 0));
});

test('landscape, square and portrait map the same composition around the canvas center', () => {
  for (const effect of ['quad', 'pattern', 'scroll']) {
    const reference = context();
    renderFullComposition(reference, scene(effect), 0.37, 1400, 788);
    for (const [width, height] of [[1280, 720], [720, 720], [720, 1280]]) {
      const ctx = context();
      renderFullComposition(ctx, scene(effect), 0.37, width, height);
      const unit = effect === 'quad' ? Math.min(width, height) / 788 : Math.max(width / 1400, height / 788);
      for (let i = 0; i < ctx.draws.length; i += 1) {
        near(ctx.draws[i].x - width / 2, (reference.draws[i].x - 700) * unit);
        near(ctx.draws[i].y - height / 2, (reference.draws[i].y - 394) * unit);
        near(ctx.draws[i].width, reference.draws[i].width * unit);
        near(ctx.draws[i].height, reference.draws[i].height * unit);
      }
    }
  }
});

test('portrait patterns cover the source frame height instead of becoming a short horizontal band', () => {
  for (const effect of ['pattern', 'scroll']) {
    const ctx = context();
    renderFullComposition(ctx, scene(effect), 1, 720, 1280);
    const poses = sampleFullComposition(effect, 1);
    // At identical time, source coordinates 0..788 span the full output height.
    const i = poses.findIndex(pose => pose.y > 0 && pose.y < 788);
    near(ctx.draws[i].y, poses[i].y * 1280 / 788);
    near(ctx.draws[i].height, poses[i].height * 1280 / 788);
  }
});

test('all members use the selected Unicode mask and color, with punctuation scale preserved', () => {
  for (const effect of ['quad', 'pattern', 'scroll']) {
    for (const digit of ['0', 'A', 'q\u0301', '-']) {
      const first = context(), second = context();
      renderFullComposition(first, scene(effect, digit), 0.2, 1400, 788);
      renderFullComposition(second, scene(effect, digit, '#abcdef'), 0.2, 1400, 788);
      assert.ok(first.draws.every(draw => draw.mask.character === digit && draw.mask.color === '#123456'));
      assert.ok(second.draws.every(draw => draw.mask.character === digit && draw.mask.color === '#abcdef'));
      assert.ok(first.draws.every(draw => draw.mask === first.draws[0].mask));
      assert.deepEqual(first.draws.map(({ mask, ...pose }) => pose), second.draws.map(({ mask, ...pose }) => pose));
      const poses = sampleFullComposition(effect, 0.2);
      for (let i = 0; i < first.draws.length; i += 1) {
        const draw = first.draws[i];
        near(draw.height, (poses[i].width || poses[i].height) * (digit === '-' ? 10 / 72 : 1));
      }
    }
    assert.throws(() => renderFullComposition(context(), scene(effect, 'Б'), 0, 1400, 788), /not loaded yet/);
  }
});
