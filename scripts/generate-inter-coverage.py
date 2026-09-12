#!/usr/bin/env python3
"""Regenerate src/inter-coverage.json from installed Inter 500 WOFF cmaps.

Run from any directory with Python 3 (standard library only) after npm ci:
    python3 scripts/generate-inter-coverage.py

Coverage comes from nonzero glyph IDs in Unicode cmap subtables, not CSS
unicode-range declarations. Unknown Unicode subtable formats stop generation.
"""

import hashlib
import json
from pathlib import Path
import struct
import zlib


ROOT = Path(__file__).resolve().parent.parent
SUBSETS = (
    "latin", "latin-ext", "greek", "greek-ext",
    "cyrillic", "cyrillic-ext", "vietnamese",
)


def unpack(data, offset, fmt):
    size = struct.calcsize(fmt)
    if offset < 0 or offset + size > len(data):
        raise ValueError("Truncated font table")
    return struct.unpack_from(fmt, data, offset)


def table_from_woff(data, wanted):
    signature, _, length, count, reserved = unpack(data, 0, ">4sIIHH")
    if signature != b"wOFF" or length != len(data) or reserved != 0:
        raise ValueError("Invalid WOFF header")
    if len(data) < 44 + 20 * count:
        raise ValueError("Truncated WOFF directory")
    found = None
    for index in range(count):
        tag, offset, compressed, original, _ = unpack(data, 44 + 20 * index, ">4sIIII")
        if tag != wanted:
            continue
        if found is not None:
            raise ValueError("Duplicate WOFF table")
        if compressed > original or offset < 44 + 20 * count or offset + compressed > len(data):
            raise ValueError("Invalid WOFF table bounds")
        table = data[offset:offset + compressed]
        found = zlib.decompress(table) if compressed < original else table
        if len(found) != original:
            raise ValueError("Incorrect decompressed WOFF table length")
    if found is None:
        raise ValueError(f"Missing WOFF table: {wanted!r}")
    return found


def is_scalar(codepoint):
    return 0 <= codepoint <= 0x10FFFF and not 0xD800 <= codepoint <= 0xDFFF


def format4(data, offset):
    _, length, _, segment_bytes = unpack(data, offset, ">HHHH")
    if not segment_bytes or segment_bytes % 2 or offset + length > len(data):
        raise ValueError("Invalid cmap format 4 header")
    count = segment_bytes // 2
    if length < 16 + 8 * count:
        raise ValueError("Truncated cmap format 4 arrays")
    table = data[offset:offset + length]
    end_base, start_base = 14, 16 + 2 * count
    delta_base, range_base = 16 + 4 * count, 16 + 6 * count
    if unpack(table, 14 + 2 * count, ">H")[0] != 0:
        raise ValueError("Invalid cmap format 4 reserved field")
    glyphs, previous_end = {}, -1
    for index in range(count):
        end = unpack(table, end_base + 2 * index, ">H")[0]
        start = unpack(table, start_base + 2 * index, ">H")[0]
        delta = unpack(table, delta_base + 2 * index, ">h")[0]
        range_position = range_base + 2 * index
        glyph_offset = unpack(table, range_position, ">H")[0]
        if start > end or start <= previous_end or glyph_offset % 2:
            raise ValueError("Invalid cmap format 4 segment")
        previous_end = end
        for codepoint in range(start, end + 1):
            if glyph_offset:
                position = range_position + glyph_offset + 2 * (codepoint - start)
                if position < 16 + 8 * count:
                    raise ValueError("cmap format 4 glyph offset precedes glyph array")
                glyph = unpack(table, position, ">H")[0]
                if glyph:
                    glyph = (glyph + delta) & 0xFFFF
            else:
                glyph = (codepoint + delta) & 0xFFFF
            if is_scalar(codepoint):
                glyphs[codepoint] = glyph
    if previous_end != 0xFFFF:
        raise ValueError("Missing cmap format 4 sentinel segment")
    return glyphs


def format12(data, offset):
    _, reserved, length, _, count = unpack(data, offset, ">HHIII")
    if reserved or length != 16 + 12 * count or offset + length > len(data):
        raise ValueError("Invalid cmap format 12 header")
    glyphs, previous_end = {}, -1
    for index in range(count):
        start, end, first_glyph = unpack(data, offset + 16 + 12 * index, ">III")
        if start > end or start <= previous_end or end > 0x10FFFF:
            raise ValueError("Invalid cmap format 12 group")
        if first_glyph + end - start > 0xFFFFFFFF:
            raise ValueError("Invalid cmap format 12 glyph ID")
        previous_end = end
        for codepoint in range(start, end + 1):
            glyph = first_glyph + codepoint - start
            if is_scalar(codepoint):
                glyphs[codepoint] = glyph
    return glyphs


def unicode_coverage(woff):
    cmap = table_from_woff(woff, b"cmap")
    version, count = unpack(cmap, 0, ">HH")
    if version != 0 or len(cmap) < 4 + 8 * count:
        raise ValueError("Invalid cmap directory")
    glyphs, parsed = {}, set()
    for index in range(count):
        platform, encoding, offset = unpack(cmap, 4 + 8 * index, ">HHI")
        if not (platform == 0 or (platform == 3 and encoding in (1, 10))):
            continue
        if offset < 4 + 8 * count:
            raise ValueError("Invalid cmap subtable offset")
        kind = unpack(cmap, offset, ">H")[0]
        parser = {4: format4, 12: format12}.get(kind)
        if parser is None:
            raise ValueError(f"Unsupported Unicode cmap format {kind}")
        if offset in parsed:
            continue
        parsed.add(offset)
        for codepoint, glyph in parser(cmap, offset).items():
            if codepoint in glyphs and glyphs[codepoint] != glyph:
                raise ValueError(f"Conflicting Unicode cmap glyph for U+{codepoint:04X}")
            glyphs[codepoint] = glyph
    if not parsed or not any(glyphs.values()):
        raise ValueError("No supported nonempty Unicode cmap")
    return sorted(codepoint for codepoint, glyph in glyphs.items() if glyph)


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def main():
    package = ROOT / "node_modules/@fontsource/inter"
    metadata = json.loads((package / "package.json").read_text(encoding="utf-8"))
    if metadata["name"] != "@fontsource/inter" or metadata["version"] != "5.3.0":
        raise ValueError("Expected @fontsource/inter 5.3.0; review font updates before regenerating")
    manifest = {
        "family": "Inter",
        "weight": 500,
        "package": metadata["name"],
        "packageVersion": metadata["version"],
        "license": {"file": "LICENSE", "sha256": sha256((package / "LICENSE").read_bytes())},
        "generator": {
            "file": "scripts/generate-inter-coverage.py",
            "sha256": sha256(Path(__file__).read_bytes()),
        },
        "subsets": [],
    }
    for subset in SUBSETS:
        filename = f"inter-{subset}-500-normal.woff"
        font = (package / "files" / filename).read_bytes()
        manifest["subsets"].append({
            "id": subset, "file": filename, "sha256": sha256(font),
            "codepoints": unicode_coverage(font),
        })
    output = ROOT / "src/inter-coverage.json"
    output.write_text(json.dumps(manifest, separators=(",", ":")) + "\n", encoding="utf-8")
    total = len(set().union(*(set(subset["codepoints"]) for subset in manifest["subsets"])))
    print(f"Wrote {len(SUBSETS)} Inter subsets covering {total} codepoints to src/inter-coverage.json")


if __name__ == "__main__":
    main()
