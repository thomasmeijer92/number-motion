# Full reference compositions

Request: apply the approved full Opbouw, Groeiend kwartet, Schuivend patroon and Uitzoomend patroon compositions to the editor. One selected Inter Medium grapheme may repeat within a composition. Preserve the four existing preset IDs and all saved project settings.

## Review gate

Independent mechanism: separate read-only agent `full_tool_review`, which did not implement the change. Implementation was split between the primary agent and two implementation agents. Exact reviewed commit is recorded in the pull request and its `independent-review` commit status.

- Round 1: no actionable code findings. Independently compared all 1,380 quartet/pattern poses and identities with the measured source data; maximum numeric rounding 0.00005 source pixels. All 62 tests passed.
- Browser QA found F1 below. Round 2 independently reviewed its fix and regression coverage; no actionable findings remained. All 24 focused renderer/composition tests passed.

| Key | Severity | Location | Status | Fix and verification |
| --- | --- | --- | --- | --- |
| F1 | P2 | src/full-compositions.js, output framing | Fixed | Fitting the zoom pattern by the short edge exposed empty upper/lower bands in portrait. Both patterns now cover the output crop; quartet framing stays centered. Portrait regression test and actual 720×1280 preview/export verified. |

## Verification

- `npm run check`: build and all 63 tests pass. Coverage includes full composition counts, four orientations and sideways bounds, unequal grouped gaps, row/column travel, exact sampling, holds, Unicode/color identity, punctuation scale, blank/bar construction, bounded morph cache, scene cuts and shared preview/export drawing.
- Real Chrome editor at desktop and 390×844: effect descriptions and accessible labels, no horizontal overflow, keyboard scrubbing, play/pause, custom colors, and existing saved IDs tested. No console warnings/errors. Unsupported emoji blocks export and recovery to supported input works.
- Real MP4 export: 1280×720, H.264/yuv420p, 30 fps, four repeats, 240 frames, exactly 8 seconds; complete decode succeeds. Portrait Unicode export with Ω, A, — and €: 720×1280, two repeats, 120 frames, exactly 4 seconds.
- The exported 2000 sequence was visually compared frame by frame with the previously corrected video, including the bar-to-character transition. Full compositions match; small pixel differences reflect browser/Pillow rasterization, H.264 encoding and the approximately 0.064% cover-fit adjustment for the reference's near-16:9 aspect ratio.
- Opbouw computes its contour blend only during the 60 ms transition on a cropped, bounded raster. At most 16 cached canvases, each at most 512×512; no reads from the visible canvas or DOM layout. Independent synthetic CPU check (excluding browser raster costs): median 0.99 ms, p95 2.51 ms over 100 uncached samples.

Only numeric motion measurements, code, tests and documentation are published. Reference GIF/artwork, comparison images, exported videos and scratch analysis remain outside the repository. Other presets, font licensing, dependency versions and project schema remain unchanged. No website deployment.
