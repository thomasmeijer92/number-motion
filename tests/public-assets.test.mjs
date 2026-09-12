import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const glyphs = new URL('../public/glyphs/', import.meta.url);
const hash = async name => createHash('sha256').update(await readFile(new URL(name, glyphs))).digest('hex');

test('public numeral assets match the licensed font, generator and all ten recorded glyph hashes', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', glyphs)));
  assert.equal(manifest.input.package, '@fontsource/inter');
  assert.equal(manifest.input.family, 'Inter');
  assert.equal(manifest.input.weight, 500);
  assert.equal(manifest.license.identifier, 'OFL-1.1');
  assert.deepEqual(await readFile(new URL(manifest.input.file, glyphs)),
    await readFile(new URL(`../node_modules/@fontsource/inter/files/${manifest.input.file}`, import.meta.url)));
  assert.deepEqual(await readFile(new URL(manifest.license.file, glyphs)),
    await readFile(new URL('../node_modules/@fontsource/inter/LICENSE', import.meta.url)));
  assert.equal(manifest.generation.referenceArtworkUsed, false);
  assert.equal(await hash(manifest.input.file), manifest.input.sha256);
  assert.equal(await hash(manifest.license.file), manifest.license.sha256);
  assert.equal(await hash(manifest.generation.script), manifest.generation.scriptSha256);
  assert.deepEqual(Object.keys(manifest.glyphs), Array.from({ length: 10 }, (_, i) => String(i)));
  for (const glyph of Object.values(manifest.glyphs)) assert.equal(await hash(glyph.file), glyph.sha256);
});

test('public production output excludes local reference media and includes dependency notices', async () => {
  const files = await readdir(new URL('../dist/client/', import.meta.url));
  assert.ok(!files.includes('local-reference'));
  assert.ok(!files.includes('reference-glyphs'));
  assert.ok(!files.includes('reference.gif'));
  const notices = await readdir(new URL('../dist/client/licenses/', import.meta.url));
  for (const expected of ['react.txt', 'react-dom.txt', 'scheduler.txt', 'phosphor-react.txt', 'mp4-muxer.txt', 'dm-sans.txt', 'inter.txt']) {
    assert.ok(notices.includes(expected), `Missing license: ${expected}`);
  }
});
