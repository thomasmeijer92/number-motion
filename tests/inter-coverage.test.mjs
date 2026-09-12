import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const fontPackage = new URL('node_modules/@fontsource/inter/', root);
const manifest = JSON.parse(await readFile(new URL('src/inter-coverage.json', root), 'utf8'));
const expectedSubsets = ['latin', 'latin-ext', 'greek', 'greek-ext', 'cyrillic', 'cyrillic-ext', 'vietnamese'];
const sha256 = async url => createHash('sha256').update(await readFile(url)).digest('hex');

test('Inter coverage records the exact installed font, license and generator sources', async () => {
  const metadata = JSON.parse(await readFile(new URL('package.json', fontPackage), 'utf8'));
  assert.equal(manifest.family, 'Inter');
  assert.equal(manifest.weight, 500);
  assert.equal(manifest.package, '@fontsource/inter');
  assert.equal(manifest.package, metadata.name);
  assert.equal(manifest.packageVersion, '5.3.0');
  assert.equal(manifest.packageVersion, metadata.version);
  assert.equal(manifest.license.file, 'LICENSE');
  assert.equal(manifest.license.sha256, await sha256(new URL('LICENSE', fontPackage)));
  assert.equal(manifest.generator.file, 'scripts/generate-inter-coverage.py');
  assert.equal(manifest.generator.sha256, await sha256(new URL(manifest.generator.file, root)));
  assert.deepEqual(manifest.subsets.map(subset => subset.id), expectedSubsets);
  for (const subset of manifest.subsets) {
    assert.equal(subset.file, `inter-${subset.id}-500-normal.woff`);
    assert.equal(subset.sha256, await sha256(new URL(`files/${subset.file}`, fontPackage)), subset.id);
  }
});

test('Inter coverage has sorted unique Unicode scalar values for all seven subsets', () => {
  for (const subset of manifest.subsets) {
    assert.ok(subset.codepoints.length > 0, subset.id);
    assert.deepEqual(subset.codepoints, [...new Set(subset.codepoints)].sort((a, b) => a - b), subset.id);
    for (const codepoint of subset.codepoints) {
      assert.ok(Number.isInteger(codepoint) && codepoint >= 0 && codepoint <= 0x10ffff
        && !(codepoint >= 0xd800 && codepoint <= 0xdfff), `${subset.id}: ${codepoint}`);
    }
    assert.ok(!subset.codepoints.includes(0xffff), `${subset.id}: sentinel must not map to .notdef`);
  }
});

test('Inter supports accented text in a single font subset without promising absent scripts or emoji', () => {
  const supportsTogether = text => manifest.subsets.some(subset => [...text]
    .every(character => subset.codepoints.includes(character.codePointAt(0))));
  assert.ok(supportsTogether('q\u0301'), 'q and combining acute must be available in one subset');
  for (const character of ['0', '9', 'A', 'é', 'Ω', 'Ж', '€', '₿', '↑', '↓']) {
    assert.ok(supportsTogether(character), `Expected font glyph for ${character}`);
  }
  for (const character of ['😀', '🚀', '漢', '中', '→', '↗', '♥']) {
    assert.ok(!supportsTogether(character), `Unexpected font coverage for ${character}`);
  }
});
