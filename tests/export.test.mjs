import test from 'node:test';
import assert from 'node:assert/strict';
import { exportVideo } from '../src/export.js';

const options = { width: 640, height: 360, fps: 30, duration: 1, renderFrame() {} };

function globals(t, values) {
  const originals = new Map(Object.keys(values).map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  for (const [key, value] of Object.entries(values)) Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  t.after(() => {
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
}

function browser(t) {
  const canvases = [];
  const frames = [];
  const encoders = [];
  class FakeFrame {
    constructor(canvas, metadata) { Object.assign(this, metadata); frames.push(this); }
    close() { this.closed = true; }
  }
  class FakeEncoder {
    static async isConfigSupported(config) { return { supported: true, config }; }
    constructor() { this.state = 'unconfigured'; encoders.push(this); }
    configure() { this.state = 'configured'; }
    encode() { if (this.state === 'closed') throw new Error('Encoder closed'); }
    async flush() {}
    close() { this.state = 'closed'; }
  }
  globals(t, {
    VideoEncoder: FakeEncoder,
    VideoFrame: FakeFrame,
    document: { createElement() {
      const canvas = { getContext: () => ({ save() {}, restore() {}, setTransform() {}, clearRect() {} }) };
      canvases.push(canvas);
      return canvas;
    } },
  });
  return { canvases, frames, encoders };
}

test('rejects invalid dimensions and unknown formats before allocating browser resources', async () => {
  await assert.rejects(exportVideo({ ...options, width: 641 }), /even/);
  await assert.rejects(exportVideo({ ...options, duration: 0 }), /seconden/);
  await assert.rejects(exportVideo({ ...options, fps: 61 }), /frames/);
  await assert.rejects(exportVideo({ ...options, format: 'mov' }), /MP4 of WebM/);
});

test('an already cancelled export never renders', async () => {
  const controller = new AbortController();
  controller.abort();
  let rendered = false;
  await assert.rejects(exportVideo({ ...options, signal: controller.signal, renderFrame() { rendered = true; } }), { name: 'AbortError' });
  assert.equal(rendered, false);
});

test('unsupported MP4 reports an error without silently switching to WebM', async t => {
  const state = browser(t);
  let recorderCreated = false;
  globals(t, { VideoEncoder: undefined, MediaRecorder: class { constructor() { recorderCreated = true; } } });
  await assert.rejects(exportVideo(options), /MP4-export is hier niet beschikbaar/);
  assert.equal(recorderCreated, false);
  assert.equal(state.canvases[0].width, 1);
  assert.equal(state.canvases[0].height, 1);
});

test('render errors close the encoder and release the canvas', async t => {
  const state = browser(t);
  await assert.rejects(exportVideo({ ...options, renderFrame() { throw new Error('Render failed'); } }), /Render failed/);
  assert.equal(state.encoders[0].state, 'closed');
  assert.equal(state.canvases[0].width, 1);
  assert.equal(state.canvases[0].height, 1);
});

test('cancellation between batches releases every frame and samples exact frame times', async t => {
  const state = browser(t);
  const controller = new AbortController();
  const times = [];
  await assert.rejects(exportVideo({
    ...options, signal: controller.signal,
    renderFrame(ctx, time, width, height) {
      times.push(time);
      assert.equal(width, 640);
      assert.equal(height, 360);
      if (times.length === 10) controller.abort();
    },
  }), { name: 'AbortError' });
  assert.deepEqual(times, Array.from({ length: 10 }, (_, index) => index / 30));
  assert.equal(state.frames.every(frame => frame.closed), true);
  assert.equal(state.encoders[0].state, 'closed');
  assert.equal(state.canvases[0].width, 1);
});

test('an encoder dropping frames fails instead of returning an incomplete MP4', async t => {
  const state = browser(t);
  await assert.rejects(exportVideo({ ...options, duration: 0.35 }), /frames overgeslagen/);
  assert.equal(state.frames.length, 11);
  assert.equal(state.frames.at(-1).timestamp + state.frames.at(-1).duration, 350_000);
  assert.equal(state.frames.every(frame => frame.closed), true);
  assert.equal(state.encoders[0].state, 'closed');
});
