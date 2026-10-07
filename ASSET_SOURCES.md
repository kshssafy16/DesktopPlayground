# 자산 출처 및 재배포 상태

현재 `D:\DesktopPet` v1.0.0 소스와 `package.json`의 package allowlist를 기준으로 한 기록입니다. 출처 기록은 재배포 허가가 아닙니다.

| 자산 | 현재 위치 | 확인된 출처 | 공개 재배포 상태 |
| --- | --- | --- | --- |
| 기본 Cat 스프라이트 | `spritesheet.webp` | 프로젝트에 기존 제공된 이미지 | 별도 권리 문서 없음, 확인 필요 |
| Magpie 스프라이트 | `spritesheet_2.webp` | 프로젝트에 기존 제공된 이미지. 현재 Pet 팝업에는 표시하지 않지만 runtime 코드가 참조 | 별도 권리 문서 없음, 확인 필요 |
| 앱 아이콘 | `assets/icon.png`, `electron-build/icon.png`, `electron-build/icon.ico` | 프로젝트에 있던 아이콘. 원저작자·라이선스 기록 없음 | 확인 필요 |
| 고양이 Brown / Face / Sleepy / Salary | `assets/pets/cat_brown`, `cat_face`, `cat_sleepy`, `salary-cat` | 로컬 Codex Pet package의 `pet.json`과 `spritesheet.webp` 복사본 | license 파일 없음, 확인 필요 |
| 강아지 시바 / 푸들 | `assets/pets/doge`, `puddle` | 로컬 Codex Pet package의 `pet.json`과 `spritesheet.webp` 복사본 | license 파일 없음, 확인 필요 |
| 캐릭터 우사기 / 커비 / 커비(잠) | `assets/pets/usagi`, `kirby`, `kirby_sleepy` | 로컬 Codex Pet package의 `pet.json`과 `spritesheet.webp` 복사본 | **local/personal use** 범위로 취급. Kirby 등 제3자 IP의 **redistribution rights not verified** |
| 기본 계열 Pet, 효과, 구조물, 툴바 SVG, Tray 아이콘 | `renderer.js`, `controls.html`, `main.js`의 Canvas/SVG 코드 | 프로젝트 소스에서 생성 | 별도 이미지 자산 없음 |

로컬 Pet package에는 공개 재배포를 허가하는 문서가 확인되지 않았습니다. 특히 Kirby 계열과 다른 캐릭터 자산은 개인 사용 가능 여부와 별개로 공개 ZIP·EXE 및 GitHub 소스 배포 권리를 확인해야 합니다. 확인 전에는 해당 자산의 공개 재배포가 허가되었다고 표시하지 마세요. `package.json`의 소스코드 라이선스 표기는 Pet 이미지·아이콘 권리를 보증하지 않습니다.
