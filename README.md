# Number Motion

A browser-based editor for animated character sequences. Each block contains one Unicode grapheme (a letter, numeral or symbol) with its own motion, colors and timing; video export joins the blocks in order. The interface is currently in Dutch.

## Run locally

Use Node.js 22 (minimum 20.19).

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The editor works entirely in the browser. It does not upload projects or videos and does not require an account.

## Create a video

1. Enter one character and choose its animation, background and character color. The quick buttons still select digits 0–9.
2. Play or scrub a block independently. Adjust its duration, speed and size.
3. Add, duplicate or reorder blocks.
4. Choose **Exporteer montage → Maak MP4 → Download MP4**.

Twelve motion presets include stretching, rotating, zooming, moving, revealing and splitting one character into four pieces. Each preset draws one character; the split preset partitions that character rather than duplicating it.

New blocks last 0.45 seconds. At speed 1, the motion lasts 0.45 seconds, or 0.42 seconds for **Groeien**. **Referentietempo** restores that duration and speed. A longer block holds the final pose; a shorter block cuts the motion. Some motion profiles deliberately start or end outside the frame.

## Supported characters

The **Teken** input accepts one visible grapheme and normalizes it to NFC. Letters, numerals and symbols must exist in Inter Medium: examples include `A`, `é`, `Ω`, `Ж`, `€`, `₿`, `↑` and `q́`. Whitespace, a standalone accent, multiple characters, unsupported emoji or CJK, and unsupported combinations show an error instead of using another font. A cluster is limited to 128 UTF-16 code units and safe canvas bounds. Short punctuation and symbols keep their height relative to Inter’s `0`; a dash is not enlarged to a full letter’s height. Letters and numerals retain the existing animation sizes.

IME composition is allowed to finish before the character is committed. Invalid or unfinished input blocks playback, video export and JSON download; the last valid project remains in storage. Choose a quick digit or correct the input to continue. Existing version-1 projects keep their `digit` field and remain compatible.

## Projects and examples

The current project is saved in browser storage for the current origin. **Project opslaan als JSON** downloads a portable copy; **Project openen** imports it. Invalid or newer saved data is preserved for recovery instead of overwritten. Undo and redo apply to the current session.

Ten example sequences for **2000**, each with four different effects, are in [`examples/2000`](examples/2000). Import a JSON file to edit it. Their short sequences can be repeated at export.

## Export support

- MP4/H.264 at 30 fps, 720p or 1080p; landscape, square or portrait.
- One, two or four repeats; maximum five minutes per export.
- Up to 60 blocks, each 0.2–10 seconds. No sound or watermark.
- MP4 requires a supported WebCodecs H.264 encoder. Chrome has been verified; availability depends on the browser and device.
- WebM is an explicit alternative recorded in real time. Keep its tab visible during recording.

Preview, scrubbing and export share the same deterministic renderer. MP4 uses explicit frame timestamps and a shortened final frame when the duration is not an exact multiple of 1/30 second. Downloaded mobile playback and the host chat application's inline preview are separate capabilities.

## Open-source assets

All character masks are generated locally in the browser from the unmodified **Inter Medium (500)** WOFF files in `@fontsource/inter`. The renderer loads only a font subset that covers the entire grapheme. Its own `FontFace` family prevents system-font substitution; preview and export use the same cached white alpha mask. DM Sans remains the interface font. Both fonts are licensed under SIL OFL 1.1; see [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

The reproducible coverage manifest is [`src/inter-coverage.json`](src/inter-coverage.json). Its generator reads actual cmap glyph mappings from all seven Inter subsets and records the font, license and script hashes:

```sh
python3 scripts/generate-inter-coverage.py
```

The earlier ten static numeral masks, source font and their generator remain in [`public/glyphs`](public/glyphs) as reproducible font specimens. Runtime rendering no longer depends on those PNGs or the development reference pack.

Motion profiles were implemented from measurements of a supplied animation reference. The original GIF and its extracted artwork are not redistributed. The public glyph shapes therefore differ from that private reference.

## Development and pull requests

```sh
npm run check
npm audit --audit-level=high
```

`check` builds first, then runs the unit and packaging tests. CI runs these checks on every pull request and on `main`.

Each change request gets its own branch and pull request. An independent review must be clean and CI must pass on the current commit before merge. See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md). The application is not automatically deployed by CI.

Main files: `src/App.jsx` (editor), `src/project.js` (storage/import), `src/renderer.js` (motion), `src/reference-frames.js` (sampled poses), `src/characters.js` (Unicode validation), `src/glyphs.js` (font loading and masks) and `src/export.js` (video encoding).

## License

Application code: [MIT](LICENSE). Fonts and third-party dependencies retain their own licenses. No license is granted for excluded local reference material.
