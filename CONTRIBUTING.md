# Contributing to Number Motion

Use Node.js 22 and install with `npm ci`. Start the editor with `npm run dev`.

## One request, one pull request

1. Start a new branch from the latest `main` for each requested change.
2. Keep the change focused. Preserve the reference motion, one numeral per block, and the shared preview/export renderer.
3. Run `npm run check`. For UI changes, inspect desktop and mobile. For rendering or export changes, inspect an actual exported video and its metadata.
4. Open a pull request with the problem, behavior, verification and limitations.
5. Have someone or an independent review agent inspect the current commit. Address every actionable finding and request another review when the change affects an earlier review.
6. Merge only after the independent review is clean and CI has passed on that commit. The project owner has authorized this workflow for subsequent requests in this project. Do not merge through failing checks or unresolved findings.

Automated CI verifies the build, tests and dependency audit. It does not replace independent code review or a visual check. Do not submit a GitHub review as if it came from a separate human when a local agent performed it; record the review mechanism accurately in the PR.

Do not push feature work directly to `main`. Do not force-push shared history. If a review/fix cycle still has blocking findings after three rounds, explain the blocker before continuing.

## Assets and privacy

Do not commit credentials, local browser data, generated videos, scratch measurements or reference media without redistribution rights. Keep `.env.local`, `work/`, `node_modules/`, and `dist/` local. Preserve the license notices for fonts and other third-party material.
