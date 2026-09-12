// Openly licensed numeral silhouettes are decoded once and tinted in isolated
// canvases. An ignored reference pack can be used in local development only.
const glyphs = new Map();
const tinted = new Map();
let pending;
export function loadGlyphs() {
  if (!pending) {
    const required = Array.from({ length: 10 }, (_, i) => String(i));
    pending = Promise.all(required.map(digit => glyphs.has(digit) ? true : new Promise(resolve => {
      const img = new Image();
      img.onload = () => { glyphs.set(digit, img); resolve(true); };
      img.onerror = () => resolve(false);
      const directory = import.meta.env?.DEV && import.meta.env?.VITE_USE_LOCAL_REFERENCE === 'true'
        ? 'local-reference/glyphs' : 'glyphs';
      img.src = `${import.meta.env?.BASE_URL || '/'}${directory}/${digit}.png`;
    }))).then(results => {
      const missing = required.filter((_, index) => !results[index]);
      if (missing.length) throw new Error(`Cijfers ${missing.join(', ')} konden niet worden geladen. Probeer opnieuw.`);
      return true;
    }).catch(error => { pending = null; throw error; });
  }
  return pending;
}
export function getGlyph(digit, color) {
  const source = glyphs.get(String(digit));
  if (!source) return null;
  const key = `${digit}:${color}`;
  if (tinted.has(key)) return tinted.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = source.naturalWidth; canvas.height = source.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0);
  ctx.globalCompositeOperation = 'source-in';
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (tinted.size >= 100) tinted.delete(tinted.keys().next().value);
  tinted.set(key, canvas);
  return canvas;
}
