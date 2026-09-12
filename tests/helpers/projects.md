# Test helpers

Read ../../AGENTS.md and ../../CONTRIBUTING.md. This directory contains the small fake canvas and FontFace environment used by the Node unit tests. It checks mask loading, cache boundaries and renderer calls without a browser; it does not establish real font shaping or video quality. Keep actual browser and exported-video checks separate. Tests run from the application root with npm run check.
