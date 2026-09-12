import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCharacter, inspectCharacter, inspectCharacterDraft, characterSetKey, nextCharacter } from '../src/characters.js';

test('one NFC grapheme supports letters, numerals, symbols and actual combining coverage', () => {
  for (const text of ['A', '0', 'é', 'Ω', 'Ж', '€', '₿', '↑', 'q\u0301']) assert.equal(normalizeCharacter(text), text);
  assert.equal(normalizeCharacter('e\u0301'), 'é');
  assert.equal(normalizeCharacter('Ω\u0301'), 'Ώ');
  assert.equal(inspectCharacter('q\u0301').subset, 'latin');
  assert.equal(normalizeCharacter(7), '7');
  assert.equal(characterSetKey(['e\u0301', 'A', 'é']), characterSetKey(['A', 'é']));
});

test('empty, pasted multiple characters, invisible content and unsupported fonts are rejected', () => {
  for (const text of ['', 'AB', '1A', ' ', 'A ', '\n', '\u200d', '\u0301', '😀', '漢', '→', 'a\ufe0f', '\ud800', 'a' + '\u0301'.repeat(128)]) {
    assert.throws(() => normalizeCharacter(text), Error, JSON.stringify(text));
  }
  for (const value of [null, {}, 12, -1]) assert.throws(() => normalizeCharacter(value));
});

test('composition and invalid drafts block output, and selecting the stored digit clears the draft', () => {
  assert.equal(inspectCharacterDraft('A', true).blocked, true);
  assert.equal(inspectCharacterDraft('', true).error, '');
  assert.equal(inspectCharacterDraft('AB').blocked, true);
  assert.deepEqual(inspectCharacterDraft('0'), { ...inspectCharacter('0'), blocked: false, composing: false });
  assert.equal(inspectCharacterDraft('e\u0301').character, 'é');
  assert.equal(nextCharacter('9'), '0');
  assert.equal(nextCharacter('A'), 'A');
});
