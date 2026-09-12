import { inspectCharacter, normalizeCharacter } from './characters.js';

// Literal URLs let Vite bundle the unmodified font files. Each has its own
// family name, so a loaded face cannot be mistaken for another subset or font.
const fontUrls = {
  latin: new URL('../node_modules/@fontsource/inter/files/inter-latin-500-normal.woff', import.meta.url).href,
  'latin-ext': new URL('../node_modules/@fontsource/inter/files/inter-latin-ext-500-normal.woff', import.meta.url).href,
  greek: new URL('../node_modules/@fontsource/inter/files/inter-greek-500-normal.woff', import.meta.url).href,
  'greek-ext': new URL('../node_modules/@fontsource/inter/files/inter-greek-ext-500-normal.woff', import.meta.url).href,
  cyrillic: new URL('../node_modules/@fontsource/inter/files/inter-cyrillic-500-normal.woff', import.meta.url).href,
  'cyrillic-ext': new URL('../node_modules/@fontsource/inter/files/inter-cyrillic-ext-500-normal.woff', import.meta.url).href,
  vietnamese: new URL('../node_modules/@fontsource/inter/files/inter-vietnamese-500-normal.woff', import.meta.url).href,
};
const digits = Array.from({ length: 10 }, (_, i) => String(i));
const FONT_SIZE = 1024, MASK_HEIGHT = 700, MAX_CANVAS_SIDE = 4096;

function withTimeout(promise, milliseconds) {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error('Inter Medium laden duurt te lang. Probeer opnieuw.')), milliseconds);
  })]).finally(() => clearTimeout(timer));
}

function rasterize(character, family, referenceFamily, createCanvas) {
  const canvas = createCanvas();
  let ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) throw new Error('Deze browser kan geen tekenmasker maken.');
  ctx.font = `500 ${FONT_SIZE}px "${referenceFamily}"`;
  const reference = ctx.measureText('0');
  const referenceHeight = reference.actualBoundingBoxAscent + reference.actualBoundingBoxDescent;
  if (!Number.isFinite(referenceHeight) || referenceHeight <= 0) throw new Error('De Inter-lettergrootte kon niet worden bepaald.');
  const font = `500 ${FONT_SIZE}px "${family}"`;
  ctx.font = font;
  const { actualBoundingBoxLeft: left, actualBoundingBoxRight: right,
    actualBoundingBoxAscent: ascent, actualBoundingBoxDescent: descent } = ctx.measureText(character);
  const width = Math.ceil(left + right) + 8, height = Math.ceil(ascent + descent) + 8;
  if (![left, right, ascent, descent, width, height].every(Number.isFinite)
    || width <= 8 || height <= 8 || width > MAX_CANVAS_SIDE || height > MAX_CANVAS_SIDE) {
    throw new Error('Dit teken heeft geen bruikbare vorm of is te groot om te tekenen.');
  }
  canvas.width = width; canvas.height = height;
  ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.font = font; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#ffffff'; ctx.fillText(character, 4 + left, 4 + ascent);
  const pixels = ctx.getImageData(0, 0, width, height).data;
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    if (pixels[(y * width + x) * 4 + 3]) {
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
    }
  }
  if (x1 <= x0 || y1 <= y0) throw new Error('Dit teken heeft geen zichtbare vorm in Inter Medium.');
  // A dash or underscore can be very wide relative to its ink height. Scale
  // both axes uniformly to fit the cache limit rather than rejecting punctuation.
  const scale = Math.min(MASK_HEIGHT / (y1 - y0), MAX_CANVAS_SIDE / (x1 - x0));
  const mask = createCanvas();
  mask.width = Math.max(1, Math.round((x1 - x0) * scale));
  mask.height = Math.max(1, Math.round((y1 - y0) * scale));
  const target = mask.getContext('2d');
  target.imageSmoothingEnabled = true; target.imageSmoothingQuality = 'high';
  target.drawImage(canvas, x0, y0, x1 - x0, y1 - y0, 0, 0, mask.width, mask.height);
  target.globalCompositeOperation = 'source-in';
  target.fillStyle = '#ffffff'; target.fillRect(0, 0, mask.width, mask.height);
  // Keep numeral/letter sizing intact. Short marks use their natural size at
  // the same Inter font size; a dash must not grow to a full numeral's height.
  mask.characterScale = /^[\p{P}\p{S}]/u.test(character) ? Math.min(1, (y1 - y0) / referenceHeight) : 1;
  return mask;
}

export function createGlyphStore(environment = {}) {
  const createCanvas = environment.createCanvas || (() => document.createElement('canvas'));
  const createFontFace = environment.createFontFace || ((...args) => new FontFace(...args));
  const addFont = environment.addFont || (face => document.fonts.add(face));
  const fonts = new Map(), fontPending = new Map(), glyphs = new Map(), pending = new Map(), tinted = new Map();
  let active = new Set();
  async function loadFont(subset) {
    if (fonts.has(subset)) return fonts.get(subset);
    if (!fontPending.has(subset)) {
      const family = `NumberMotionInter500-${subset}`;
      const operation = Promise.resolve().then(async () => {
        try {
          const face = createFontFace(family, `url("${fontUrls[subset]}")`, { style: 'normal', weight: '500' });
          const loaded = await withTimeout(face.load(), environment.timeout ?? 15_000);
          addFont(loaded); fonts.set(subset, family); return family;
        } catch (error) {
          throw new Error(error?.message?.includes('duurt te lang') ? error.message : 'Inter Medium kon niet worden geladen. Probeer opnieuw.');
        } finally { fontPending.delete(subset); }
      });
      fontPending.set(subset, operation);
    }
    return fontPending.get(subset);
  }
  function prune() {
    for (const character of glyphs.keys()) {
      if (glyphs.size <= 100) break;
      if (active.has(character) || pending.has(character)) continue;
      glyphs.delete(character);
      for (const key of tinted.keys()) if (JSON.parse(key)[0] === character) tinted.delete(key);
    }
  }
  async function loadGlyphs(characters = digits) {
    const required = [...new Set(characters.map(normalizeCharacter))]; active = new Set(required);
    await Promise.all(required.map(character => {
      if (glyphs.has(character)) return undefined;
      if (!pending.has(character)) {
        const operation = Promise.resolve().then(async () => {
          try {
            const [family, referenceFamily] = await Promise.all([loadFont(inspectCharacter(character).subset), loadFont('latin')]);
            glyphs.set(character, rasterize(character, family, referenceFamily, createCanvas));
          } finally { pending.delete(character); }
        });
        pending.set(character, operation);
      }
      return pending.get(character);
    }));
    prune(); return true;
  }
  function hasGlyphs(characters) { return characters.every(character => glyphs.has(character)); }
  function getGlyph(value, color) {
    const character = normalizeCharacter(value), source = glyphs.get(character);
    if (!source) return null;
    const key = JSON.stringify([character, color]);
    if (tinted.has(key)) return tinted.get(key);
    const canvas = createCanvas(); canvas.width = source.width; canvas.height = source.height;
    canvas.characterScale = source.characterScale;
    const ctx = canvas.getContext('2d'); ctx.drawImage(source, 0, 0);
    ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = color; ctx.fillRect(0, 0, canvas.width, canvas.height);
    if (tinted.size >= 100) tinted.delete(tinted.keys().next().value);
    tinted.set(key, canvas); return canvas;
  }
  return { loadGlyphs, hasGlyphs, getGlyph };
}

const store = createGlyphStore();
export const { loadGlyphs, hasGlyphs, getGlyph } = store;
