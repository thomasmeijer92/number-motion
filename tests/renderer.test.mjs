import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SCENES, EFFECTS, getSceneAtTime, getTotalDuration, getLoopTime, renderProject, renderScene, sampleReference } from '../src/renderer.js';
import { REFERENCE_TRACKS, REFERENCE_BOUNDS } from '../src/reference-frames.js';

function context(width = 1920, height = 1080) {
  const operations = [];
  const ctx = { canvas: { width, height }, operations };
  for (const method of ['save', 'restore', 'translate', 'rotate', 'scale', 'fillRect', 'fillText', 'beginPath', 'rect', 'clip']) {
    ctx[method] = (...args) => {
      assert.equal(args.filter(arg => typeof arg === 'number').every(Number.isFinite), true, `${method} received invalid coordinates`);
      operations.push([method, ctx.fillStyle, ...args]);
    };
  }
  ctx.measureText = () => ({ actualBoundingBoxAscent: 72, actualBoundingBoxDescent: 0, actualBoundingBoxLeft: 0, actualBoundingBoxRight: 48, width: 50 });
  return ctx;
}

test('fractional scene cuts select the incoming scene and the end retains the final scene', () => {
  const scenes = [DEFAULT_SCENES[0], DEFAULT_SCENES[1], DEFAULT_SCENES[0]]
    .map((scene, index) => ({ ...scene, duration: [0.2, 0.45, 0.35][index] }));
  assert.equal(getTotalDuration(scenes), 1);
  assert.equal(getSceneAtTime(scenes, 0.199).index, 0);
  assert.equal(getSceneAtTime(scenes, 0.2).index, 1);
  assert.equal(getSceneAtTime(scenes, 0.65).index, 2);
  const end = getSceneAtTime(scenes, 1);
  assert.equal(end.index, 2);
  assert.equal(end.localTime, 0.35);
  assert.equal(getSceneAtTime(scenes, 500).index, 2);
});

test('preview and export sampling draw the incoming scene identically at a cut', () => {
  const scenes = DEFAULT_SCENES.slice(0, 2);
  const projectCtx = context();
  const sceneCtx = context();
  renderProject(projectCtx, scenes, scenes[0].duration);
  renderScene(sceneCtx, scenes[1], 0);
  assert.deepEqual(projectCtx.operations, sceneCtx.operations);
});

test('repeated video cuts do not leak a final frame from the preceding loop', () => {
  for (const durations of [[0.2, 0.2, 0.2, 0.2], [0.45, 0.45, 0.6, 0.6]]) {
    const scenes = durations.map((duration, i) => ({ ...DEFAULT_SCENES[i % 2], duration }));
    const total = getTotalDuration(scenes);
    const frame = Math.round(total * 3 * 30);
    const local = getLoopTime(frame / 30, total);
    assert.equal(local, 0);
    assert.equal(getSceneAtTime(scenes, local).index, 0);
    assert.equal(getSceneAtTime(scenes, getLoopTime((frame - 1) / 30, total)).index, 3);
  }
});

test('fractional playback speed enters a blank source frame on its exact video frame', () => {
  const scene = { ...DEFAULT_SCENES[0], effect: 'orbit', speed: 0.6, duration: 1 };
  const before = context(), at = context();
  renderScene(before, scene, 20 / 30);
  renderScene(at, scene, 21 / 30);
  assert.equal(before.operations.some(([method]) => method === 'clip'), false);
  assert.equal(at.operations.some(([method]) => method === 'clip'), true);
});

test('every preset renders one numeral, optionally partitioned into four pieces, deterministically', () => {
  for (const effect of EFFECTS) {
    for (let digit = 0; digit <= 9; digit += 1) {
      for (const [width, height] of [[1920, 1080], [1080, 1920], [1080, 1080]]) {
        const scene = { ...DEFAULT_SCENES[0], effect: effect.id, digit: String(digit), speed: 1, scale: 1.5 };
        for (const time of [0, 0.03, 0.12, 0.24, 0.39, scene.duration]) {
          const first = context(width, height);
          const second = context(width, height);
          renderScene(first, scene, time);
          renderScene(second, scene, time);
          assert.deepEqual(first.operations, second.operations);
          const pieces = effect.id === 'splitFour' && time > 0 && time < 0.396 ? 4 : 1;
          assert.equal(first.operations.filter(([method]) => method === 'fillText').length, pieces,
            `${effect.id}: digit ${digit} at ${time} has an unexpected number of pieces`);
          if (pieces === 4) assert.equal(first.operations.filter(([method]) => method === 'clip').length, 4);
          assert.equal(first.operations.filter(([method]) => method === 'fillRect').length, 1,
            `${effect.id} must only paint the background before its glyph`);
          const coloredPaint = first.operations.filter(([method]) => ['fillRect', 'fillText'].includes(method));
          assert.deepEqual(coloredPaint.map(([, color]) => color), [scene.bg, ...Array(pieces).fill(scene.fg)]);
        }
      }
    }
  }
});

test('splitFour partitions the whole numeral into unique quarters and rejoins before the final video frame', () => {
  const scene = { ...DEFAULT_SCENES[0], effect: 'splitFour', digit: '0' };
  const peak = context();
  renderScene(peak, scene, 0.2);
  const clips = peak.operations.filter(([method]) => method === 'rect').map(row => row.slice(2));
  const centers = peak.operations.filter(([method]) => method === 'translate').slice(2).map(row => row.slice(2));
  const relativeClips = clips.map(([x, y, w, h], i) => [
    Math.round(x - centers[i][0]), Math.round(y - centers[i][1]), Math.round(w), Math.round(h),
  ]);
  assert.deepEqual(relativeClips, [
    [-216, -270, 216, 270], [0, -270, 216, 270],
    [-216, 0, 216, 270], [0, 0, 216, 270],
  ]);
  assert.ok(clips[1][0] - (clips[0][0] + clips[0][2]) > 150);
  assert.ok(clips[2][1] - (clips[0][1] + clips[0][3]) > 150);
  const start = context(), closed = context(), finalFrame = context();
  renderScene(start, scene, 0);
  renderScene(closed, scene, 0.4);
  renderScene(finalFrame, scene, 13 / 30);
  assert.deepEqual(closed.operations, start.operations);
  assert.deepEqual(finalFrame.operations, start.operations);
  assert.equal(closed.operations.filter(([method]) => method === 'fillText').length, 1);
});

test('new projects start with two blocks at the original GIF pace', () => {
  assert.equal(DEFAULT_SCENES.length, 2);
  assert.deepEqual(DEFAULT_SCENES.map(({ digit, effect, duration }) => ({ digit, effect, duration })), [
    { digit: '1', effect: 'single', duration: 0.45 },
    { digit: '2', effect: 'duo', duration: 0.45 },
  ]);
  assert.equal(getTotalDuration(DEFAULT_SCENES), 0.9);
});

test('block duration does not retime reference motion; speed does', () => {
  for (const effect of EFFECTS) {
    const scene = { ...DEFAULT_SCENES[0], effect: effect.id };
    const normal = context(), longer = context(), slower = context(), held = context(), end = context();
    renderScene(normal, scene, 0.12);
    renderScene(longer, { ...scene, duration: 5 }, 0.12);
    renderScene(slower, { ...scene, speed: 0.5 }, 0.24);
    renderScene(held, { ...scene, duration: 5 }, 3);
    renderScene(end, scene, 0.45);
    assert.deepEqual(normal.operations, longer.operations, effect.id);
    assert.deepEqual(normal.operations, slower.operations, effect.id);
    assert.deepEqual(held.operations, end.operations, effect.id);
  }
});

test('source motion retains measured directions, nonuniform pacing and blank construction frames', () => {
  const five = REFERENCE_TRACKS['5'].samples;
  assert.ok(Math.abs(five[0][1] - five[14][1]) < 0.001);
  assert.ok(five[14][2] - five[0][2] > 0.37);
  assert.ok(five[1][2] - five[0][2] > 10 * (five[14][2] - five[13][2]));
  assert.ok(REFERENCE_TRACKS['6'].samples.every(row => row[4] === 0));
  assert.ok(REFERENCE_TRACKS['3'].samples[13][4] > 0.93);
  assert.equal(sampleReference(REFERENCE_TRACKS['3'].samples, 14), null);
  assert.equal(sampleReference(REFERENCE_BOUNDS['7'], 0), null);
  assert.deepEqual(sampleReference(REFERENCE_BOUNDS['7'], 1), [259, 255, 416, 416]);
  assert.deepEqual(sampleReference(REFERENCE_BOUNDS['7'], 8), [447, 72, 947, 541]);
});

test('deprecated accent and centre colors do not alter any block', () => {
  for (const effect of EFFECTS) {
    const scene = { ...DEFAULT_SCENES[0], effect: effect.id };
    const original = context();
    const legacyColors = context();
    renderScene(original, scene, 0.5);
    renderScene(legacyColors, { ...scene, accent: '#F000FF', centerColor: '#00FF00' }, 0.5);
    assert.deepEqual(original.operations, legacyColors.operations);
  }
});

test('the second-zero variation has a distinct diagonal finish and a visible sweep, with the original turn preserved', () => {
  const pose = (effect, time) => {
    const ctx = context();
    renderScene(ctx, { ...DEFAULT_SCENES[0], digit: '0', effect }, time);
    return {
      angle: ctx.operations.find(([method]) => method === 'rotate')[2],
      position: ctx.operations.filter(([method]) => method === 'translate').at(-1).slice(2),
    };
  };
  const start = pose('spinSweep', 0), end = pose('spinSweep', 0.45);
  assert.ok(start.angle - end.angle > Math.PI * 1.16);
  assert.ok(start.angle - end.angle < Math.PI * 1.34);
  assert.ok(end.position[0] - start.position[0] > 0.4 * 1080);
  assert.ok(start.position[0] < 960 && end.position[0] > 960);
  const source = REFERENCE_TRACKS['8'].samples;
  assert.equal(pose('cluster', 0).angle, source[0][4]);
  assert.equal(pose('cluster', 0.45).angle, source.at(-1)[4]);
});
