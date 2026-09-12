import { DEFAULT_SCENES, EFFECTS } from './renderer.js';
import { normalizeCharacter } from './characters.js';

export const STORAGE_KEY = 'number-motion-project-v1';
export const uid = () => crypto.randomUUID();
export const freshProject = () => ({ version: 1, name: 'Mijn motion reel', ratio: '16:9', scenes: DEFAULT_SCENES.map(scene => ({ ...scene, id: uid() })) });
const color = value => typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value);
const number = (value, min, max) => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;

export function validateProject(value) {
  if (!value || value.version !== 1 || !['16:9', '1:1', '9:16'].includes(value.ratio) || !Array.isArray(value.scenes) || value.scenes.length < 1 || value.scenes.length > 60) throw new Error('Kies een Number Motion-project met 1–60 blokken.');
  const scenes = value.scenes.map(scene => {
    if (!scene || !EFFECTS.some(effect => effect.id === scene.effect) || !color(scene.bg) || !color(scene.fg) || !number(scene.duration, 0.2, 10) || !number(scene.speed, 0.25, 3) || !number(scene.scale, 0.5, 1.5)) throw new Error('Dit project bevat ongeldige blokinstellingen.');
    return { id: uid(), digit: normalizeCharacter(scene.digit), effect: scene.effect, bg: scene.bg, fg: scene.fg, ...(color(scene.accent) ? { accent: scene.accent } : {}), ...(color(scene.centerColor) ? { centerColor: scene.centerColor } : {}), duration: scene.duration, speed: scene.speed, scale: scene.scale };
  });
  return { version: 1, name: String(value.name || 'Mijn motion reel').slice(0, 60), ratio: value.ratio, scenes };
}

export function loadProjectState(storage) {
  let raw;
  try {
    // Resolve the browser property here: access to localStorage itself may
    // throw, before getItem can run (for example when storage is blocked).
    const source = storage === undefined ? globalThis.localStorage : storage;
    if (!source || typeof source.getItem !== 'function') throw new Error('Lokale opslag is niet beschikbaar.');
    raw = source.getItem(STORAGE_KEY);
    if (raw !== null && typeof raw !== 'string') throw new Error('Lokale opslag gaf een ongeldige waarde terug.');
  } catch (error) {
    return {
      project: freshProject(), recoveryRaw: null,
      storageError: error instanceof Error && error.message ? error.message : 'Het opgeslagen project kon niet worden gelezen.',
    };
  }

  if (raw === null) return { project: freshProject(), recoveryRaw: null, storageError: null };
  try {
    return { project: validateProject(JSON.parse(raw)), recoveryRaw: null, storageError: null };
  } catch {
    // The caller must suspend autosave while recoveryRaw !== null. Preserve
    // every byte, including an empty string or an unsupported newer version.
    return { project: freshProject(), recoveryRaw: raw, storageError: null };
  }
}

export function loadProject(storage) {
  return loadProjectState(storage).project;
}

export function dimensions(ratio, quality = 1080) {
  if (ratio === '1:1') return { width: quality, height: quality };
  const short = Math.round(quality * 9 / 16 / 2) * 2;
  return ratio === '9:16' ? { width: short, height: quality } : { width: quality, height: short };
}

export function videoDimensions(ratio, quality = 1080) {
  if (ratio === '1:1') return { width: quality, height: quality };
  const long = Math.round(quality * 16 / 9 / 2) * 2;
  return ratio === '9:16' ? { width: quality, height: long } : { width: long, height: quality };
}
