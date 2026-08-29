#!/usr/bin/env python3
"""Build a complete macOS .icns from a 1024x1024 PNG.

Uses Apple-compatible encodings:
- ic04 / ic05: PackBits-compressed ARGB (required for crisp 16/32 1x Finder icons;
  PNG icp4/icp5 appear garbled on macOS)
- ic07–ic14: PNG

Usage:
  python3 scripts/build-mac-icns.py [input.png] [output.icns]
"""

from __future__ import annotations

import struct
import subprocess
import sys
import tempfile
import zlib
from pathlib import Path

# Match electron-builder / iconutil OSType set.
# encoding: "argb" | "png"
ICNS_ENTRIES: list[tuple[bytes, int, str]] = [
    (b"ic04", 16, "argb"),  # 16x16 ARGB
    (b"ic05", 32, "argb"),  # 32x32 ARGB
    (b"ic07", 128, "png"),  # 128x128 PNG
    (b"ic08", 256, "png"),  # 256x256 PNG
    (b"ic09", 512, "png"),  # 512x512 PNG
    (b"ic10", 1024, "png"),  # 1024x1024 PNG (512@2x)
    (b"ic11", 32, "png"),  # 16x16@2x PNG
    (b"ic12", 64, "png"),  # 32x32@2x PNG
    (b"ic13", 256, "png"),  # 128x128@2x PNG
    (b"ic14", 512, "png"),  # 256x256@2x PNG
]


def read_png_rgba(path: Path) -> tuple[int, int, list[bytearray]]:
    data = path.read_bytes()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"not a PNG: {path}")

    offset = 8
    width = height = None
    color_type = None
    idat: list[bytes] = []
    while offset < len(data):
        length = struct.unpack(">I", data[offset : offset + 4])[0]
        ctype = data[offset + 4 : offset + 8]
        chunk = data[offset + 8 : offset + 8 + length]
        offset += 12 + length
        if ctype == b"IHDR":
            width, height, bit_depth, color_type = struct.unpack(">IIBB", chunk[:10])
            if bit_depth != 8 or color_type != 6:
                raise ValueError(
                    f"expected 8-bit RGBA PNG, got bit_depth={bit_depth} color_type={color_type}"
                )
        elif ctype == b"IDAT":
            idat.append(chunk)
        elif ctype == b"IEND":
            break

    if width is None or height is None:
        raise ValueError("missing IHDR")

    raw = zlib.decompress(b"".join(idat))
    bpp = 4
    stride = width * bpp
    rows: list[bytearray] = []
    i = 0
    prev = bytearray(stride)
    for _ in range(height):
        filter_type = raw[i]
        i += 1
        row = bytearray(raw[i : i + stride])
        i += stride
        if filter_type == 1:
            for x in range(stride):
                left = row[x - bpp] if x >= bpp else 0
                row[x] = (row[x] + left) & 255
        elif filter_type == 2:
            for x in range(stride):
                row[x] = (row[x] + prev[x]) & 255
        elif filter_type == 3:
            for x in range(stride):
                left = row[x - bpp] if x >= bpp else 0
                row[x] = (row[x] + ((left + prev[x]) // 2)) & 255
        elif filter_type == 4:

            def paeth(a: int, b: int, c: int) -> int:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                if pa <= pb and pa <= pc:
                    return a
                if pb <= pc:
                    return b
                return c

            for x in range(stride):
                a = row[x - bpp] if x >= bpp else 0
                b = prev[x]
                c = prev[x - bpp] if x >= bpp else 0
                row[x] = (row[x] + paeth(a, b, c)) & 255
        elif filter_type != 0:
            raise ValueError(f"unsupported PNG filter {filter_type}")
        rows.append(row)
        prev = row
    return width, height, rows


def resize_rgba(rows: list[bytearray], src: int, dst: int) -> list[bytearray]:
    if dst == src:
        return [bytearray(r) for r in rows]
    out: list[bytearray] = []
    if dst > src:
        for y in range(dst):
            sy = min(src - 1, int((y + 0.5) * src / dst))
            src_row = rows[sy]
            row = bytearray(dst * 4)
            for x in range(dst):
                sx = min(src - 1, int((x + 0.5) * src / dst))
                row[x * 4 : (x + 1) * 4] = src_row[sx * 4 : (sx + 1) * 4]
            out.append(row)
        return out

    for y in range(dst):
        y0 = int(y * src / dst)
        y1 = max(y0 + 1, int((y + 1) * src / dst))
        row = bytearray(dst * 4)
        for x in range(dst):
            x0 = int(x * src / dst)
            x1 = max(x0 + 1, int((x + 1) * src / dst))
            acc = [0, 0, 0, 0]
            n = 0
            for yy in range(y0, y1):
                src_row = rows[yy]
                for xx in range(x0, x1):
                    pix = src_row[xx * 4 : (xx + 1) * 4]
                    for c in range(4):
                        acc[c] += pix[c]
                    n += 1
            for c in range(4):
                row[x * 4 + c] = acc[c] // n
        out.append(row)
    return out


def encode_png(rows: list[bytearray], size: int) -> bytes:
    def chunk(tag: bytes, data: bytes) -> bytes:
        return (
            struct.pack(">I", len(data))
            + tag
            + data
            + struct.pack(">I", zlib.crc32(tag + data) & 0xFFFFFFFF)
        )

    raw = bytearray()
    for row in rows:
        raw.append(0)
        raw.extend(row)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 6, 0, 0, 0)
    return (
        b"\x89PNG\r\n\x1a\n"
        + chunk(b"IHDR", ihdr)
        + chunk(b"IDAT", zlib.compress(bytes(raw), 9))
        + chunk(b"IEND", b"")
    )


def packbits_channel(channel: bytes) -> bytes:
    """ICNS PackBits: control < 0x80 => literal of control+1; control >= 0x80 => run of control-125."""
    out = bytearray()
    i = 0
    n = len(channel)
    while i < n:
        # Prefer a run of identical bytes when beneficial.
        run = 1
        while i + run < n and channel[i] == channel[i + run] and run < 130:
            run += 1
        if run >= 3:
            # control = run + 125, next byte is the value; run = control - 125
            out.append(run + 125)
            out.append(channel[i])
            i += run
            continue

        # Literal sequence until a useful run or max length.
        start = i
        i += 1
        while i < n and (i - start) < 128:
            run = 1
            while i + run < n and channel[i] == channel[i + run] and run < 130:
                run += 1
            if run >= 3:
                break
            i += 1
        length = i - start
        out.append(length - 1)
        out.extend(channel[start:i])
    return bytes(out)


def encode_argb(rows: list[bytearray], size: int) -> bytes:
    """ARGB magic + PackBits-compressed A,R,G,B planes (straight alpha)."""
    count = size * size
    a = bytearray(count)
    r = bytearray(count)
    g = bytearray(count)
    b = bytearray(count)
    i = 0
    for row in rows:
        for x in range(size):
            pr, pg, pb, pa = row[x * 4 : (x + 1) * 4]
            a[i] = pa
            r[i] = pr
            g[i] = pg
            b[i] = pb
            i += 1
    return (
        b"ARGB"
        + packbits_channel(bytes(a))
        + packbits_channel(bytes(r))
        + packbits_channel(bytes(g))
        + packbits_channel(bytes(b))
    )


def sips_resize_png(src: Path, size: int, dest: Path) -> None:
    subprocess.run(
        ["sips", "-z", str(size), str(size), str(src), "--out", str(dest)],
        check=True,
        capture_output=True,
    )


def build_icns(png_path: Path, icns_path: Path) -> None:
    width, height, rows = read_png_rgba(png_path)
    if width != height:
        raise ValueError(f"icon must be square, got {width}x{height}")
    if width < 1024:
        raise ValueError(f"icon must be at least 1024x1024, got {width}x{height}")
    if width != 1024:
        rows = resize_rgba(rows, width, 1024)
        width = 1024

    # Prefer sips for PNG sizes when available (better filtering).
    use_sips = sys.platform == "darwin"
    frame_cache: dict[tuple[str, int], bytes] = {}

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)

        def payload_for(size: int, encoding: str) -> bytes:
            key = (encoding, size)
            if key in frame_cache:
                return frame_cache[key]

            if use_sips:
                resized = tmp_path / f"{size}.png"
                sips_resize_png(png_path, size, resized)
                rgba_w, rgba_h, rgba_rows = read_png_rgba(resized)
                assert rgba_w == rgba_h == size
            else:
                rgba_rows = resize_rgba(rows, width, size)

            if encoding == "argb":
                payload = encode_argb(rgba_rows, size)
            else:
                # Re-encode from pixels so we control PNG; or use sips bytes directly.
                if use_sips:
                    payload = (tmp_path / f"{size}.png").read_bytes()
                else:
                    payload = encode_png(rgba_rows, size)
            frame_cache[key] = payload
            return payload

        entries: list[bytes] = []
        for ostype, px, encoding in ICNS_ENTRIES:
            payload = payload_for(px, encoding)
            entries.append(ostype + struct.pack(">I", 8 + len(payload)) + payload)
            print(f"  {ostype.decode()} {px}x{px} {encoding} ({len(payload)} bytes)")

    total = 8 + sum(len(entry) for entry in entries)
    icns_path.write_bytes(b"icns" + struct.pack(">I", total) + b"".join(entries))
    print(f"wrote {icns_path} ({icns_path.stat().st_size} bytes, {len(ICNS_ENTRIES)} icon types)")


def main() -> int:
    root = Path(__file__).resolve().parent.parent
    png_path = Path(sys.argv[1]) if len(sys.argv) > 1 else root / "assets" / "icon.png"
    icns_path = Path(sys.argv[2]) if len(sys.argv) > 2 else root / "assets" / "mac.icns"
    build_icns(png_path, icns_path)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
