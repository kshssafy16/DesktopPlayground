# 애니메이션 → 앱 작업 인계 (2026-10-15)

## 지금 준비된 계약

- 기존 9종의 원본 WebP와 `pet.json`은 유지했다. `animation/profiles.v1.json`에서는 영업냥의 `sleep`만 0행 0열과 접지점 188/208로 수정했다. 다른 기존 클립은 유지했다. 점검표와 신규 제작 기준은 `docs/v1.2/animation/PROFILE_SPEC.md`, 단일 프로필의 기계 검증 형식은 `animation/profile-authoring.schema.json`에 있다.
- 런타임 상태 선택·재생 규칙은 현재 `animation/pet-animation.cjs`가 담당한다. `grabStart`는 1회, `held`는 반복, `sleep`은 자세 유지한다. `land`·`release`·`wake`는 idle 그림을 1회 사용하고, `hit`는 drag 그림을 1회 사용한다. 별도 클립을 프로필에 넣으면 `resolveClip`이 해당 상태 이름을 우선 선택한다.
- 후속 사용자 요청으로 공개용 신규 후보는 콜덕·아기 하프물범·아기 펭귄·닥스훈트·웰시코기·말티즈·포메라니안 **7종**으로 확장했다. 상세 설계는 `docs/v1.2/animation/PUBLIC_ANIMAL_PACK_DESIGN.md`, 제작용 프로필 초안은 `animation/drafts/public-animals.v1.draft.json`에 있다. 기존 9종 카탈로그·브라우저 사본과 분리되어 있으며, 콜덕·아기 하프물범·아기 펭귄 외 4종의 원화와 측정값은 아직 없다.
- 콜덕은 이후 제공된 Idle·WalkRight PNG 16장과 기존 ZIP의 나머지 상태 원화를 조립했다. ID는 `call_duck`이며 독립 패키지는 `deliverables/DesktopPlayground-call-duck-ready.zip`이다. 실제 프로필과 프레임 출처는 패키지 내부 `animation/call_duck.profile.json`, `docs/FRAME_MAPPING.md`를 기준으로 한다. 위 7종 초안의 원화 미제작 설명은 아직 제작하지 않은 4종에만 적용된다.
- 아기 하프물범은 `incoming/baby_harp_seal/baby_harp_seal_sheet.png`의 실제 그림 56개를 분리해 ID `baby_harp_seal`의 독립 패키지 `deliverables/DesktopPlayground-baby-harp-seal-ready.zip`으로 조립했다. 상태가 참조하는 고유 셀은 51개다. Idle은 7→0→1→2→3→4→5→6열을 125ms씩 재생해 1초에 8장을 모두 보여 준다. 패키지 WebP 원화는 유지했고 프로필·GIF·매핑·ZIP을 갱신했다. 행·열·출처·수면 및 잡기 표현은 ZIP의 `animation/baby_harp_seal.profile.json`과 `docs/FRAME_MAPPING.md`를 우선한다. 앱에는 아직 등록하지 않았다.
- 아기 펭귄은 `incoming/baby_penguin/baby_penguin_sheet.png`의 실제 그림 56개와 피격 행의 별·땀 효과 10개를 분리해 ID `baby_penguin`의 독립 패키지 `deliverables/DesktopPlayground-baby-penguin-ready.zip`으로 조립했다. 상태가 참조하는 고유 셀은 55개다. 실제 행·열과 선택 클립 `react`의 런타임 미연결 상태는 ZIP의 `animation/baby_penguin.profile.json`, `docs/FRAME_MAPPING.md`를 우선한다. 앱에는 아직 등록하지 않았다.

## 향후 앱 통합 때 필요한 변경

이번 두 수정은 앱 개발 worktree에 직접 반영하지 않았다. 앱 담당은 갱신된 `animation/profiles.v1.json`과 생성된 `animation/profiles.browser.js`를 함께 반영하고, 하프물범을 통합했다면 새 ZIP의 `animation/baby_harp_seal.profile.json`으로 교체한다. 현재 공통 플레이어는 Idle 8열을 순서대로 재생한다. **미해결:** 아기 하프물범 Idle에서 시선과 몸 방향이 번갈아 바뀌어 보인다. Walk에서 Idle로 돌아갈 때의 정면 전환도 실제 화면 QA가 필요하다. 승인된 원화/중간 포즈와 앱 상태 전환을 다음 작업에서 함께 검토한다. 이번 백업 작업에서 이미지·프로필·런타임은 추가 수정하지 않았다.

1. 새 패키지 7종의 ID와 `pet.json`, WebP, 승인된 프로필이 준비되면 앱 담당이 `local-pets.js`의 고정 목록/검증 경로와 선택 UI를 확장한다. 현재 등록 목록과 시트 높이 제한 때문에 프로필 파일만 추가해서는 앱에 나타나지 않는다. 기존 `docs/v1.2/ROADMAP.md`는 최초 5종의 실제 에셋/가져오기를 v1.3 준비 항목으로 두고 있으며, 이번 요청은 대상 설계만 7종으로 확장하고 출시 일정을 바꾸지 않는다.
2. 새 프로필을 `profiles.v1.json`에 넣은 뒤 앱 담당과 조율하여 `animation/write-browser-profiles.cjs`로 브라우저 프로필 사본을 갱신한다. 두 사본의 버전과 해시 일치를 확인한다. 저장 위치 `%APPDATA%\\desktop-playground`, 기존 펫 ID, 시작 펫 4종 및 설정 호환성은 유지한다.
3. 독립적인 `hit`·`held`·`release`·`land`·`wake` 그림을 실제 제작할 경우 상태 이벤트가 정확히 발생하는지 앱 입력/물리 쪽에서 확인한다. 현재 공통 플레이어가 이벤트를 받을 수 있어도 앱이 해당 이벤트를 보내지 않으면 클립은 보이지 않는다. 프로필을 바꾸기 전에 이벤트 연결과 전환 순간의 발 anchor·크기·클립 타이밍을 화면에서 QA한다.
4. 영업냥 보행 행에는 분리된 원본 그림과 배경 잔여물이 남아 있다. 현재 채택된 0–6열, 전 셀 매핑을 임의로 바꾸지 말고 과거 QA 프리뷰와 나란히 재확인한 뒤 원본/매핑 중 무엇을 손볼지 별도 결정한다. 얼굴냥의 수면 제외 셀, 도지/우사기의 울음 셀 분리도 유지한다.
5. 신규 초안은 8열·192×208 셀·9행(1536×1872), 가상 접지선 y=192를 제작 목표로 한다. 종별 특징은 보행·idle·look 원화에 담고 물리 값은 공통 초기값으로 둔다. `drag`는 held 그림, `hit`는 별도 놀람 그림이며 land·release·wake도 별도 예약했다. 이벤트 시간은 현재 `ONCE_MS`에 맞췄다. sleep은 첫 셀 유지이므로 수면 호흡 루프는 이번 초안의 기능으로 간주하지 않는다.
6. 펭귄 슬라이딩 선택·실제 물범 바운스·특성 전용 상태는 현재 자동 선택 계약에 없다. 필요할 때 앱 담당이 상태/입력/물리를 검토하며 신규 프로필만으로 구현되었다고 처리하지 않는다. 돌고래·범고래의 유영 및 물튀김 효과는 후순위 메모다. 이번 설계는 효과 코드와 공개 자산을 추가하지 않는다.

이 문서는 앱 작업 요청 사항이다. 이번 애니메이션 작업에서 `renderer.js`, `main.js`, `controls.js`, `local-pets.js`와 앱 개발 worktree는 수정하지 않았다.

## PC 초기화 전 백업 위치와 통합 파일

- 이 인계의 기준 브랜치는 `feature/v1.2-animation`이다. 기존 9종 프로필 변경분은 `animation/profiles.v1.json` 및 `animation/profiles.browser.js`에 있다. 영업냥 Sleep 매핑과 하프물범 Idle의 패키지 프로필은 위 설명을 확인한다. 앱 개발 브랜치로 자동 반영된 것은 없다.
- 신규 펫별 앱 통합 입력은 `deliverables/{call_duck_ready,baby_harp_seal_ready,baby_penguin_ready}/`의 `assets/pets/<id>/spritesheet.webp`, `pet.json`, `animation/<id>.profile.json`, `docs/FRAME_MAPPING.md`다. 같은 폴더의 `preview/`는 육안 QA용이다. 콜덕의 기존 입력 ZIP은 `incoming/call_duck/DesktopPlayground-call-duck.zip`, 새 PNG는 `incoming/call_duck/`에 있다. 다른 두 원본 PNG는 각 `incoming/` 하위 폴더에 있다.
- 조립 재현에 필요한 스크립트는 `animation/assemble_call_duck.py`, `animation/assemble_baby_harp_seal.py`, `animation/assemble_baby_penguin.py`다. 규격은 `animation/profile-authoring.schema.json`, `docs/v1.2/animation/PROFILE_SPEC.md`, `PUBLIC_ANIMAL_PACK_DESIGN.md` 및 `animation/drafts/public-animals.v1.draft.json`을 참조한다.
- 완성 ZIP 3개는 `deliverables/DesktopPlayground-*-ready.zip`에, 콜덕의 이전 입력 ZIP은 `incoming/call_duck/DesktopPlayground-call-duck.zip`에 있다. 네 ZIP 모두 이 백업 커밋에 명시적으로 포함한다. 추후 GitHub Release 첨부 시 저장소의 해당 파일을 그대로 사용하며, 아래 SHA-256으로 복원본을 확인한다.

| ZIP | SHA-256 |
| --- | --- |
| `deliverables/DesktopPlayground-call-duck-ready.zip` | `97DBBA6299DCB7715BFCF7DD79A0E4B95D2066A04D5760F65F5C72899B38D3CD` |
| `deliverables/DesktopPlayground-baby-harp-seal-ready.zip` | `44B0237C1AC44C77BC8AD9DBF940EF9F9789DD0737CCF3377257DC60FCD6A256` |
| `deliverables/DesktopPlayground-baby-penguin-ready.zip` | `5F7CF567984B4DBE187B3D4B6EB18450C3B533BCC25DE8F6B22478BA1CA9E36F` |
| `incoming/call_duck/DesktopPlayground-call-duck.zip` | `3AE0254226E14F6D11E148CED497EF8923C91D33DF4962EFD3CCD888480B7850` |
