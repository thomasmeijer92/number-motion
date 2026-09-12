import test from 'node:test';
import assert from 'node:assert/strict';
import { freshProject, loadProject, loadProjectState, STORAGE_KEY, validateProject, videoDimensions } from '../src/project.js';

function storedProject(raw) {
  let value = raw;
  const writes = [];
  const storage = {
    getItem(key) { assert.equal(key, STORAGE_KEY); return value; },
    setItem(key, next) { writes.push(['setItem', key, next]); value = next; },
    removeItem(key) { writes.push(['removeItem', key]); value = null; },
    clear() { writes.push(['clear']); value = null; },
  };
  return {
    storage,
    assertUnchanged() { assert.deepEqual(writes, []); assert.equal(value, raw); },
  };
}

test('JSON round-trip preserves all editable scene settings and replaces imported IDs', () => {
  const project = freshProject();
  project.name = 'Mijn aangepaste reel';
  project.ratio = '9:16';
  Object.assign(project.scenes[0], {
    digit: '0', effect: 'rings', bg: '#123456', fg: '#abcdef',
    accent: '#fedcba', centerColor: '#654321', duration: 2.35,
    speed: 0.75, scale: 1.25,
  });
  const imported = validateProject(JSON.parse(JSON.stringify(project)));
  assert.equal(imported.name, project.name);
  assert.equal(imported.ratio, project.ratio);
  const { id: previousId, ...previousSettings } = project.scenes[0];
  const { id: importedId, ...importedSettings } = imported.scenes[0];
  assert.deepEqual(importedSettings, previousSettings);
  assert.notEqual(importedId, previousId);
  assert.equal(new Set(imported.scenes.map(scene => scene.id)).size, imported.scenes.length);
});

test('invalid imported projects are rejected before settings reach the renderer', () => {
  const project = freshProject();
  for (const scenes of [[], Array.from({ length: 61 }, () => project.scenes[0])]) {
    assert.throws(() => validateProject({ ...project, scenes }));
  }
  for (const patch of [
    { digit: '12' }, { effect: 'unknown' }, { bg: '#fff' },
    { duration: 0 }, { duration: 10.01 }, { speed: Infinity }, { scale: null },
  ]) {
    assert.throws(() => validateProject({ ...project, scenes: [{ ...project.scenes[0], ...patch }] }));
  }
});

test('HD video dimensions are even and match the labelled output formats', () => {
  assert.deepEqual(videoDimensions('16:9', 1080), { width: 1920, height: 1080 });
  assert.deepEqual(videoDimensions('9:16', 1080), { width: 1080, height: 1920 });
  assert.deepEqual(videoDimensions('1:1', 1080), { width: 1080, height: 1080 });
  assert.deepEqual(videoDimensions('16:9', 720), { width: 1280, height: 720 });
});

test('loading a valid saved project preserves its settings without touching storage', () => {
  const project = freshProject();
  project.name = 'Mijn opgeslagen 2000';
  project.ratio = '1:1';
  project.scenes[0].duration = 3.25;
  const raw = `  ${JSON.stringify(project, null, 2)}\n`;
  const saved = storedProject(raw);
  const result = loadProjectState(saved.storage);
  assert.equal(result.recoveryRaw, null);
  assert.equal(result.storageError, null);
  assert.equal(result.project.name, project.name);
  assert.equal(result.project.ratio, project.ratio);
  assert.deepEqual(result.project.scenes.map(({ id, ...settings }) => settings), project.scenes.map(({ id, ...settings }) => settings));
  saved.assertUnchanged();
});

test('missing storage creates an unsaved default project without a recovery warning', () => {
  const saved = storedProject(null);
  const result = loadProjectState(saved.storage);
  assert.equal(result.project.version, 1);
  assert.equal(result.project.name, 'Mijn motion reel');
  assert.equal(result.recoveryRaw, null);
  assert.equal(result.storageError, null);
  saved.assertUnchanged();
});

test('invalid JSON, including empty stored text, remains byte-for-byte recoverable', () => {
  for (const raw of ['\n  {"name":"onaf werk",\n', '']) {
    const saved = storedProject(raw);
    const result = loadProjectState(saved.storage);
    assert.equal(result.project.name, 'Mijn motion reel');
    assert.equal(result.recoveryRaw, raw);
    assert.notEqual(result.recoveryRaw, null);
    assert.equal(result.storageError, null);
    saved.assertUnchanged();
  }
});

test('a project from a newer version is retained instead of replaced during load', () => {
  const raw = JSON.stringify({ ...freshProject(), version: 2, futureField: { editable: 'bewaren' } }, null, 4);
  const saved = storedProject(raw);
  const result = loadProjectState(saved.storage);
  assert.equal(result.project.version, 1);
  assert.equal(result.recoveryRaw, raw);
  assert.equal(result.storageError, null);
  saved.assertUnchanged();
});

test('valid JSON with invalid scene settings is also retained for recovery', () => {
  const project = freshProject();
  project.scenes[0].effect = 'future-animation';
  const raw = JSON.stringify(project);
  const saved = storedProject(raw);
  const result = loadProjectState(saved.storage);
  assert.equal(result.recoveryRaw, raw);
  assert.equal(result.storageError, null);
  saved.assertUnchanged();
});

test('a failing storage read returns a storage error without any write', () => {
  const saved = storedProject('still stored');
  saved.storage.getItem = () => { throw new Error('Opslag geblokkeerd'); };
  const result = loadProjectState(saved.storage);
  assert.equal(result.project.version, 1);
  assert.equal(result.recoveryRaw, null);
  assert.equal(result.storageError, 'Opslag geblokkeerd');
  saved.assertUnchanged();
});

test('the localStorage property getter is resolved inside the guarded read', t => {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  t.after(() => {
    if (descriptor) Object.defineProperty(globalThis, 'localStorage', descriptor);
    else delete globalThis.localStorage;
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() { throw new Error('Geen toegang tot lokale opslag'); },
  });
  const result = loadProjectState();
  assert.equal(result.project.version, 1);
  assert.equal(result.recoveryRaw, null);
  assert.equal(result.storageError, 'Geen toegang tot lokale opslag');
});

test('the compatibility loader returns the project and remains read-only', () => {
  const project = freshProject();
  project.name = 'Compatibel project';
  const saved = storedProject(JSON.stringify(project));
  assert.equal(loadProject(saved.storage).name, project.name);
  saved.assertUnchanged();
});
