# Inter Medium numeral masks

Ten white RGBA masks, one each for digits 0–9. They were generated only from the bundled, unmodified Inter Medium (weight 500) Latin WOFF font from `@fontsource/inter` 5.3.0. No reference GIF or extracted reference artwork is used.

The source font is licensed under SIL Open Font License 1.1. Keep `OFL-1.1.txt` with the bundled font; `manifest.json` records its authorship and SHA-256. The font file is copied unchanged.

To regenerate with Python 3 and Pillow (FreeType with WOFF support):

```sh
python3 generate.py --height 700
```

The helper renders the font at a large size, crops natural painted bounds and uniformly downsamples to 700px height. It does not stretch, trace or redraw any outline. The tiny per-digit width rounding is recorded by the output dimensions and aspect ratio in `manifest.json`.

`contact-sheet.png` is only a visual index. Runtime use should load `0.png` through `9.png` and tint the white pixels through the alpha channel.
