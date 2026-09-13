// The construction begins as a solid bar. During its short unfolding, blend
// signed distances instead of overlapping a translucent bar and character.
// Work only on the cropped construction, at bounded source resolution; never
// read the preview/export canvas. Repeated export frames reuse the small cache.
export function signedDistance(ink, width, height) {
  const inside = new Int16Array(ink.length), outside = new Int16Array(ink.length);
  const far = width + height + 1;
  for (let i = 0; i < ink.length; i += 1) {
    inside[i] = ink[i] ? far : 0;
    outside[i] = ink[i] ? 0 : far;
  }
  for (const field of [inside, outside]) {
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      if (x) field[i] = Math.min(field[i], field[i - 1] + 1);
      if (y) field[i] = Math.min(field[i], field[i - width] + 1);
    }
    for (let y = height - 1; y >= 0; y -= 1) for (let x = width - 1; x >= 0; x -= 1) {
      const i = y * width + x;
      if (x + 1 < width) field[i] = Math.min(field[i], field[i + 1] + 1);
      if (y + 1 < height) field[i] = Math.min(field[i], field[i + width] + 1);
    }
  }
  for (let i = 0; i < ink.length; i += 1) inside[i] -= outside[i];
  return inside;
}

export function constructionGeometry(mask, bounds) {
  const [left, top, right, bottom] = bounds;
  const scale = mask.characterScale;
  const fullHeight = Math.max(bottom - top, (right - left) / (475 / 665));
  return {
    x: (left + right) / 2, top,
    barWidth: (right - left) * scale,
    visibleHeight: (bottom - top) * scale,
    height: fullHeight * scale,
    width: fullHeight * scale * mask.width / mask.height,
    barHeight: Math.min(bottom - top, fullHeight * 0.13) * scale,
  };
}

export function createConstructionCache(createCanvas = () => document.createElement('canvas')) {
  const entries = [];
  return function constructionMask(mask, color, bounds, frame) {
    const key = JSON.stringify([color, bounds, frame]);
    const hit = entries.findIndex(entry => entry.mask === mask && entry.key === key);
    if (hit !== -1) {
      const [entry] = entries.splice(hit, 1); entries.push(entry); return entry.result;
    }
    const g = constructionGeometry(mask, bounds);
    const span = Math.max(g.width, g.barWidth);
    const resolution = Math.min(0.5, 508 / Math.max(span, g.visibleHeight));
    const width = Math.ceil(span * resolution) + 4;
    const height = Math.ceil(g.visibleHeight * resolution) + 4;
    const left = g.x - span / 2 - 2 / resolution, top = g.top - 2 / resolution;
    const canvas = createCanvas(); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    const crop = Math.min(1, g.visibleHeight / g.height);
    ctx.drawImage(mask, 0, 0, mask.width, mask.height * crop,
      (g.x - g.width / 2 - left) * resolution, 2, g.width * resolution, g.visibleHeight * resolution);
    const pixels = ctx.getImageData(0, 0, width, height);
    const ink = new Uint8Array(width * height), bar = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
      const i = y * width + x;
      ink[i] = pixels.data[i * 4 + 3] > 127 ? 1 : 0;
      const sourceX = left + (x + 0.5) / resolution, sourceY = top + (y + 0.5) / resolution;
      bar[i] = sourceX >= g.x - g.barWidth / 2 && sourceX < g.x + g.barWidth / 2
        && sourceY >= g.top && sourceY < g.top + g.barHeight ? 1 : 0;
    }
    const a = signedDistance(bar, width, height), b = signedDistance(ink, width, height);
    const mix = Math.max(0, Math.min(1, (frame - 6) / 2));
    for (let i = 0; i < ink.length; i += 1) {
      const alpha = Math.max(0, Math.min(1, a[i] * (1 - mix) + b[i] * mix + 0.5));
      pixels.data[i * 4] = 255; pixels.data[i * 4 + 1] = 255; pixels.data[i * 4 + 2] = 255;
      pixels.data[i * 4 + 3] = Math.round(alpha * 255);
    }
    ctx.putImageData(pixels, 0, 0);
    ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = color; ctx.fillRect(0, 0, width, height);
    const result = { canvas, left, top, width: width / resolution, height: height / resolution };
    if (entries.length >= 16) entries.shift();
    entries.push({ mask, key, result });
    return result;
  };
}

export const getConstructionMask = createConstructionCache();
