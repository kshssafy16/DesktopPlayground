"""Assemble the supplied baby harp seal art into an independent pet package.

Reads only incoming/baby_harp_seal and writes only deliverables/baby_harp_seal_ready
and its ZIP. It does not register the pet or alter existing sprite sheets.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt, find_objects, label


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "incoming" / "baby_harp_seal" / "baby_harp_seal_sheet.png"
OUTPUT = ROOT / "deliverables" / "baby_harp_seal_ready"
ZIP_PATH = ROOT / "deliverables" / "DesktopPlayground-baby-harp-seal-ready.zip"
ID = "baby_harp_seal"
CELL_W, CELL_H = 192, 208
FOOT_Y = 192
SOURCE_ROW_BANDS = [(70, 205), (205, 330), (330, 500), (500, 665),
                    (665, 800), (800, 960), (960, 1100)]
DEST_ROWS = [0, 1, 3, 4, 5, 6, 7]
SOURCE_ROW_FEET = [171, 310, 475, 641, 786, 935, 1086]


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def extract_frames() -> list[list[tuple[Image.Image, int]]]:
    with Image.open(SOURCE) as src:
        rgba = np.array(src.convert("RGBA"))
    if rgba.shape != (1385, 1136, 4):
        raise ValueError(f"Unexpected source geometry: {rgba.shape}")
    alpha = rgba[:, :, 3]
    if np.count_nonzero(alpha == 0) < alpha.size // 3:
        raise ValueError("Source does not have a substantially transparent background")

    # At alpha >= 128 the 56 drawn seals are separate components. The sparse
    # white flecks and loosely connected fringe are excluded from the art.
    cores, component_count = label(alpha >= 128)
    component_sizes = np.bincount(cores.ravel())
    objects = find_objects(cores)
    primary = [i for i in range(1, component_count + 1) if component_sizes[i] > 2500]
    if len(primary) != 56:
        raise ValueError(f"Expected 56 authored figures, found {len(primary)}")
    retained = np.where(np.isin(cores, primary), cores, 0)
    distance, nearest = distance_transform_edt(retained == 0, return_indices=True)
    nearest_label = retained[tuple(nearest)]

    rows: list[list[tuple[int, Image.Image, int]]] = [[] for _ in SOURCE_ROW_BANDS]
    for index in primary:
        ys, xs = objects[index - 1]
        cx, cy = (xs.start + xs.stop) / 2, (ys.start + ys.stop) / 2
        source_row = next((r for r, (lo, hi) in enumerate(SOURCE_ROW_BANDS)
                           if lo <= cy < hi), None)
        if source_row is None:
            raise ValueError(f"Figure outside row bands: {index}")
        source_col = min(7, int(cx // 142))
        x0, y0 = max(0, xs.start - 4), max(0, ys.start - 4)
        x1, y1 = min(rgba.shape[1], xs.stop + 4), min(rgba.shape[0], ys.stop + 4)
        pixels = rgba[y0:y1, x0:x1].copy()
        keep = (nearest_label[y0:y1, x0:x1] == index) & (distance[y0:y1, x0:x1] <= 3)
        pixels[:, :, 3] = np.where(keep & (pixels[:, :, 3] >= 16), pixels[:, :, 3], 0)
        pixels[pixels[:, :, 3] == 0, :3] = 0
        yy, xx = np.where(pixels[:, :, 3] > 16)
        if len(xx) < 2500:
            raise ValueError(f"Figure vanished during extraction: {index}")
        image = Image.fromarray(pixels[yy.min():yy.max() + 1, xx.min():xx.max() + 1], "RGBA")
        source_bottom = y0 + int(yy.max()) + 1
        rows[source_row].append((source_col, image, source_bottom))

    output = []
    for row_index, entries in enumerate(rows):
        entries.sort(key=lambda entry: entry[0])
        if [col for col, _, _ in entries] != list(range(8)):
            raise ValueError(f"Source row {row_index} lacks one figure per column: {entries}")
        output.append([(frame, bottom) for _, frame, bottom in entries])
    return output


def make_profile() -> dict:
    def clip(row: int, frames: list[int], ms: int, loop: bool) -> dict:
        return {"row": row, "frames": frames, "frameMs": ms, "loop": loop,
                "center": 0.5, "foot": FOOT_Y / CELL_H, "scale": 1}

    clips = {
        "idle": clip(0, [7, 0, 1, 2, 3, 4, 5, 6], 125, True),
        "walkRight": clip(1, list(range(8)), 110, True),
        "walkLeft": {**clip(1, list(range(8)), 110, True),
                     "flip": True, "mirrorOf": "walkRight"},
        "jump": clip(3, [0, 1, 2], 85, False),
        "fall": clip(3, [3, 4], 100, False),
        "land": clip(3, [5, 6, 7], 43, False),
        "grabStart": clip(4, [0, 1], 60, False),
        "drag": clip(4, [2, 3, 4], 200, True),
        "release": clip(4, [5, 6, 7], 40, False),
        "rest": clip(5, [0, 1], 350, True),
        "sleep": clip(5, [2], 1000, False),
        "wake": clip(5, [4, 5, 6, 7], 45, False),
        "hit": clip(6, [0, 1, 2], 60, False),
        "stunned": clip(6, [4], 1000, False),
        "look": clip(7, list(range(8)), 180, True),
    }
    return {"rows": 9, "origin": "feet", "elasticity": 0.55,
            "sleeping": False, "clips": clips,
            "fallback": {"sleep": "rest", "look": "idle", "rest": "idle",
                         "jump": "fall", "fall": "idle", "walkRight": "idle",
                         "walkLeft": "idle", "climb": "idle", "drag": "idle"}}


def place(frame: Image.Image, source_bottom: int, source_row: int) -> Image.Image:
    scale = min(1.13, 174 / frame.width, 168 / frame.height)
    width, height = round(frame.width * scale), round(frame.height * scale)
    resized = frame.resize((width, height), Image.Resampling.LANCZOS)
    cell = Image.new("RGBA", (CELL_W, CELL_H))
    # Keep authored bounce and air height only for movement. Grounded poses
    # (especially the low sleeping silhouette) share the same contact line.
    lifted = (round((SOURCE_ROW_FEET[source_row] - source_bottom) * scale)
              if source_row in (1, 2) else 0)
    left, top = round((CELL_W - width) / 2), FOOT_Y - lifted - height
    if left < 8 or top < 8 or left + width > CELL_W - 8 or top + height > CELL_H - 8:
        raise ValueError(f"Figure exceeds cell safety margin: row {source_row}, {(left, top, width, height)}")
    cell.alpha_composite(resized, (left, top))
    return cell


def validate_sheet(sheet: Image.Image, profile: dict) -> tuple[int, int]:
    used = {(c["row"], col) for c in profile["clips"].values()
            if not c.get("mirrorOf") for col in c["frames"]}
    minimum_margin = 999
    for row, col in used:
        tile = sheet.crop((col * CELL_W, row * CELL_H,
                           (col + 1) * CELL_W, (row + 1) * CELL_H))
        yy, xx = np.where(np.asarray(tile.getchannel("A")) > 16)
        if len(xx) < 2500:
            raise ValueError(f"Empty or damaged used cell {row}:{col}")
        margin = min(xx.min(), yy.min(), CELL_W - 1 - xx.max(), CELL_H - 1 - yy.max())
        minimum_margin = min(minimum_margin, int(margin))
        if margin < 8:
            raise ValueError(f"Cell {row}:{col} margin {margin}px")
    return len(used), minimum_margin


def write_gif(sheet: Image.Image, profile: dict, path: Path) -> None:
    states = ["idle", "walkRight", "walkLeft", "jump", "fall", "land",
              "grabStart", "drag", "release", "rest", "sleep", "wake",
              "hit", "stunned", "look"]
    frames, durations = [], []
    for state in states:
        clip = profile["clips"][state]
        for col in clip["frames"]:
            tile = sheet.crop((col * CELL_W, clip["row"] * CELL_H,
                               (col + 1) * CELL_W, (clip["row"] + 1) * CELL_H))
            if clip.get("flip"):
                tile = tile.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            canvas = Image.new("RGBA", (288, 264), (35, 40, 49, 255))
            canvas.alpha_composite(tile, (48, 36))
            ImageDraw.Draw(canvas).text((12, 12), state, fill="white")
            frames.append(canvas.convert("RGB"))
            durations.append(round(clip["frameMs"] / 10) * 10)
    frames[0].save(path, format="GIF", save_all=True, append_images=frames[1:],
                   duration=durations, loop=0, optimize=True)


def main() -> None:
    if not SOURCE.is_file():
        raise FileNotFoundError(SOURCE)
    source_rows = extract_frames()
    profile = make_profile()
    sheet = Image.new("RGBA", (1536, 1872))
    for source_row, frames in enumerate(source_rows):
        for col, (frame, bottom) in enumerate(frames):
            sheet.alpha_composite(place(frame, bottom, source_row),
                                  (col * CELL_W, DEST_ROWS[source_row] * CELL_H))
    used, margin = validate_sheet(sheet, profile)

    asset_dir = OUTPUT / "assets" / "pets" / ID
    animation_dir = OUTPUT / "animation"
    preview_dir = OUTPUT / "preview"
    docs_dir = OUTPUT / "docs"
    for path in (asset_dir, animation_dir, preview_dir, docs_dir):
        path.mkdir(parents=True, exist_ok=True)
    webp = asset_dir / "spritesheet.webp"
    sheet.save(webp, format="WEBP", lossless=True, method=6, exact=True)
    if webp.stat().st_size > 10 * 1024 * 1024:
        raise ValueError("WebP exceeds the existing loader's 10 MB limit")
    pet_json = asset_dir / "pet.json"
    pet_json.write_text(json.dumps({"id": ID, "displayName": "아기 하프물범",
                                    "spritesheetPath": "spritesheet.webp"},
                                   ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    profile_json = animation_dir / f"{ID}.profile.json"
    profile_json.write_text(json.dumps(profile, ensure_ascii=False, indent=2) + "\n",
                            encoding="utf-8")
    preview_png = preview_dir / f"{ID}_sheet.png"
    preview_gif = preview_dir / f"{ID}_states.gif"
    sheet.save(preview_png)
    write_gif(sheet, profile, preview_gif)

    mapping = [
        "# 아기 하프물범 프레임 매핑", "",
        "행·열은 0부터 센다. 1536×1872 투명 WebP, 8열×9행, 셀 192×208.",
        "이 ZIP은 독립 조립본이다. 앱 카탈로그에는 등록하지 않았다.", "",
        "## 입력과 조립", "",
        f"- 입력: `incoming/baby_harp_seal/baby_harp_seal_sheet.png` (SHA-256 `{sha256(SOURCE)}`), 1136×1385 RGBA.",
        "- 원화에서 실제로 그려진 7행×8열, 56개 실루엣을 추출했다. 알파 128 이상 본체를 기준으로 3px 이내의 반투명 테두리만 유지하고, 주변에 분리된 흰색 잡픽셀을 제거했다.",
        "- 모든 프레임은 비율을 유지해 축소 또는 확대하고 x 중심 96, 접지선 y 192에 배치했다. 지상 자세의 배/지느러미 접점을 맞추고, 원화의 보행 바운스와 점프 높이 차이는 유지했다.",
        "- 2·8행은 투명 예약 행. 5행 3열과 6행 3·5–7열은 원화에 존재하지만 현재 클립에서 참조하지 않는다. 새 프레임을 복제하거나 그려 넣지 않았다.",
        "- WalkLeft는 WalkRight 원화를 좌우 반전한다. `drag`는 앱의 잡힌 상태(Held)이며 `sleep`과 `stunned`는 첫 포즈를 유지한다.", "",
        "- Idle은 실제 8장을 7→0→1→2→3→4→5→6열 순서로 125ms씩 반복한다. 가만히 있을 때 한 바퀴가 1000ms 이내에 끝나며, Walk 종료 직후에는 보행의 평균 몸 크기에 가까운 7열부터 시작한다.", "",
        "## 상태 매핑", "", "| 상태 | 대상 행 | 열 | 원화 행 | 재생 |",
        "| --- | ---: | --- | ---: | --- |",
    ]
    source_for_dest = dict(zip(DEST_ROWS, range(7)))
    for name, clip in profile["clips"].items():
        mode = "좌우 반전 반복" if clip.get("flip") else ("반복" if clip["loop"] else "1회/자세 유지")
        if name in ("sleep", "stunned"):
            mode = "자세 유지"
        mapping.append(f"| {name} | {clip['row']} | {','.join(map(str, clip['frames']))} | "
                       f"{source_for_dest[clip['row']]} | {mode} |")
    mapping += ["", "## 검증 및 앱 통합 전 확인", "",
                f"- 클립이 참조하는 비반전 고유 셀 {used}개 모두 비어 있지 않고, 최소 상하좌우 여백 {margin}px.",
                "- GIF는 시트의 셀 순서와 프레임 시간, WalkLeft 반전을 보여 준다. 앱 물리와 입력은 재현하지 않는다.",
                "- 원화의 보조 효과는 본체에 붙은 것만 남겼다. 별·땀·z 등 분리된 작은 입자는 원화의 배경 잡픽셀과 안정적으로 구별되지 않아 패키지에 포함하지 않았다.",
                "- 실제 앱에서 보행·접지, Jump→Fall→Land, GrabStart→Held→Release, Rest→Sleep→Wake, Hit→Stunned 전환을 최종 확인한다.",
                "- 앱 담당자는 `local-pets.js` ID 목록, 앱 프로필 카탈로그와 브라우저 사본을 별도 작업에서 연결해야 한다.", ""]
    mapping_path = docs_dir / "FRAME_MAPPING.md"
    mapping_path.write_text("\n".join(mapping), encoding="utf-8")

    files = [webp, pet_json, profile_json, preview_png, preview_gif, mapping_path]
    with ZipFile(ZIP_PATH, "w", compression=ZIP_DEFLATED, compresslevel=6) as archive:
        for path in files:
            archive.write(path, path.relative_to(OUTPUT).as_posix())
    with ZipFile(ZIP_PATH) as archive:
        if archive.testzip() is not None:
            raise ValueError("ZIP integrity check failed")
        for path in files:
            if archive.read(path.relative_to(OUTPUT).as_posix()) != path.read_bytes():
                raise ValueError(f"ZIP member mismatch: {path}")
    print(f"PASS: 56 source figures; {used} referenced unique cells; margin >= {margin}px")
    print(f"ZIP: {ZIP_PATH} ({ZIP_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
