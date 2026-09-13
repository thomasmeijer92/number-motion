# Number Motion

Read projects.md, README.md, CONTRIBUTING.md and package.json before changing this project.

## GitHub workflow

- The owner explicitly requested an open-source repository and authorized this standing workflow: each subsequent change request gets a separate branch and pull request, independent review, then merge after a clean review and passing checks. Do not ask again for the routine push or merge within that scope.
- Start each PR from current main. Keep unrelated changes in separate PRs. Never push feature work directly to main or rewrite shared history.
- Run npm run check and inspect affected browser flows. Obtain a review from an independent agent or person that did not make the changes. Resolve actionable findings and re-review changed code; after three unsuccessful rounds, report the blocker.
- Record reviewer mechanism, reviewed commit, findings and verification truthfully in the PR. An agent review is not a second human GitHub approval.
- Set the independent-review commit status to success only after that independent review is clean on the exact PR head. CI's Build and test status must also pass. New commits require a fresh review status; do not reuse an old approval.
- Merge only that reviewed, passing head. Publishing this repository does not authorize website deployment, unrelated account changes or other external writes.

## Product and rendering contracts

- One selected NFC-normalized Unicode grapheme per independently previewed video block. The quad, pattern and scroll effects repeat that selected character in their full reference compositions. Only export joins the blocks in order. The splitFour effect divides one character into four disjoint pieces, distinct from quad's four complete characters.
- Preview, scrubbing and export share the deterministic renderer. Keep the measured positions, scale, direction and timing in src/reference-frames.js and src/full-composition-frames.js, including clipped or blank source poses. The reveal, quad, pattern and scroll presets are Build-up, Growing quartet, Sliding pattern and Zoom-out pattern. Preserve their existing IDs and version-1 project compatibility. Full patterns cover the output crop; the quartet keeps its centered group framing.
- Source motion lasts 0.45 s at speed 1, except rings at 0.42 s. Block duration changes the cut, not the motion speed; longer blocks hold the final pose. Reference timing restores duration and speed. New blocks default to 0.45 s; preserve stored durations.
- Render cuts and loop boundaries must account for floating-point rounding. Keep existing regression coverage for blank source poses and repeated cuts.
- MP4 is the primary export. Never silently substitute WebM. Keep the five-minute maximum consistent between UI and exporter.
- Protect invalid, newer or unreadable stored projects from startup autosave. Give an explicit recovery path before replacing them.
- The current character set must have ready Inter masks before playback or export; compare its key during render, not only in a later effect. Invalid or composing character drafts also block playback, video export and JSON download. Errors must be visible and retryable. Preserve the version-1 digit field for old projects.

## Assets and open source

- Runtime glyphs are generated from the bundled OFL-licensed Inter Medium font. Validate every cluster against the actual cmap of one complete subset, and use its own loaded FontFace family with no renderer fallback. Preserve font licenses, coverage/source hashes, generation helpers and dependency notices. Do not replace them with unlicensed reference extractions.
- The original local prototype's artwork remains in ignored local-reference/ and is no longer a runtime glyph source. The ten PNGs in public/glyphs/ are retained font specimens. Never commit local reference files, .env.local, generated videos, dist/, node_modules/ or scratch work/.
- Keep the MIT application license distinct from third-party font/dependency licenses.

## Checks and tooling

- Run npm ci, then npm run check from a fresh checkout. check builds before running tests, including Sites packaging checks. Run npm audit --audit-level=high when dependencies change.
- After UI changes, verify desktop and mobile layout, text fit, controls and keyboard behavior. Run the local server yourself. After renderer/export changes, inspect an actual video and its metadata.
- Keep .openai/hosting.json, worker/index.js, scripts/prepare-sites-build.mjs and tests/sites-worker.test.mjs functioning so a later authorized Sites handoff remains possible. CI does not deploy.

## 2000 examples

- The requested sample loops are 20 seconds. Each of the ten variants uses four different animations, with visibly different motion for its three zeros.
- The earlier single '2000 in vieren' test uses splitFour on its middle zero. Its preceding rotating version looked too similar to the final zero; different preset names alone are not enough to establish visual variety.
