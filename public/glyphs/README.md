# Inter Medium numeral masks

Ten white RGBA masks, one each for digits 0–9. They were generated only from the bundled, unmodified Inter Medium (weight 500) Latin WOFF font from `@fontsource/inter` 5.3.0. No reference GIF or extracted reference artwork is used.

The source font is licensed under SIL Open Font License 1.1. Keep `OFL-1.1.txt` with the bundled font; `manifest.json` records its authorship and SHA-256. The font file is copied unchanged.

To regenerate with Python 3 and Pillow (FreeType with WOFF support):

```sh
python3 generate.py --height 700
```

The helper renders the font at a large size, crops natural painted bounds and uniformly downsamples to 700px height. It does not stretch, trace or redraw any outline. The tiny per-digit width rounding is recorded by the output dimensions and aspect ratio in `manifest.json`.

`contact-sheet.png` is a visual index. These ten PNGs remain reproducible font specimens; the editor now generates character masks dynamically from the Inter subsets and does not load this static set.
