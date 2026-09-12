# Number Motion

Created 2026-09-12. Canonical application source for the numeral animation tool in this task.

Read README.md, AGENTS.md, CONTRIBUTING.md and package.json first. Source is in src/. Runtime character masks are generated from the bundled OFL-licensed Inter Medium subsets, validated by src/inter-coverage.json. Earlier static numeral specimens remain in public/glyphs/. Original reference artwork is preserved only in ignored local-reference/ and is not a runtime glyph source.

The user requested an open-source GitHub repository and a standing workflow: one request per PR, an independent review, then merge after clean review and passing checks. Run npm run check (build before tests). CI does not deploy. Review findings and evidence live in docs/reviews/. Example projects live in examples/2000/; private video exports and scratch measurements are outside the repository.

Preserve one visible Unicode grapheme per block, except the explicitly requested four disjoint parts of one numeral. Preserve measured motion semantics and share one deterministic renderer between preview and export. Keep local reference assets out of commits and production builds.
