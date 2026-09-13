// Frames are sampled from the same time-based renderer as the preview.
// MP4 has explicit microsecond timestamps; the WebM compatibility path records
// in real time because MediaRecorder does not accept frame timestamps.

function abortError() {
  return new DOMException('Export cancelled.', 'AbortError');
}

function checkAbort(signal) {
  if (signal?.aborted) throw abortError();
}

function bounded(promise, signal, timeout = 30_000) {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    const finish = (callback, value) => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      callback(value);
    };
    const abort = () => finish(reject, abortError());
    const timer = setTimeout(() => finish(reject, new Error('Video export is not responding. Try again or choose a lower resolution.')), timeout);
    signal?.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(value => finish(resolve, value), error => finish(reject, error));
  });
}

function pause(milliseconds, signal) {
  checkAbort(signal);
  return new Promise((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(abortError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, Math.max(0, milliseconds));
    signal?.addEventListener('abort', abort, { once: true });
  });
}

function validate({ width, height, fps, duration, format, renderFrame }) {
  if (![width, height].every(value => Number.isInteger(value) && value >= 2 && value <= 4096)) {
    throw new Error('Choose video dimensions between 2 and 4096 pixels per side.');
  }
  if (format === 'mp4' && (width % 2 || height % 2)) {
    throw new Error('MP4 width and height must be even numbers of pixels.');
  }
  if (!Number.isInteger(fps) || fps < 1 || fps > 60) throw new Error('Choose between 1 and 60 frames per second.');
  if (!Number.isFinite(duration) || duration < 0.1 || duration > 300) throw new Error('The video must last between 0.1 and 300 seconds.');
  if (!['mp4', 'webm'].includes(format)) throw new Error('Choose MP4 or WebM as the video format.');
  if (typeof renderFrame !== 'function') throw new TypeError('The function for rendering video frames is missing.');
}

async function findAvcConfig(width, height, fps, signal) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') {
    throw new Error('MP4 export is not available here. Open this tool in an up-to-date Chrome or Edge browser, or choose WebM.');
  }
  const bitrate = Math.min(32_000_000, Math.max(2_000_000, Math.round(width * height * fps * 0.16)));
  // Test actual device support: the presence of WebCodecs alone is insufficient.
  for (const hardwareAcceleration of ['no-preference', 'prefer-software']) {
    for (const codec of ['avc1.640034', 'avc1.4d0034', 'avc1.420034', 'avc1.42002a', 'avc1.42001f']) {
      checkAbort(signal);
      const candidate = {
        codec, width, height, bitrate, framerate: fps, hardwareAcceleration,
        latencyMode: 'quality', avc: { format: 'avc' },
      };
      try {
        const support = await bounded(VideoEncoder.isConfigSupported(candidate), signal);
        if (support.supported) return support.config;
      } catch (error) {
        if (error.name === 'AbortError') throw error;
        // A browser may reject a profile rather than returning supported:false.
      }
    }
  }
  throw new Error('This browser cannot create an MP4 at these dimensions. Choose a lower resolution, an up-to-date Chrome or Edge browser, or WebM.');
}

function draw(ctx, renderFrame, time, width, height) {
  ctx.save();
  try {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, width, height);
    renderFrame(ctx, time, width, height);
  } finally {
    ctx.restore();
  }
}

async function exportMp4(options, canvas, ctx) {
  const { width, height, fps, duration, renderFrame, onProgress, signal } = options;
  const config = await findAvcConfig(width, height, fps, signal);
  const { Muxer, ArrayBufferTarget } = await bounded(import('mp4-muxer'), signal);
  checkAbort(signal);
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width, height },
    fastStart: 'in-memory',
    firstTimestampBehavior: 'strict',
  });
  let failure;
  let outputCount = 0;
  let encoder;
  const close = () => {
    if (encoder && encoder.state !== 'closed') encoder.close();
  };
  encoder = new VideoEncoder({
    output(chunk, metadata) {
      if (failure || signal?.aborted) return;
      try {
        muxer.addVideoChunk(chunk, metadata);
        outputCount += 1;
      } catch (error) {
        failure = error;
        close();
      }
    },
    error(error) { failure = error; },
  });
  signal?.addEventListener('abort', close, { once: true });
  try {
    checkAbort(signal);
    encoder.configure(config);
    // The shortened last frame keeps non-integral frame durations exact.
    const frameCount = Math.ceil(duration * fps - 1e-8);
    const endTimestamp = Math.round(duration * 1_000_000);
    for (let index = 0; index < frameCount; index += 1) {
      checkAbort(signal);
      if (failure) throw failure;
      const timestamp = Math.round(index * 1_000_000 / fps);
      const nextTimestamp = Math.min(endTimestamp, Math.round((index + 1) * 1_000_000 / fps));
      draw(ctx, renderFrame, index / fps, width, height);
      const frame = new VideoFrame(canvas, { timestamp, duration: nextTimestamp - timestamp });
      try {
        encoder.encode(frame, { keyFrame: index % (fps * 2) === 0 });
      } finally {
        frame.close();
      }
      // Bounded batches put a firm cap on GPU/encoder memory and provide an
      // event-loop opportunity for progress rendering and cancellation.
      if ((index + 1) % 8 === 0) {
        await bounded(encoder.flush(), signal);
        if (failure) throw failure;
        onProgress?.(0.98 * (index + 1) / frameCount);
        await pause(0, signal);
      }
    }
    await bounded(encoder.flush(), signal);
    checkAbort(signal);
    if (failure) throw failure;
    if (outputCount !== frameCount) throw new Error('The encoder skipped frames. Try again at a lower resolution.');
    muxer.finalize();
    if (!target.buffer?.byteLength) throw new Error('The MP4 export contains no video data.');
    const blob = new Blob([target.buffer], { type: 'video/mp4' });
    onProgress?.(1);
    return { blob, extension: 'mp4', mimeType: 'video/mp4' };
  } catch (error) {
    checkAbort(signal);
    throw failure || error;
  } finally {
    signal?.removeEventListener('abort', close);
    close();
  }
}

async function exportWebm(options, canvas, ctx) {
  const { width, height, fps, duration, renderFrame, onProgress, signal } = options;
  if (typeof MediaRecorder === 'undefined' || typeof canvas.captureStream !== 'function') {
    throw new Error('This browser does not support WebM export. Use an up-to-date Chrome or Edge browser.');
  }
  const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) throw new Error('This browser has no WebM encoder. Try MP4 or open the tool in Chrome or Edge.');
  const checkVisibility = () => {
    if (document.visibilityState === 'hidden') throw new Error('Keep this tab visible during WebM export. Try again or choose MP4.');
  };
  checkVisibility();
  draw(ctx, renderFrame, 0, width, height);
  const stream = canvas.captureStream(0);
  let recorder;
  let failure;
  const chunks = [];
  const stop = () => {
    if (recorder && recorder.state !== 'inactive') recorder.stop();
  };
  try {
    const track = stream.getVideoTracks()[0];
    if (!track || typeof track.requestFrame !== 'function') {
      throw new Error('This browser cannot record individual WebM frames. Choose MP4 or open the tool in Chrome or Edge.');
    }
    recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: Math.min(24_000_000, Math.max(2_000_000, Math.round(width * height * fps * 0.16))),
    });
    if (!recorder.mimeType.startsWith('video/webm')) throw new Error('The browser did not produce a valid WebM format.');
    const stopped = new Promise((resolve, reject) => {
      recorder.onstop = resolve;
      recorder.onerror = event => {
        failure = event.error || new Error('WebM recording failed.');
        reject(failure);
      };
    });
    // An encoder failure can occur while the render loop awaits its next frame.
    stopped.catch(() => {});
    recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
    const started = new Promise(resolve => { recorder.onstart = resolve; });
    signal?.addEventListener('abort', stop, { once: true });
    recorder.start();
    await bounded(started, signal, 10_000);
    const start = performance.now();
    const frameCount = Math.ceil(duration * fps - 1e-8);
    for (let index = 0; index < frameCount; index += 1) {
      const deadline = start + index * 1000 / fps;
      await pause(deadline - performance.now(), signal);
      checkVisibility();
      if (failure) throw failure;
      if (recorder.state !== 'recording') throw new Error('WebM recording stopped unexpectedly.');
      if (performance.now() - deadline > 250) {
        throw new Error('This WebM export is falling behind. Choose a lower resolution or use MP4 for exact timing.');
      }
      draw(ctx, renderFrame, index / fps, width, height);
      track.requestFrame();
      onProgress?.(0.98 * (index + 1) / frameCount);
    }
    await pause(start + duration * 1000 - performance.now(), signal);
    checkVisibility();
    stop();
    await bounded(stopped, signal, 10_000);
    checkAbort(signal);
    if (failure) throw failure;
    const blob = new Blob(chunks, { type: recorder.mimeType });
    if (!blob.size) throw new Error('The WebM export contains no video data.');
    onProgress?.(1);
    return { blob, extension: 'webm', mimeType: recorder.mimeType };
  } finally {
    signal?.removeEventListener('abort', stop);
    stop();
    for (const track of stream.getTracks()) track.stop();
    if (recorder) {
      recorder.onstart = null;
      recorder.onstop = null;
      recorder.onerror = null;
      recorder.ondataavailable = null;
    }
  }
}

/**
 * Export all frames drawn by renderFrame(ctx, seconds, width, height).
 * onProgress receives a fraction from 0 to 1. MP4 is rendered offline with
 * exact timestamps. Explicit WebM export runs in real time in a visible tab.
 * No download is started here; the caller owns the returned Blob and URL.
 */
export async function exportVideo({ width, height, fps = 30, duration, format = 'mp4', renderFrame, onProgress, signal }) {
  const options = { width, height, fps, duration, format, renderFrame, onProgress, signal };
  validate(options);
  checkAbort(signal);
  onProgress?.(0);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  if (!ctx) throw new Error('A canvas could not be created for video export.');
  try {
    return format === 'mp4' ? await exportMp4(options, canvas, ctx) : await exportWebm(options, canvas, ctx);
  } finally {
    // Release the potentially large backing surface on success, error or abort.
    canvas.width = 1;
    canvas.height = 1;
  }
}
