#!/usr/bin/env python3
"""Create recolorable digit masks using only the bundled OFL source font.

Requirements: Python 3, Pillow built with FreeType WOFF support.
Run: python3 generate.py --height 700
No GIF, extracted reference artwork, network or font transformation is used.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

import PIL
from PIL import Image, ImageDraw, ImageFont, features

BASE = Path(__file__).resolve().parent
FONT_FILE = 'inter-latin-500-normal.woff'
FONT_SIZE = 4096


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--height', type=int, default=700, help='Final painted pixel height (default: 700).')
    args = parser.parse_args()
    if not 64 <= args.height <= 2048:
        parser.error('height must be between 64 and 2048')

    font_path = BASE / FONT_FILE
    font = ImageFont.truetype(str(font_path), FONT_SIZE)
    glyphs = {}
    for digit in '0123456789':
        left, top, right, bottom = font.getbbox(digit)
        alpha = Image.new('L', (right - left + 8, bottom - top + 8), 0)
        ImageDraw.Draw(alpha).text((4 - left, 4 - top), digit, font=font, fill=255, stroke_width=0)
        ink_bounds = alpha.getbbox()
        if ink_bounds is None:
            raise RuntimeError(f'Font rendered no pixels for {digit}')
        alpha = alpha.crop(ink_bounds)
        natural_width, natural_height = alpha.size
        width = max(1, round(natural_width * args.height / natural_height))
        # Uniform scaling of natural painted bounds; width is rounded only to
        # the nearest output pixel. No stretching, tracing or shape edits.
        alpha = alpha.resize((width, args.height), Image.Resampling.LANCZOS)
        alpha = alpha.crop(alpha.getbbox())
        rgba = Image.new('RGBA', alpha.size, (255, 255, 255, 255))
        rgba.putalpha(alpha)
        output = BASE / f'{digit}.png'
        rgba.save(output, compress_level=9)
        glyphs[digit] = {
            'file': output.name,
            'width': rgba.width,
            'height': rgba.height,
            'aspectRatio': rgba.width / rgba.height,
            'inkBounds': [0, 0, rgba.width, rgba.height],
            'naturalInkAt4096px': [natural_width, natural_height],
            'sha256': sha256(output),
        }

    manifest = {
        'set': 'Inter Medium 500 numeral masks',
        'input': {
            'package': '@fontsource/inter',
            'packageVersion': '5.3.0',
            'family': 'Inter',
            'weight': 500,
            'style': 'normal',
            'subset': 'latin',
            'file': FONT_FILE,
            'sha256': sha256(font_path),
            'pillowFontName': list(font.getname()),
            'fontsourceHomepage': 'https://fontsource.org/fonts/inter',
            'upstream': 'https://github.com/rsms/inter',
        },
        'license': {
            'identifier': 'OFL-1.1',
            'file': 'OFL-1.1.txt',
            'sha256': sha256(BASE / 'OFL-1.1.txt'),
            'attribution': 'Copyright 2016 The Inter Project Authors (https://github.com/rsms/inter)',
            'fontFileUnmodified': True,
        },
        'generation': {
            'script': 'generate.py',
            'scriptSha256': sha256(Path(__file__).resolve()),
            'pillowVersion': PIL.__version__,
            'freetypeVersion': features.version('freetype2'),
            'renderFontSize': FONT_SIZE,
            'targetPaintedHeight': args.height,
            'resampling': 'LANCZOS, uniform scale; output width rounded to nearest pixel',
            'pixelFormat': 'RGBA, white RGB with antialiased alpha',
            'referenceArtworkUsed': False,
        },
        'glyphs': glyphs,
    }
    (BASE / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')

    sheet = Image.new('RGB', (1400, 700), '#EEECE6')
    draw = ImageDraw.Draw(sheet)
    for index, digit in enumerate('0123456789'):
        source = Image.open(BASE / f'{digit}.png')
        source.thumbnail((220, 265), Image.Resampling.LANCZOS)
        preview = Image.new('RGBA', source.size, '#252525')
        preview.putalpha(source.getchannel('A'))
        x, y = (index % 5) * 280, (index // 5) * 350
        sheet.paste(preview, (x + (280 - source.width) // 2, y + 20), preview)
        draw.text((x + 20, y + 310), f"{digit} | {glyphs[digit]['width']} x {glyphs[digit]['height']} px", fill='#252525')
    sheet.save(BASE / 'contact-sheet.png')
    print(json.dumps({'glyphs': len(glyphs), 'font': font.getname(), 'height': args.height, 'output': str(BASE)}))


if __name__ == '__main__':
    main()
