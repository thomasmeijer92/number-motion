import coverage from './inter-coverage.json' with { type: 'json' };

export const MAX_CHARACTER_LENGTH = 128;
const subsets = coverage.subsets.map(subset => ({ ...subset, points: new Set(subset.codepoints) }));
let segmenter;

// One actual font file must cover the entire cluster, not merely the union of
// several subsets: otherwise the browser could silently substitute a font.
export function inspectCharacter(value) {
  const text = typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 9 ? String(value) : value;
  const invalid = error => ({ character: null, subset: null, error });
  if (typeof text !== 'string' || !text.length) return invalid('Enter one character.');
  if (text.length > MAX_CHARACTER_LENGTH) return invalid('This character combination is too long.');
  const character = text.normalize('NFC');
  if (/[\p{White_Space}\p{Cc}\p{Cf}\p{Cs}]/u.test(character)) return invalid('Use a visible character without spaces or control characters.');
  if (typeof Intl.Segmenter !== 'function') return invalid('This browser cannot validate combined characters. Use an up-to-date browser.');
  segmenter ||= new Intl.Segmenter('und', { granularity: 'grapheme' });
  if (Array.from(segmenter.segment(character)).length !== 1) return invalid('Use exactly one character per block.');
  if (/^\p{M}/u.test(character)) return invalid('An accent needs a letter.');
  const points = Array.from(character, part => part.codePointAt(0));
  const subset = subsets.find(candidate => points.every(point => candidate.points.has(point)));
  if (!subset) return invalid('This character or combination is not available in Inter Medium.');
  return { character, subset: subset.id, error: '' };
}

export function normalizeCharacter(value) {
  const result = inspectCharacter(value);
  if (result.error) throw new Error(result.error);
  return result.character;
}

export function inspectCharacterDraft(value, composing = false) {
  if (composing) return { character: null, subset: null, error: '', blocked: true, composing: true };
  const result = inspectCharacter(value);
  return { ...result, blocked: Boolean(result.error), composing: false };
}

export function characterSetKey(characters) {
  return JSON.stringify([...new Set(characters.map(normalizeCharacter))].sort());
}

export function nextCharacter(value) {
  const character = normalizeCharacter(value);
  return /^[0-9]$/.test(character) ? String((Number(character) + 1) % 10) : character;
}
