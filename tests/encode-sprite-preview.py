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
if label not in ('before', 'after', 'animation'):
    raise SystemExit('Expected before, after or animation')
animation = label == 'animation'
frame_file = 'desktopplayground-animation-qa-frames.json' if animation else 'desktopplayground-sprite-qa-frames.json'
frames = json.loads((Path(os.environ['TEMP']) / frame_file).read_text(encoding='utf-8'))
expected_frames = 51 if animation else 32
if len(frames) != expected_frames:
    raise SystemExit(f'Expected {expected_frames} native frames')
images = [Image.open(io.BytesIO(base64.b64decode(frame.split(',', 1)[1]))).convert('RGB') for frame in frames]
destination = Path(__file__).resolve().parents[1] / 'docs/v1.1/qa' / ('animation-integration' if animation else 'sprite-final')
destination.mkdir(parents=True, exist_ok=True)
output = 'runtime-preview' if animation else label
if not animation:
    images[0].save(destination / f'{output}.png')
duration = 80 if animation else 100
images[0].save(destination / f'{output}.webp', save_all=True, append_images=images[1:], duration=duration, loop=0, lossless=True, method=1)
if animation:
    (destination / 'runtime-preview.html').write_text('<!doctype html><meta charset="utf-8"><title>Electron animation integration QA</title><p>Native Pet.draw; scripted visual inputs, 9 pets, 17 phases, 80ms samples. Physics and Windows mouse feel require separate QA.</p><img src="runtime-preview.webp" alt="Nine pets transition through platform states">', encoding='utf-8')
print(f'QA capture: {destination / (output + ".webp")} ({len(frames)} frames / {len(frames)*duration/1000:g} seconds, lossless)')
