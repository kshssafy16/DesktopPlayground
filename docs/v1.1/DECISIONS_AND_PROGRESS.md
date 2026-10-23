# v1.1 결정 기록과 진행 현황

## 2026-10-15 / 애니메이션 작업 트리의 수면·대기 보정

- 영업냥 원본 0행을 확인해 눈을 감고 기대어 있는 0열을 `sleep`으로 선택했다. 원본 WebP와 `idle`·`rest`·보행은 유지하고, 원화 바닥 y=188에 맞춰 수면 접지점을 188/208로 설정했다. `animation/profiles.v1.json`과 브라우저 사본을 함께 갱신했으며 앱 개발 worktree에는 반영하지 않았다.
- 아기 하프물범 독립 패키지의 Idle은 실제 8장을 모두 참조하던 상태였다. 200ms×8장(1.6초)으로 짧은 대기 중 전체 프레임을 보기 어려워 125ms×8장(1초), 7→0→1→2→3→4→5→6열로 조정했다. 시트 원화는 보존했다. 앱 통합 후 옆모습 보행에서 정면 대기로 바뀌는 장면은 수동 QA가 필요하다.
- `node tests/animation-platform.cjs`, `node animation/write-browser-profiles.cjs --check`, 하프물범 플레이어 8프레임 순서 검사, ZIP 무결성, `git diff --check`가 통과했다. 실제 Windows 앱에서 두 전환을 직접 실행하지 않았으며, 보행 임의 프레임에서 정면 Idle로 바뀌는 포즈 차이는 앱 QA로 남긴다.

## 문서 운영 규칙

- 이 파일은 개발 중 발견, 선택, 변경, 완료 상태를 기록하는 살아있는 로그다.
- 사용자가 확정한 요구를 최상위 기준으로 삼는다. 이전 분석 보고서에서 제안한 값은 별도 승인 없이는 확정 요구가 아니다.
- 새로운 사실이나 문제가 발견되면 원인, 대안, 변경 영향, 테스트 결과를 여기에 기록하고 필요한 기획 문서를 업데이트한다.
- 우선 기존 코드의 동작을 확인한다. 기록만 있고 재현되지 않은 버그는 미확인으로 표시한다.
- `docs/history/`는 과거 기록으로 보존한다.

## 2026-10-14 / 배포 전 마지막 수정: 툴바 숨김·창 순서 (현행)

- 펼친 둥근 툴바에 작은 숨김 버튼을 추가하고 기존 `app:hide-controls` IPC를 연결했다. 숨길 때 main 프로세스가 먼저 PC 모드로 전환해 오버레이 입력을 통과시킨 뒤 조작창을 숨긴다. 접기(작은 툴바 유지), 툴바 숨기기(오버레이 유지), Playground 숨기기(조작창 유지)는 독립적이다. 트레이 메뉴의 **툴바 표시**와 기존 아이콘 클릭은 저장된 위치를 화면 안으로 보정해 포커스를 빼앗지 않고 복원한다. 접힌 툴바3버튼과 종료·Tray 복구는 유지한다.
- Win32 창 순서 테스트에서 기존 `floating` 오버레이가 Hide→Show 뒤 일반 창보다 바로 앞에 있어도 native topmost 속성을 잃는 경우를 재현했다. 단순 `moveTop()` 재호출로는 속성이 돌아오지 않았다. 오버레이와 툴바에 안정적인 `pop-up-menu` topmost 레벨을 적용하고 표시/복원/툴바 포커스·숨김/모드·패널 전환 시 오버레이 뒤에 툴바를 다시 놓는다. 오버레이는 `focusable:false`, PC 모드는 기존 `setIgnoreMouseEvents(true)`이며 복원에는 `showInactive()`를 사용한다. 반복 타이머·다른 창 강제 활성화는 없다. 전체 화면 `display.bounds`, userData 및 도구/물리/애니메이션은 변경하지 않았다.
- 최소 검증: `node tests/window-order.cjs`에서 일반/최대화 창, native topmost/입력 대상, 툴바 숨김→PC 통과, Playground와 툴바의 독립 숨김, 트레이 메뉴/아이콘 복원이 통과했다. 변경 JS 구문과 `git diff --check`를 확인했다. 실제 Chrome/탐색기/Codex 포커스 왕복, 좌우 클릭·휠·키보드 전달, 다중 모니터/DPI, F11/관리자·시스템 UI는 사용자 수동 확인 대상으로 남긴다. build/commit/push 없음. 이번 이후 추가 기능은 구현하지 않는다.

## 2026-10-14 / v1.1 배포 전 세 가지 품질 보완 (현행)

- 미폭발 수류탄 조기 소멸 원인은 `ScreenEffects.add`의 공통 FIFO 상한 16개였다. 17번째 투척이 기존 수류탄을 신관 종료 전 삭제했다. 수류탄만 별도 **24개** 상한으로 늘리고 한도에서는 신규 투척을 거절한다. 신관 경과와 제거는 `updateGrenades`가 전담해 약 3초 후 실제 위치에 폭발을 일으킨 다음 제거하며, 일반 시각효과 만료 처리에서는 수류탄을 제외한다. 파편160/자국8 등 시각효과 상한은 독립적으로 유지한다. 좌/우/정면 및 드래그 투척·충돌·상향 비살상 Hit은 변경하지 않았다.
- 9종 원본 WebP/프로필을 대조했다. 영업냥 Rest의 눈물 row6을 중립 row8로 바꾸고 전용 Sleep 그림이 없어 row8 col0을 자세 유지로 사용한다. 시바는 눈물이 있는 row5 대신 row0 col3(눈 감음)으로 Sleep, row0의 차분한 0~3열로 Rest를 바꿨다. 푸들은 웅크려 눈 감은 row5 col4만 Sleep에 남기고 우사기는 row0 col3을 명시했다. 황색냥·얼굴냥·실눈냥·커비·커비(잠)의 기존 안전한 Sleep/Rest는 유지했다. 동일 clip 기준점을 재사용하고 원본 시트·수면 5~60분·상호작용 기상 규칙은 변경하지 않았다. 영업냥·시바·우사기의 전용 수면 그림 제작은 향후 자산 과제로 남는다.
- 툴바는 기존 둥근 레이아웃 안에서 아이콘 SVG 크기/간격, 활성 윤곽·`aria-pressed`, Gun 종류 툴팁과 메뉴 확장 상태를 정리했다. 펫/Gun/Draw 패널은 같은 창 폭에 맞게 표시하고 긴 목록은 내부 스크롤한다. 툴바 접기와 Playground 숨기기의 설명을 분리했다. 입력 모드·PC 클릭 통과·우클릭 복귀·Tray/Hide/Show 동작은 건드리지 않았다.
- 최소 검증: `node tests/screen-effects.cjs`, `node tests/gun.cjs`, `node tests/animation-platform.cjs`, `node tests/pet-expression.cjs`, `node tests/hit-sleep.cjs`, 브라우저 프로필 동기화, 변경 JS/CJS 8개 구문 검사와 `git diff --check` 통과. 새 QA/Electron 캡처·장시간 자동 실행은 하지 않았다. 실제 24개 연속 투척의 화면 가독성/FPS, 9종 Sleep 진입·기상 전환과 툴바 가장자리·고DPI/실마우스 사용감은 사용자 수동 확인 대상이다. 빌드·commit·push 없음.

## 2026-10-14 / Phase 3-C 최종 사용감 보완 (현행)

- 최신 사용자 지시가 `PHASE_3C_POLISH_NOTES.md`의 기존 2시 배치보다 우선한다. 4종 총 PNG의 오른쪽 총구를 확인하고 기본 커서 4시 위치에서 10시 레드도트로 향하게 회전했다. 화면 끝에서는 이미지가 들어오는 사분면을 선택하고 총을 왼쪽으로 향할 때 총열 기준 반전으로 손잡이가 거꾸로 보이지 않게 했다. 실제 PNG별 총구 anchor와 발사체/섬광 출발점을 통일하고 총구 축 반동으로 어긋남을 줄였다.
- 기존 조준점 도착 시에만 하던 판정을 구간별 연속 Sprite 알파 검사로 교체했다. 총구와 조준점 사이의 첫 불투명 픽셀에서 비살상 Hit/Head·Body/숫자를 처리하며 샷건도 펠릿별로 적용한다. 빈 조준점 앞의 펫도 맞을 수 있다. 24발·2초 및 4종 발사 간격/데미지, Sleep 해제는 보존했다.
- 수류탄 짧은 클릭은 좌/우/거의 수직의 세 기본 포물선 중 랜덤이며 드래그 우선, 3초 신관/반발/상향 넉백은 동일하다. Hammer는 기존 PNG의 금속 머리를 클릭점에 맞춰 약 430ms 준비→타격→반동을 보이고 260ms 균열 확산과 유리 파편 낙하를 사용한다. 동일 위치 누적·자동 복구/누적 설정과 비살상 Hit은 유지한다.
- 도구별 cursor는 PC=OS 기본, Touch=열린 손/잡는 중 닫힌 손, Gun=기존 PNG+레드도트, Spawn/Draw/Eraser/Hammer/Grenade/Black Hole=클릭점을 중심으로 한 Canvas 표시다. Canvas cursor에서는 OS 커서를 숨겨 중복을 피한다. 조작창은 기존 포인터를 사용한다.
- `safeOverlayBounds()`는 주 디스플레이 `workArea` 대신 `bounds`를 사용한다. 작업 표시줄 포함 전체 높이가 Pet 바닥/도구/Draw 좌표계가 되며 PC click-through는 그대로다. 보조 모니터 전체 확장은 이번 범위에 포함하지 않았고, 실제 작업 표시줄의 최상위 계층·DPI·다중 모니터 표시/입력은 사용자가 수동 확인한다.
- **애니메이션 전담 TODO:** 애니메이션 전담 채팅에서 9종 Sleep/Rest 프레임 재검토. 울음, 피격, 당황 표정을 제외하고 편안한 수면 자세 활용. 기존 5~60분 수면 유지. 이번에는 수면 클립/프로필을 변경하지 않았다.
- 최소 검증: `node tests/gun.cjs`의 경로상 첫 펫/빈 조준점/총구 방향·모서리/수류탄 3방향 포함 신규 16개와 상속 67개 PASS, `node tests/screen-effects.cjs`, `node tests/smoke.cjs --viewport-only`(실제 Electron 전체 화면 bounds), `node tests/smoke.cjs`(전체 회귀), `node tests/window-order.cjs` PASS. 전체 화면 Canvas에서 Sprite 감사가 기존보다 오래 걸렸지만 완료됐다. 변경 JS 구문·`git diff --check` 확인. 새 QA 이미지·대량 시뮬레이션·장시간 측정은 생성하지 않았다. 실제 `npm start` 마우스 사용감은 사용자 검수 대상이다. 빌드/commit/push 없음.

## 2026-10-14 / Phase 3-C 재개: 4종 Gun·수류탄 Bomb·Hammer·상단 개방 (최신 결정)

- 사용량 초과 전의 미커밋 Phase 3-B와 Gun 초안, 사용자 제공 PNG/문서를 초기화하지 않고 이어받았다. 최신 사용자의 수류탄 투척 요구가 이전 `CODEX_GUN_RESUME.md`의 Bomb 유지 지시보다 우선한다. Phase 3-C 범위에서만 변경했다.
- AWM/AK-47/UZI/더블배럴 샷건은 각각 4000/120/65/1200ms 간격, 표시 데미지 120/20/9/펠릿당12, 넉백 34/12/6/펠릿당5, 속도 3.1/2.35/2.25/2 px/ms다. 샷건은 10펠릿, AK/UZI는 좌클릭 유지 중만 연사한다. 무제한 탄약, HP/KO/삭제 없음. 제공 투명 PNG를 실제 총구 기준으로 회전해 커서 오른쪽 위에 그리며 빨간 점은 정확한 마우스 좌표다. 발사체는 총구에서 해당 탄착점까지 이동한 뒤 Sprite 알파 기반으로 Head/Body를 판정한다. 샷건만 레드도트 주변으로 퍼진다. 빈 공간/투명 여백에서는 miss다. Head는 숫자1.5배, 넉백1.35배다.
- 수류탄은 `bomb.png` 투척체를 클릭 시 기본 속도, 드래그 후 놓기 시 이동 벡터 기반으로 던진다. 3초 동안 중력·좌우벽·바닥 반발/마찰 후 현재 위치에서 기존 불규칙 검은 폭심지·큰 섬광/충격파·파편을 생성한다. 균열은 생성하지 않는다. Bomb의 공통 비살상 Hit에서 위쪽 충격을 보강해 지상 펫도 실제로 떠오른다. 투척체 cap16, 폭발 뒤 제거. Hammer는 제공 PNG의 짧은 표시와 클릭점 균열, 같은 위치 재타격 시 반경76→최대116px 확대를 사용하며 자동5초/누적 모드는 기존 Tray 정책이다.
- 공통 `applyNonlethalHit`와 장시간 Sleep 해제를 3도구가 공유한다. Grab·Black Hole orbit은 명중보다 우선, 충격은 자율 점프/Rest/Sleep/등반보다 우선한다. 숫자는 Sprite 앞에 다시 그려 가독성을 높이고 샷건은 5열×2단으로 분산한다. 보조 효과 OFF에서도 실제 명중/넉백은 유지한다. 원본 Sprite·애니메이션 프로필은 변경하지 않았다.
- Pet 상단 충돌만 열어 위로 나갔다가 중력으로 복귀한다. 좌우·바닥/Platform/Draw 규칙과 자율 점프 무반발, Throw/도구 충격 반발은 유지한다. 높이 2700px 또는 화면 높이 3배 이상 상승 시 속도 발산 방지 안전선을 둔다. 관리자 상한은 bullet24/2초, grenade16/3초, shot24, particle160, crack64, damage40/850ms다. 펫 생성에는 상한을 두지 않는다.
- 자동 검증: `tests/gun.cjs` 신규13개+기존67 상속 PASS, `tests/smoke.cjs --gun-preview` 격리 Electron PASS, `tests/window-order.cjs` PASS. `screen-effects`, `hit-sleep`, `animation-platform`, `animation-integration`, `jump-landing`, `pet-expression`, `local-pets`, `grab-visual.cjs after`(9종 3.2초 Held) PASS. `grab-throw` 기존55 중 상단 개방 기대값을 새 동작에 맞춰 검증했다. JS 구문·브라우저 프로필 동기화·`git diff --check` PASS. [4종 PNG/총구·레드도트/명중 캡처](qa/phase3c/native-weapons.png), [수류탄/폭발/Hammer 캡처](qa/phase3c/native-grenade-hammer.png)를 실제 Electron Canvas에서 보존하고 직접 확인했다. 원본 Phase 3-B 전후 캡처도 유지한다.
- 남은 위험: 실제 Windows 마우스·고DPI/다중 모니터에서 조준감, 수류탄 기본 속도와 3초 대기, 반복 연사/투척 시 FPS와 장시간 메모리는 수동 확인이 필요하다. 격리 테스트의 합성 입력/Canvas 캡처는 사람의 조작감 판정을 대체하지 않는다. 신규 펫/BH10/툴바 전면 변경, 빌드·commit·push는 하지 않았다.

## 2026-10-14 / Phase 3-B 후속 보완: 큰 효과·공통 비살상 Hit·장시간 Sleep (최신 결정)

- 사용자 최신 요구에 따라 Bomb/Hammer와 향후 Gun은 모두 **비살상**이다. 기존 Gun `hit→knockout→remove` 기획은 철회했다. 이번에 Gun 자체와 기존 의미의 Phase 3-C는 진행하지 않았다. Trash 및 Black Hole 흡수의 기존 인스턴스 삭제는 별개로 유지한다.
- Bomb은 균열 0개를 유지하면서 불규칙 구멍 반경을 61~71→78~90px, 충격파를 240/110→320/160px, 섬광을 8→10프레임, 파편을 50→68개로 키웠다. 넓은 범위 폭발 살과 시간별 fade는 유지한다. 기존 거리360·force17·속도cap19 광역 펫 impulse는 그대로다.
- Hammer는 40ms 접촉 지연을 없애 클릭 위치에 즉시 유리 파손을 만든다. 머리 하단 중앙/균열 중심/펫 hit test가 같은 좌표다. 국소 균열 반경 58→76px, 링 54→88px, 섬광 5→7프레임, 유리 파편 16→24개(속도 6→8). 머리 이미지는 약 80ms 이내 사라지고 자동5초 또는 누적 균열만 남는다. 기존 국소 충격 성분 13/11−8과 cap24는 유지한다.
- 공통 `applyNonlethalHit`는 Grab/orbit 제외, 외부 충격 속도·squash·자율 Sleep 깨우기·Hit 이벤트·데미지 숫자 생성 순서를 통일했다. Bomb/Hammer는 원본 Sprite의 기존 유효한 `hit→drag` fallback을 쓰며 KO/삭제, 새 장식/프로필/원본 자산 변경은 없다. 도구 충격은 자율 점프·Sleep·등반보다 우선하고, Grab/Black Hole orbit은 도구보다 우선한다. 향후 Gun은 같은 source/impulse/damage 진입점을 사용할 수 있다.
- 데미지 숫자는 별도 bounded 효과(`damage` 상한40, 수명850ms)로 Canvas에서 위로 38px 이동하며 탄성·작은 흔들림·색상 외곽선·fade를 쓴다. `auxiliaryEffectsEnabled` OFF에서는 숫자/보조 효과를 숨기지만 명중, 물리, 수명 정리는 계속된다. 기존 particle160/ring24/impact24/crater8/crack64/hammer12 상한과 정리는 유지한다.
- `activityProfiles`의 Sleep은 Rest 만료 시 성격별 확률로 시작하며 실제 RAF elapsedMs로 지속된다. 매우 차분 30~60분, 차분 20~40분, 보통 10~25분, 약간 활발 7~18분, 활발 5~15분, 매우 활발 5~10분이다. 자율 타이머에는 물리 dt 상한이 아닌 실제 경과 시간을 전달하되 물리 이동은 기존 상한을 유지한다. 안정된 지상 자율 상태에서만 진행되고 Grab/Throw/Bomb/Hammer/Black Hole은 기존 `interruptAutonomy`로 즉시 깨운다. 사다리 중 수면 진입은 막는다. 긴 수면 동안 기존 수면/휴식 클립을 사용한다.
- [수정 전 실제 Electron Canvas](qa/phase3b/before-hit-sleep-toys.png), [클릭 직후](qa/phase3b/native-toys-hit.png), [파편 이동 중](qa/phase3b/native-toys-hit-motion.png)을 보존했다. 눈으로 본 보완 후 캡처에서는 Bomb 구멍/폭발 폭과 Hammer 중심 유리 파손 및 숫자가 전보다 분명하다. 실제 물리 마우스·장시간 Sleep/연속 효과의 최종 체감은 수동 QA로 남긴다. 세부 실행 검사는 최신 [QA](QA_CHECKLIST.md)에 기록한다.
- 실행 결과: `screen-effects.cjs` 관리자6+renderer10, 신규 `hit-sleep.cjs` 6(상속 Grab55/Autonomy12), `grab-throw.cjs`55, `autonomy.cjs`12, `animation-platform.cjs`, `animation-integration.cjs`14, `jump-landing.cjs`8, `pet-expression.cjs`19, `local-pets.cjs`, `smoke.cjs --toy-preview`, `window-order.cjs` 통과. 변경 JS/CJS 구문 검사, 브라우저 프로필 동기화, `git diff --check` 통과. 중간에 Sleep의 물리 dt 상한 문제를 새 테스트가 포착해 실제 RAF 시간 전달로 수정하고 재실행했다. 빌드·commit·push는 하지 않았다.

## 2026-10-14 / Phase 3-B Bomb/Hammer 시각 보완 (최신 결정)

- 실제 Phase 3-B 렌더 비교에서 Bomb 구멍 바깥의 긴 직선 균열과 Hammer 접촉점에서 벗어난 머리 위치가 확인됐다. 사용자가 제공한 폭발/깨진 유리 검색 화면은 시각 참고로만 사용했다. 이미지는 다운로드하거나 제품 자산으로 사용하지 않았다.
- 최신 확정 요구에 따라 Bomb의 `addCrack` 호출을 제거했다. `crackMode` 자동5초/누적 및 Tray `균열만 지우기`는 Hammer 균열 전용이다. Bomb은 v1.0.0의 검은 구멍·주황 테두리를 32점 불규칙 다각형으로 강화하고 250ms 이하 폭발 살, 짧은 섬광, 이중 충격파 및 바깥으로 튀는 50개 파편을 사용한다. 구멍 수명5초/fade는 유지한다. Bomb의 거리360·force17·속도cap19 광역 물리/비삭제는 변경하지 않았다.
- Hammer는 클릭 좌표와 머리 하단 중앙·펫 피격 좌표가 같다. 40ms 하강 후 중심 파손/9각형 고리/짧은 꺾임8갈래와 분기4개/삼각 유리 파편16개·국소 흔들림 잔상을 생성한다. 머리 표시는 약80ms에 끝나고 균열만 남는다. 물리 충격은 기존처럼 클릭 즉시 적용하며 `beginImpact('hammer')`/Hit fallback·Grab/orbit 우선순위는 보존한다. 균열 기하 41선분/개, 누적 최대64개(2624선분)이고 기존 효과 상한·정리도 유지한다.
- [수정 전](qa/phase3b/before-native-toys.png), [수정 후 접촉/폭발](qa/phase3b/native-toys.png), [이동 중 파편](qa/phase3b/native-toys-motion.png) 캡처를 실제 격리 Electron Canvas에서 생성해 확인했다. 자동 테스트와 수동 한계는 최신 [QA](QA_CHECKLIST.md)에 기록한다. 실제 사람의 `npm start` 클릭 타이밍·60/144Hz·고DPI·장시간 누적 효과 체감은 별도 확인이다. 이 절 아래의 최초 3-B 결정은 변경 전 상태를 보존한 역사 기록이다.
- 실행 결과: `node tests/screen-effects.cjs`(관리자6+renderer10 및 상속 Grab55), `grab-throw.cjs`55, `animation-platform.cjs`, `animation-integration.cjs`14, `autonomy.cjs`12, `jump-landing.cjs`8, `pet-expression.cjs`19, `local-pets.cjs`, `smoke.cjs --toy-preview`, `window-order.cjs` 통과. 변경 JS/CJS 4개 구문 검사, 브라우저 프로필 일치 검사, `git diff --check` 통과. 기존 설정/물리/툴바/원본 Sprite는 보존했고 빌드·commit·push는 하지 않았다.

## 2026-10-14 / Phase 3-B Bomb 균열·Hammer 완료 (최신 결정)

- 최신 사용자 요청은 과거 Phase 3 계획의 3-B Bomb/3-C Hammer 분할을 대체해 **두 작업을 Phase 3-B 한 단계**로 묶는다. Phase 3-A의 `screen-effects.js` 수명·정리 구조, 기존 Bomb 광역 impulse와 Throw/자율 점프 구분, 애니메이션 프로필/원본 자산을 유지했다. 실제 Windows 창·파일을 건드리지 않고 투명 Canvas에만 그린다.
- Bomb은 기존 거리 360·force 17 충격과 링/파편/섬광/자국에 반경 155 균열을 추가한다. Hammer는 반경 70 균열, 260ms 타격 모션, 작은 링/파편/섬광을 생성한다. 클릭 범위에서 드래그/블랙홀 orbit 중이 아닌 최상위 펫 1마리에만 최대 ±24의 국소 반발을 주고 기존 `hit` 시각 상태와 `beginImpact('hammer')`의 Throw 계열 물리를 사용한다. 펫은 삭제하지 않는다. 실제 Hit 전용 프레임이 없는 프로필은 기존 안전 fallback을 따른다.
- 효과 상한은 기존 파편 160·링/섬광 각 24·자국 8·균열 64를 유지하고 Hammer 모션 12를 추가했다. 균열 하나는 반경 최대 200 안에서 최대 24선분으로 생성해 저장한다. 자동 복구는 5초, 누적은 최대 64개에서 오래된 균열을 밀어낸다. 보조 효과 OFF는 시각 표시만 숨기며 물리/효과 수명·정리는 계속된다.
- 최소 조작 경로로 툴바 Hammer 버튼/커서와 Tray의 `균열 모드` 자동·누적 선택 및 `균열만 지우기`를 연결했다. 기존 신뢰 sender/mode/Clear 검증을 확장하고, `crackMode`는 schemaVersion 1의 optional 설정값으로 저장한다. 기존 설정에 값이 없거나 잘못됐으면 자동 복구로 fallback한다. Clear는 Draw/collider/Pet을 보존한다. 우클릭 PC·click-through·Hide/Show는 유지한다.
- 자동 검증: `screen-effects.cjs` 관리자 6개+renderer 10개와 기존 Grab 55개, `grab-throw.cjs`55, `autonomy.cjs`12, `pet-expression.cjs`19, `jump-landing.cjs`8, `animation-integration.cjs`14, `animation-platform.cjs`, `local-pets.cjs` 통과. 중복 제외 VM 단위/renderer 124개. `grab-throw.cjs --measure`는 변경 전 HEAD와 현재의 30/60/144Hz × 느림/보통/flick 초기 속도·0.5초 거리·상승 높이가 동일하다. `smoke.cjs --toy-preview` 실제 격리 Electron Canvas/Tray/재시작/설정과 `window-order.cjs` Hammer 포함 18개 입력/PC 창 순서 시나리오 통과. [native 비교 캡처](qa/phase3b/native-toys.png)를 보존했다.
- 남은 위험/수동 QA: 실제 사람의 `npm start` 물리 마우스 Hammer/Bomb 연속 사용감, 60/144Hz·고DPI·다중 모니터/투명 배경, 누적 64 균열의 가독성 및 장시간 CPU·메모리. 자동 상한과 격리 Electron 시각 캡처는 실제 장시간 측정을 대신하지 않는다. Gun·블랙홀 최대 10개·새 캐릭터·전체 툴바 개편은 하지 않았고 build/commit/push도 하지 않았다.

## 2026-10-14 / 통합 애니메이션 회귀 보완 완료 (최신 결정)

- 사용자 재지시와 현재 diff/QA를 확인해 완료된 9종 GrabStart once→Held loop, 얼굴냥 울음·시바 눈물, 푸들 원본 보행, 기존 물리·효과/플랫폼을 유지했다. 앞선 중단 작업의 미커밋 상태를 보존했고 다른 worktree·원본 WebP/pet.json·IPC/UI/물리·설정은 변경하지 않았다.
- 새 명시 요구인 **프레임 내부 이미지 자르기 금지**가 중단 작업의 영업냥 `sourceCrop` 중간안보다 우선한다. 공통 renderer/preview/player의 crop 처리와 영업냥 프로필 값을 제거하고 원본 셀 전체를 표시한다. 기존 v1.0.0의 좌우row1/2·83.33ms를 복원하되 원본7열은 몸 일부 미완성으로 제외했다. 전체 셀0~6의 alpha>16 bbox x50~142/y9~199를 확인해 center=.5/foot=199/208만 사용한다. Pet.size/물리/충돌은 그대로다. 중간 cropped 화면은 `qa/grab-regression/interim-cropped-*`에 역사적 비교 자료로 보존했다.
- 9종 모든 원본 시트의 9/11행×8열 비어 있지 않은 셀을 스캔해 현재 모든 클립 참조가 유효함을 확인했다. 신규 상태용 이미지가 없는 Release/Landing은 idle, Throw는 fall 등의 기존 안전 fallback을 사용한다. 9종 Held는 원본 row5의 유효 표정 목록을 반복하며 GrabStart는 선택한2장 각60ms once. 손가락/안경이 있는 얼굴냥 row8 col2/3은 여전히 제외한다.
- 실행 결과: `node tests/animation-platform.cjs`, `animation-integration.cjs`(14개), `grab-throw.cjs`(55개), `autonomy.cjs`(12개), `pet-expression.cjs`(19개), `jump-landing.cjs`(8개), `screen-effects.cjs`(11개), `local-pets.cjs` 통과. 중복 제외 renderer/단위119개. `node tests/smoke.cjs`는 native81상태401선택프레임·9종17상태×3시점459렌더/기존 Electron 기능 통과. `node tests/grab-visual.cjs after`는 실제 `npm start`와 RAF로9종 각3.2초 Held, Release/Throw/실제 낮은 낙하 Landing/복귀와 영업냥 좌우 동작을 통과했다. 입력은 CDP DOM 이벤트이고 사람의 물리 마우스가 아니다.
- `node animation/write-browser-profiles.cjs --check`, 20개 JS/CJS 구문, `git diff --check`·신규 텍스트 공백 검사 통과. 작업 시작 renderer snapshot과 현재 `node tests/grab-throw.cjs --measure`의30/60/144Hz 속도·거리·높이가 동일하고 Phase3-A 효과/IPC/자산 파일 차이가 없다. 최신 QA 캡처 JSON의 renderer/player/profile/effects SHA는 현재 파일과 일치한다.
- 검토한 최신 [전후 프리뷰](qa/grab-regression/index.html)는 얼굴냥 울음과 다른8종의 표정·자세 반복, 영업냥의 원본 전체 셀 보행과 안정된 발 기준을 보여 준다. 영업냥 원본의 분리된 윗부분·회전과 업무→보행 크기/자세 차이, 전용 Release/Landing/Hit 이미지의 부재는 자산 한계다. 원본을 자르거나 새 픽셀/소품을 만들지 않는다. 실제 사람의 마우스, 60/144Hz·DPI·투명 화면에서9종3초 Hold와 동적 전환의 최종 체감은 사용자 수동 QA로 남긴다.
- 범위: 애니메이션 재생·프로필/표시만 수정. 신규 도구·캐릭터·창 순서·Phase3-B는 미구현. 빌드/commit/push 미실행.

## 2026-10-12 결정 확정

| 항목 | 확정 | 이전 논의와 달라진 점 |
| --- | --- | --- |
| 기본 Canvas 펫 | 슬라임만 메뉴에 남김 | Robot/Ghost/Star/Cloud 선택 제거 |
| 기존 Sprite 펫 | 유지, 품질 문제는 제한적으로 수정 허용 | 기존 에셋의 오류 보정 가능 |
| 시작 펫 | Slime/Brown/시바/커비 4개 | v1.0.0 유지 |
| 동시 Pet 수 | **상한 추가하지 않음** | 이전에 논의한 hard cap 20 취소 |
| 활동성 | 전체 roam 비중 낮춤, 캐릭터별 차등 | 고양이 차분, 강아지 활동적, 우사기 매우 활동적 |
| 블랙홀 | 최대 10개, 흡입 후 **삭제만** | 삭제/방출 선택 기능 취소 |
| Bomb | 기존 충격 + 구멍/폭발/파편 강화, 균열 없음 | 전역 파괴가 아닌 오버레이 연출 |
| Hammer | 신규 구현, 국소 타격 + 펫 반발 | 과거 제거했던 기능 복귀 |
| Gun | 후속 비살상 Hit + 숫자 데미지 팝업, KO/삭제 없음 | 2026-10-14 최신 요구로 이전 삭제 계획 철회 |
| 균열 | 자동 복구 / 누적 유지 선택 | 두 모드 모두 유지 |
| 구조물 | 펫별 스타일, 물리는 공유 | 기존 생성 규칙은 우선 유지 |
| Draw | 현재 사용성 유지 | 필요할 때 결함만 수정 |
| UI | 간소화 툴바 + Toy + 더보기 + 펫 관리 | 완전 툴바 숨김 구분 |
| 추가 동물 | 말티즈, 포메라니안, 웰시코기, 오리, 하프물범 | 솜털오리 표시 이름을 오리로 변경 |
| 커스텀 | 로컬 animated package 가져오기 | 공개 배포와 사용자 개인용 분리 |

## Codex 분석에서 확인된 후보 문제

다음은 코드 및 격리 테스트 분석 결과로 보고됐으나 **새 작업 환경에서 재확인해야 하는 항목**이다.

- throw `vx=18`이 자율 이동 1회 후 약 `2.744`로 줄어듦.
- Sprite에 착지 squash 미적용, 기존 sprite row 해석이 실제 패키지와 다를 수 있음.
- 마지막 이동 이벤트 간 차이만 사용한 던지기 속도 계산.
- 블랙홀 orbit 중 붙잡아 빼냈을 때 상태 불일치 가능.
- 일부 `recentStructures` 이력 장기 누적 가능.
- Draw의 단일 점이 지우개 대상 collider 없이 남는 사례.
- 일부 frameCount 기반 animation/effect 타이밍이 주사율에 따라 달라짐.

참고: 소스 분석은 실제 Windows 체감/FPS/장시간 메모리 검증을 대신하지 않는다.

## 단계별 상태

| Phase | 상태 | 완료/보류 내용 |
| --- | --- | --- |
| 0. baseline | 완료 (수동 QA 별도) | v1.0.0 동일 소스 확인, 구문/local/Electron smoke 통과, 후보 결함 격리 재현. 아래 2026-10-12 Phase 0 기록 참고 |
| 1. 물리/반응 | 1-A/B/C/D 구현·자동 검증 완료 | 1-D orbit/점 지우개/구조물 이력 정리 완료. 실제 마우스·동적 시각·장시간 QA는 별도 |
| 2. 활동성/성격 | 2-A/B 구현·자동 검증 완료 | 2-A 활동성 유지, 2-B 표현/원본 보존 Sprite 보완/겹침/Tray 보조 효과 저장 완료. 실제 Windows QA 별도, 특수 스킬은 향후 |
| 3. Bomb/Hammer/Gun/Black Hole | 3-A/3-B 및 후속 보완 구현·자동 검증 완료 | Bomb 균열 없이 확대, Hammer 국소 균열·공통 비살상 Hit/숫자, 장시간 Sleep. Gun/블랙홀 10개 확장 및 실제 마우스/장시간 QA는 별도 |
| 4. Toolbar/Pet 관리 | 대기 | |
| 5. 새 캐릭터/구조물/Import | 대기 | |
| 6. 통합/릴리스 | 대기 | |

## 2026-10-12 / Phase 0 / 현행 baseline 조사

### 범위와 기준점

- 실제 checkout: `D:\DesktopPlayground`, 브랜치 `feature/v1.1`, Windows x64, Node `v24.18.1`, lockfile의 Electron `29.4.6`.
- HEAD와 로컬 `v1.0.0` 태그의 commit은 모두 `68da7f03681053b8bb771d6a47c91f452ea44184` (`Release DesktopPlayground v1.0.0`). 추적 파일은 태그 대비 변경 없음. 시작 시 `AGENTS.md`와 `docs/v1.1/` 전체가 untracked였으므로 기존 사용자 문서를 보존한다.
- 루트 지침, README, ASSET_SOURCES, v1.1 문서 6개, history 문서 4개, 현재 main/preload/renderer/controls/local-pets, 기존 테스트 2개와 pet.json 9개를 읽었다. 현재 코드와 테스트를 구현 근거로 우선했다.
- 이번 작업에서 수정한 저장소 파일은 **이 결정 기록뿐**이다. 제품 코드·UI·이미지·테스트·package/lockfile·버전은 수정하지 않았다. build/commit/push/tag/release 작업 없음. 원본 userData로 앱을 실행하지 않았다. 원격 GitHub Release 상태는 조회하지 않았다.

### 현재 동작과 명세의 차이

| 영역 | 현재 v1.0.0 코드/검증 근거 | v1.1에서 남은 일 |
| --- | --- | --- |
| 시작/펫 목록 | `renderer.js:1232`의 시작 4마리는 blob/cat_brown/doge/kirby. `controls.js` 기본 메뉴는 blob/robot/ghost/star/cloud, 로컬 Sprite 9종. smoke에서 시작/목록 확인 | Phase 2에서 기본 메뉴만 슬라임으로 축소. 숨긴 basic/cat/magpie/bug 정의와 기존 자산은 즉시 삭제하지 않음 |
| 생성/삭제 | `spawnPet`에 인스턴스 cap 없음. 격리 환경에서 25개 생성 확인. Touch+Trash는 인스턴스만 필터링하며 정의/구조물은 보존 | cap을 추가하지 않음. 관리 목록/개별·전체 삭제 UI는 Phase 4 |
| 입력/창 | main이 overlay/controls/Tray를 소유. PC click-through는 `setIgnoreMouseEvents`로 제어. 우클릭과 접기 PC 복귀, Hide/Show는 smoke 통과 | 현재 10버튼에서 Toy/더보기 구성으로 변경은 Phase 4. 물리 마우스 전달·Tray 클릭은 별도 QA |
| Hide/Show | 현재 `main.js:setEnabled`는 enabled만 바꾸므로 기존 모드를 유지. 비상 `Ctrl+Alt+Shift+P`는 PC 모드만 설정. Tray/second-instance가 controls 복구 | 명세 §7은 Show 시 PC 복귀를 요구해 현행과 차이가 있음. Phase 4에서 명시적으로 다루며 이번에 변경하지 않음. 툴바 숨김 API/Tray 복구는 이미 있고 현재 UI에서 숨김 버튼은 노출되지 않음 |
| 물리/행동 | dt를 쓰는 이동/중력/마찰과 공유 지형 탐색이 있음. 외부 충격 전용 상태 없음. 로컬 9종 behavior 값이 동일 | Phase 1에서 Grab/Throw/착지, Phase 2에서 roam/rest/sleep 및 개별 성격 |
| 도구 | draw/bomb/blackhole만 허용. Bomb는 구멍/링/파티클과 impulse, 직접 삭제 없음. 블랙홀 cap 2, 수명 540 기준 tick, 약 3.5회전 후 22px 중심에서 해당 인스턴스 삭제 | Phase 3에서 균열/Hammer/Gun, 블랙홀 10개. 현재 hole 교체/만료 시 orbit 해제 및 중복 hole 소속 방지는 이미 있음 |
| Draw/구조물 | 4종 outline, 6색, 굵기 1~30, 80 shapes/600 segments/100 freehand points. 구조물 기본 OFF, OFF 시 데이터 보존·표시/충돌/등반 중단. 7 platform/5 ladder, 공유·cooldown·idle 정리 있음 | Draw 사용성 유지, 아래 재현된 결함만 별도 최소 보정. 구조물 종별 style은 Phase 5 |
| 가져오기/설정 | 고정 9개 package만 `local-pets.js`에서 검증·로드. 기존 custom 이미지 설정/자산을 main에서 복원하나 업로드/관리 UI 없음 | Phase 5의 animated package import는 신규 기능. 기존 custom 이미지와 새 라이브러리 migration/fallback 경계 필요 |
| 보안/offline | `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`, preload whitelist와 main의 sender/frame 검증. `%APPDATA%\desktop-playground\playground`의 settings/UI/assets 경로 유지 | Phase 1에서 IPC/스키마 변경 필요 없음. runtime HTTP(S) resource 0건은 smoke 범위 결과이며 전체 네트워크 패킷 검증은 아님 |

과거 기록 주의: `docs/history/CURRENT_STATE.md`와 `V2_PLAN.md`의 시작 5마리·새 카테고리 및 접힌 툴바 숨김 버튼 설명은 현재 코드와 다르다. 실제 접힌 버튼은 표시/숨김·펼치기·종료다. `PHASE_3_PETS_STRUCTURES.md`의 초기 10/8 제한 및 OFF 의미도 후속 변경/현재 코드와 구분한다. `ASSET_SOURCES.md`의 `D:\DesktopPet`은 과거 경로이며 재배포 권리는 여전히 미확인이다. 원문과 기존 v1.0.0 자산은 보존했다.

### 후보 결함 재확인과 개선 위치

아래의 “격리 재현”은 실제 `renderer.js` 전체를 Node VM에 로드하고 DOM/Canvas/시계/난수를 stub한 조사다. Electron 입력 체감이나 장시간 실측을 의미하지 않는다.

| 항목 | 근거/결과 | 다음 조치와 영향 |
| --- | --- | --- |
| throw 속도 덮어쓰기 — 격리 재현 | `Pet.update` 지상 탐색 분기(`renderer.js:410–426`)가 vx를 ±2.8로 clamp한 뒤 마찰 .98 적용. 단독 blob, 바닥, vx=18, vy=0, dt=1에서 `2.7439999999999998`. 공중 전체에서 항상 발생하는 것은 아님 | Phase 1: 외부 impulse 우선권/복귀 조건 도입. 충격 직후 navigation·등반·무작위 점프가 속도를 덮지 않게 검증 |
| grab offset/throw 시간 — 격리 재현+코드 확인 | `mousedown/mousemove/mouseup`(`1032–1096`)에 offset/이벤트 timestamp 이력 없음. 중심 x=800을 x=810에서 잡고 포인터를 820으로 옮기면 중심이 820으로 붙음(기대 810). release는 마지막 dx=10에 .9를 곱해 vx=9. 멈춘 시간은 계산하지 않음 | 최근 80~120ms 좌표/시각 샘플과 정지 release, offset 보존. 마우스 이벤트 빈도 차이를 흡수하되 기존 속도 단위와 dt 환산을 함께 정함 |
| 블랙홀 구출 — 격리 재현 | grab에서 climbing/support만 해제하고 `blackHoleOrbit`은 남김. orbit 펫을 반경 밖으로 옮긴 후 dragging을 해제하면 다음 `updateBlackHoles`가 이전 궤도로 복귀시킴 | Grab의 상태 정리로 Phase 1에 포함 제안. grab 즉시 orbit 해제, 반경 밖 release는 재흡입하지 않음. 반경 안에서 새로 포획되는 기존 규칙과 cap 확대는 별개 |
| Sprite squash — 격리 재현+코드 확인 | 바닥에서 squish를 갱신하지만 `Pet.draw` sprite 분기(`529–545`)에는 scale이 없음. squish=1.4에서도 scale 호출 0. Canvas/기존 custom DOM 이미지는 적용됨 | Phase 1: 지지면 기준 squash/복구를 Sprite에도 적용. 단순 중심 scale은 발 위치를 흔들 수 있어 anchor와 같이 검증 |
| 접촉별 반응 차이 — 코드 확인 | 바닥은 vy×-.6과 squish, Platform/Draw 착지는 vy=0, Draw 벽/닫힌 천장은 해당 속도를 0으로 설정. 화면 옆은 vx 반전, 화면 위쪽 경계 보정 없음 | Phase 1에서 충격 강도/저속 정지 기준을 접촉별로 검증. one-way 발판과 Draw 형상은 유지. 큰 dt/고속 선분 터널링은 현재 재현하지 않았으므로 확정 버그로 표시하지 않음 |
| 프레임 기반 시간 — 코드 확인 | 이동/마찰/블랙홀 life·회전은 dt 사용. Sprite `tick++`, squash의 고정 .15 복구, `drawEffects`의 life--/particle 이동은 호출 횟수 기반. dt는 .25~3으로 제한 | Phase 1에서 Sprite 시간/squash를 경과 시간으로 전환 제안. 효과 전체 전환은 Phase 3. 예: 300프레임 Bomb 잔상은 이상적 60Hz에서 5초, 144Hz에서 약 2.08초로 달라짐. 실제 고주사율 측정 아님 |
| recentStructures 누적 — 격리 재현+코드 확인 | `recentStructures.set`은 있지만 pruning 없음. `cleanupStructures`로 오래된 id=999 구조물을 제거해도 펫 Map에는 남음. 구조물 ID는 증가하며 Clear도 해당 Map을 초기화하지 않음 | 구조물 안정성의 후속 소작업으로 만료/존재하지 않는 ID 정리 제안. 실제 누수량/30분 증가율은 미측정. zoneVisits는 5개 zone, targetHistory는 32개 제한으로 구분 |
| Draw 단일 점 — 격리 재현 | freehand 점 1개는 화면에 원으로 그리지만 `shapeSegments`가 []이고 `eraseDrawing`은 segment만 조회. 동일 좌표 지우개 후 shape 1개/collider 0개 유지 | 후속 Draw 결함 수정 1건으로 분리 제안. 이번과 Phase 1의 물리 작업에서 Draw 도구 재설계는 하지 않음 |

추가 성능 관찰: `Pet.update`의 다른 펫 전체 순회와 navigation의 군집 검색은 펫 증가 시 비용이 커질 수 있다. 아직 FPS/CPU 측정은 하지 않았다. cap 도입 근거로 사용하지 않으며, 필요하면 측정 뒤 근접 검색/캐시를 검토한다.

### 기존 애니메이션/시트 실물 조사

- Pillow로 로컬 9개 WebP를 실제 디코딩했다. Brown/Face/푸들은 1536×2288(8×11), 나머지 6개는 1536×1872(8×9). pet.json ID/path와 로더 결과가 일치한다. 숨긴 기존 Cat/Magpie도 1536×2288이며 현재 선택 범위에 완전히 투명한 프레임은 없다.
- 현재 공통 clips는 idle row0×6, right row1×8, left row2×8, fall row4×5, drag row5×8. 로컬 9개 모두 이 **선택 범위에는 완전히 빈 alpha 프레임 없음**. fall 행의 5~7열 등 사용하지 않는 빈 셀은 손상이 아니다. 11행 시트의 idle 7번째 유효 셀은 현행 6프레임 클립에서 사용하지 않는다.
- 사용 행 5개×8열을 9종 contact sheet로 만들어 눈으로 확인했다. row5는 Brown/시바/커비/푸들 등에서 웅크림·눕기·수면 계열 자세여서 “잡힘” 표현과 맞지 않을 수 있다. Salary는 소품/형태 변화, Face는 표정 중심이다. 프레임이 깨졌다고 단정하거나 모두 같은 다른 행으로 치환하지 않는다. 사용하지 않는 행까지 대조한 뒤 ID별 clip/fallback이 필요한 종만 선택한다.
- anchor는 공통 `renderSize=size*2.5`, `offsetY=10`(Magpie만 15)이다. 실제 alpha 하단을 현행 렌더 좌표로 환산하면 Brown walk는 중심 아래 약 18.6~23.8px, 푸들 walk는 19.1~20.5px인데 물리 발은 +39px다. Sleepy idle은 +16.7~18.6px, Kirby idle은 +21.1~23.9px(물리 발 +34px). **투명 여백과 포즈에 따른 지지면 불일치 후보**이며 실화면의 발 위치/소품/그림자를 관찰해 보정해야 한다. alpha 하단을 모든 프레임의 발로 강제 정렬하면 점프와 소품이 흔들릴 수 있다.
- 모든 local Sprite의 behavior가 동일하므로 Sleepy만의 수면 행동은 아직 없다. clip 선택은 drag → |vy|>1.5 fall → |vx|>.5 walk → idle이며 클립 변경 시 독립 시간/프레임 초기화가 없다. 활동성/수면 상태 추가는 Phase 2, 시간과 확인된 표시 문제만 Phase 1 후보다.
- contact sheet는 `%TEMP%\desktopplayground-phase0-clips.png`에만 만들었고 원본 WebP는 수정하지 않았다. 신규 에셋 생성/다운로드 없음. 전체 프레임의 미세 손상·방향·anchor가 정상이라는 판정은 아직 하지 않는다.

### 실제 실행한 검사

| 명령/방법 | 결과와 한계 |
| --- | --- |
| `node --check main.js`, `preload.js`, `renderer.js`, `controls.js`, `local-pets.js` (각 파일별 실행) | 5개 모두 구문 오류 없음 |
| `node tests/local-pets.cjs` | PASS. 정상 doge/kirby, malformed JSON/invalid WebP/missing sheet skip 검사. fixture에 없는 다른 7종의 ENOENT 경고는 예상 결과. 9종 전체의 부정 입력 테스트를 의미하지 않음 |
| 최초 `node tests/smoke.cjs` | FAIL: `node_modules/electron/dist/electron.exe` ENOENT. 제품 동작 실패가 아닌 의존성 미설치 |
| `npm ci --no-audit --no-fund` | 성공, lockfile 기준 310개 설치. deprecated 경고와 Electron postinstall 미실행 알림 발생. 버전 업데이트/audit fix는 하지 않음 |
| `node node_modules/electron/install.js` | 성공, 잠긴 Electron 실행 의존성 준비. npm의 postinstall 생략을 보완. package/lockfile 변경 없음 |
| 재실행 `node tests/smoke.cjs` | PASS. TEMP에 소스/자산을 복사하고 appData를 격리한 실제 Electron 실행: 4 starters, 현재 목록, 우클릭 PC, 접힌 3버튼/접기 PC, 구조물 ON/OFF 표시·충돌, Draw collider, Hide/Show, HTTP resource 0건, 종료 확인 |
| `node "$env:TEMP/desktopplayground-phase0-probe.cjs"` | 최종 PASS. 위 throw/offset/orbit/Map/단일 점/Sprite scale/25개 spawn 조사. 최초 부동소수점 strict 비교(2.744와 실제 2.7439999999999998) 실패 후 조사 assertion 수정, 재실행 통과. 제품 수정 없음 |
| 번들 Python/Pillow stdin 조사 | 11개 기존 시트 디코딩/사용 클립 alpha 검사, 로컬 9종 contact sheet 관찰·하단 좌표 계산 완료 |
| `git diff --exit-code v1.0.0 -- main.js preload.js renderer.js controls.js local-pets.js package.json package-lock.json tests README.md ASSET_SOURCES.md docs/history` | exit 0, baseline 추적 파일 불변 |
| 최종 `git diff --check`, `git diff --exit-code v1.0.0`, `git diff --no-index --check -- NUL docs/v1.1/DECISIONS_AND_PROGRESS.md` | 모두 exit 0. untracked 결정 기록까지 공백 검사 완료. Git의 LF→CRLF 안내만 발생. 태그 commit 재확인 동일 |

VM 조사 스크립트는 TEMP의 일회성 도구로 저장소 테스트를 변경하지 않았다. 최종 SHA-256: `DF5BAF00C8EDC23452B045C25E1B49F6675FC2F032F5821A42C4068856F70C11`. Phase 1에서 해당 조건을 영속 회귀 테스트로 옮긴다. smoke의 resolver 차단은 개발 의존성 설치의 네트워크 사용과 별개다.

직접 미실행: 실제 마우스의 Chrome/Explorer click-through·휠, Tray/전역 단축키 조작, Drag+Trash 체감, 고주사율/DPI/다중 모니터, 과거 설정 migration 시나리오, 3분 캐릭터 관찰, 20마리+10개 블랙홀 부하, 30분 방치, portable EXE 검증. 10개 블랙홀 등 미구현 요구는 실패한 회귀가 아니라 이후 Phase 검증 대상이다. 기존 QA 체크리스트는 복합 조건/미구현 항목을 포함하므로 이번에 일괄 체크하지 않았다.

### Phase 1 최소 구현 제안 (아직 시작하지 않음)

확정 요구 변경 없음. 기존 Phase 1을 아래 하위 작업 순서로 나누는 제안이며 매 작업마다 검사 후 다음으로 진행한다.

1. **1A Grab/Throw와 상태 우선권**: offset, timestamp 이력(최근 80~120ms), 정지 후 놓기, 외부 충격 중 navigation/등반/자율 점프의 속도 덮어쓰기 방지와 감쇠 후 복귀. grab 시 orbit을 해제하고 blur/우클릭/Hide/도구 전환/Trash의 정리 경로도 맞춘다. Bomb impulse도 같은 외부 충격 우선권을 쓰되 Bomb 연출/삭제 정책은 바꾸지 않는다.
2. **1B 충돌/착지**: 바닥/화면 경계/Platform/Draw 접촉별 bounce/slide 및 저속 정지 조건을 검증하고 필요한 곳만 보정. 고속·큰 dt에서 재현된 터널링만 최소 해결한다. Draw 생성/지우개 사용성, one-way Platform, 구조물 공유/OFF는 보존한다.
3. **1C 기존 Sprite 표시**: dt 기반 클립 시간과 squash 복구, 지지면 anchor를 고려한 Sprite squash. 패키지별 실물 비교로 확인된 clip/anchor만 metadata/fallback으로 보완한다. 정상 이미지 교체나 일괄 재정렬은 하지 않는다.

- 예상 수정 중심: `renderer.js`와 물리/입력/렌더 회귀 테스트, 결정 기록/QA 체크리스트. main/preload/controls/local-pets 및 설정 schema 변경은 현재 근거로 필요하지 않다. 개별 clip metadata 전달이 꼭 필요해질 경우 그 시점에 경계를 재평가한다.
- 필수 자동 검사: 기존 5개 구문 검사/local-pets/smoke 유지, offset 유지/같은 경로의 이벤트 빈도 차이/정지 release/지상·공중 throw 감쇠/Bomb 충격/상태 복귀/orbit 구출/Trash 개별 삭제, 60/144Hz 시간 비교, 바닥·Draw·Platform 착지/고속 충돌·구조물 OFF, 25개 이상 spawn과 시작 4마리 보존. 시각 프레임 수와 anchor 검사는 실물 기준으로 선택한다.
- 주요 회귀 위험: 외부 충격 상태의 영구 고착, 등반/지원 상태 경합, throw 단위 변경에 따른 속도 과대·과소, dt 변경 시 기존 애니메이션 속도 변화, squash 적용 시 발 위치 흔들림, 고속 충돌 수정이 Draw one-way 동작에 미치는 영향. 실제 Windows 입력·착지는 자동 검사 후 별도로 관찰한다.
- Phase 1 제외: 성격/메뉴 축소, Hammer/Gun/균열/블랙홀 cap 변경, UI 재구성/import, 새 동물/새 에셋, 구조물 스타일, 구조물 Map pruning, 점 지우개 수정, 효과 전반 시간 전환. 후자의 확인 결함은 별도 작은 후속 작업으로 추적하며 누락하지 않는다.
- 사용자 승인 필요 여부: Phase 0 기록은 이번 요청 범위 내 완료. 구현은 후속 Phase 1 요청을 받은 뒤 시작한다. 확정된 무제한 spawn·블랙홀 흡수 삭제·시작 4마리·설정/보안/Draw 유지 정책을 변경하는 제안은 없다.

## 2026-10-12 / Phase 1-A / Grab·Throw와 자율 이동 우선권

- 확정 작업 범위: 이번 사용자 요청은 1-A만 구현하며 Bomb/Black Hole/Draw/구조물 생성/UI/기존 자산은 유지한다. 따라서 Phase 0의 **orbit 구출과 Bomb impulse 상태 연결 제안은 이번에 적용하지 않았다**. 이들은 해결 완료로 취급하지 않는다. 후속 1-B/1-C/1-D도 미착수다.
- 수정 파일: `renderer.js`, 신규 `tests/grab-throw.cjs`, `tests/smoke.cjs`, `IMPLEMENTATION_PLAN.md`, `QA_CHECKLIST.md`, 이 결정 기록. main/preload/controls/local-pets, package/lockfile, 설정 경로/스키마, 시작 4마리와 기존 펫 목록/자산은 변경하지 않았다.
- Grab: 포인터와 중심의 x/y offset을 잡는 시점에 저장하고 move 및 최종 mouseup 좌표에도 적용한다. climbing/down/target/support와 이전 throw 상태를 해제하되 기존 isDragging/잡힌 표정/클립/squish는 유지한다. Trash는 offset을 반영한 **펫 중심**으로 기존처럼 판정해 인스턴스 하나만 제거한다.
- Throw: 이벤트 `timeStamp` 기준 최근 100ms 구간의 시작/끝 변위를 사용한다. 경계가 샘플 사이에 있으면 선형 보간하며 mouseup을 정지 샘플로 포함한다. 같은 시각 샘플은 교체하고 역행 시각은 마지막 시각으로 제한한다. 1ms 미만 이력은 0속도로 처리한다. 변환식은 `변위(px) / 경과(ms) × (1000/60)`으로 기존 px/기준프레임 단위와 맞춘다. 대각선 포함 초기 속도 벡터 크기는 18로 제한한다. 예: 100ms에 100px 이동은 약 16.667, 120px 이동은 cap 18이다. 100ms 이상 멈춰 놓으면 이전 이동 속도는 0이 된다.
- 물리 우선권: `beginThrow`가 세션 내 externalMotion을 시작한다. 활성 동안 지상 navigation의 ±2.8 clamp, 자율 등반/airSteer, 착지·바닥의 무작위 방향/점프를 건너뛴다. 중력/마찰/기존 충돌/펫 간 separation/렌더는 유지한다. **외부 상태 진입은 이번에는 Throw에만 연결**하며 폭탄의 수치/연출/기존 처리는 그대로다.
- 종료 조건: `dt × (1000/60)`으로 시간을 누적한다. 최소 200ms가 지난 뒤, 지지면에서 `|vx|≤2.8`, `|vy|≤1.5`가 120ms 연속 유지되면 종료한다. 그렇지 않아도 최대 3000ms의 **활성 물리 갱신 시간**에 종료한다. Hide 시뮬레이션 일시정지 동안은 진행하지 않는다. 이후 다음 update부터 일반 AI가 복귀한다. 재Grab은 이전 상태를 초기화하며 blur/mouseleave/우클릭/모드 변경/Hide 입력 취소는 throw 없이 놓고 샘플을 비운다.
- 회귀 증거: 지상 vx=18을 던지는 실제 Electron 합성 입력에서 다음 update 값 **17.64**로 확인(기존 약 2.744). 100px/100ms Throw VM 사례는 약 16.667→16.333이다. 정지 release는 0속도. 기존 Sprite drag row5/squish 유지, 사다리 탐색/등반/중단, 일반 점프/배회 복귀, 공유 구조물 생성, 25개 spawn도 자동 검사했다.

### 실행 검사와 결과

| 명령 | 결과/범위 |
| --- | --- |
| `node tests/grab-throw.cjs` | PASS, 20개 사례. 실제 renderer 전체와 입력 listener를 VM에서 실행, DOM/시계/난수 stub. 사용자 요청의 1~7 사례 및 빈도/정지/속도 cap/취소/재Grab/60·144Hz 물리 시간/최대 종료/구조물 생성/기존 Draw 벽 dt=3 검사 |
| `node tests/smoke.cjs` | PASS. 기존 startup/목록/PC/접기/구조물/Draw/Hide·Show/HTTP resource 0/종료 검사 유지 + 실제 Electron에서 합성 timestamp MouseEvent로 offset/지상 속도 유지/정지/Trash 확인. TEMP appData로 원본 설정 격리 |
| `node tests/local-pets.cjs` | PASS. 기존 정상/불량 package 검사. fixture에 없는 패키지와 고의 불량 입력 skip 경고는 예상 결과 |
| `node --check` (main.js, preload.js, renderer.js, controls.js, local-pets.js, tests/grab-throw.cjs, tests/smoke.cjs, tests/local-pets.cjs 각각) | PASS, 8개 구문 검사 |
| `git diff --check`, 신규 테스트/변경 문서의 `git diff --no-index --check -- NUL <파일>`, Node 파일 검사 | 추적 파일 공백 검사 exit 0. no-index는 NUL 대비 내용 차이로 exit 1, 공백 진단 없음. 별도 Node stdin 검사에서 변경 6개 파일 trailing whitespace/충돌 마커 없음 확인. 로컬 v1.0.0 태그 commit 유지, build/commit/push 없음 |

### 남은 위험과 수동 확인

- 실제 Windows 마우스로 가장자리 grab/빠른 flick/100ms 이상 정지 release/Trash/blur 취소/사다리 중간 grab을 확인하지 않았다. 합성 입력과 VM의 통과가 실제 조작감·DPI 입력 전달을 보증하지 않는다.
- 속도 cap과 기존 수직 Draw 벽 dt=3 사례는 검사했으나 **모든 얇은 선/경사/모서리의 관통 방지를 보증하지 않는다**. 충돌 알고리즘과 화면 상단 경계/landing 반발은 변경하지 않았으며 별도 충돌 Phase에서 재현 후 다룬다.
- 100ms 평균과 cap 18의 체감, 최소 보호 200ms/안정 120ms/최대 3초는 수동 튜닝 후보다. 3초가 만료되는 특수 공중 상황에서는 일반 AI가 복귀할 수 있다. 향후 조정 시 빠른 던지기와 정지 release 회귀를 유지한다.
- 블랙홀 orbit에서 꺼낸 펫의 이전 궤도 복귀, 폭탄 impulse의 기존 지상 clamp, 단일 점 지우개, Sprite squash/anchor/프레임 시간, recentStructures pruning은 이번 범위 밖으로 남긴다.
- 고주사율/DPI 실화면, 장시간/다수 펫 부하, portable는 미검증. IPC 보안/설정/자산/버전 변경은 없으며 사용자 확정 요구를 변경하지 않았다.

## 2026-10-12 / Phase 1-B / 던지기 체감과 충돌 반발

### 사용자 피드백과 원인

- 사용자 실제 Windows 검사: 빠른/느린 던지기의 거리 차이가 작고, 펫이 무거우며 금방 멈춘다. offset/Trash 등 나머지 조작은 정상이다. **1-A의 자동 통과는 조작감 합격을 의미하지 않는다.** 이번 단계는 이 피드백을 우선 반영하며 1-C 표현/신규 도구/UI/에셋 작업은 하지 않는다.
- 흐름 확인: 입력 px/ms→60Hz 단위 환산 자체는 맞지만 초기 벡터 cap 18에 이어 `Pet.update`에서도 vx를 ±18로 제한했다. 약 1080px/s 이상 수평 입력은 모두 같은 초기 속도가 되어 보통/빠른 flick 차이를 없앴다. 둘 중 한 제한만 높여서는 해결되지 않는다.
- 100ms 균등 평균에 마지막 짧은 flick 전의 정지가 포함되어 최종 움직임이 희석될 수 있었다. 공중·지상 모두 `.98^dt` 수평 감쇠라 0.5초 뒤 속도는 약 54.5%, 수직 중력 .5로 초기 vy=-18의 이론적 상승은 약 324px에 그친다(실제 이산 60Hz 검사 315px). 3초 최대 상태 시간도 긴 비행에 짧았다. 외부 상태 중 별도의 추가 감속은 없었지만 이 공통 감쇠와 상한이 체감을 제한했다.

### 구현과 상수 (Throw 상태에만 적용)

| 항목 | 이전 → 현재 | 선택 이유 |
| --- | --- | --- |
| 입력 추정 | 최근 100ms 단일 평균 → 최근 40ms 75% + 100ms 25% | 100ms 이력을 유지하면서 짧은 마지막 flick 반영. 최근 40ms 추정이 거의 0이면 0속도로 놓아 정지 후 잔류 속도 방지 |
| 입력 gain | 1 → 속도 6 이하는 1, 6~30 사이 1~1.35, 이후 1.35 | 느린 이동을 그대로 두고 빠른 움직임에만 약한 추가 배율. `1 + .35*clamp((speed-6)/24,0,1)`이며 기준 속도 단위는 px/60Hz frame |
| 초기 cap | 벡터 크기 18 → 54 | 정상 flick 범위를 확장, 극단적 입력만 안전 제한. beginThrow에서도 초기 벡터 cap 재검증, update는 Throw에서 축별 ±54 제한(낙하 종단 포함) |
| 중력 | .5 → .22 px/기준frame² | 상향 던지기의 상승/체공을 가볍게. 일반 배회/자동 점프/폭탄의 중력은 .5 유지 |
| 수평 retention | 공통 .98 → Throw 공중 .996 / 지상 .94 | 공중 관성 유지(0.5초 뒤 약 88.7%), 바닥에서는 짧은 느린 던지기가 안정적으로 멈춤. 모두 `retention^dt` |
| 반발 | 바닥 .6 / Draw·Platform 0 / 옆벽 1 → Throw 바닥·Draw·Platform .65 / 화면 경계 .72 | 강한 접촉은 에너지를 줄이며 반발. Draw는 접촉 법선 성분만 반사해 접선 이동 유지 |
| 저속 충돌 | 잔여 미세 bounce → 법선 속도 절댓값 ≤3이면 반발 0 | 미세 떨림/무한 반동 방지. stable 판정은 기존 `|vx|≤2.8`, `|vy|≤1.5`, 최소 200ms 및 연속 안정 120ms 유지 |
| 최대 보호 시간 | 3000 → 8000ms 물리 갱신 시간 | 강한 상승/여러 번의 반발 중 AI로 갑자기 전환되는 경우 줄임. 안정 착지는 일찍 복귀하며 최대 시간은 고착 방지용 |
| 적분 | 프레임 dt 직접 적용 → Throw만 최대 .5 기준frame씩 substep | 20/30/60/144Hz 및 불규칙 dt의 비행·접촉 차이 축소. 일반 이동/사다리의 기존 update 경로는 그대로 |

- 기존 RAF의 dt 범위 .25~3은 유지한다. 긴 렌더 정체 시간 전체를 catch-up하지 않는 기존 정책도 유지하므로 극단적인 stall/240Hz 초과 실제 환경은 별도 검증 대상이다. substep은 물리에만 적용하며 기존 squish 복구는 렌더 update당 한 번 유지했다. Sprite clip/anchor/자산/애니메이션 프레임 속도는 수정하지 않았다.
- Draw: Throw 상태에서 펫 원형 몸체(반경 size)와 선 두께를 반영한 capsule을 사용해 **이전 위치부터의 이동 경로**를 연속 검사한다. 선 측면과 끝점 중 최초 충돌을 고르고 법선 반발 및 남은 이동을 최대 4회 처리한다. AABB 사전 검사로 먼 선분은 제외한다. 사각형/타원은 양면 벽·천장·바닥, 열린 수평 선은 기존 one-way 지형을 유지한다. 경사/자유곡선의 접촉 법선도 반영한다. 그리기 입력·색·두께·지우개·collider 생성은 변경하지 않았다.
- Platform: 하강 중 발이 위를 교차할 때만 접촉하며 교차 시점의 x도 검사한다. 강한 착지는 반발, 약한 착지는 지지 상태 유지. 상승 통과 및 사다리 상승/하강은 유지한다. Throw는 화면 위쪽도 경계로 반발시켜 강한 상향 flick의 화면 이탈을 막는다. 시작 펫의 일반 낙하는 기존 경로다.
- Bomb/Black Hole 함수와 효과·개수·삭제 규칙, 기존 일반 Pet 물리/자율 성격, 구조물 생성/공유, offset/Touch/Trash/취소, 목록/시작 4마리/무제한 spawn, 툴바/IPC/설정 경로/스키마/자산은 변경하지 않았다. 개선 반발/중력/CCD는 Throw 상태에 한정하며 다른 도구에 새 상태를 연결하지 않았다.

### 수정 전후 측정

실제 renderer 전체를 Node VM으로 실행, DOM/시계/난수 stub, 다른 펫/지형 없이 100000×100000 가상 영역. 100ms 일정 속도 입력을 0/50/100ms 샘플로 전달하고 release 이후 60Hz로 적분했다. 수평 거리와 수직 상승은 **별개 throw** 측정이며 release 위치를 기준으로 한다. 상향은 vy≥0인 최고점까지 추적. 실제 화면에서는 상단/좌우/바닥과 충돌하므로 아래 상승 높이만큼 화면 밖으로 날아간다는 의미가 아니다.

| 입력 속도 | 초기 속도 전→후 | 0.5초 수평 거리 전→후 | 최대 상승 전→후 |
| --- | --- | --- | --- |
| 느림 0.3px/ms | 5 → 5 | 113.63 → 141.47px | 22.50 → 55.55px |
| 보통 1.2px/ms | 18 → 24.083 | 409.06 → 681.44px | 315.00 → 1312.18px |
| 빠름 3.6px/ms | 18 → 54 | 409.06 → 1527.92px | 315.00 → 6613.78px |

- 현재 30/60/144Hz에서 빠른 입력 0.5초 거리는 1527.92/1527.92/1527.67px. 별도 20/30/60/144Hz·불규칙 dt 검사에서는 비행 거리 편차 0.5% 이내/상승 높이 1% 이내, Draw 반발 후 1초 위치 차이 12px 미만/속도 차이 1 미만을 검사해 통과했다. 실제 FPS/CPU 측정은 아니다.
- 재현 명령: 현재 `node tests/grab-throw.cjs --measure`. 이전 코드는 수정 전에 `%TEMP%\desktopplayground-phase1a-renderer.js`로 보존했고 `PHYSICS_SOURCE`를 그 절대 경로로 설정해 같은 명령을 실행했다. 측정 후 환경변수를 제거했다. 이전 스냅샷 SHA-256 `69BC00ABB127926EDCE2E2C65ADAD0C661B5C95E0EB9B1B313528E5AD05DA7F7`. 저장소에 과거 제품 코드 복사본을 추가하지 않았다.

### 실행 결과와 수정 파일

- 수정: `renderer.js`, `tests/grab-throw.cjs`, `tests/smoke.cjs`, `docs/v1.1/IMPLEMENTATION_PLAN.md`, `docs/v1.1/QA_CHECKLIST.md`, 이 기록. 신규 이미지/의존성/테스트 전용 제품 API 없음. 1-A 변경을 덮어쓰거나 되돌리지 않았다.
- `node tests/grab-throw.cjs`: **34개 사례 PASS**. 기존 20개 행동 회귀를 유지하면서 의도적으로 바뀐 속도/감쇠/cap/반발 기대값을 갱신. 새 검사는 느림/보통/flick 실제 거리·최고점, 마지막 짧은 flick/정지 release, 자연 낙하, FPS/dt 비교, 강·약 바닥/경계, Draw 선·끝점·경사·사각형·타원/천장·바닥, one-way Platform 및 사다리 하강, 일반 중력/마찰 보존을 포함한다.
- `node tests/smoke.cjs`: **PASS**, TEMP appData 격리 Electron. 기존 기능 검사 유지, 합성 입력의 offset/정지/속도 유지/Trash와 최대 속도 Draw 벽 반발 검사 통과.
- `node tests/local-pets.cjs`: **PASS**, 의도적 invalid/missing fixture skip 경고는 예상 결과.
- `node --check`로 main/preload/renderer/controls/local-pets 및 tests/grab-throw/smoke/local-pets 8개 검사 **PASS**. `git diff --check` 및 변경 파일의 trailing whitespace/충돌 마커 검사 **PASS**.
- 개발 중 이전 상수 18/.98에 고정된 assertion은 새 밸런스와 맞지 않아 갱신했다. 추가 테스트의 가상 영역 크기가 다음 사례에 남는 fixture 문제를 고쳐 매 사례 1600×900으로 초기화한 뒤 전체를 재실행했다. 실패를 제품 체감 해결의 증거로 숨기거나 자동 통과만으로 수동 합격을 선언하지 않는다.

### 실제 사용자 재확인과 한계

- 실제 Windows에서 **느림/보통/빠름의 거리 구분**, 빠른 수평 flick의 화면 횡단·벽 반발, 상향 포물선/상단 반발, 가만히 놓기, 짧게 멈춘 뒤 release, 바닥/발판/Draw 반복 반발을 재확인해야 한다. 이번 수정의 실제 마우스 사용감은 아직 미검증이다. 기존 offset/Trash와 사다리 도중 Grab도 함께 확인한다.
- gain/cap/중력은 공통 초기 체감값이다. 실제 1080p/고 DPI 화면 크기와 마우스 이동량 차이에 따라 튜닝이 필요할 수 있다. cap 54에서 펫이 지나치게 튀는지, 지상 .94가 바닥 flick에 너무 짧은지 특히 확인한다.
- CCD는 Throw의 원형 hitbox와 선분 근사 기준이며 Sprite 외곽선과 정확히 일치하지 않는다. 작은/촘촘한 도형, Pet보다 좁은 틈, 그림을 펫 위에 새로 그려 겹친 시작 상태, 화면 resize 중 접촉은 전면 penetration solver로 해결한 것이 아니므로 수동 확인이 필요하다. 한 step에서 4회 충돌하면 남은 이동을 보수적으로 버려 관통을 피한다.
- 복잡한 Draw 600개 선분×다수 동시 Throw의 실 FPS/CPU와 장시간 검사는 미실행. 전체 Pet 수 제한은 추가하지 않았다. Throw 밖의 기존 Draw 반응/폭탄 지상 clamp, 블랙홀 구출, 단일 점 지우개, Sprite squash/anchor/시간, 구조물 이력 pruning은 후속 대상이다.
- v1.0.0 태그/버전 유지. build/commit/push 없음. 이번 작업은 Phase 1-B까지이며 Phase 1-C/1-D 및 새 캐릭터/장난감/UI는 진행하지 않았다.

## 2026-10-12 / Phase 1-C / Sprite 애니메이션과 상호작용 표현

### 범위와 실제 자산 조사

- `feature/v1.1`에서 기존 1-A/B 미커밋 변경을 유지했다. 관련 명세/진행 기록, README/ASSET_SOURCES/history와 현재 코드/테스트, 로컬 9개 `pet.json` 및 실제 WebP와 legacy Cat/Magpie까지 조사했다. 이미지 파일과 패키지 metadata는 변경하지 않았다.
- 로컬 ID와 원본 metadata ID가 다른 경우는 기존 로더 매핑이다: Brown=sanqian, Face=hami--tat, Sleepy=diandian--lllucasxu, Salary=monthly-salary-cat, 푸들=tudou, 커비(잠)=haaap, 우사기=usachi--jack. doge/kirby는 동일 ID. 모두 `spritesheetPath: spritesheet.webp`; pet.json에는 이 앱의 clip mapping이 없어 실제 시트와 현재 선택을 대조했다. spriteVersionNumber만 보고 없는 클립을 추정하지 않았다.
- Brown/Face/푸들과 legacy 2종은 1536×2288(8열×11행), 다른 로컬 6종은 1536×1872(8열×9행). 공통 셀 192×208. 실제 선택은 idle=0행 6프레임, walkRight=1행 8, walkLeft=2행 8, fall=4행 5, drag=5행 8(0-based). **11시트×5클립=55클립, 총 385개 사용 셀 모두 비어 있지 않음**. 4행의 뒤 3개 빈 셀은 선택하지 않는다. 좌우 전용 행이 있으므로 추가 좌우 flip을 하지 않는다.
- 실제 자세: Brown/시바/푸들의 drag에는 웅크림·눈 감음이 섞이고, 커비는 납작해지며, Face는 표정 변화, Sleepy 고양이는 엎드림, 커비(잠)는 졸린 모자를 유지한다. Salary는 소품과 몸 형태 변화, 우사기는 크기 변화가 있다. 기존 drag를 유지하라는 요구에 따라 임의 행 재배치/휴식 상태 구현은 하지 않았다. fall도 기존 공중/반응 자세를 사용하며 전용 새 당황 이미지가 있다고 가정하지 않는다.
- 발견: Sprite 분기에 squash가 없고 draw 호출마다 tick이 진행되어 144Hz에서 재생이 빨라졌다. 상태 변경 때 이전 frame/tick을 재사용했다. 고정 offsetY는 Brown/푸들의 짧은 걷기 자세와 Sleepy/커비의 투명 여백을 반영하지 못했다. 커비(잠)는 모자를 포함한 실루엣이 x축 중앙에서 벗어나 있다. 손상된 원본 프레임/현재 클립의 빈 참조는 발견하지 않았다.

### 구현과 시각 상수

- `spriteProfiles` 공통 데이터에 **클립 전체의 alpha>16 합집합** 바닥 좌표와 필요한 x 중심을 기록했다. 클립별 고정 기준을 `y+size`에 맞추므로 원래 프레임 안의 뛰기/웅크리기는 유지한다. 매 프레임 alpha 바닥을 강제 정렬하지 않는다. Brown 걷기 기준은 .8462/.8317, Sleepy 고양이 idle .7933, 커비 idle .899 등 차이를 반영한다. 커비(잠)만 클립별 x 중심 .3854/.4167/.4818/.4193/.388을 보정한다. 이는 렌더 설정이며 물리 중심, size/hitbox, Grab offset은 변경하지 않는다.
- Sprite는 발 기준 `scale(s,1/s)`로 squash/stretch한다. `s=1+(squish-1)*elasticity`. 기본 탄성 .55, Face .25(납작한 얼굴 보호), Sleepy/Salary .4(소품/긴 몸 보호), 커비 .7. 신규 ID fallback은 center .5/foot .976/elasticity .55. 기존 size×2.5 렌더 크기 유지. Canvas에도 기존 몸체 하단 기준 변형을 적용했다.
- 바닥/Platform/Draw 착지의 **반발 전 법선 속도**에 `clamp((speed-2)*.018,0,.4)`를 적용한다. 약한 정지 접촉에는 변형이 거의 없고 강한 충돌은 squish 최대1.4. 속도/반발 수식은 건드리지 않는다. 형태는 `1+(squish-1)*.85^dt`로 복구(기준 60Hz), 약 237ms 후 잔여 변형 10%, 약 472ms 후 1%. 잡는 동안 기존 squish1.4 유지. 화면 옆벽/천장에 별도 착지 squash를 새로 연결하지 않았다.
- 애니메이션은 update의 경과 ms로 진행하며 draw는 시간을 증가시키지 않는다. 상태 변경은 frame/time을 0으로 초기화한다. 기존 60Hz 기준 `(speed+1)×1000/60`ms/프레임 유지: idle183.33, walk83.33, fall100, drag116.67ms. 물리 substep 수나 vx에 따라 반복 속도가 빨라지지 않는다. 잘못된 row/frame/speed 또는 누락 클립은 유효 idle로 fallback, idle마저 잘못됐으면 그리지 않고 context를 복구한다.
- Throw 외부 상태 동안 vy가 0인 최고점/바닥 미끄러짐에서도 walk 대신 fall을 유지하고, 안정 착지로 기존 외부 상태가 끝나면 idle/walk로 복귀한다. Canvas 슬라임은 기존 Grab의 벌린 입/땀 표현을 Throw 중에도 재사용한다. 별도 자율 휴식/수면/활동성 상태는 추가하지 않았다.
- 1-A/B의 샘플링/gain/cap54/중력.22/공중.996/지상.94/반발/CCD/AI 복귀 조건은 유지했다. 시작4마리/무제한 생성, 목록/자산, Trash, 배회/점프/사다리/발판, Draw 입력, 폭탄/블랙홀, UI/IPC/설정 경로는 변경하지 않았다.

### 검증과 증거

- 환경: Windows x64, Node24.18.1, Electron29.4.6. `node tests/grab-throw.cjs`: **45개 PASS**(기존34+시각11). 상태 초기화, draw 횟수 독립, 공중 최고점/지상 Throw, clip fallback, 발 pivot/좌우 행, profile 예외, 강/약 착지·복원, Platform/Draw Sprite·Canvas, 슬라임 표정, 30/60/144Hz 복구와 5클립 60/144Hz 재생을 확인한다. DOM/시간은 VM stub이므로 실마우스 검증은 아니다.
- `node tests/smoke.cjs --sprite-preview`: **PASS**. 격리 appData의 실제 Electron Canvas에서 11시트 decode, 55클립/385프레임 alpha, profile 바닥·중심 값, 가장 낮은 idle 프레임의 원래/변형 후 발 위치 오차≤1px를 검증했다. 기존 startup/menu/Draw/Grab/Throw/Trash/Hide/Show/PC/HTTP0/Exit smoke도 통과했다.
- 실제 Electron의 전체 펫×5클립 첫 프레임 preview를 `%TEMP%/desktopplayground-phase1c-render.png`에 출력하고 직접 열어 방향/자세/발 기준/과도한 clip 잘림을 확인했다. 원본 선택 프레임 contact sheet도 TEMP에서 확인했다. 정적 그림 확인이므로 모든 프레임 사이의 동적 깜빡임 합격으로 간주하지 않는다. 제품/저장소에 새 이미지 없음.
- `node tests/local-pets.cjs`: **PASS**, malformed/missing fixture skip 경고는 의도된 결과. 5제품 JS+3테스트 JS의 `node --check`, `git diff --check` 및 신규 문서/테스트 공백 검사 통과.
- `node tests/grab-throw.cjs --measure`를 수정 전 TEMP 스냅샷(`desktopplayground-phase1b-renderer.js`, `PHYSICS_SOURCE`)과 현재 코드에 실행해 **30/60/144Hz 전체 JSON 결과 동일** 확인. 60Hz 느림/보통/빠름의 초기속도5/24.083/54, 0.5초 거리141.47/681.44/1527.92px, 최고상승55.55/1312.18/6613.78px로 1-B 보존. 측정 조건은 위 1-B 기록과 같다.
- 개발 중 native 발 검사의 첫 idle 프레임이 항상 가장 낮다는 가정은 실제 시트의 hop 때문에 실패했다. 이를 가장 낮은 실제 프레임으로 교정해 검사했으며, 원본 hop을 없애는 프레임별 정렬은 하지 않았다. 새 profile 테스트의 snapshot fixture 필드 오류도 실제 API 필드로 교정 후 전체 재실행했다.
- 이번 변경 파일: `renderer.js`, `tests/grab-throw.cjs`, `tests/smoke.cjs`, `docs/v1.1/IMPLEMENTATION_PLAN.md`, `docs/v1.1/QA_CHECKLIST.md`, 이 기록. 제품 파일은 renderer만 수정. build/버전 변경/commit/push/자산 수정 없음. Phase1-D/2 미착수.

### 실제 Windows 수동 확인과 남은 위험

- 모든 로컬9종(특히 Brown/시바/커비/우사기/Sleepy2종)에서 실제 마우스 Grab→Throw→강/약 착지→복원, 좌우 전환, 발판/그림 위 발 접촉, 60/144Hz 실화면의 깜빡임/전환 느낌을 확인해야 한다. 정적 preview와 합성 입력만으로 조작감 합격을 선언하지 않는다.
- 기존 시트 내 실제 hop/크기 변화는 유지돼 일부 프레임은 발이 기준선 위에 있다. 클립 간 자세 변화는 frame0 초기화로 처리하며 crossfade는 추가하지 않았다. 원형 hitbox는 Sprite 외곽선과 같지 않으므로 좁은 Draw 틈/경사/소품 접촉 및 Grab의 체감 중심은 별도 확인 대상이다.
- profile은 현행 원본의 alpha 측정값이다. 향후 시트 교체 시 smoke의 profile 검사 실패를 근거로 재측정해야 한다. 큰 Throw에서도 원본 fall만 사용하므로 전용 공중 표정이 없는 펫의 표현 한계는 남는다. 기존 RAF의 dt clamp(.25~3), 정체 시 catch-up 정책도 유지하여 긴 stall/240Hz 초과는 별도 범위다.

## 2026-10-13 / Phase 1-D / 잔여 버그와 상태 정리

### 현행 재현과 작업 범위

- `feature/v1.1`의 현재 미커밋 1-A/B/C, `AGENTS.md` 및 사용자 문서를 보존했다. 지침/명세/계획/QA/진행 기록, README/ASSET_SOURCES/history와 현재 renderer/테스트를 근거로 1-D만 수정했다.
- 수정 전 renderer를 `%TEMP%/desktopplayground-phase1c-renderer.js`에 보존하고 실제 입력 리스너를 쓰는 Node VM으로 다시 확인했다: **orbit 중 Grab→홀 밖 이동→release 후 기존 orbit 복귀=true**, **effects clear 후 orbit 잔류=true**, **점 중심 지우기 후 strokes=1**, **삭제 구조물 cleanup 후 recentStructures.size=1**. 원인을 확인한 부분만 수정했다.
- 수명 종료 frame에도 흡입을 수행한 뒤 참조를 해제하던 경로도 확인했다. 흡수된 인스턴스는 홀 전체 loop 뒤 필터링되므로 중첩 홀 처리에서 다시 접근하지 않게 보완했다. 새 물리/렌더 상수나 전역 상태 머신은 추가하지 않았다.

### 수정 및 상태 우선순위

- **Grab > Black Hole orbit > Throw > 자율 이동**. Grab 즉시 orbit을 null로 하고 기존 Throw/등반 상태도 기존처럼 해제한다. 드래그 중 홀 업데이트는 펫 위치에 접근하지 않는다. 홀의 새 포획은 기존 Throw 타이머와 climbingDown을 해제하며, 홀 종료 뒤 오래된 Throw를 재개하지 않고 기존 속도로 일반 물리에 복귀한다.
- 구출한 홀 ID를 인스턴스별 `rescuedFromHoles` Set에 기록한다. 놓은 뒤 홀의 반경190 안에 있으면 재포획을 막고, 물리 갱신에서 범위 밖임이 확인되면 제외를 해제한다. 재진입하면 기존처럼 **새 포획** 가능하다. 옛 궤도로 돌아가는 결함을 시간 제한의 우연에 의존하지 않고 해결한다. 다른 홀의 정상 새 포획까지 전역 면제하지 않는다.
- 홀은 기존 최대2개, 수명540 기준frame, .072×dt 궤도와 3.5회전 후 해당 인스턴스 삭제를 유지했다. 최대10개/방출모드 변경 없음. 만료된 홀은 해당 frame의 흡입/삭제를 수행하지 않는다. 만료·교체·effects clear에서 orbit과 구출 제외 ID 참조를 정리한다. 다른 홀 소유 orbit은 처리하지 않고 absorbed Pet은 추가 홀 처리에서 건너뛴다.
- `Pet.remove()`는 held/orbit/구출 제외/Throw 참조를 해제한다. 실제 인스턴스 목록 제거는 기존 호출 경로(흡입 filter, Trash filter, 정의 갱신/error filter, 전체 삭제)를 유지한다. Trash는 remove가 held 참조를 해제하기 전에 삭제할 인스턴스를 지역 변수로 보존해 다른 펫과 정의/구조물을 유지한다.
- Draw의 `shapeSegments`가 빈 배열이면 `redrawDrawing`은 기존처럼 중심점+size/2 원을 그린다. 이제 지우개도 같은 원과 기존 지우개 반경 `max(12,drawSize×2)`의 겹침을 검사한다. 길이0 line/rect/ellipse도 같은 fallback에 포함한다. 기존 점은 충돌체가 없는 장식으로 유지하고 새 점 collider는 만들지 않았다. 지우기 후 strokes/world.drawnShapes와 colliders/cache를 함께 재생성하며 일반 도형의 기존 선분 선택 반경은 변경하지 않았다.
- 구조물 cleanup의 기존5초 간격에서 유효 ID 집합으로 recentStructures/targetHistory/lastStructureId와 삭제된 support/climbing/targetLadderId를 정리한다. 비활성 방문 이력은 기존 탐색 점수의 유효 시간과 같은35초 후 만료한다. 현재 support/climbing/target은 TTL에서 제외하고 기존 keep 규칙으로 사용 중인 공유 플랫폼/사다리를 보존한다. targetHistory의 기존32개 제한 유지. 전체 구조물 삭제는 즉시 정리하고 climbingDown도 해제한다. OFF에서도 방문 참조만 정리하며 유효 구조물 자체와 생성 규칙은 보존한다.
- 1-A/B/C의 Grab offset, Throw 속도/gain/cap/중력/반발/CCD/AI 안정 복귀, Sprite clip/anchor/시간/squash 상수는 변경하지 않았다. 폭탄/홀 시각효과, 시작4종/기존 목록/무제한 생성, Draw 입력/도형, 공유 구조물, PC/툴바/보안/설정/자산 유지. 새 도구/캐릭터/활동성/UI 및 Phase2 미착수.

### 실제 실행한 검증

- 환경: Windows x64, Node24.18.1 / Electron29.4.6. `node tests/grab-throw.cjs`: **55개 PASS**. 기존45개 assertion은 그대로 두고 1-D10개 추가. 구출/재포획 해제·재진입, 만료·교체·효과 삭제, 중첩홀 소유/개별 흡수, finite 좌표/수명 끝 frame, Trash 참조, 점·길이0 도형 선택 경계, 일반4도형 지우기/collider/전체 삭제, 방문 이력·활성 경로 보호/OFF/전체 삭제, Throw 충돌 착지 AI 복귀 및10회 빠른 Grab/release 포함.
- `node tests/smoke.cjs`: **PASS**, 원본 userData 격리. 실제 Electron 합성 mouse 이벤트로 흡입→Grab→이동→release 위치/상태, effects clear, 구조물 이력 정리 검증. 실제 drawingCanvas의 점 중심 alpha>0→지운 뒤 alpha0/그림 데이터·collider 없음 확인. 기존 startup4/menu/PC/Hide/Show/Draw/Grab/Throw/Trash/HTTP0/Exit와 Sprite11시트55클립385사용프레임 검사 유지·통과.
- `node tests/local-pets.cjs`: **PASS**, invalid/missing fixture 경고는 의도된 결과. main/preload/renderer/controls/local-pets와 grab-throw/smoke/local-pets 총8개의 `node --check`, `git diff --check`, 변경6파일의 공백·충돌 마커 검사 **PASS**.
- 수정 전1-C snapshot을 `PHYSICS_SOURCE`로 지정한 `node tests/grab-throw.cjs --measure`와 현재 결과를 비교: **30/60/144Hz 전체 JSON 동일**. 거리·최고 높이와 느림/보통/빠름 차이를 유지한다. 환경변수는 측정 후 제거했다. 측정 상세 조건/수치는 위1-B/C 기록 참고.
- 개발 중 `remove()`가 held 참조를 먼저 정리하면서 Trash filter가 삭제 대상 대신 null을 참조하는 회귀를 기존 테스트가 발견했다. 삭제 인스턴스를 지역 변수에 보존하는 최소 수정 후 전체55개와 Electron Trash 검사를 통과했다. 테스트 기대값을 약화하지 않았다.
- 수정 파일: `renderer.js`, `tests/grab-throw.cjs`, `tests/smoke.cjs`, `docs/v1.1/IMPLEMENTATION_PLAN.md`, `docs/v1.1/QA_CHECKLIST.md`, 이 기록. build/portable 생성/버전 변경/commit/push/태그·자산 수정 없음.

### 수동 확인과 남은 위험

- 실제 Windows 마우스의 홀 구출/홀 내부 정지 release/빠른 Throw/Trash, 겹친 두 홀의 새 포획, 효과 clear·교체·Hide 전환을 확인해야 한다. 홀 내부에서 놓아도 구출 제외는 해당 홀 범위 밖으로 실제 이동할 때까지 유지하는 의도된 정책이다.
- 단일 점과 도형 지우기 경계의 실제 DPI 체감, 사다리 등반·발판 지지 중 구조물 삭제/OFF·ON, 실제 click-through/Tray 복구 및 장시간 다수 펫 상태·메모리 검증은 이번에 직접 수행하지 않았다. 자동 회귀의 finite 좌표 검증은 모든 가능한 NaN 입력을 처리하는 새 validation 계층을 의미하지 않는다.
- TTL과 참조 정리는 기존 cleanup 주기에서 수행하므로 임의 삭제 뒤 오래된 이력은 다음 활성 렌더 cleanup까지 최대 약5초 남을 수 있다. 명시적 전체 구조물 삭제/효과 삭제는 즉시 정리한다. 동작 중인 플랫폼/사다리의 구조·생성 밀도/외형은 변경하지 않았다.
- 1-C의 모든 동적 프레임/DPI 시각 QA와 1-B 실제 손맛 재검증도 미검증 상태를 유지한다. 이번 작업은 Phase1-D 종료이며 Phase2 이후 작업을 시작하지 않았다.

## 2026-10-13 / Phase 2-A / 캐릭터별 활동성과 기본 자율 행동

### 범위 및 결정

- 시작 작업 트리: `feature/v1.1`, HEAD `c465470`(사용자가 보존한 Phase1 완료 커밋), `AGENTS.md`만 untracked. 해당 변경과 v1.0.0 태그/배포를 유지했다. 현재 지침/명세/계획/진행·QA/캐릭터 가이드, README/ASSET_SOURCES/history 및 실제 renderer/테스트를 기준으로 구현했다.
- 기존 chooseNavigation/chooseRoamX와 경로 탐색/구조물 생성 알고리즘은 Roam에서 호출한다. Roam 시간이 끝나면 Look/Rest/Idle 중 하나를 선택하고, 정지 상태 종료 뒤 반드시 Roam으로 돌아간다. Roam→Roam 무한 선택은 하지 않는다. 초기 시간은 인스턴스별 랜덤으로 시작하여 같은 종의 전환이 동기화되지 않게 한다.
- 사용자 최신 요청에 따라 **푸들은 보통**, **커비(잠)는 매우 차분함**으로 명세/가이드의 이전 방향을 보완했다. 이는 사용자 요구 반영이며 임의 성격 변경이 아니다. 수면·특수 행동, 새 이미지/캐릭터/장난감/UI, 전체 Phase2의 Canvas 메뉴 축소는 이번에 구현하지 않았다.

### 설정 데이터 (초기 밸런스)

ID→profile→category fallback(cat=calm, dog=normal)→normal 공통 설정 순서다. 이동 속도·점프 높이를 캐릭터별로 높이지 않고, 안정된 지상에서의 시간 배분과 기존 점프/방향 전환 빈도를 조정한다.

| profile / 대상 | Roam 초 | Idle 초 | Rest 초 | Look 초 | Roam 종료 시 Look/Rest/Idle 확률 | 기존 점프/회전 빈도 배율 |
| --- | --- | --- | --- | --- | --- | --- |
| sleepy / Sleepy고양이·커비(잠) | 1.8~3.5 | 1.8~3.2 | 6.5~12 | .9~1.8 | 15/80/5% | .05/.35 |
| calm / Brown·Salary | 2.5~4.5 | 1.5~2.5 | 4~7.5 | .8~1.5 | 20/70/10% | .12/.6 |
| normal / Face·푸들·슬라임 | 2.5~4.5 | 1~2.2 | 3~5.5 | .7~1.4 | 25/55/20% | .2/.8 |
| lively / 커비 | 3.5~5.5 | .8~1.6 | 2~4 | .6~1.1 | 30/50/20% | .25/1 |
| active / 시바 | 4.5~6.5 | .6~1.4 | 1~2.2 | .5~1 | 35/45/20% | .3/1.2 |
| veryActive / 우사기 | 5~7.5 | .4~1 | .8~1.6 | .4~.9 | 45/35/20% | .4/1.4 |

- 상태 선택 확률은 프레임마다가 아니라 Roam 유지시간 종료 시 적용한다. 점프/무작위 방향 전환은 `1-exp(-기존chance×profile배율×dt)`로 elapsed time 기반 확률을 적용한다. 기존 chooseNavigation/구조물 생성 조건·위치·제한·cooldown은 그대로이며 호출은 Roam에서만 한다.
- 처음 높은 점프 배율로 측정했을 때 체공 중 자율 시계가 양보하므로 휴식 진입이 너무 늦었다(시바 Roam93.88%, 우사기96.32%). 프로필의 배회·휴식 시간과 **자율 점프 빈도**를 줄여 조용한 방치 목표에 맞췄다. 중력/점프 impulse/Throw 상수를 조정하지 않았다.

### 상태와 물리 우선순위

- Grab/orbit은 기존 early-return, Throw는 기존 externalMotion 물리를 유지한다. 등반도 기존 상승/하강 경로를 먼저 실행한다. 이 동안 자율 시계가 멈추며 자율 감속/점프/목적지 steering을 실행하지 않는다.
- 자율 행동은 grounded, |vy|≤1.5, |vx|≤3, squish≤1.12, 외부 상태/반응 hold 없음일 때만 진행한다. 시간은 `dt×1000/60`ms로 누적하고 경계 오차 epsilon을 둔다. 공중 이동·큰 속도·강한 반응을 정지 상태가 덮어쓰지 않는다. 정상 점프의 체공도 타이머에서 제외하므로 표의 시간은 전체 관찰 벽시계와 다르다. 기존 RAF dt clamp/Hide 동안 정지 정책 유지.
- Idle/Rest/Look은 작은 기존 속도에만 `.7^dt` 감속을 적용해 서서히 멈춘다. 중력/마찰/충돌/펫 간 밀림은 계속 처리하고 기존 탐색 목적지는 보존하여 복귀 후 재검사한다. 휴식 중 발판/사다리 lastUsedAt·현재 지지 보호는 유지한다.
- 강한 착지(충돌 전 속도≥6)는 자율 제어만300ms 양보하며 기존 squash/반발은 유지한다. Bomb는 기존 impulse 수식 그대로, 자율 상태를 Roam으로 깨우고700ms 양보한다. Bomb가 등반에 덮어쓰이지 않도록 등반/탐색 참조를 해제한다. Grab/Throw 시작과 orbit 포획도 Roam으로 초기화하여 이전 휴식에 고착하지 않는다. Bomb를 Throw 전용 물리로 바꾸지는 않았다.
- 정지 Sprite는 기존 idle, Grab/Throw는 기존 drag/fall. Look 중간에 한 번 방향을 바꾸며 Sprite는 발 기준 ±.035rad(약2도) 기울임, 슬라임은 기존 눈의 ±2px 시선으로 보완한다. 새로운 행이나 sleep 클립을 참조하지 않는다. Phase1 clip/발/탄성/프레임 시간과 squash 복원 상수는 유지한다.

### 3분 관찰 측정

`node tests/autonomy.cjs --measure`: 현재 renderer 전체를 VM 실행, 시계/DOM stub, LCG seed731. 60Hz, 1600×900, 구조물OFF/다른 펫·외부 입력 없음, 각 캐릭터1마리를 바닥에 놓아180초 관찰. 물리/탐색/확률은 실제 코드다. 실제 수평 이동=|vx|>.5, 정지=|vx|<.5 및 |vy|<1.5. 이는 화면 이동/정지의 대리 지표이며 점프·느린 이동 때문에 둘의 합은100%가 아니다. Roam 비율은 상태의 관찰 벽시계 비율로, 실제 걷기와 같지 않다.

| 대상 | Roam 상태 | Rest 상태 | 실제 수평 이동 | 정지 | 최장 연속 수평 이동 | 상태 전환 횟수 |
| --- | --- | --- | --- | --- | --- | --- |
| Brown | 49.64% | 44.84% | 45.07% | 53.38% | 5.25초 | 40 |
| Face | 64.68% | 21.78% | 55.92% | 41.17% | 5.13초 | 54 |
| Sleepy고양이 | 25.49% | 71.95% | 24.62% | 75.02% | 4.72초 | 30 |
| Salary | 49.64% | 44.84% | 45.07% | 53.38% | 5.25초 | 40 |
| 시바 | 86.78% | 7.08% | 71.04% | 23.96% | 7.13초 | 40 |
| 푸들 | 64.68% | 21.78% | 55.92% | 41.17% | 5.13초 | 54 |
| 우사기 | 90.85% | 4.91% | 70.20% | 21.50% | 7.90초 | 34 |
| 커비 | 75.06% | 19.06% | 64.48% | 32.06% | 7.88초 | 46 |
| 커비(잠) | 25.49% | 71.95% | 24.62% | 75.02% | 4.72초 | 30 |
| 슬라임 | 63.56% | 25.77% | 57.56% | 40.25% | 5.72초 | 52 |

- 같은 profile/seed/behavior의 일부 펫은 결과가 같다. 이는 실제 앱에서 동시에 같은 난수를 공유하거나 동기화한다는 뜻이 아니다. 나머지 시간은 Idle/Look이며 CLI JSON에 전체 상태 비율을 출력한다.
- 우사기는 높은 점프 빈도로 수평 이동률 자체가 시바보다 약간 낮지만 Roam 비중과 점프 배율이 높다. 활동성을 수평 이동률 하나로 순위화하지 않는다. 모든10종에 정지/전환이 관찰됐고, 자동 검사는 최장 연속 수평 이동<30초를 요구한다. 단일 seed·단독 환경의 초기 밸런스이며 실화면 만족도/다수 상호작용 통계는 아니다.

### 검증 결과 및 파일

- `node tests/autonomy.cjs --measure`: **새12개 + 기존55개 =67개 PASS**. 데이터 mapping/fallback, 휴식 감속·탐색 재개, 30/60/144Hz의 Idle/Rest/Look1초 유지·중간 방향(오차<1e-6ms), 공중/지상 큰 충격, 휴식·등반 중 Bomb, 사다리 양방향, Grab/Throw/orbit 복귀, 강한 착지·복원, 기존 idle 사용,25마리20초 상태·유한 좌표·공유 구조물, Roam 자동 생성/Rest 생성 중지,10종180초 활동 비교.
- `node tests/grab-throw.cjs`: 기존 **55개 PASS**, 기존 assertion/기대값 유지. 테스트 harness만 export하여 새 autonomy 테스트가 기존 전체 검사를 함께 실행하게 했다. `--measure`는 직접 실행할 때만 처리하여 import 시 프로세스 종료를 방지한다. 새 테스트 전용 제품 API/의존성 없음.
- `node tests/smoke.cjs`: **PASS**, 격리 userData Electron. 새 Brown rest/idle clip/1초 타이머/Bomb 반응 검사와 Phase1 전체 기능·Sprite11시트55클립385프레임 검사 유지. `node tests/local-pets.cjs`: **PASS**, invalid/missing fixture skip 경고는 예상 결과.
- `node tests/grab-throw.cjs --measure`의 현재 결과와 수정 전 `%TEMP%/desktopplayground-phase1d-renderer.js`를 PHYSICS_SOURCE로 지정한 결과는 **30/60/144Hz 전체 JSON 동일**. Throw의 느림/보통/빠름 이동 거리·최고 높이 차이 보존. 환경변수는 측정 후 해제.
- main/preload/renderer/controls/local-pets 및 grab-throw/smoke/local-pets/autonomy 총9개 `node --check`, `git diff --check`와 신규 파일 공백/충돌 마커 검사 **PASS**. Node24.18.1/Electron29.4.6, Windows x64.
- 개발 중144Hz의 반초 경계 부동소수점 오차를 발견해 epsilon 처리했고, 신규 테스트의 category/VM 변수 fixture 오류와 import 시 기존 --measure 종료를 수정 후 전체 재실행했다. 기존 회귀 기대값을 바꾸지 않았다.
- 수정: `renderer.js`, `tests/grab-throw.cjs`, `tests/smoke.cjs`, 신규 `tests/autonomy.cjs`, `docs/v1.1/V1_1_SPEC.md`, `CHARACTER_GUIDE.md`, `IMPLEMENTATION_PLAN.md`, `QA_CHECKLIST.md`, 이 기록. 메뉴/목록/시작4종/무제한 생성, Draw/홀/Bomb 시각효과, PC·툴바·IPC·보안·설정·기존 자산 유지. build/commit/push/버전 변경 없음. Phase2-B 미착수.

### 실제 사용자 확인 및 남은 위험

- 실제 Windows에서 대표 펫3종 이상3분 관찰: Brown/Sleepy의 충분한 쉼과 시바/우사기의 활동 차이, Look 기울임과 시선, 클립 전환/발 접촉, 쉬던 펫의 Bomb·Grab/Throw 반응을 확인해야 한다. Rest는 기존 idle를 재사용하며 본격 수면 표현은 아직 없다.
- 구조물ON·25마리·DPI/60·144Hz·Hide/Show 환경에서 실제 탐색/등반 복귀·새 경로 생성 빈도·CPU/메모리/FPS를 확인해야 한다. Roam에서만 기존 생성 알고리즘을 호출하므로 시간당 경로 생성량이 줄 수 있으나 생성 밀도 설정/geometry 규칙은 변경하지 않았다.
- 타이머는 안전한 자율 시간에만 진행하므로 체공/충격/혼잡한 밀림/등반이 잦으면 벽시계로 본 Roam이 길어진다. 이번 단독 측정에서 연속 이동 고착은 없었지만 실제 다수 펫 장시간 관찰은 별도다. Hold300/700ms와 profile 시간은 실제 방치 피드백으로 조정할 수 있는 초기값이다.

## 2026-10-13 / Phase 2-B / 펫 표현·Sprite 품질·겹침·보조 효과 설정

이 절은 최초2-B의 당시 결과다. 공통행/전체Look 선택·Zzz 표현과 활동 측정은 아래 **Phase 2-B 품질 보완** 기록이 최신이며 해당 항목을 대체한다.

### 범위와 사용자 결정

- Phase1 및2-A의 현재 미커밋 변경을 보존하고 Phase2-B만 구현했다. 사용자의 이번 요청으로 펫 간 밀어내기 제거, 고양이 표시 이름 한글화, 기본슬라임만 메뉴 노출, 기존 시트의 휴식 표현, 공통 보조 효과 ON/OFF를 확정했다. 추가 승인 없이 요청 범위 안에서 처리했다.
- 내부 ID/경로/pet.json, 시작4마리(blob/cat_brown/doge/kirby), 생성 무제한, 기존 물리 상수·활동성 프로필, Draw·Platform·사다리·Bomb·Black Hole최대2개/흡입삭제·Touch/Trash·PC/툴바/보안경계·userData 경로는 보존한다. build/버전변경/commit/push 없음.

### 확인한 원인과 최소 변경

- `Pet.updateStep`의 매 substep 전체펫 순회가 가까운 펫에 `.32*(1-distance/desired)*dt`의 밀어내기 vx를 가했다. 이 루프를 제거했다. 겹친 펫에도 분리 힘·강제 위치 보정이 없다. 구조물 탐색의 zone/경로 혼잡 점수는 탐색 선택 시에만 유지하며 물리 충돌 검사와 구분한다. 지형·Draw·Platform one-way와 등반 코드는 유지했다.
- 실제9개 로컬pet.json과11시트(legacy2개 포함)를 확인했다. 모두8열/셀192×208, 9행 또는11행이고 앱 clip metadata는 없으므로 실물을 기준으로 판단했다. 1-C의 nonempty/anchor 검사는 이미지 내부 분절을 판별하는 검사가 아니므로 이번 확대 점검에서 새로 확인된 황색냥 문제를 보완한다.
- **황색냥 원본2행 좌측walk, 특히5~7열에 얼굴/발 분절 조각이 셀 내부에 존재한다.** 1행은 정상이며 양 행 bbox의 좌우 투명 경계5px와 고정crop은 정상이다. crop을 넓히거나 자산을 재제작하지 않고, profile의 `walkLeft`만1행8프레임+flip+우측anchor로 교체한다. 원본11시트/9개pet.json은 전혀 수정하지 않았다. 정상인 다른 좌측클립은 유지한다.
- 표시 이름/tooltip: Brown→황색냥, Face→얼굴냥, Sleepy→실눈냥, Salary→영업냥. sourceId/name metadata와 저장된 ID는 유지한다. 기본/고양이/강아지/캐릭터4카테고리 유지, 기본선택지만blob1개로 축소한다. 숨긴 legacy 정의/이미지는 삭제하지 않는다.
- 공통 `spriteProfiles.clips`에 row/start/frames/speed/anchor/foot/center 지원. 황색냥Rest7행0~5(그루밍), 얼굴냥Look8행0~5(표정/소품), 푸들Rest7행0~5, 커비(잠)Rest5행2~4(실제 눈 감은3장)를 연결한다. 실눈냥Rest는 이미 웅크린0행을 느리게 재생한다. 없는 펫은 기존idle를 느리게 재생하며 Look 기울임·시선/기존탄성을 유지한다.
- Rest의 호흡은 일반±0.6%, 수면±1.2%, 발pivot에서만 렌더 변형한다. 슬라임은 Rest에 선형 감은 눈을 그린다. 실눈냥/커비(잠)의 수면은 **기존 Rest 표현**이며 영구sleep 상태/새 활동성 확률을 추가하지 않는다. Grab/Throw/orbit/등반/불안정공중은 quiet 표현보다 우선한다. clip/cadence 전환 시frame/time 초기화, 실제 경과시간 재생 유지. 수면Zzz는 프레임당 직접 그리며 persistent particle을 만들지 않는다.

### 보조 효과 설정과 호환성

- Tray **보조 효과 표시** checkbox→기존 직렬`petWriteChain`→atomic설정 저장→app:state broadcast. schemaVersion1에 선택 필드`auxiliaryEffectsEnabled`만 추가하며 누락/잘못된 값은ON, 명시false는OFF다. 기존 파일/경로/펫설정/사용자이미지는 그대로 유지한다. 새 production IPC/preload API나 toolbar 변경이 없다. 저장 실패 시 state는 바꾸지 않고 Tray를 실제 state로 복원하며 경고를 기록한다.
- OFF: 새Zzz, Canvas땀방울, Bomb보조링/섬광/파티클/화면흔들림만 숨긴다. 기본표정·시트에 그려진 소품/효과·호흡·squash, Draw, 폭탄자국·블랙홀본체, 물리/충돌/흡입/삭제는 유지한다. 기존 효과 수명/이동은 OFF에서도 갱신하여 재활성화 시 오래된 효과가 정지해 남지 않는다. 폭탄의 기존 난수/impulse 흐름도 그대로다.
- 향후 말풍선/데미지숫자/피격이펙트는 이 공통flag를 따른다. 이번에는 해당 도구나 효과를 새로 구현하지 않았다.

### 실행한 검증과 측정

환경: Windows x64, Node24.18.1, Electron29.4.6. VM은 mock DOM/시계, Electron은 TEMP 복사본·격리userData·외부HTTP차단·합성입력이다.

- `node tests/pet-expression.cjs`: **새9개+기존Grab/Throw55개+autonomy12개=76개 PASS**. 101마리 완전겹침2초 뒤x/y/vx동일,20이웃 유무 Throw경로동일, 황색냥행/반전/foot, 검증된표현·fallback,5종30/60/144Hz frame/time 일치·draw불변, Grab/Throw/orbit/ladder/공중우선, OFF의Zzz숨김·기본pose유지, Bomb/Throw물리동일,41마리휴식persistent효과0.
- `node tests/grab-throw.cjs`: **55개 PASS**, 기존 물리/입력/지형/Trash/orbit/구조물이력 검사 기대값 유지.
- `node tests/autonomy.cjs --measure`: **기존55+12=67개 PASS**, 10종×180초 단독가상관찰·25마리20초·구조물공유/등반·상태복귀 유지. 아래 비율은2-A와 동일하다(60Hz,1600×900,구조물OFF,seed731). 같은 프로필의 결과가 같은 이유와 단독가상환경의 한계는2-A 기록 참고.

| 펫 | Roam 상태 | Rest 상태 | 실제 수평 이동(속력>.5) |
| --- | --- | --- | --- |
| 황색냥 | 49.64% | 44.84% | 45.07% |
| 얼굴냥 | 64.68% | 21.78% | 55.92% |
| 실눈냥 | 25.49% | 71.95% | 24.62% |
| 영업냥 | 49.64% | 44.84% | 45.07% |
| 시바 | 86.78% | 7.08% | 71.04% |
| 푸들 | 64.68% | 21.78% | 55.92% |
| 우사기 | 90.85% | 4.91% | 70.20% |
| 커비 | 75.06% | 19.06% | 64.48% |
| 커비(잠) | 25.49% | 71.95% | 24.62% |
| 슬라임 | 63.56% | 25.77% | 57.56% |

- `node tests/smoke.cjs --sprite-preview` 및 최종`node tests/smoke.cjs`: **PASS**. 기존전체smoke+한글4이름/4카테고리/기본슬라임,11시트55기본클립385프레임·5override29프레임의native decode/alpha/anchor, 황색냥8장반전렌더, 보조효과OFF Canvas alpha0/aging·ON표시, 실제Tray checkbox콜백/broadcast, legacy schema필드없음ON→OFF저장→**프로세스재시작OFF**→ON저장, 기존defaultPets false/유효customPet·이미지바이트 보존 확인. 테스트용IPC/preload hook은TEMP 테스트앱에만 추가하며 production에는 없다.
- 황색냥 반전 픽셀비교는 수평1:1목적지에서 수행하여 GPU subpixel sampling 차이를 분리했다(alpha허용1/255, premultiplied RGB허용2/255). 일반표시크기의 native11종×5자세 및10종×Idle/Rest/Look contact sheet를 직접 열어 확인했다. 첫preview의상단여백부족을 테스트산출물에서만 수정한 뒤 다시 확인했다.
- `node tests/local-pets.cjs`: **PASS**, 로컬9개 유효패키지/한글label/ID와 기존invalid JSON/WebP/누락skip 유지. invalid/missing fixture 경고는 예상 결과.
- `node tests/grab-throw.cjs --measure`: 수정 전2-A renderer TEMP snapshot(PHYSICS_SOURCE)과 현재 **30/60/144Hz 전체JSON 동일**. 60Hz 느림/보통/빠름 입력 .3/1.2/3.6px/ms에서 초기vx5/24.083/54,0.5초 수평거리141.47/681.44/1527.92px,상승55.55/1312.18/6613.78px. 경계없는가상공간이며 실제화면밖이동이아님. 기존throwPhysics/cap/물리단위는 재조정하지 않았다.
- main/preload/renderer/controls/local-pets 및grab-throw/autonomy/pet-expression/smoke/local-pets 총10개`node --check`, `git diff --check` PASS. 신규테스트/문서 공백도 확인한다.

### 변경 파일과 남은 위험

- 이번2-B 수정: `renderer.js`, `main.js`, `controls.js`, `local-pets.js`, 신규`tests/pet-expression.cjs`, `tests/smoke.cjs`, `tests/local-pets.cjs`, v1.1의SPEC/CHARACTER_GUIDE/IMPLEMENTATION_PLAN/QA_CHECKLIST/이기록. 기존2-A의grab-throw harness/autonomy테스트 등 작업트리는 보존했다. README/ASSET_SOURCES/history/원본이미지/패키지파일/버전은 수정하지 않았다.
- 실제Windows 수동조작/방치 QA는 미실행: 황색냥좌측8장·방향전환·발·깜빡임, 실눈냥/커비(잠)수면/기상·새그루밍/Look자연스러움, 실제TrayON/OFF/재시작·Grab/Throw/Bomb/홀/등반중전환,60/144Hz·DPI/화면가장자리·PCclick-through/Hide/Show.
- 101마리겹침·41마리조용한표현은가상상태검사이며 실제FPS/CPU/메모리측정이 아니다. 다수겹친펫/구조물ON/30분방치 성능·보이는선택대상구분은추가수동확인대상이다. 원본을훼손하지않은우회이므로 향후다른렌더러가 원본황색냥2행을직접쓰면같은결함이보일수있다.

### 향후 구현 후보 (이번에는 미구현)

- 개인용캐릭터: **파닥몬, 테리어몬, 치이카와, 쿠리만쥬, 우소우소**. 별도package/권리·자산준비후 연결하며 공개배포자산과 분리한다.
- 캐릭터별특수스킬: 예를들어 **커비가 전방 부채꼴 범위의 다른 펫을 빨아들이는 스킬**. 발동조건/대상·흡입후처리/상태우선순위/쿨다운/효과OFF동작은 별도설계가 필요하며 아직 결정하거나 구현하지 않았다. 기본펫끼리충돌제거와 능동스킬상호작용은 구분한다.
- 다음범위는 사용자후속요청에따른다. Phase3의망치/총/BH10개, 신규캐릭터, 구조물디자인, 툴바전면개편은 진행하지 않았다.

## 2026-10-13 / Phase 2-B 품질 보완 / 개별 애니메이션과 움직임 원인 분리

### 요구와 범위

사용자가 제공한 새 SPRITE_INVENTORY/PET_ANIMATION_PLATFORM/SPRITE_REWORK_PLAN, 기존 QA/진행 기록, 실제 코드와9종 원본을 대조했다. feature/v1.1의 기존 미커밋 작업과 새 사용자 문서/INSTALL.txt/AGENTS.md를 보존했다. 이번 요청에 따라 최초2-B의 Look/Zzz/공통클립 가정을 수정하고 자율 점프 착지와 외부 충격을 분리했다. 활동성 preset 숫자, Throw 입력·물리 상수, 시작4종/한글명/무제한 생성, 펫 간 비충돌, 도구/구조물/UI/설정·IPC/보안/원본 자산을 보존한다. 신규 캐릭터·스킬·망치·총·구조물 디자인·툴바/build/버전변경/commit/push는 진행하지 않았다.

### 자율 점프 반발 원인과 수정

- 화면 바닥은 externalMotion이 없어도 `vy * bounce(-.6)`를 적용했다. 자율 점프를 시작하는 두 경로에 원인 표시가 없었으므로 정상 포물선 이후 또 튀었고, Platform/Draw의 일반 착지vy0와도 달랐다. Bomb은 순간속도·700ms행동보호만 적용하여 외부 충격 소유권 없이 일반 충돌 경로를 탔다.
- `motionCause`를 null/`autonomous-jump`/`throw`/`bomb`으로 관리한다. 실제 floor/Platform 자율 점프는 beginAutonomousJump, 사용자 Throw는 beginThrow, Bomb은 기존 impulse 직후 beginImpact를 사용한다. 외부 소유권은 source/elapsedMs/stableMs를 가진 기존 externalMotion 구조로 관리하며 자율 점프 중 Bomb도 우선한다.
- 외부 소유권이 없는 일반 낙하·자율 점프는 바닥/Platform/Draw 착지vy0와 squash만 적용한다. 자율 점프 원인을 해제하고 최소200ms 착지 보호(기존 강한착지300ms와max)를 두어 같은 프레임 재점프를 막는다. 보호 후 기존 자율 행동으로 돌아간다. 전역 restitution을 낮추지 않았다.
- Throw는 기존 gravity .22/air .996/ground .94/restitution .65/wall .72/max54/8초 및 안정화 조건을 유지한다. Bomb은 이전 일반 gravity .5/friction .98/floor .6/wall1/초기 성분cap19·갱신vxcap18을 유지하면서 보호된 swept Draw/Platform 경로를 사용한다. 외부 vy의 안전 상한54와 substep은 공유한다. 안정접촉120ms·경과200ms 또는 최대5초 뒤 Bomb 소유권을 종료한다. Grab/orbit/삭제도 이전 원인을 정리한다.
- 자율점프 상승·최고점은jump, 작은 양수vy의 하강부터fall을 선택해 최고점 근처의idle 깜빡임을 막는다. Jump/Fall의비반복clip은 마지막프레임을 유지하며 물리 착지시 정상표현으로 돌아간다.

### 스프라이트 원인과 공통 구현

- 9개 WebP hash가 새 Inventory와 모두 일치한다. 각 pet.json/sourceId/1536너비/8열/192×208셀/9·11행과 실제 원본프레임을 확인했으며 WebP/pet.json은 수정하지 않았다. 원본 이미지 변경·백업이 필요한 상황은 없었다.
- 기존 로컬9종이 대부분 공유 sheetClips를 사용해 동작 의미가 다른 행을 선택했다. 첫2-B의 얼굴냥Look도8행 전체를 반복하여 실제안경·손가락2/3열이 재생됐다. 여기서 **row8=0-based, Inventory의9행=1-based**다. 원본의row/column을 명시한 최신 확정표를 Inventory6절에 추가했다.
- 공통 렌더러를 유지하고9종별profile을 definition.animation으로 참조한다. frames 배열(비연속/되돌아보기 허용), frameMs, loop:false, 직접mirrorOf, 명시fallback, 고정center/foot/centerY와 선택적scale을 지원한다. mirror는초기화때한번해결하고 이미지·프레임배열은렌더중재생성하지않는다. legacyCat/Magpie만기존count/speedadapter를유지한다. 새animation.json파일로더나플러그인시스템은만들지않았다.
- row/column/목록/양수시간/유한anchor/scale/loop를검증하고 최대10회fallback후표시불가상태는안전하게건너뛴다. 시계는실제경과시간이며draw횟수와무관하다. 기준점은선택한프레임alpha>16 union에서클립단위로고정한다. bbox를프레임마다같은크기로강제확대하지않는다. 얼굴냥만center origin,나머지는physical foot이다.

| 펫 | 실제 품질 보완 |
| --- | --- |
| 황색냥 | 손상2행 대신정상1행반전유지.11행시트idle7장활용,4행중간공중·5행일부drag·7행그루밍·9행Look. 눕고일어나는drag변형셀제외 |
| 얼굴냥 | 안경/손가락8행2/3과치아7행제외. Look0/1/4/5·Rest0/1/5·Sleep1/5선택. 입벌림보행대신idle fallback,표정별center origin보정 |
| 실눈냥 | 기존좌우/웅크린수면보존.4행공중·6행Rest·0행Sleep·8행일부Look을개별선택 |
| 영업냥 | 분절1/2행·다른캐릭터3행·전복책상0행·과장7행제외.8행노트북기본·6행키보드Rest·5행일부drag(고정scale .9). 실제보행/공중은idle fallback |
| 시바 | 정상좌우유지.4행중간jump/fall·5행누움제외drag·6행Rest·8행Look |
| 푸들 | 푸른소품1/2행제외.3행앞발동작보행fallback·좌반전,4행공중·5행일부drag·7행Rest·9행Look |
| 커비 | 정상좌우와탄성 .7유지.4행중간공중·5행납작셀제외drag·6행일부Rest/Sleep,Look idle fallback |
| 커비(잠) | 기존좌우유지.4행중간공중·5행일부drag/Rest/눈감은Sleep·6행Look.7행하품/흡입기본재생제외 |
| 우사기 | 기존좌우유지.4행중간공중·5행누움3열제외drag·0행감은눈Rest/Sleep·7행Look |

- 생성 Zzz를 제거했다. 이모지/안경/말풍선/임의소품 오버레이는 추가하지 않는다. 원본 소품도 명시선택한clip에서만 쓴다. 보조 효과 ON/OFF와 저장/Tray는 그대로이며 기존 Canvas땀방울·Bomb보조렌더·향후승인효과에 적용한다.
- 활동성 preset 값은 그대로다. Rest/Sleep은표현이며새자율Sleep상태는없다. 실제보행이없는얼굴냥/영업냥은idle,소품없는측면보행이없는푸들은앞발동작fallback을사용한다. 영업냥이책상과함께이동하는한계는원본부족으로남기며새이미지를만들지않았다.

### 실행한 검증

환경: Windows x64, Node24.18.1/Electron29.4.6. VM은 mock DOM/시계, Electron은TEMP복사앱·격리userData·합성입력·외부HTTP차단이다.

- `node tests/grab-throw.cjs`: 기존55개PASS. Throw물리/거리·높이/offset/Trash/지형/사다리/orbit/정리검사는기대수치변경없이유지했다.
- `node tests/autonomy.cjs --measure`: 기존55+12=67개PASS. 최신검증된BrownLook을사용하도록표현기대값1개만갱신했다. 성격mapping·시간·충격우선·등반·25마리·공유탐색과3분관찰유지.
- `node tests/pet-expression.cjs`: 기존67+13=80개PASS. 기존겹침/물리독립/우선순위·5종시계에9종전클립30/60/144Hz2초검사,금지프레임,최고점·저속하강/비반복hold,잘못된목록/순환fallback/Canvas균형을추가했다. Look/frame리스트/Zzz관련기대값은이번명시요구대로수정했다.
- `node tests/jump-landing.cjs`: 기존55+새8=63개PASS. floor/Platform/Draw×30/60/144Hz1회자율점프→추가반발없음/복원,실제자율결정의원인표시,일반낙하안정,빠른Throw반복반발,Throw/Bomb세지형반발,점프중Bomb우선/종료/AI복귀,5초기한,Bomb화면/Draw벽,Grab/Throw/orbit원인정리. VM사례중복제외총88개다.
- `node tests/smoke.cjs --sprite-preview`및최종`node tests/smoke.cjs`: PASS. 기존PC/도구/구조물/삭제/Grab/홀/Tray·설정·재시작회귀와11원본시트55legacy행선택385nonempty셀검사를유지했다. 별도로**실제9프로필81상태428프레임선택**의alpha/anchor/금지셀,1x/2x·squash기준점및Brown8장반전을검사했다.428은fallback/반복을포함한선택횟수이며서로다른원본셀수가아니다.
- Preview는실제Pet.draw로32장/100ms간격,3.2초의9종×9상태+전환을캡처했다. `%TEMP%/desktopplayground-sprite-quality-preview.html`(약40.5MB,1x/2x/Pause)과PNG를생성하고0/1/2/3초정적캡처를직접비교했다. TEMP QA산출물만있으며배포/저장소자산추가가아니다. 포즈반복·전환프리뷰이지실제Throw물리영상은아니다.
- `node tests/local-pets.cjs`: PASS.9종ID/한글명·정상metadata/invalid JSON·WebP·누락skip유지. fixture경고는예상결과다.
- `node tests/grab-throw.cjs --measure`: 수정전2-B TEMP snapshot(PHYSICS_SOURCE)과현재30/60/144Hz 초기속도·0.5초거리·최고높이전체JSON동일.60Hz 느림/보통/빠름의초기vx5/24.083/54,거리141.47/681.44/1527.92px,상승55.55/1312.18/6613.78px로유지했다. 경계없는가상공간이며실제화면밖이동이아니다.
- 제품5개+테스트6개총11개`node --check`, `git diff --check`, 새테스트/문서공백·충돌마커검사PASS. 원본9개SHA-256은Inventory앞12자리와전부일치하며`git diff -- assets/pets`는없다.

### 활동성 관찰과 영향

2-A의profile 범위·확률·점프배율은변경하지않았다. 자율점프착지반발을없애면공중/반응보호시간과안정된자율시계진행이달라지므로 같은seed에서도실제벽시계활동률은달라진다. 60Hz·1600×900·구조물OFF·단독180초·seed731의현재측정은다음과같다. 계속걷기고착이나차분/활발경향역전은없었으며실제방치만족도는수동QA다.

| 펫 | 수정전 수평이동 | 수정후 수평이동 | 수정후 Roam / Rest |
| --- | --- | --- | --- |
| 황색냥 / 영업냥 | 45.07% | 41.46% | 47.19% / 48.07% |
| 얼굴냥 / 푸들 | 55.92% | 46.64% | 54.87% / 39.98% |
| 실눈냥 / 커비(잠) | 24.62% | 24.79% | 25.67% / 72.65% |
| 시바 | 71.04% | 68.80% | 83.34% / 12.63% |
| 우사기 | 70.20% | 73.36% | 90.57% / 5.31% |
| 커비 | 64.48% | 65.15% | 73.44% / 21.84% |
| 슬라임 | 57.56% | 46.98% | 57.87% / 38.07% |

### 변경 파일 / 남은 확인

이번보완수정: `renderer.js`; `tests/autonomy.cjs`, `tests/pet-expression.cjs`, `tests/smoke.cjs`, 신규`tests/jump-landing.cjs`; v1.1의SPRITE_INVENTORY/PET_ANIMATION_PLATFORM/SPRITE_REWORK_PLAN/V1_1_SPEC/CHARACTER_GUIDE/IMPLEMENTATION_PLAN/QA_CHECKLIST/이기록. main/preload/controls/local-pets/README/ASSET_SOURCES/history/package/원본자산은이번보완에서수정하지않았고이전작업트리변경은보존했다.

실제Windows마우스/DPI/투명오버레이동적QA는미실행이다. 9종좌우·발/크기·깜빡임,영업냥/푸들fallback자연스러움,자율점프vsThrow/Bomb반발,쉬는펫의Grab/등반/흡입/삭제/보조효과전환,PCclick-through/Hide/Show·Tray를확인해야한다. Native1x/2x와합성30/60/144Hz는실제DPI/성능을대체하지않는다. 다수펫30분CPU/메모리/FPS도미측정이다. 신규개인캐릭터·특수스킬후보는기존기록대로향후별도단계이며구현하지않았다.

## 2026-10-13 / Phase 2-B 최종 시각 보완 / 실제 프리뷰 피드백 반영

### 사용자 요구와 확인한 원인

직전자동PASS를시각적최종합격으로간주하지않는다.사용자의이번피드백을우선해9종원본과이전프리뷰를다시비교했다.푸들앞발fallback은보행감이부족했고,얼굴냥idle이동은방향성이없었다.영업냥은노트북포즈가이동에도재생됐다.우사기의중간공중3장은높이146/147/148px로idle196px보다작고,소스2열의발은y153인데clip foot은y194여서셀안에구워진공중높이가물리점프에중복되어보였다.

최신사용자요구에따라푸들의원본소품포함보행복원을확정했다.이는직전단계의소품보행제외선택을대체하는명시적요구변경이며새소품생성이아니다.원본시트수정금지를준수했고자산수정이필요한상황은없었다.기존작업트리/사용자추가이미지/INSTALL/AGENTS도보존했다.

### 표시 변경과 공통 구조

- 푸들: 원본1/2행좌우8장과83.33ms cadence복원. 고정scale1.1로가이트/head 표시비율보완,원본좌측을그대로사용해이중반전없음. 푸른소품과낮은측면자세는원본의일부로남긴다. crop으로소품/몸을자르지않았다.
- 얼굴냥:9행[1,2,3,4,5,6,5,4,3,2]시선전환110ms와좌측반전,scale1.035·tilt .035rad·상향bob .025×size/360ms. center origin을유지해얼굴만있는특성을살린다.안경/손가락8행2/3과치아7행제외유지,다리/장식생성없음.
- 영업냥: 이동/공중을4행2열단일기립fallback으로분리하고,정지/Look은8행노트북·Rest는6행키보드를유지한다. 좌측기립반전과이동tilt .025rad·bob .018×size/420ms만적용한다. **실제보행프레임부족은남는다.** 무관한자세를걸음으로반복시키지않고기립대체표현임을문서화했다.업무/기립사이에소품이달라지는원본자세차이는남는다.
- 우사기: jump/fall의표시scale1.25,source-column1/2/3 foot .8894/.7356/.9327. 공중가시높이는idle의약74~76%에서약93~94%로보완된다. 중앙프레임의이중상승/발위치점프를제거하고귀/몸의의도된포즈차이는보존한다. collider/size/속도는변경하지않았다.
- 황색냥/실눈냥/시바/커비/커비(잠)는원본·프리뷰를검토하고정상프로필을변경하지않았다. 5종프로필JSON수정전후동일을검증했다. 황색냥정상우측반전과기존애니메이션유지.
- 공통Pet.spriteGeometry와source-column frameAdjustments를추가했다. 정규화center/foot/centerY,clip배율에곱하는frame scale,기본표시상자에대한offsetX/Y를지원한다.유한값/범위/타입검증,invalid clip의fallback,render-only·경과시간기반tilt/bob를사용한다.프레임배열/이미지/파티클을매draw마다생성하지않고runtime bbox자동정규화도없다.
- 로컬Sprite의walk진입>.5/유지>.15 표시전용hysteresis로감속경계의idle/업무깜빡임을줄인다. 안정휴식/Grab/Throw/orbit/등반우선순위와물리속도는그대로다. 임의이모지/안경/소품/Zzz/말풍선추가없음.

### 전후 QA와 실행 결과

- 프로젝트`docs/v1.1/qa/sprite-final`에before/after PNG·무손실animatedWebP(각32장/100ms/3.2초),프로필/rendererSHA와offline index.html을보존했다.동일캡처프로토콜의9종×9포즈+대기→좌우→점프→낙하→착지squash→Rest→Grab전환열이다.전환궤적은표시비교용합성으로실제물리영상이아니다.원본이미지복사/교체가아닌QA캡처이며제품package allowlist에들어가지않는다.
- `node tests/smoke.cjs --sprite-preview --qa-before`,after명령과Pillow개발용인코더실행: PASS.직전기준428선택프레임에서최신418선택프레임/81상태로변경됐다.모든선택프레임의native1x기준점·대표2x/강한squash·alpha/원본보행행/금지셀·Brown반전검사와기존PC/도구/구조물/Grab/Trash/홀/Tray·저장·재시작회귀유지.
- 브라우저에서전후반복재생을열어푸들/얼굴냥/영업냥/우사기와9종전체의여러시점캡처를직접비교했다.원본보행·방향성·업무분리·공중크기보완을확인했지만10fps캡처비교는실제npm start의시각적최종합격을대체하지않는다.
- `node tests/pet-expression.cjs`: 기존67+표현/품질19=86개PASS.원본gait/얼굴방향·미세움직임/기립분리/우사기크기와foot/공통보정재사용·invalid값/hysteresis의새6개포함.기존푸들금지행기대값은최신원본보행복원요구대로변경하고Face금지셀은유지했다.
- `node tests/grab-throw.cjs`55개, `node tests/jump-landing.cjs`63개, `node tests/autonomy.cjs`67개, `node tests/local-pets.cjs`PASS.중복제외VM94개.예상invalid/missing fixture경고는기존검증결과다.
- `node tests/grab-throw.cjs --measure`:이번수정전renderer TEMP snapshot과30/60/144Hz 초기속도/0.5초거리/최고높이전체JSON동일.물리상수·업데이트/impulse·활동성코드바이트동일을별도확인했다.9원본시트SHA와캡처rendererSHA도일치한다.
- 제품5개/테스트6개JS구문검사,Python인코더구문,`git diff --check`·새문서/테스트공백검사PASS.환경Windows x64/Node24.18.1/Electron29.4.6.실제userdata는사용하지않았으며빌드/commit/push/버전변경없음.

### 파일과 남은 확인

이번수정은renderer.js,tests/pet-expression.cjs·smoke.cjs·신규encode-sprite-preview.py,관련v1.1매핑/플랫폼/계획/캐릭터가이드/SPEC/QA/이기록과프로젝트QA자료다.물리·활동성·펫간비충돌/한글명/시작4종·무제한생성/Draw/구조물/도구/IPC/UI/설정/원본자산은유지했다.신규펫/망치/총/툴바/구조물디자인미구현.

사용자가실제`npm start`에서9종의대기→좌우→실제자율점프/착지→Rest,Grab/Throw,발판/Draw접촉과60/144Hz·DPI를확인해야한다.상세순서는qa/sprite-final/README.md에기록했다.특히푸들의원본소품보행선호,영업냥의실제발걸음부재·업무/기립전환,우사기의실제투명화면공중크기가남은시각확인사항이다.사용자가정한완성도를자동수치만으로통과처리하지않는다.

## 변경 기록 템플릿

### 2026-10-20 / feature/v1.3 / 펫 생성 크기 선택

- 사용자 요청에 따라 펫 선택 메뉴에 50~1000%, 10% 간격 슬라이더와 100/200/500/1000% 빠른 선택을 추가했다. 기존 펫 종류와 생성 개수 정책은 유지한다.
- 마지막 생성 배율은 기존 `ui-state.json`의 `controls.petScalePercent`에 저장한다. 필드가 없는 설정은 100%로 시작하고, UI와 main IPC에서 정수·범위·간격을 검증한다. 생성 시점의 배율만 새 Pet 인스턴스에 적용하므로 기존 펫은 변하지 않는다.
- 공통 `Pet.size`를 배율화하여 스프라이트/슬라임/Canvas 기본 펫의 렌더와 물리·Grab·Throw·Draw/구조물·총/망치 판정을 따른다. 사용자 이미지의 CSS 표시 배율은 `size/defaultSize`로 맞춘다. 폭이 화면보다 큰 펫은 일부 클리핑을 허용하고 중심을 화면 좌우 안에 제한하여 벽 양쪽의 반복 반사를 막는다. Bomb/Black Hole은 기본 크기에서 기존 범위를 유지하면서 큰 펫의 가장자리를 반영한다. 보스 배율은 종별 기본 크기의 최대 10배다.
- `tests/pet-size.cjs`에 배율별 생성, 독립 인스턴스, 비정상 값, 화면 경계/바닥, Grab/Throw/Hit, 이미지·Canvas·스프라이트, Bomb/Black Hole, 보스 상한을 검증한다. Electron smoke에 UI/IPC 배율 선택·잘못된 IPC 입력과 스크롤 메뉴 검사를 추가했다.
- 자동 단위 회귀 10개 파일과 신규 배율 테스트는 통과했다. 최초 Electron smoke는 신규 UI/IPC와 실제 렌더러의 200% 스프라이트 alpha Hit 확인을 지난 후 기존 스프라이트 감사에서 콜덕·하프물범의 `walkLeft` 16개 빈 셀로 실패했다. 이 문제는 아래 후속 작업에서 테스트 매핑을 정비했다. `window-order`는 12개 native 순서/입력 검사를 통과했으나 외부 창 foreground 획득이 거부되어 exit 2(환경 제한)였다. `taskbar-watch-stderr`는 통과했다. 원본 에셋과 애니메이션 프로필은 변경하지 않았다. 실제 Windows 마우스/투명 오버레이, DPI, 극대 크기의 사용감은 사용자 GUI 검수 대상으로 남긴다. 빌드·commit·push·release는 수행하지 않았다.

### 2026-10-20 / feature/v1.3 / 애니메이션 인계 확인과 smoke 감사 정비

- `feature/v1.2-animation`의 보존 기록(5d97c5d)과 v1.2 인계·프로필 규격·각 완성 패키지의 `FRAME_MAPPING.md`, 현재 `resolveClip()`을 대조했다. 콜덕·아기 하프물범의 WalkLeft는 1행 WalkRight를 반전하며 2행은 투명 예약 행이다. 앱 WebP와 완성 패키지 WebP의 SHA-256은 각각 일치하고, 1행 8셀은 알파가 있으며 2행 8셀은 비어 있음을 확인했다.
- `tests/smoke.cjs` 첫 감사가 실제 런타임 대신 모든 펫에 레거시 `d.clips.walkLeft` 2행을 적용한 것이 16개 실패의 원인이었다. 프로필이 있는 펫은 `assertProfile`·`resolveClip`·`Pet.spriteClip`과 선택 셀 알파를 검사하고, 반전 참조·원본·출력도 확인하도록 변경했다. Cat/Magpie 레거시 검사는 유지한다. 검사 집계는 레거시 2장+로컬 11장, 5상태씩 13시트·65클립·414프레임 방문이다.
- 기존 9종 특수 자세 감사는 9종 범위로 유지했다. 영업냥의 승인된 Sleep 0행 0열을 허용하고, Sleep alpha 바닥과 작성된 foot의 최대 5px 차이는 6px 이내 검사로 다뤘다. 별도 실제 렌더 기준점 검사는 유지한다. 공통 플랫폼 17상태×3시점 검사는 현재 11종의 561샘플을 확인한다.
- `node tests/smoke.cjs` 전체 PASS. `pet-size`, `animation-platform`, `animation-integration`, `autonomy`, `grab-throw`, `jump-landing`, `pet-expression`, `hit-sleep`, `gun`, `local-pets`, `screen-effects`, `taskbar-watch-stderr`의 헤드리스 테스트를 각각 재실행해 모두 PASS. `node animation/write-browser-profiles.cjs --check`, 변경 JS 구문 검사, `git diff --check`도 PASS. 원본 이미지·프로필·조립 스크립트·제품 코드는 이번 후속에서 바꾸지 않았다. 최신 규칙은 `docs/v1.3/ANIMATION_NOTES.md`에 간단히 정리했다. 크기 조절 변경은 보존했고 실제 Windows 마우스·DPI QA는 남아 있다. 빌드·커밋·푸시·병합·릴리스는 하지 않았다.

### 2026-10-13 / 독립 애니메이션 플랫폼 Electron 선택 통합

- 시작 기준 앱 `feature/v1.1`=`50d2fb7`, 별도 `feature/pet-animation`=`feceb20`, 양쪽 clean 확인. 앱 담당에서 player/9종JSON/프리뷰·생성기/테스트/설계 문서만 선택적으로 가져왔다. 별도 worktree와 branch는 수정하지 않았다. 전체 merge/cherry-pick은 수행하지 않았다.
- renderer 중복 9종 mapping을 제거하고 canonical JSON의 browser wrapper 하나를 참조한다. CJS/browser 양쪽 export, script 순서·package 포함·VM/격리 smoke 로딩을 연결했다. 별도 preload/IPC/Node 권한/fetch는 추가하지 않았다. 원본 metadata/WebP/ID/표시명/시작4종/무제한 생성/펫 비충돌·Canvas/GIF·UI·설정 보존.
- 실제 GrabStart→Held→Release/Throw, 자율 rise/apex/fall→land, 강한 bounce, Bomb hit, climb/orbit, Rest/Sleep/Look/wake를 기존 물리 상태와 사건에 연결했다. 향후 stunned/knockout는 시각 override 인터페이스만 준비하고 HP/삭제/새 도구는 구현하지 않았다. 전용 그림은 기존 drag/idle/fall fallback이며 신규 이미지/소품은 없다.
- 독립 초안 보완 이유/영향: Grab > orbit과 기존 구출 우선순위를 맞췄다. 120ms 전 release와 실제 apex/fall을 pending once가 막지 않도록 했고, once 종료 초과 ms를 넘겨 FPS 차이를 줄였다. fall/thrown의 기존 loop:false 프레임 진행/마지막 자세를 유지했다. geometry의 frameAdjustments/scale/foot/center/tilt/bob/squash는 변경하지 않았다. 기존 clock 직접 조작 QA는 실제 player 진행/현재 프레임 검사로 바꿨으며 금지 셀·자산·기준점 기대치를 완화하지 않았다.
- Phase3-A screen-effects.js 바이트 동일. 효과 RAF raw elapsedMs를 Sprite clock에도 전달하지만 물리 dt clamp/상수·Throw/Bomb impulse·자율 점프 무바운스·자율 활동성/Draw/구조물은 유지했다. HEAD snapshot 대비 `node tests/grab-throw.cjs --measure`의30/60/144Hz 느림/보통/flick 초기속도·0.5초거리·최고높이 전체 JSON 동일.
- 검증: animation-platform PASS; animation-integration 신규12, 기존grab55/autonomy12/expression19/jump8/effects11 중복 제외117개 PASS. 각 테스트 명령과 local-pets를 재실행했다. 격리 Electron smoke PASS: 모듈 실제 로드, 기존81상태·418프레임·원본11시트385셀/기준점·1x/2x/금지셀/반전, 신규17상태×9종×3시점459렌더, 기존PC/Draw/Grab/Trash/BH/구조물/Tray·저장·재시작/HTTP0. local-pets invalid fixture 경고는 예상이다. 구문·wrapper동일성·diff/new-file 공백 검사 PASS.
- 실제Pet.draw의51장/80ms QA와459 sample을 `qa/animation-integration`에 보존하고 contact sheet 직접 점검. 입력은 시각 전환 스크립트이며 실제 Windows 마우스/물리 영상이 아니다. 실눈냥·커비(잠)의 Rest→Sleep은 원래 정책이며 다른 종의 Sleep/KO는 QA 입력만 제공했다. 영업냥의 책상/기립 불연속·진짜 보행 부재, 푸들 원본 소품, 일부 원본 자세 크기 차이와 전용 land/hit/KO/wake 자산 부재는 남는다.
- 변경 파일/재현 명령/계약은 animation/RUNTIME_INTEGRATION.md와 QA README에 기록했다. 실제Windows 60/144Hz·DPI·투명 화면/짧은Grab/장시간 부하 검증은 사용자 수동 확인으로 남긴다. 망치/총/BH확장/신규캐릭터/툴바/다음Phase, 빌드/commit/push/버전 변경은 미실행.

## 2026-10-13 / 애니메이션 전담 1차 / 독립 상태 플랫폼 초안

- `feature/pet-animation`에서 9종 원본 시트/메타데이터와 `qa/sprite-final` 전후 프리뷰·프로필, 현재 renderer와 이전 Git 이력을 대조했다. 현재 앱은 9개 클립 중심이며 grabStart/release/land/hit 등의 독립 표현 상태는 아직 없다.
- 앱에 연결하지 않는 `animation/profiles.v1.json`(최종 after 스냅샷과 동일), `animation/pet-animation.cjs`(상태 우선순위·loop/once/hold·시간 재생·fallback), 오프라인 프리뷰 생성기와 `docs/v1.1/animation/` 분석·미리보기를 추가했다. 원본 에셋·ID와 renderer/main/controls는 변경하지 않았다.
- 영업냥 이전 코드의 row1/2 좌우 8장 선택은 확인했지만 그 행의 몸 분절/소품 문제가 있어 실사용 자연스러움을 확정하지 않았다. 현재 row4 col2 기립 대체 표현도 실제 보행은 아니다. 통합 전 프레임별 A/B 시각 QA가 필요하다.
- `node tests/animation-platform.cjs` PASS: 9종 프로필 스냅샷, 원본 SHA-256, 상태 전환/우선순위, 금지 셀, 푸들/얼굴냥/영업냥/우사기 주요 매핑, 30/60/144Hz 동일 시간 프레임. 기존 `node tests/pet-expression.cjs` 86개 PASS. `node animation/write-preview.cjs`로 프리뷰 생성 및 script 구문 확인 PASS. 실제 앱 실행·DPI·동적 물리 전환은 이번 브랜치에서 하지 않았다.
- 사용자 승인으로 확정된 새 동작 변경은 없다. 다음 단계는 앱 개발 채팅과 HEAD/파일 충돌 확인 후 단일 담당이 이벤트 공급과 렌더 연결을 수행하고 실제 Windows 시각 QA를 받는 것이다.

### 2026-10-13 / Phase 3-A / 화면 효과 공통 수명 및 정리

- 사용자 요청 범위: 화면 타격 효과의 공통 관리만 구현. 애니메이션 모듈 가져오기/매핑 변경, 신규 도구/캐릭터/툴바/빌드/commit/push는 하지 않는다. 앞선 계획보다 좁은 최신 요청에 따라 균열 선택 UI와 설정 저장은 나중에 연결 가능한 내부 구조만 둔다.
- `screen-effects.js`의 ScreenEffects가 종류별 bounded 배열, `durationMs/remainingMs`, 생성/경과 시간 갱신/정리를 담당한다. Pet/물리/삭제/DOM/애니메이션 의존성 없음. 기존 Bomb 생성 함수는 60Hz 기준 수명을 ms로 변환한다. 실제 RAF 경과 시간은 물리 dt clamp와 별도로 효과에 전달한다. 숨김 시 정지는 기존 동작 유지.
- 상한과 이유: 기존 particle160/ring24/impact24/crater8 보존. 신규 crack64는 최대1152선분의 초기 안전 제한, 반경200px·6갈래×3선분으로 geometry 자체도 제한한다. 파편 생성 burst160 제한, 화면 밖32px 정리, 제자리 배열 압축/clear로 프레임별 filter 배열 교체를 제거한다. 고속 반복 생성에서 오래된 객체부터 제거하며 Pet 개수는 제한하지 않는다.
- 균열 API: `addCrack`, `setCrackMode('auto'|'accumulate')`, `clear('crack')`. auto5초, accumulate는 cap 내 유지, auto 복귀 시 기존 균열에5초 재부여. 보조 효과 OFF에서 균열/파편/링/섬광을 숨겨도 수명 정리는 계속된다. 기존 Bomb 자국과 BH 본체 표시는 유지. 이번에는 Bomb 클릭에 균열을 추가하지 않았으며 3-B로 남긴다.
- Pet Bomb impulse/외부 충격 source, Throw 및 자율 점프 코드·상수/클립·활동성은 그대로다. BH 최대2개와 흡수 삭제, Draw/collider/Trash/설정/IPC/툴바도 보존했다. 관리자는 인스턴스 참조를 저장하지 않는다.
- 파일: 신규 screen-effects.js, tests/screen-effects.cjs; renderer.js(효과 생성/렌더/clear/RAF 전달만), index.html/package.json(모듈 로드/포함), tests/grab-throw.cjs(VM 로드), tests/smoke.cjs(TEMP 모듈 복사·native 효과 검사), PHASE_3_PLAN/IMPLEMENTATION_PLAN/QA_CHECKLIST/이 기록. 원본 자산 및 애니메이션 담당 파일은 미수정.
- 실행 결과: `node tests/screen-effects.cjs` 신규11 + 기존55 PASS; `node tests/grab-throw.cjs`55, `node tests/pet-expression.cjs`86(autonomy 포함), `node tests/jump-landing.cjs`63, `node tests/local-pets.cjs`, `node tests/smoke.cjs` PASS. 중복 제외105개 단위/renderer 사례와 별도 local-pets/Electron. local-pets invalid/missing fixture 경고는 예상 검사다. `--measure`의 HEAD baseline/current JSON은30/60/144Hz 느림/보통/flick 초기속도·0.5초거리·최고높이에서 동일. 제품6개/테스트7개 구문, diff/new-file 공백 검사 PASS.
- 통합 영향: 애니메이션 mapping/anchor/frame 함수 변경 없음. renderer의 RAF/animate 효과 elapsedMs 전달과 효과 store 연결, index script 순서, package allowlist 및 VM/smoke의 새 모듈 로드를 향후 단일 통합자가 보존해야 한다. 모듈 자체는 애니메이션과 독립적이다.
- 남은 확인: Windows 실제 지속시간/반복 Bomb/장시간 CPU·메모리·Hide/Show 사용감. 부하 검사는 객체/geometry 상한과10000회 생성·1시간 가상 누적 검증이며 실제 장시간 실행 측정이 아니다. 효과를 그린 뒤 시간 갱신하는 기존 순서로 만료 표시가 최대 한 render 간격 남을 수 있다. 균열 UI/저장/도구 연결·Hammer/Gun/BH10과 애니메이션 통합은 미진행. 빌드/commit/push/버전 변경 없음.

### 2026-10-13 / 작업 역할 분리 및 Phase 3 준비 점검

- 사용자 확정: 이 채팅은 전체 앱 물리/도구/구조물/툴바/테스트/최종 통합을 담당한다. 애니메이션 전담은 별도 `feature/pet-animation` worktree에서 펫별 클립/크기/기준점/프레임/시각 보정과 독립 모듈을 담당한다. 공통 애니메이션 코드를 중복 작성하지 않는다. 기존 Phase 2-B와 ANIMATION_WORKSTREAM의 경계를 보존한다.
- 조사 기준: 앱과 애니메이션 브랜치 HEAD 모두 `26c23fa`. 조사 시작 시 앱 작업 트리 clean. 애니메이션 worktree에는 `animation/`, `docs/v1.1/animation/`, `tests/animation-platform.cjs` 미추적 파일만 표시됐다. 해당 파일은 수정/복사하지 않았고 모듈 완료나 통합 가능 판정도 하지 않았다.
- 현재 코드 확인: Bomb과 최대 2개 Black Hole만 구현되어 있다. 공통 균열/Hammer/Gun/KO 삭제 예약은 미구현이다. `drawEffects()`는 프레임 횟수 기반, `beginImpact()`와 물리 선택은 Bomb source 전용, `Pet.remove()` 이후 배열 제거는 호출자가 담당한다. 이 세 부분과 모드/IPC 검증·설정·clear 경로가 장난감 구현의 주요 영향 범위다. 기존 Throw/자율 점프/활동성/애니메이션 상수는 수정하지 않았다.
- 새 PHASE_3_PLAN에 코드별 영향, 기존 순서를 유지한 3-A 균열 → 3-B Bomb → 3-C Hammer → 3-D Gun → 3-E Black Hole 10개 제안, 테스트/수동 확인, 통합 소유권을 기록했다. 다음 권장 단위는 3-A만이다. cap/cooldown·도구 접근·겹침 명중/KO 우선순위의 미확정 세부안은 확정 요구로 취급하지 않는다.
- 통합은 독립 모듈 완성 후 양쪽 HEAD/변경 목록과 공유 renderer 호출부·로딩/패키징·smoke 목록·QA를 다시 검토하고 한쪽에서만 수행한다. 지금 merge/cherry-pick이나 새 애니메이션 API를 만들지 않는다.
- 변경 파일: PHASE_3_PLAN.md, IMPLEMENTATION_PLAN.md, 이 기록뿐. 제품 코드/자산/테스트/애니메이션 전담 문서는 변경하지 않았다. 사용자 확인을 요구하는 핵심 요구 변경은 없으며, 이번 요청 범위는 준비 점검으로 완료한다.
- 검증: 문서 변경 후 `git diff --check`와 변경 목록 확인. 제품 변경이 없으므로 기능 회귀/JS 구문 검사/Electron smoke/Windows 마우스 QA는 이번에 재실행하지 않는다. 이전 Phase의 PASS 기록을 이번 실행 결과로 간주하지 않는다. 빌드/commit/push/버전 변경 미실행.
- 남은 위험: 독립 모듈과 공유 테스트 연결의 실제 충돌은 통합 직전 확인해야 한다. Gun의 유한 KO/삭제와 Grab·orbit 경합, 효과 시간/FPS 차이, 누적 균열과 10개 홀의 부하는 후속 구현·검증 대상이다.

### YYYY-MM-DD / Phase X / 변경 제목

- 현행 사실과 문제:
- 변경 전 결정/동작:
- 변경 후 제안/동작:
- 수정 파일과 호환성 영향:
- 사용자 승인 필요 여부:
- 실행한 테스트와 결과:
- 남은 문제와 다음 조치:

### 2026-10-14 / Windows 일반 창 위 오버레이 순서

- 범위는 실제 Windows BrowserWindow 순서만이다. 앱 시작 시 오버레이는 `floating` topmost/비포커스/입력 무시, 툴바는 `pop-up-menu` topmost였다. 기존 `raiseControls()`는 툴바만 올려 오버레이의 표시·복원·상태 변경 및 툴바 blur 시 순서를 복구하지 않았다. CSS z-index 문제가 아니다.
- 격리 Electron+Win32 HWND 검사에서 초기 비동기 표시 완료 전 한 실행의 순서가 불안정해 테스트가 오버레이 visible을 기다리도록 보정했다. 표시 완료 후 일반 창 생성/포커스/최대화/복원은 기본 코드에서도 대부분 정상이었다. 테스트에서 topmost 속성을 상실하도록 한 뒤 툴바 blur를 발생시키면 이전 코드는 복구 실패했다. 실제 사용자 보고의 정확한 발생 원인은 아직 확정하지 못했다.
- `main.js`에 `raiseOverlay()`를 추가했다. visible 상태에서 기존 `floating` 레벨을 재설정하고 focus 없이 `moveTop()`한 뒤 툴바를 올린다. 오버레이 show/restore, 툴바 blur, 상태 변경, 디스플레이 변경, 툴바 복구에서만 호출한다. 주기 타이머·강제 포커스·새 native 의존성은 없다. 툴바 `pop-up-menu` 레벨과 기존 입력 무시 전환은 유지한다.
- Electron [BrowserWindow API](https://www.electronjs.org/docs/latest/api/browser-window)는 `floating`과 `pop-up-menu` 레벨, 포커스 없는 `moveTop()`/`showInactive()`, `setIgnoreMouseEvents()`의 하위 창 입력 전달을 명시한다. Windows [SetWindowPos](https://learn.microsoft.com/en-us/windows/win32/api/winuser/nf-winuser-setwindowpos)는 topmost 창의 일반 창 위 순서와 비활성화 후 유지를 설명한다.
- `tests/window-order.cjs`는 TEMP appData/복사본 Electron과 일반 창 probe, Win32 z-order/WS_EX_TOPMOST/WindowFromPoint를 검사한다. 수정 후 기본 시나리오 3회 연속 PASS, Pet/Draw/Toy/native hit target/비포커스 추가 검사 PASS. `node tests/smoke.cjs` PASS, `node --check main.js`, `git diff --check` PASS. 테스트는 native hit target을 확인하며 실제 좌·우클릭/휠 전송은 수동 QA로 남긴다.
- `node tests/window-order.cjs --real-apps`: 현재 실행 중인 Chrome을 foreground로 전환한 뒤 오버레이·툴바의 native 순서 PASS. Code/ChatGPT 자동 foreground 전환은 Windows에서 거부됐고 탐색기 별도 파일 창은 탐지되지 않아 해당 실제 앱 검사는 미완료. Alt+Tab, F11 전체 화면, 관리자 권한 창/보안 데스크톱도 직접 조작하지 않았다. 일반 창 위 표시가 대상이며 F11/타 topmost/시스템 UI의 우선순위는 보장하지 않는다. 애니메이션·물리·효과·설정 경로와 원본 에셋은 수정하지 않았다. 빌드/commit/push 없음.

## 2026-10-23 / PC 이전 통합 기준

- 원본 6개 Git worktree와 D 드라이브의 별도 builds/incoming 폴더를 먼저 복사하고 Git bundle을 검증했다. 원본 브랜치·worktree는 수정하지 않았다.
- main e3069d1에는 v1.2 기능과 애니메이션 브랜치 5d97c5d의 내용이 이미 들어 있다. 별도 복제의 codex/migration-2026-10-23에서 로컬 feature/v1.3의 미커밋 펫 크기 작업 및 테스트만 적용했다. 중복 커밋이나 미검증 신규 원화는 앱에 추가하지 않았다.
- 펫 생성 크기 50~1000%와 기존 펫 크기 유지, 설정 호환성을 해당 브랜치의 기존 테스트로 검증했다. window-order.cjs 작업 표시줄 입력 단계는 통합본과 원본 main 양쪽에서 현재 데스크톱 환경에 따라 실패했으므로 수동 Windows QA가 남는다.
- Git/코드/백업/자산별 현황과 새 PC 복원법은 이전 폴더의 Documentation/PROJECT_STATUS.md, PC_MIGRATION_GUIDE.md, BACKUP_MANIFEST.md를 기준으로 한다. 앱의 실제 사용자 데이터는 공개 소스와 분리한다.
