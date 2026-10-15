# v1.2 애니메이션 프로필 제작 규격과 9종 점검

2026-10-15 기준. 기준 파일은 `animation/profiles.v1.json`, `animation/pet-animation.cjs`, `assets/pets/*/{pet.json,spritesheet.webp}`이며, 과거 인벤토리의 오래된 표보다 현재 JSON을 우선한다. 이번 점검은 원본 시트 열람, 프로필의 행/열 대조, 선택 셀의 알파 영역 및 기존 단위 테스트에 한정한다. 실제 앱에서 전환 장면을 재촬영한 판정은 아니다.

신규 대상은 후속 사용자 요청으로 7종으로 확장했다. 최신 상태별 설계·포즈·시트 배치·제작 우선순위는 [공개용 동물팩 설계](PUBLIC_ANIMAL_PACK_DESIGN.md), 기계 검증 가능한 제작 초안은 `animation/drafts/public-animals.v1.draft.json`을 기준으로 한다. 아래 9종 점검은 유지하며, 하단의 5종 브리프는 최초 검토 기록이다.
콜덕 `call_duck`은 별도 `deliverables/DesktopPlayground-call-duck-ready.zip`으로 조립되었으며 실제 프레임은 해당 ZIP의 `docs/FRAME_MAPPING.md`를 우선한다.
아기 하프물범 `baby_harp_seal`도 별도 `deliverables/DesktopPlayground-baby-harp-seal-ready.zip`으로 조립되었으며 실제 프레임은 해당 ZIP의 `docs/FRAME_MAPPING.md`를 우선한다.
아기 펭귄 `baby_penguin`도 별도 `deliverables/DesktopPlayground-baby-penguin-ready.zip`으로 조립되었으며 실제 프레임은 해당 ZIP의 `docs/FRAME_MAPPING.md`를 우선한다.

## 9종 현황

행/열은 모두 0부터 센다. `J/F`는 jump/fall, `G/H`는 grabStart/held, `R/S`는 rest/sleep이다. land·release·wake는 각 펫의 idle을 1회 재생한다. hit는 현재 held와 같은 drag 행을 1회 재생한다. look이 없는 `kirby`는 idle로 대체한다.

| 펫 ID | 크기 | idle / 좌·우 걷기 | J/F | G/H | R/S | 점검 및 남은 시각적 위험 |
| --- | --- | --- | --- | --- | --- | --- |
| `cat_brown` | 1536×2288 | 0 / 오른쪽 1, 왼쪽은 1 반전 | 4/4 | 5/5 | 7/5 | 원본 왼쪽 행 일부 그림 분리 때문에 반전 사용. 수면은 5행 3·4열의 차분한 자세. |
| `cat_face` | 1536×2288 | 0 / 좌우 9행, 왼쪽 반전 | 6/6 | 5/5 | 8/8 | 8행 2·3열의 안경·손가락 그림은 휴식/수면에서 제외. 5행의 눈물 표정은 잡기/피격 전용. 얼굴형이라 `origin:center`. |
| `cat_sleepy` | 1536×1872 | 0 / 2·1행 | 4/4 | 5/5 | 6/0 | 기본 자세부터 잠든 고양이. sleep 첫 셀 고정. |
| `doge` | 1536×1872 | 0 / 2·1행 | 4/4 | 5/5 | 0/0 | 5행 울음은 수면에서 제외. sleep은 0행 3열. |
| `puddle` | 1536×2288 | 0 / 2·1행 | 4/4 | 5/5 | 7/5 | 걷기 시 원본 소품까지 포함된 넓은 실루엣과 1.1배 스케일을 보존. 새 소품 추가 금지. sleep은 5행 4열. |
| `salary-cat` | 1536×1872 | 8 / 2·1행 | 4/4 | 5/5 | 8/0 | 원본 보행 행에 몸통 분리/배경 찌꺼기가 있다. 현재 채택된 0–6열 전 셀 매핑을 보존하고 재수정은 별도 비교 QA 후 결정. Sleep은 0행 0열의 눈 감고 기대어 있는 자세이며 원화 바닥 y=188에 접지. |
| `kirby` | 1536×1872 | 0 / 2·1행 | 4/4 | 5/5 | 6/6 | look 전용 클립 없음(정상 fallback). sleep은 6행 3열. |
| `kirby_sleepy` | 1536×1872 | 0 / 2·1행 | 4/4 | 5/5 | 5/5 | 수면 모자 원본 유지. sleep은 5행의 차분한 세 셀 중 첫 셀을 유지. |
| `usagi` | 1536×1872 | 0 / 2·1행 | 4/4 | 5/5 | 0/0 | 5행의 울음/당황은 held·hit 전용. 0행 3열 수면, jump/fall의 기존 1.25배 스케일과 발 보정 유지. |

9개 모두 8열·192×208 셀이며 원본 행 수는 9 또는 11이다. 현재 선택된 비반전 클립 셀의 알파 영역 검사에서 빈 셀은 0개였다. 이 수치는 표정 적합성이나 움직임의 자연스러움을 자동으로 보증하지 않는다. `GRAB_REGRESSION.md`의 일부 옛 수면 표는 이후 변경된 현재 프로필과 다르다.

look 행은 순서대로 `cat_brown` 9, `cat_face` 8, `cat_sleepy` 8, `doge` 8, `puddle` 9, `salary-cat` 8, `kirby` idle 대체, `kirby_sleepy` 6, `usagi` 7이다. 현재 9종은 모두 jump와 fall에 같은 원본 행을 재사용하며, hit와 held에도 같은 drag 행을 쓴다. 상태별 재생 방식은 다르지만 그림 자체를 구분하려면 승인된 새 프레임과 별도 QA가 필요하다. 특히 `salary-cat`의 상승/낙하 선택은 4행 2열 단일 자세다.

## 신규 패키지 계약

- `assets/pets/<id>/pet.json`은 기존과 같이 `id`, `displayName`, `spritesheetPath`를 제공한다. ID는 디렉터리와 일치시키고 기존 ID와 겹치지 않게 한다. 공개 배포 권리는 `ASSET_SOURCES.md`와 별도로 확인한다.
- 원본 시트는 투명 WebP, 8열, 셀 192×208, 전체 폭 1536px. 각 셀은 내용이 셀 경계를 넘지 않아야 한다. 현재 로더는 높이 1872 또는 2288px와 10MB 미만만 수용한다. 신규 제작은 우선 9행 또는 11행 중 하나를 선택하고, 행 수를 프로필의 `rows`에 기록한다. 다른 레이아웃은 앱 담당 변경이 먼저 필요하다.
- 프로필 한 개의 구조는 `animation/profile-authoring.schema.json`으로 검증한다. 실제 배치 시 `animation/profiles.v1.json`의 `profiles[id]`에 추가한다. `origin`은 발이 있는 동물은 `feet`, 얼굴 중심형만 `center`; `elasticity`, `sleeping`, `clips`, `fallback`도 명시한다. 원본 파일을 덮어쓰지 않고 버전과 출처를 보존한다.
- 각 클립은 `row`, 0–7의 `frames`, 양수 `frameMs`를 갖는다. 기준점은 `center`·`foot`(발 기준) 또는 `centerY`(중심 기준), 예외 프레임은 `frameAdjustments`로 표현한다. 좌우가 진짜 대칭일 때만 `mirrorOf`와 `flip`을 사용한다. `scale`/크롭으로 잘린 프레임을 억지 복구하지 않는다.
- 우선 제작할 시각 클립: `idle`, `walkRight`, `walkLeft`, `jump`, `fall`, `drag`(held), `grabStart`, `rest`, `sleep`, `look`. 가능하면 `land`, `release`, `wake`, `hit`, `thrown`도 독립 그림으로 만든다. 없는 이벤트는 현재 런타임의 안전한 fallback을 사용하며 별도 그림이 있는 것처럼 표시하지 않는다. `hit`와 `held`가 같은 그림이어도 이벤트 재생 방식은 다르다.
- 반복: idle/걷기/look/rest/held. 1회: grabStart/jump rise/land/release/hit/wake. 자세 유지: sleep/jump apex/fall/thrown/stunned. `fall` 시퀀스를 1회 진행할 필요가 있으면 `loop:false`를 지정한다. 수면은 평온한 표정만 사용하며 울음·놀람·피격 그림과 섞지 않는다.
- 전환 QA: 모든 프레임의 발 또는 중심 anchor를 같은 화면 좌표에 놓고 보간 없이 전환해 비교한다. 좌우 실루엣 크기와 발 높이, 보행 루프 마지막→첫 프레임, 점프 상승→정점→낙하→착지, 잡기 시작→잡힌 상태→놓기를 확인한다. 잘림, 빈 셀, 배경 잔여물, 갑작스러운 신체 크기 변화가 있으면 프레임을 임의 보정하기 전에 원본과 매핑을 재검토한다.

## 신규 5종 제작 브리프

| 예정 캐릭터 | 제작 때 확인할 특징 | 필요한 원자료 |
| --- | --- | --- |
| 말티즈 | 흰 털 윤곽이 투명 배경에서 끊기지 않도록 하고 발 접지점 고정 | 사용 허가된 원본/디자인, 정면·좌우 기준 포즈 |
| 포메라니안 | 풍성한 털과 꼬리가 셀 경계를 넘지 않으며 보행 때 몸통 크기 일정 | 사용 허가된 원본/디자인, 털·꼬리 기준 실루엣 |
| 웰시코기 | 짧은 다리의 발 높이와 긴 몸통이 좌우 전환에서도 일정 | 사용 허가된 원본/디자인, 좌우 보행 기준 포즈 |
| 오리 | 날개·부리 방향, 두 발의 접지, 점프/낙하 실루엣 구분 | 사용 허가된 원본/디자인, 좌우 방향 기준 포즈 |
| 하프물범 | 지느러미를 발 anchor처럼 취급할지 중심 anchor를 쓸지 시트로 결정 | 사용 허가된 원본/디자인, 지상 이동·휴식 기준 포즈 |

제작 전 각 캐릭터의 이름/ID, 권리·공개 범위, 스타일 가이드, 원본/참고 이미지, 기준 크기와 배경 투명도, 좌우 방향 포즈, 수면 및 피격 감정 기준이 필요하다. 이 자료가 들어온 뒤 실제 셀 행/열과 anchor를 확정한다. 최초 설계 단계에서는 이미지나 임시 프레임을 만들지 않았으며, 이후 제공된 원화로 콜덕·아기 하프물범·아기 펭귄을 각각 독립 패키지로 조립했다.
