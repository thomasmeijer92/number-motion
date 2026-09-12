# Third-party notices

The application code is MIT-licensed. Third-party components retain their own licenses and copyright notices.

| Component | License | Use |
| --- | --- | --- |
| React, React DOM, Scheduler | MIT | UI runtime |
| Phosphor Icons React | MIT | Interface icons |
| mp4-muxer | MIT | MP4 container export |
| Inter | SIL Open Font License 1.1 | Character font and generated masks |
| DM Sans | SIL Open Font License 1.1 | Interface typography |

Full notices for the bundled runtime components and fonts are in `public/licenses/` and are included in production builds. The public numeral assets also carry their font file, license, hashes and regeneration script in `public/glyphs/`. Font licenses are not replaced by the application's MIT license.

The original animation reference and extracted reference masks do not have a confirmed redistribution license and are not part of the public repository or production build. The ignored `local-reference/` archive is no longer used by the runtime; its presence does not grant redistribution rights.

Other development dependencies are installed from npm with their original licenses. Exact versions are pinned in `package-lock.json`.
