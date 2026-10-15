"""Assemble the supplied call duck art; requires Pillow, NumPy and SciPy.

Only reads incoming/call_duck. Outputs a standalone package in deliverables/.
It does not register a pet or modify the nine existing profiles.
"""

from __future__ import annotations

import hashlib
import io
import json
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

import numpy as np
from PIL import Image, ImageDraw
from scipy.ndimage import distance_transform_edt, find_objects, label


ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / "incoming" / "call_duck"
OUTPUT = ROOT / "deliverables" / "call_duck_ready"
ZIP_PATH = ROOT / "deliverables" / "DesktopPlayground-call-duck-ready.zip"
OLD_ZIP = INPUT / "DesktopPlayground-call-duck.zip"
IDLE_PNG = INPUT / "call_duck_idle.png"
WALK_PNG = INPUT / "call_duck_walk_right.png"
CELL_W, CELL_H = 192, 208
FOOT_Y = 192


def digest(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def split_authored_frames(path: Path, layout: str) -> list[Image.Image]:
    with Image.open(path) as src:
        image = np.asarray(src.convert("RGBA"))
    if image.shape[:2] != (887, 1774):
        raise ValueError(f"Unexpected source size: {path.name}: {image.shape[:2]}")
    if int(np.count_nonzero(image[:, :, 3] == 0)) < image.shape[0] * image.shape[1] // 3:
        raise ValueError(f"Source lacks transparent background: {path.name}")

    # Idle is a 4x2 layout. Walk is eight connected silhouettes in one strip,
    # crossing the nominal 4x2 and regular 8x1 grid lines by several pixels.
    # Segment the real alpha components, preserving their antialiased fringe.
    alpha = image[:, :, 3]
    components, count = label(alpha > 16)
    objects = find_objects(components)
    sizes = np.bincount(components.ravel())
    primary = [index for index in range(1, count + 1) if sizes[index] > 10000]
    if len(primary) != 8:
        raise ValueError(f"Expected eight authored silhouettes in {path.name}; got {len(primary)}")
    if any(objects[index - 1] is None for index in primary):
        raise ValueError("Missing source silhouette")
    if layout == "idle":
        primary.sort(key=lambda index: (objects[index - 1][0].start >= 444,
                                        objects[index - 1][1].start))
        if sum(objects[index - 1][0].start < 444 for index in primary) != 4:
            raise ValueError("Idle does not contain four figures per row")
    else:
        primary.sort(key=lambda index: objects[index - 1][1].start)
        if any(not 330 <= objects[index - 1][0].start <= 370 for index in primary):
            raise ValueError("Walk frames are not in the expected horizontal strip")

    labels = np.where(np.isin(components, primary), components, 0)
    distance, nearest_indices = distance_transform_edt(labels == 0, return_indices=True)
    nearest_label = labels[tuple(nearest_indices)]
    frames = []
    for index in primary:
        ys, xs = objects[index - 1]
        x0, y0 = max(0, xs.start - 5), max(0, ys.start - 5)
        x1, y1 = min(image.shape[1], xs.stop + 5), min(image.shape[0], ys.stop + 5)
        pixels = image[y0:y1, x0:x1].copy()
        belongs = (nearest_label[y0:y1, x0:x1] == index) & (distance[y0:y1, x0:x1] <= 4)
        pixels[:, :, 3] = np.where(belongs, pixels[:, :, 3], 0)
        pixels[pixels[:, :, 3] == 0, :3] = 0
        mask = pixels[:, :, 3] > 16
        yy, xx = np.where(mask)
        if len(xx) < 10000:
            raise ValueError(f"Source figure vanished while separating {path.name}: {index}")
        pixels = pixels[yy.min(): yy.max() + 1, xx.min(): xx.max() + 1]
        frames.append(Image.fromarray(pixels, "RGBA"))
    return frames


def place_frame(frame: Image.Image) -> Image.Image:
    scale = min(174 / frame.width, 168 / frame.height)
    width, height = round(frame.width * scale), round(frame.height * scale)
    scaled = frame.resize((width, height), Image.Resampling.LANCZOS)
    cell = Image.new("RGBA", (CELL_W, CELL_H), (0, 0, 0, 0))
    cell.paste(scaled, (round((CELL_W - width) / 2), FOOT_Y - height))
    return cell


def validate_cells(sheet: Image.Image, profile: dict) -> tuple[int, int]:
    count = 0
    smallest_margin = CELL_W
    for name, clip in profile["clips"].items():
        if clip.get("mirrorOf"):
            continue
        if not 0 <= clip["row"] < profile["rows"]:
            raise ValueError(f"Invalid row: {name}")
        for col in clip["frames"]:
            if not 0 <= col < 8:
                raise ValueError(f"Invalid column: {name}/{col}")
            tile = sheet.crop((col * CELL_W, clip["row"] * CELL_H,
                               (col + 1) * CELL_W, (clip["row"] + 1) * CELL_H))
            alpha = np.asarray(tile.getchannel("A")) > 16
            if not alpha.any():
                raise ValueError(f"Empty used cell: {name}/{col}")
            if alpha[0].any() or alpha[-1].any() or alpha[:, 0].any() or alpha[:, -1].any():
                raise ValueError(f"Character touches cell edge: {name}/{col}")
            yy, xx = np.where(alpha)
            smallest_margin = min(smallest_margin, int(xx.min()), int(CELL_W - 1 - xx.max()))
            count += 1
    return count, smallest_margin


def write_gif(sheet: Image.Image, profile: dict, path: Path) -> None:
    # The preview follows selected clip frames and timing; app physics is not simulated.
    states = [("Idle", "idle", False), ("WalkRight", "walkRight", False),
              ("WalkLeft", "walkRight", True), ("Jump", "jump", False),
              ("Fall", "fall", False), ("Land", "land", False),
              ("Rest", "rest", False), ("Sleep", "sleep", False),
              ("GrabStart", "grabStart", False), ("Held", "drag", False),
              ("Release", "release", False), ("Hit", "hit", False)]
    images, durations = [], []
    for label_text, clip_name, flip in states:
        clip = profile["clips"][clip_name]
        for column in clip["frames"]:
            cell = sheet.crop((column * CELL_W, clip["row"] * CELL_H,
                               (column + 1) * CELL_W, (clip["row"] + 1) * CELL_H))
            if flip:
                cell = cell.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
            canvas = Image.new("RGBA", (288, 264), (31, 35, 43, 255))
            canvas.alpha_composite(cell.resize((192, 208)), (48, 30))
            ImageDraw.Draw(canvas).text((10, 8), label_text, fill=(255, 255, 255, 255))
            images.append(canvas.convert("RGB"))
            durations.append(int(round(clip["frameMs"] / 10) * 10))
    images[0].save(path, format="GIF", save_all=True, append_images=images[1:],
                   duration=durations, loop=0, optimize=True)


def main() -> None:
    for path in (OLD_ZIP, IDLE_PNG, WALK_PNG):
        if not path.is_file():
            raise FileNotFoundError(path)
    with ZipFile(OLD_ZIP) as old:
        if old.testzip() is not None:
            raise ValueError("Previous ZIP failed integrity check")
        with Image.open(io.BytesIO(old.read("assets/pets/call_duck/spritesheet.webp"))) as src:
            sheet = src.convert("RGBA")
        profile = json.loads(old.read("animation/call_duck.profile.json"))
    if sheet.size != (1536, 1872):
        raise ValueError(f"Unexpected previous sheet geometry: {sheet.size}")

    # Fully transparent RGB data in the previous WebP may appear colored in
    # image viewers that ignore alpha. Normalize those invisible pixels only.
    old_pixels = np.array(sheet)
    old_pixels[old_pixels[:, :, 3] == 0, :3] = 0
    sheet = Image.fromarray(old_pixels, "RGBA")
    idle = split_authored_frames(IDLE_PNG, "idle")
    walk = split_authored_frames(WALK_PNG, "walk")
    sheet.paste((0, 0, 0, 0), (0, 0, 1536, 416))
    for row, frames in ((0, idle), (1, walk)):
        for column, frame in enumerate(frames):
            sheet.paste(place_frame(frame), (column * CELL_W, row * CELL_H))
    profile["clips"]["idle"]["frames"] = list(range(8))
    profile["clips"]["walkRight"]["frames"] = list(range(8))
    profile["clips"]["walkLeft"]["frames"] = list(range(8))
    profile["clips"]["walkLeft"]["mirrorOf"] = "walkRight"
    profile["clips"]["walkLeft"]["flip"] = True
    # Three authored wake frames must fit the current player's 180 ms event.
    profile["clips"]["wake"]["frameMs"] = 60

    final_pixels = np.array(sheet)
    final_pixels[final_pixels[:, :, 3] == 0, :3] = 0
    sheet = Image.fromarray(final_pixels, "RGBA")

    used, margin = validate_cells(sheet, profile)
    OUTPUT.mkdir(parents=True, exist_ok=True)
    asset_dir = OUTPUT / "assets" / "pets" / "call_duck"
    asset_dir.mkdir(parents=True, exist_ok=True)
    animation_dir = OUTPUT / "animation"
    animation_dir.mkdir(exist_ok=True)
    preview_dir = OUTPUT / "preview"
    preview_dir.mkdir(exist_ok=True)
    docs_dir = OUTPUT / "docs"
    docs_dir.mkdir(exist_ok=True)
    sheet_path = asset_dir / "spritesheet.webp"
    sheet.save(sheet_path, format="WEBP", lossless=True, method=6)
    if sheet_path.stat().st_size > 10 * 1024 * 1024:
        raise ValueError("Output WebP exceeds the current loader's 10 MB limit")
    meta = {"id": "call_duck", "displayName": "콜덕", "spritesheetPath": "spritesheet.webp"}
    (asset_dir / "pet.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (animation_dir / "call_duck.profile.json").write_text(
        json.dumps(profile, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    sheet.save(preview_dir / "call_duck_sheet.png")
    write_gif(sheet, profile, preview_dir / "call_duck_states.gif")

    mapping = [
        "# 콜덕 프레임 매핑", "", "모든 행·열은 0부터 센다. 1536×1872 투명 WebP, 8열×9행, 셀 192×208.",
        "`assets/pets/call_duck/pet.json`은 현재 DesktopPlayground 로더의 최소 필드(id, displayName, spritesheetPath)를 사용한다.",
        "프로필은 `animation/call_duck.profile.json`에 있으며 앱에는 아직 등록하지 않았다.", "",
        "## 출처와 조립", "",
        f"- 새 Idle: `call_duck_idle.png` SHA-256 `{digest(IDLE_PNG)}`. 실제 4×2 배열의 8개 그림을 0행 0–7열에 배치.",
        f"- 새 WalkRight: `call_duck_walk_right.png` SHA-256 `{digest(WALK_PNG)}`. 실제 한 줄의 8개 그림을 알파 연결 영역별로 분리해 1행 0–7열에 배치. 보통 4×2 또는 균등 8분할하면 부리/꼬리가 잘린다.",
        f"- 기존 ZIP: `DesktopPlayground-call-duck.zip` SHA-256 `{digest(OLD_ZIP)}`. 3–7행의 기존 그림과 상태 구성을 재사용.",
        "- 2·8행과 6행 4–7열은 예약 투명 셀. 빈 프레임을 복제하지 않았다.",
        "- 원본의 알파 0 픽셀에 남은 RGB 색상은 표시되지 않는 값이므로 조립 중 0으로 정규화했다. 표시되는 캐릭터 원화는 유지했다.",
        "- 기존 4·6·7행의 작은 노란/파란 모션 선은 실제 알파가 있는 기존 연출이다. 배경 오염으로 지우지 않았다.",
        "- 기존 wake 3장에 맞춰 frameMs 80→60으로 조정해 180ms 이벤트 안에 세 장이 표시되게 했다.",
        "- 새 16장만 셀 중심 x=96·접지선 y=192에 맞춰 비율을 유지한 채 축소했다. 기존 행은 옮기거나 크롭하지 않았다.", "",
        "## 사용 중인 클립", "", "| 클립 | 행 | 열 | 출처 |", "| --- | ---: | --- | --- |",
    ]
    for name, clip in profile["clips"].items():
        source = "새 PNG" if name in ("idle", "walkRight", "walkLeft") else "기존 ZIP"
        cols = ",".join(map(str, clip["frames"]))
        if clip.get("mirrorOf"):
            source += " (WalkRight 반전)"
        mapping.append(f"| {name} | {clip['row']} | {cols} | {source} |")
    mapping += ["", "## 확인 범위", "",
                f"- 참조하는 비반전 셀 {used}개 모두 비어 있지 않고, 셀 가장자리에 알파 픽셀이 닿지 않았다. 최소 좌우 여백 {margin}px.",
                "- GIF는 클립 순서·타이밍·좌우 반전을 보여 주는 미리보기다. 실제 앱 물리/입력은 시뮬레이션하지 않는다.",
                "- 실제 Windows 앱에서 보행 루프, Grab→Held→Release, Jump→Fall→Land, 피부색/외곽선/크기 전환을 최종 확인해야 한다.",
                "- `local-pets.js`의 고정 ID 목록과 앱 프로필 카탈로그·브라우저 사본 연결은 앱 담당 통합 범위다.", ""]
    (docs_dir / "FRAME_MAPPING.md").write_text("\n".join(mapping), encoding="utf-8")

    package_files = [sheet_path, asset_dir / "pet.json", animation_dir / "call_duck.profile.json",
                     preview_dir / "call_duck_sheet.png", preview_dir / "call_duck_states.gif",
                     docs_dir / "FRAME_MAPPING.md"]
    ZIP_PATH.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(ZIP_PATH, "w", compression=ZIP_DEFLATED, compresslevel=6) as archive:
        for path in package_files:
            archive.write(path, path.relative_to(OUTPUT).as_posix())
    with ZipFile(ZIP_PATH) as archive:
        if archive.testzip() is not None:
            raise ValueError("Output ZIP failed integrity check")
        for path in package_files:
            if archive.read(path.relative_to(OUTPUT).as_posix()) != path.read_bytes():
                raise ValueError(f"Output ZIP mismatch: {path}")
    print(f"PASS: {len(idle)} new idle, {len(walk)} new walk, {used} used cells; margin >= {margin}px")
    print(f"ZIP: {ZIP_PATH} ({ZIP_PATH.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
