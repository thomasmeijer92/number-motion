export function fakeCanvas({ metrics, blank = false } = {}) {
  const canvas = { width: 300, height: 150 };
  const ctx = {
    canvas,
    measureText(character) {
      return typeof metrics === 'function' ? metrics(character) : metrics || (['-', '—', '_'].includes(character) ? {
        actualBoundingBoxLeft: 0, actualBoundingBoxRight: 144,
        actualBoundingBoxAscent: 10, actualBoundingBoxDescent: 0,
      } : {
        actualBoundingBoxLeft: 0, actualBoundingBoxRight: 48,
        actualBoundingBoxAscent: 72, actualBoundingBoxDescent: 0,
      });
    },
    fillText(character) { canvas.character = character; canvas.font = this.font; },
    drawImage(source, ...args) { canvas.character = source.character; canvas.font = source.font; canvas.source = source; canvas.crop = args; },
    fillRect() { canvas.color = this.fillStyle; },
    getImageData() {
      const data = new Uint8ClampedArray(canvas.width * canvas.height * 4);
      if (!blank) for (let y = 4; y < canvas.height - 4; y += 1) for (let x = 4; x < canvas.width - 4; x += 1) data[(y * canvas.width + x) * 4 + 3] = 255;
      return { data };
    },
  };
  canvas.getContext = () => ctx;
  return canvas;
}

export function installGlyphEnvironment() {
  const documentDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const fontDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'FontFace');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => fakeCanvas(), fonts: { add() {} } } });
  Object.defineProperty(globalThis, 'FontFace', { configurable: true, value: class {
    constructor(family, source, options) { Object.assign(this, { family, source, options }); }
    async load() { return this; }
  } });
  return () => {
    if (documentDescriptor) Object.defineProperty(globalThis, 'document', documentDescriptor); else delete globalThis.document;
    if (fontDescriptor) Object.defineProperty(globalThis, 'FontFace', fontDescriptor); else delete globalThis.FontFace;
  };
}
