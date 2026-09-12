import { getGlyph } from './glyphs.js';
import { REFERENCE_BOUNDS, REFERENCE_TRACKS } from './reference-frames.js';

export const SOURCE_DURATION = { single: 0.45, duo: 0.45, orbit: 0.45, quad: 0.45, pattern: 0.45, scatter: 0.45, reveal: 0.45, cluster: 0.45, spinSweep: 0.45, splitFour: 0.45, scroll: 0.45, rings: 0.42 };

// All animation is derived from the supplied time, so scrubbing and exported
// frames use precisely the same drawing code as the live preview.
export const EFFECTS = [
  { id: 'single', label: 'Stretch', description: 'De gemeten stretch en settling van de originele 1.' },
  { id: 'duo', label: 'Draaien en afremmen', description: 'De draaiende inzet van één originele 2.' },
  { id: 'orbit', label: 'Zoom-explosie', description: 'De versnellende zoom en draaiing van één originele 3.' },
  { id: 'quad', label: 'Groeien en verplaatsen', description: 'Eén cijfer volgt de groeiende draaibeweging van de originele 4.' },
  { id: 'pattern', label: 'Verticaal schuiven', description: 'Eén cijfer schuift mee met het oorspronkelijke 5-patroon.' },
  { id: 'scatter', label: 'Boogbeweging', description: 'De doorgaande cirkelbeweging van één originele 6.' },
  { id: 'reveal', label: 'Opbouwen', description: 'De bovenstrook groeit en onthult het cijfer zoals de originele 7.' },
  { id: 'cluster', label: 'Versnellend draaien', description: 'Eén cijfer draait naar buiten zoals in de originele 8-groep.' },
  { id: 'spinSweep', label: 'Draaien en schuiven', description: 'Een versterkte variant: een ruime draai met een brede verplaatsing van links naar rechts.' },
  { id: 'splitFour', label: 'In vieren delen', description: 'Vier stukken van één cijfer schuiven uiteen en komen weer samen.' },
  { id: 'scroll', label: 'Uitzoomen', description: 'De uitzoom en verschuiving uit het originele 9-patroon.' },
  { id: 'rings', label: 'Groeien', description: 'De snelle groei van de centrale 0 in het origineel.' },
];

export const PALETTES = [
  { name: 'Zonnegeel', bg: '#FFBB00', fg: '#2A1200', accent: '#009D8B' },
  { name: 'Kobaltblauw', bg: '#144CFD', fg: '#CDD5D5', accent: '#FFBB00' },
  { name: 'Signaalrood', bg: '#FF2624', fg: '#2A1200', accent: '#CDD5D5' },
  { name: 'Lagune', bg: '#009D8B', fg: '#2A1200', accent: '#FFBB00' },
  { name: 'Mist', bg: '#CDD5D5', fg: '#2A1200', accent: '#144CFD' },
  { name: 'Nacht', bg: '#320E00', fg: '#009D8B', accent: '#FFBB00' },
];

const DEFAULTS = [['1', 'single', 0], ['2', 'duo', 2]];

export const DEFAULT_SCENES = DEFAULTS.map(([digit, effect, palette], index) => ({
  id: `scene-${index + 1}`, digit, effect,
  bg: PALETTES[palette].bg, fg: PALETTES[palette].fg,
  duration: 0.45, speed: 1, scale: 1,
}));

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
const durationOf = scene => Math.max(0.05, finite(scene?.duration, 1.5));

export function getTotalDuration(scenes = []) {
  return scenes.reduce((total, scene) => total + durationOf(scene), 0);
}

export function getLoopTime(time, duration) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const local = Math.max(0, finite(time, 0)) % duration;
  return local < 1e-9 || duration - local < 1e-9 ? 0 : local;
}

export function getSceneAtTime(scenes = [], time = 0) {
  if (!scenes.length) return { scene: null, index: -1, localTime: 0, start: 0 };
  const total = getTotalDuration(scenes);
  const boundedTime = clamp(finite(time, 0), 0, total);
  let start = 0;
  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index];
    const duration = durationOf(scene);
    // A cut belongs to the incoming scene. The project end stays on its final
    // frame instead of silently wrapping back to scene one.
    if (boundedTime < start + duration - 1e-9 || index === scenes.length - 1) {
      return { scene, index, localTime: clamp(boundedTime - start, 0, duration), start };
    }
    start += duration;
  }
}

function glyph(ctx, digit, x, y, height, color, angle = 0, stretchX = 1, stretchY = 1) {
  if (height <= 0.1) return;
  const mask = getGlyph(digit, color);
  if (mask) {
    const width = height * mask.width / mask.height;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.scale(stretchX, stretchY);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(mask, -width / 2, -height / 2, width, height);
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.font = '500 100px "Inter", Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const metrics = ctx.measureText(digit);
  const ascent = metrics.actualBoundingBoxAscent || 72;
  const descent = metrics.actualBoundingBoxDescent || 0;
  const left = metrics.actualBoundingBoxLeft || 0;
  const right = metrics.actualBoundingBoxRight || metrics.width;
  const fit = height / (ascent + descent);
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Match the masks: use natural Inter proportions and centre by painted bounds.
  ctx.scale(fit * stretchX, fit * stretchY);
  ctx.fillStyle = color;
  ctx.fillText(digit, (left - right) / 2, (ascent - descent) / 2);
  ctx.restore();
}

// One consistent numeral is tracked through each source sequence. Its entire
// trajectory is translated once into this isolated block, retaining the measured
// movement, scale and orientation. The source's cropping/blank exit is preserved.
// Source frames use 30 ms exposures. Interpolate measured values between them,
// preserving non-monotonic overshoot rather than imposing an easing formula.
export function sampleReference(rows, frame) {
  const bounded = clamp(frame, 0, rows.length - 1);
  const nearest = Math.round(bounded);
  const at = Math.abs(bounded - nearest) < 1e-9 ? nearest : bounded;
  const index = Math.floor(at);
  if (!rows[index]) return null;
  const next = rows[Math.min(index + 1, rows.length - 1)] || rows[index];
  return rows[index].map((value, i) => value + (next[i] - value) * (at - index));
}

function sourceUnit(w, h) { return Math.min(w, h) / 788; }

function renderBounds(ctx, s, p, w, h, digit, sourceRatio) {
  const bounds = sampleReference(REFERENCE_BOUNDS[digit], p * (digit === '0' ? 14 : 15));
  const [left, top, right, bottom] = bounds;
  const unit = sourceUnit(w, h);
  const height = bottom - top;
  glyph(ctx, s.digit, w / 2 + ((left + right) / 2 - 700) * unit,
    h / 2 + ((top + bottom) / 2 - 394) * unit,
    height * unit, s.fg, 0, (right - left) / height / sourceRatio);
}

function renderSingle(ctx, s, p, t, w, h) {
  renderBounds(ctx, s, p, w, h, '1', 383 / 654);
}

function renderTracked(ctx, s, p, w, h, digit) {
  const rows = REFERENCE_TRACKS[digit].samples;
  const pose = sampleReference(rows, p * 15);
  ctx.save();
  if (!pose) {
    ctx.beginPath(); ctx.rect(0, 0, 0, 0); ctx.clip();
  }
  const [, dx, dy, height, angle] = pose || rows.findLast(Boolean);
  const unit = Math.min(w, h);
  glyph(ctx, s.digit, w / 2 + dx * unit, h / 2 + dy * unit,
    height * unit, s.fg, angle);
  ctx.restore();
}

function renderReveal(ctx, s, p, t, w, h) {
  const frame = p * 15;
  const bounds = sampleReference(REFERENCE_BOUNDS['7'], frame);
  const unit = sourceUnit(w, h);
  ctx.save();
  ctx.beginPath();
  if (!bounds) {
    // The source starts blank. Still paint a single clipped numeral, no extra
    // rectangle or replacement glyph when the construction starts.
    ctx.rect(0, 0, 0, 0);
    ctx.clip();
    glyph(ctx, s.digit, w / 2, h / 2, 660 * unit, s.fg);
  } else {
    const [left, top, right, bottom] = bounds;
    const sourceRatio = 475 / 665;
    const fullHeight = frame <= 6 ? (bottom - top) / 0.13
      : Math.max(bottom - top, (right - left) / sourceRatio);
    const x = w / 2 + ((left + right) / 2 - 700) * unit;
    const y = h / 2 + (top - 394) * unit;
    ctx.rect(-w, y, w * 3, (bottom - top) * unit);
    ctx.clip();
    glyph(ctx, s.digit, x, y + fullHeight * unit / 2, fullHeight * unit,
      s.fg, 0, (right - left) / fullHeight / sourceRatio);
  }
  ctx.restore();
}

// An explicit creative variation for the second zero in Test 2000. Retain the
// source 8's acceleration and growth; amplify its turn and sweep across the block.
// Keep the original cluster preset unchanged for reference-faithful projects.
function renderSpinSweep(ctx, s, p, t, w, h) {
  const rows = REFERENCE_TRACKS['8'].samples;
  const [, dx, dy, height, angle] = sampleReference(rows, p * 15);
  const startAngle = rows[0][4];
  const turn = clamp((angle - startAngle) / (rows.at(-1)[4] - startAngle), 0, 1);
  const unit = Math.min(w, h);
  glyph(ctx, s.digit,
    w / 2 + (-0.22 + 0.44 * turn + dx) * unit,
    h / 2 + (dy - 0.09 * Math.sin(Math.PI * turn)) * unit,
    height * unit * 1.35, s.fg, startAngle - turn * Math.PI * 1.25);
}

function renderRings(ctx, s, p, t, w, h) {
  renderBounds(ctx, s, p, w, h, '0', 302 / 376);
}

function renderSplitFour(ctx, s, p, t, w, h) {
  const unit = Math.min(w, h);
  const height = unit * 0.5;
  const easeOut = value => 1 - (1 - value) ** 3;
  // Open quickly, hold the four pieces briefly, then close before the last
  // exported frame. These are four disjoint crops of one source numeral.
  const separation = p < 0.32 ? easeOut(clamp(p / 0.32, 0, 1))
    : p < 0.54 ? 1 : 1 - easeOut(clamp((p - 0.54) / 0.34, 0, 1));
  const gap = separation * unit * 0.08;
  if (gap < 1e-7) {
    glyph(ctx, s.digit, w / 2, h / 2, height, s.fg);
    return;
  }
  const mask = getGlyph(s.digit, s.fg);
  ctx.font = '500 100px "Inter", Arial, sans-serif';
  const metrics = ctx.measureText(s.digit);
  const fallbackRatio = ((metrics.actualBoundingBoxLeft || 0)
    + (metrics.actualBoundingBoxRight || metrics.width))
    / ((metrics.actualBoundingBoxAscent || 72) + (metrics.actualBoundingBoxDescent || 0));
  const width = height * (mask ? mask.width / mask.height : fallbackRatio);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  for (const [column, row] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
    const cx = w / 2 + (column * 2 - 1) * gap;
    const cy = h / 2 + (row * 2 - 1) * gap;
    const x = cx + (column - 1) * width / 2;
    const y = cy + (row - 1) * height / 2;
    if (mask) {
      ctx.drawImage(mask, column * mask.width / 2, row * mask.height / 2,
        mask.width / 2, mask.height / 2, x, y, width / 2, height / 2);
    } else {
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, width / 2, height / 2); ctx.clip();
      glyph(ctx, s.digit, cx, cy, height, s.fg);
      ctx.restore();
    }
  }
}

const renderers = {
  single: renderSingle,
  ...Object.fromEntries([['duo', '2'], ['orbit', '3'], ['quad', '4'], ['pattern', '5'],
    ['scatter', '6'], ['cluster', '8'], ['scroll', '9']].map(([effect, digit]) =>
    [effect, (ctx, s, p, t, w, h) => renderTracked(ctx, s, p, w, h, digit)])),
  reveal: renderReveal, rings: renderRings, spinSweep: renderSpinSweep, splitFour: renderSplitFour,
};

export function renderScene(ctx, scene, localTime = 0, width = ctx.canvas.width, height = ctx.canvas.height) {
  if (!ctx || width <= 0 || height <= 0) return;
  const s = {
    ...scene,
    digit: /^[0-9]$/.test(String(scene?.digit)) ? String(scene.digit) : '0',
    bg: scene?.bg || '#FFBB00', fg: scene?.fg || '#2A1200',
  };
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = s.bg;
  ctx.fillRect(0, 0, width, height);
  const speed = clamp(finite(scene?.speed, 1), 0.1, 5);
  const scale = clamp(finite(scene?.scale, 1), 0.2, 3);
  // Block length controls the cut. Speed controls the reference motion itself;
  // extending a block holds its end frame rather than silently slowing it down.
  const motionTime = Math.max(0, finite(localTime, 0)) / (SOURCE_DURATION[s.effect] || 0.45) * speed;
  const progress = clamp(motionTime, 0, 1);
  ctx.translate(width / 2, height / 2);
  ctx.scale(scale, scale);
  ctx.translate(-width / 2, -height / 2);
  (renderers[s.effect] || renderSingle)(ctx, s, progress, motionTime, width, height);
  ctx.restore();
}

export function renderProject(ctx, scenes, time, width = ctx.canvas.width, height = ctx.canvas.height) {
  const current = getSceneAtTime(scenes, time);
  if (current.scene) {
    renderScene(ctx, current.scene, current.localTime, width, height);
  } else {
    ctx.save();
    ctx.fillStyle = '#171717';
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
  return current;
}
