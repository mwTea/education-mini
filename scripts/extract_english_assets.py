#!/usr/bin/env python3
"""Extract English-page PNG assets from the supplied six-item contact sheet.

The supplied picture contains a baked checkerboard rather than a real alpha
channel.  We flood-fill only near-neutral pixels reachable from each crop's
edge, then discard tiny disconnected remnants and trim the transparent bounds.
"""

from collections import deque
from pathlib import Path
import sys

import numpy as np
from PIL import Image


ASSETS = {
    # filename: (crop box, maximum output width)
    "english-hero-xiaomo.png": ((15, 0, 720, 625), 340),
    "mode-sentence.png": ((700, 155, 1095, 520), 150),
    "mode-unscramble.png": ((1070, 155, 1536, 510), 190),
    "english-textbook.png": ((115, 620, 520, 1005), 120),
    "alphabet-writing.png": ((555, 625, 985, 1000), 140),
    "theme-words.png": ((1015, 600, 1455, 1005), 150),
}


def exterior_checker(rgb: np.ndarray) -> np.ndarray:
    hi = rgb.max(axis=2).astype(np.int16)
    lo = rgb.min(axis=2).astype(np.int16)
    mean = rgb.mean(axis=2)
    # The real artwork is strongly coloured. The baked background is neutral
    # grey, including its soft paper-like variations.
    passable = ((hi - lo) <= 14) & (mean >= 118) & (mean <= 252)
    height, width = passable.shape
    outside = np.zeros((height, width), dtype=bool)
    queue: deque[tuple[int, int]] = deque()

    def add(y: int, x: int) -> None:
        if passable[y, x] and not outside[y, x]:
            outside[y, x] = True
            queue.append((y, x))

    for x in range(width):
        add(0, x)
        add(height - 1, x)
    for y in range(height):
        add(y, 0)
        add(y, width - 1)

    while queue:
        y, x = queue.popleft()
        if y:
            add(y - 1, x)
        if y + 1 < height:
            add(y + 1, x)
        if x:
            add(y, x - 1)
        if x + 1 < width:
            add(y, x + 1)
    return outside


def remove_small_islands(mask: np.ndarray, minimum: int = 90) -> np.ndarray:
    height, width = mask.shape
    seen = np.zeros_like(mask)
    keep = np.zeros_like(mask)
    for y in range(height):
        for x in range(width):
            if not mask[y, x] or seen[y, x]:
                continue
            seen[y, x] = True
            queue = deque([(y, x)])
            component = [(y, x)]
            while queue:
                cy, cx = queue.popleft()
                for ny, nx in ((cy - 1, cx), (cy + 1, cx), (cy, cx - 1), (cy, cx + 1)):
                    if 0 <= ny < height and 0 <= nx < width and mask[ny, nx] and not seen[ny, nx]:
                        seen[ny, nx] = True
                        queue.append((ny, nx))
                        component.append((ny, nx))
            if len(component) >= minimum:
                yy, xx = zip(*component)
                keep[np.asarray(yy), np.asarray(xx)] = True
    return keep


def extract(source: Image.Image, box: tuple[int, int, int, int]) -> Image.Image:
    crop = source.crop(box).convert("RGB")
    rgb = np.asarray(crop)
    alpha = ~exterior_checker(rgb)
    alpha = remove_small_islands(alpha)
    rgba = np.dstack((rgb, alpha.astype(np.uint8) * 255))
    result = Image.fromarray(rgba, "RGBA")
    bounds = result.getbbox()
    if not bounds:
        raise RuntimeError(f"No foreground found in crop {box}")
    left, top, right, bottom = bounds
    margin = 4
    return result.crop((max(0, left - margin), max(0, top - margin), min(result.width, right + margin), min(result.height, bottom + margin)))


def main() -> None:
    if len(sys.argv) != 3:
        raise SystemExit("usage: extract_english_assets.py SOURCE_PNG OUTPUT_DIR")
    source_path = Path(sys.argv[1])
    output_dir = Path(sys.argv[2])
    output_dir.mkdir(parents=True, exist_ok=True)
    source = Image.open(source_path)
    for filename, (box, max_width) in ASSETS.items():
        asset = extract(source, box)
        if asset.width > max_width:
            height = round(asset.height * max_width / asset.width)
            asset = asset.resize((max_width, height), Image.Resampling.LANCZOS)
        # Mini-program package space is tight; an adaptive palette keeps these
        # small display assets crisp while retaining transparency.
        asset = asset.quantize(colors=96, method=Image.Quantize.FASTOCTREE, dither=Image.Dither.NONE)
        asset.save(output_dir / filename, optimize=True)
        print(f"{filename}: {asset.width}x{asset.height}")


if __name__ == "__main__":
    main()
