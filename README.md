# Number Motion

A browser-based editor for animated numeral sequences. Each block contains one digit with its own motion, colors and timing; video export joins the blocks in order. The interface is currently in Dutch.

## Run locally

Use Node.js 22 (minimum 20.19).

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. The editor works entirely in the browser. It does not upload projects or videos and does not require an account.

## Create a video

1. Choose a digit, animation, background and numeral color for each block.
2. Play or scrub a block independently. Adjust its duration, speed and size.
3. Add, duplicate or reorder blocks.
4. Choose **Exporteer montage → Maak MP4 → Download MP4**.

Twelve motion presets include stretching, rotating, zooming, moving, revealing and splitting one numeral into four pieces. Each preset draws one numeral; the split preset partitions that numeral rather than duplicating it.

New blocks last 0.45 seconds. At speed 1, the motion lasts 0.45 seconds, or 0.42 seconds for **Groeien**. **Referentietempo** restores that duration and speed. A longer block holds the final pose; a shorter block cuts the motion. Some motion profiles deliberately start or end outside the frame.

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

The public build uses numeral masks generated from **Inter Medium (500)**, licensed under SIL OFL 1.1. The source font, license, provenance hashes and regeneration helper are in [`public/glyphs`](public/glyphs). The interface uses DM Sans. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

Motion profiles were implemented from measurements of a supplied animation reference. The original GIF and its extracted artwork are not redistributed. The public glyph shapes therefore differ from that private reference.

For optional local reference testing, put authorized masks named `0.png` through `9.png` in an ignored `local-reference/glyphs/` directory and set `VITE_USE_LOCAL_REFERENCE=true` in `.env.local`. This applies only to the development server. Production builds always use the openly licensed assets; `local-reference/` is outside the public asset directory.

## Development and pull requests

```sh
npm run check
npm audit --audit-level=high
```

`check` builds first, then runs the unit and packaging tests. CI runs these checks on every pull request and on `main`.

Each change request gets its own branch and pull request. An independent review must be clean and CI must pass on the current commit before merge. See [`CONTRIBUTING.md`](CONTRIBUTING.md) and [`AGENTS.md`](AGENTS.md). The application is not automatically deployed by CI.

Main files: `src/App.jsx` (editor), `src/project.js` (storage/import), `src/renderer.js` (motion), `src/reference-frames.js` (sampled poses), `src/glyphs.js` (numeral assets) and `src/export.js` (video encoding).

## License

Application code: [MIT](LICENSE). Fonts and third-party dependencies retain their own licenses. No license is granted for excluded local reference material.
