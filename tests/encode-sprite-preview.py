"""Encode native Electron QA captures; never edits a source Pet asset.

Requires Pillow. First run smoke.cjs --sprite-preview --qa-before/--qa-after.
"""
import base64
import io
import json
import os
from pathlib import Path
import sys

from PIL import Image

label = sys.argv[1]
if label not in ('before', 'after'):
    raise SystemExit('Expected before or after')
frames = json.loads((Path(os.environ['TEMP']) / 'desktopplayground-sprite-qa-frames.json').read_text(encoding='utf-8'))
if len(frames) != 32:
    raise SystemExit('Expected 32 native frames')
images = [Image.open(io.BytesIO(base64.b64decode(frame.split(',', 1)[1]))).convert('RGB') for frame in frames]
destination = Path(__file__).resolve().parents[1] / 'docs/v1.1/qa/sprite-final'
destination.mkdir(parents=True, exist_ok=True)
images[0].save(destination / f'{label}.png')
images[0].save(destination / f'{label}.webp', save_all=True, append_images=images[1:], duration=100, loop=0, lossless=True, method=1)
print(f'QA capture: {destination / (label + ".webp")} (32 frames / 3.2 seconds, lossless)')
