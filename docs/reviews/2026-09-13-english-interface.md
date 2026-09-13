# English interface

Request: change the tool's interface text to English. Scope includes controls, accessible labels, animation names/descriptions, loading and recovery states, validation/export errors, default project names, recovery filenames, metadata and the HTML language. Saved project names and content remain unchanged. The existing duration input still accepts a comma; displayed seconds and speed use a decimal point.

## Review gate

Independent mechanism: a separate read-only `english_review` agent that did not implement this change. Initial review found no actionable issues in the complete translation diff. Exact reviewed commit is recorded in the PR and its `independent-review` status. No open findings.

## Verification

- `npm run check`: production build and all 63 existing tests pass. Message assertions were updated without weakening behavioral checks; no new copy-only tests were added.
- Desktop and 390×844 Chrome: English labels, descriptions and dialogs fit without overlap or horizontal overflow. HTML language is `en`.
- Actual MP4 export completed through the English progress and result states, with the Download MP4 link displayed. Encoding and rendering logic are unchanged.
- Unsupported emoji shows the English validation message and blocks export; restoring a supported character enables it again. Input `0,5` commits as `0.5`; fractional speed displays `1.05×`. No console warnings/errors.
- Font timeout detection and its test were translated consistently. The source scan found no remaining Dutch app-owned interface messages. Historical records, sample project names, user data, motion data/IDs and licenses remain unchanged.

No dependencies changed and no website deployment is included.
