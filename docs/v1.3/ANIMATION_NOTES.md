# v1.3 펫 애니메이션 인계 메모

현재 기준은 `feature/v1.3`의 `local-pets.js`, `animation/profiles.v1.json`, `animation/pet-animation.cjs`, `renderer.js`다. [v1.2 애니메이션 인계](../v1.2/ANIMATION_HANDOFF.md)와 [프로필 규격](../v1.2/animation/PROFILE_SPEC.md)의 제작 경위를 대체하지 않는다. 행과 열 번호는 **0부터 시작**한다.

## 등록 상태와 자산

- 앱에 등록된 로컬 스프라이트 11종: 기존 `cat_brown`, `cat_face`, `cat_sleepy`, `salary-cat`, `doge`, `puddle`, `kirby`, `kirby_sleepy`, `usagi`와 자체 제작 `call_duck`, `baby_harp_seal`. 모두 `assets/pets/<id>/spritesheet.webp`의 8열·192×208 셀을 사용한다. 시트는 9행(1536×1872) 또는 11행(1536×2288)이며 실제 행 수는 각 프로필의 `rows`와 일치해야 한다. 기존 Cat/Magpie는 `renderer.js`의 별도 레거시 시트/매핑이다.
- `baby_penguin`은 `deliverables/baby_penguin_ready/`에 제작 완료 패키지와 매핑이 있지만 **앱에는 미등록**이다. 닥스훈트·웰시코기·말티즈·포메라니안은 [동물팩 설계 초안](../v1.2/animation/PUBLIC_ANIMAL_PACK_DESIGN.md)과 `animation/drafts/`에 계획만 있다. 완료 원화로 취급하지 않는다.
- 제작 원본은 `incoming/`, 독립 조립본·프로필·`docs/FRAME_MAPPING.md`는 `deliverables/{call_duck_ready,baby_harp_seal_ready,baby_penguin_ready}/`에 있다. 재현용 스크립트는 `animation/assemble_{call_duck,baby_harp_seal,baby_penguin}.py`다. 앱용 프로필은 `animation/profiles.v1.json`, 생성된 브라우저 사본은 `animation/profiles.browser.js`다. 이번 점검에서 원본·스크립트·프로필은 수정하거나 재실행하지 않았다.

## 클립 선택과 빈 셀

- 런타임은 프로필이 있는 펫에 `PlaygroundPetAnimation.resolveClip()`을 사용하고, `Pet.spriteClip()`이 선택 결과를 렌더러에 전달한다. `fallback`은 요청 상태의 클립이 없을 때 다른 상태를 선택한다. 명시된 `frames` 배열의 열 순서가 재생 순서이며 단순히 0열부터 순회한다고 가정하지 않는다.
- `walkRight`와 `walkLeft`가 독립 원화인 펫은 각 클립의 행·열을 검사한다. `mirrorOf: "walkRight"`, `flip: true`인 `walkLeft`는 **오른쪽 원본의 행·열을 좌우 반전**한다. 콜덕과 아기 하프물범은 둘 다 1행 0–7열을 사용한다. 두 WebP의 2행은 의도적으로 비어 있는 예약 행이다. `renderer.js`의 레거시 `sheetClips.walkLeft` 2행은 이 두 펫에 적용되지 않는다.
- 빈 예약 셀은 어떤 유효 클립·fallback도 참조하지 않을 때만 허용한다. 검사는 프로필 구조와 `mirrorOf` 관계, 각 상태의 `resolveClip()` 결과, 실제 `Pet.spriteClip()` 선택, **선택한 원본 셀의 알파 영역**, 좌우 실제 `Pet.draw()` 출력을 함께 확인한다. `tests/smoke.cjs`의 첫 감사는 레거시 2장과 로컬 11장, 5개 상태씩 **13시트·65클립·414프레임 방문**을 센다. 반전 방향의 방문은 새 원화 수가 아니다. 기존 9종의 특수 자세 검사는 별도 9종 범위로 유지하고, 공통 플랫폼 검사는 11종 모두를 확인한다.

## 다음 펫 통합 순서

1. 사용 권리와 원본·완성 패키지 상태를 확인하고 `pet.json` ID, WebP 크기·8열·행 수를 검증한다.
2. [제작 스키마](../../animation/profile-authoring.schema.json)에 맞춰 클립·명시 프레임·anchor·fallback·반전 관계를 검증하고, 선택된 셀의 알파가 실제로 있는지 검사한다.
3. 앱 카탈로그와 `profiles.v1.json`에 등록한 뒤 `node animation/write-browser-profiles.cjs --check`로 사본 일치를 확인한다. 변경이 승인된 경우에만 생성기를 실행한다.
4. `tests/smoke.cjs`와 애니메이션·물리 회귀를 실행하고, Windows GUI에서 좌우 보행, idle 전환, Grab/Held/Release, Jump/Fall/Land, Sleep/Wake 및 크기별 기준점을 관찰한다.

남은 시각 확인: 아기 하프물범 Idle의 시선·몸 방향 교대와 Walk→Idle 정면 전환, 영업냥 Sleep의 실제 앱 접지와 원본 보행 행의 분리/잔여물, 전용 그림이 없는 일부 전환 자세는 사용자 GUI 검수가 필요하다. 자동 알파·기준점 검사는 움직임의 자연스러움을 보증하지 않는다.
