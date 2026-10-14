# DesktopPlayground v1.1 검증 체크리스트

체크 표시 규칙: `[ ]` 미검증, `[x]` 실제 실행 및 통과. 자동 검사와 실제 Windows 수동 확인을 구분한다. 아래 전체 v1.1 항목은 해당 단계가 구현·검증될 때 갱신한다.

## 배포 전 마지막 수정: 툴바 숨김·창 순서 (2026-10-14, 현행)

- [x] `node tests/window-order.cjs`: 일반·최대화 창 위 오버레이와 더 위의 툴바, Hide/Show·모드 전환 후 native topmost, PC mode native hit target 확인. 툴바 버튼 숨김에서 PC 전환/입력 통과, Playground 숨김과 독립 동작, Playground가 숨겨진 상태의 트레이 **툴바 표시** 및 기존 트레이 아이콘 복원 확인.
- [x] 변경 JS `node --check` 및 `git diff --check` 통과. 격리 Electron 핵심 검사만 실행했고 전체 smoke·장시간 테스트·새 Canvas 캡처는 이번 작업에서 실행하지 않았다.
- [ ] 사용자가 실제 Windows에서 Chrome·탐색기·Codex 클릭/최대화/Alt+Tab 후 펫이 앞에 남는지, 조작창이 펫보다 위인지 확인한다. PC 모드의 좌우 클릭·휠·키보드 전달과 Grab/Throw 뒤 순서, 툴바 숨김→트레이 메뉴/아이콘 복원, Playground만 숨김/보이기, 접힌3버튼, 모니터 이동·DPI·작업 표시줄을 확인한다. F11 전체 화면·관리자 권한 창·시스템 UI는 일반 창보다 높은 별도 제한으로 기록한다.

## 배포 전 품질 보완 (2026-10-14, 현행)

- [x] `node tests/gun.cjs`, `node tests/screen-effects.cjs`: 24개 수류탄을 2999ms까지 보존하고 만료 시 폭발 뒤 제거, 25번째 거절, 시각효과의 별도 상한 확인. 좌/우/정면 클릭 및 드래그·물리·비살상 Hit 회귀 확인.
- [x] 실제 9개 WebP를 대조해 Sleep에서 눈물/놀람/피격 프레임을 제외하거나 기존 안전 프레임을 유지. `node tests/animation-platform.cjs`, `node tests/pet-expression.cjs`, `node tests/hit-sleep.cjs`와 `node animation/write-browser-profiles.cjs --check` 통과. 수면 5~60분과 깨우기 규칙 유지.
- [x] 변경한 JS/CJS 8개 `node --check`와 `git diff --check` 통과. 툴바 시각 정렬은 정적 코드 확인까지만 진행했고 실제 Electron 렌더는 수동 검수로 남겼다.
- [ ] 사용자가 `npm start`에서 수류탄 24개 연속 투척의 각각 약3초 폭발과 25번째 제한, 실마우스 투척감/FPS, 9종 Rest→Sleep→기상 자세·발 위치, 특히 영업냥 대체 자세를 확인한다. 툴바 펼침/접기·Playground 숨김의 구분, 도구 선택 윤곽/툴팁, 화면 가장자리의 Gun/Draw/펫 메뉴와 고DPI를 확인한다. 이번에는 Electron 화면 검사를 반복하지 않았다.

## Phase 3-C 최종 사용감 보완 (2026-10-14)

- [x] `node tests/gun.cjs`: 4종 총구가 기본 4시에서 레드도트를 향함, 화면 모서리 PNG 표시 범위, 프레임 간 이동 구간의 최초 펫 명중/빈 조준점 앞의 펫 명중, Head/Body·샷건 개별 판정, 수류탄 좌/우/수직 클릭과 기존 드래그/3초 신관 확인.
- [x] `node tests/screen-effects.cjs`, `node tests/smoke.cjs --viewport-only`, 전체 `node tests/smoke.cjs`, `node tests/window-order.cjs`: Hammer/비살상 Hit, Electron 전체 화면 높이, 기존 Sprite·애니메이션·설정 회귀, PC native 입력 대상·창 순서 확인. 변경 JS 구문과 `git diff --check` 확인. 전체 화면 Sprite 감사는 이전 작은 화면보다 오래 걸렸으나 완료됐다.
- [ ] 사용자가 `npm start`에서 총 4종 방향과 PNG 총구·섬광·레드도트 정합, 경로상 첫 펫, 수류탄 세 기본 방향, 430ms Hammer 스윙/260ms 균열, 도구별 커서 hotspot, 작업 표시줄 위 표시 및 PC 클릭·휠 통과를 직접 확인한다. 특히 주/보조 모니터 DPI와 Windows 작업 표시줄 최상위 순서는 실제 환경 검수가 필요하다.

아래 Phase 3-C 초기 QA의 레드도트 최종 좌표 판정·총기 2시 방향 내용은 위 현행 경로 판정·4시 방향으로 대체한다.

## Phase 3-C 현행 QA (2026-10-14)

- [x] `node tests/gun.cjs`: 신규 13개 + 기존 Grab/Throw/autonomy 67개 상속. AWM 4000ms, AK-47 120ms, UZI 65ms, 샷건 1200ms/10펠릿, 24발·2초 제한, 레드도트 명중/빈 곳 miss, Head>Body 숫자, 수면 해제·9종 Hit·비삭제, 샷건 개별 숫자·넉백 cap, 30/60/144Hz 비교. 수류탄 클릭/드래그 투척·당시16개 상한(현행24개는 위 최신 QA)/바닥 반발/3초 신관·지상 펫 상승, Hammer 반복 파손과 Bomb 균열 0, 상단 개방 Throw 회귀를 포함한다.
- [x] `node tests/smoke.cjs --gun-preview`: 격리 Electron에서 네 무기 선택과 PNG 로드, 실제 Sprite 알파의 투명 여백 miss/불투명 픽셀 hit, 모서리 배치, 비살상 Hit·Sleep 해제·숫자·Tray/PC/기존 기능 확인. [4종 비행/명중 캡처](qa/phase3c/native-weapons.png)와 [수류탄 비행/폭발·반복 Hammer 캡처](qa/phase3c/native-grenade-hammer.png)를 직접 열어 확인했다. 기존 3-B [비교 이미지](qa/phase3b/native-toys-hit.png)도 보존한다.
- [x] `node tests/window-order.cjs`: Gun/Bomb/Hammer와 PC mode의 native z-order·입력 대상 확인. `node tests/screen-effects.cjs`, `hit-sleep.cjs`, `animation-platform.cjs`, `animation-integration.cjs`, `jump-landing.cjs`, `pet-expression.cjs`, `local-pets.cjs`, `node tests/grab-visual.cjs after`(9종 3.2초 Held) 통과. 구문·브라우저 프로필 동기화·`git diff --check` 통과. Grab 프리뷰 검사로 재생성된 기존 3개 QA 파일은 원래 기록으로 되돌렸다.
- [ ] 실제 `npm start` 물리 마우스로 네 무기의 조준점/발사체·연사 유지와 놓기·창 전환, 샷건 10발 숫자 가독성, 수류탄 클릭/드래그 투척 거리와 3초 신관, 지상 펫 상승·상단 화면 밖 복귀, Hammer 동일 위치 반복 파손, 20마리 이상과 연속 사용 CPU/메모리, 고DPI/다중 모니터 클릭 통과와 조작감을 확인한다. 격리 캡처가 실사용 만족도를 확정하지는 않는다.

아래 Phase 3-B 절은 당시 변경·검증 기록이다. 클릭 즉시 Bomb 등 현행과 충돌하는 과거 문구에는 위 최신 결정이 우선한다.

## Phase 3-B 후속 보완: 큰 Bomb/Hammer·비살상 Hit·장시간 Sleep (2026-10-14, 최신)

- [x] `node tests/screen-effects.cjs`: Bomb 균열 0, 더 큰 구멍/충격파/68 파편, Hammer 클릭 즉시 반경 76px 국소 균열·24 유리 파편, effect별 상한·만료/초기화. 광역/국소 펫 충격 수식 및 비삭제 유지.
- [x] `node tests/hit-sleep.cjs`: 9종 각각 Bomb/Hammer Hit의 유효 기존 클립·비삭제·숫자, 성격별 5~60분 Sleep 범위, Rest→Sleep과 30/60/144Hz 5초 동일 시간 경과, 물리 dt 상한 중에도 실제 RAF 5초 반영, Grab/Throw/Bomb/Hammer/Black Hole 깨우기, 등반과 외부 충격 우선순위. 신규 6개 사례 통과.
- [x] `node tests/smoke.cjs --toy-preview`: 실제 격리 Electron Canvas에서 Bomb/Hammer 확대·데미지 숫자 ON/OFF(OFF여도 충격 유지)·Sleep 깨우기와 기존 자동 복구/Tray·무잔상 확인. [보완 전](qa/phase3b/before-hit-sleep-toys.png), [클릭 직후](qa/phase3b/native-toys-hit.png), [파편 이동](qa/phase3b/native-toys-hit-motion.png) 실제 Canvas 캡처를 직접 비교.
- [x] `node tests/grab-throw.cjs`, `autonomy.cjs`, `animation-platform.cjs`, `animation-integration.cjs`, `jump-landing.cjs`, `pet-expression.cjs`, `local-pets.cjs`, `window-order.cjs` 및 변경 JS/CJS 구문·브라우저 프로필 동기화·`git diff --check` 통과. 잘못된 local-pet fixture 경고는 예상 결과.
- [ ] 실제 `npm start`에서 사람의 물리 마우스로 두 도구의 크기·유리 파손·숫자 가독성·반복 타격감, 9종 표정과 Sleep 5~60분 지속/깨우기, 60/144Hz·고DPI·다중 모니터·연속 사용 CPU/메모리를 확인한다. 자동 캡처는 최종 디자인 만족도나 장시간 실사용을 대신하지 않는다.

아래의 이전 Phase 3-B 절은 당시 구현과 검증의 기록이다. 충돌하는 40ms 접촉 지연·58px 균열·Bomb 균열 등은 위 최신 절과 [계획](PHASE_3_PLAN.md)이 우선한다.

## Phase 3-B Bomb/Hammer 시각 보완 (2026-10-14, 최신)

- [x] `node tests/screen-effects.cjs`: Bomb을 자동/누적 균열 모드에서 반복해도 새 균열 0개, 기존 광역 펫 충격·비삭제 유지. 불규칙 32점 구멍과 짧은 폭발 효과, Hammer만 최대58px 유리 파손·41선분/균열·다른 모양 생성·Hit/국소 반발 확인.
- [x] `node tests/smoke.cjs --toy-preview`: 실제 격리 Electron Canvas에서 Hammer 머리 하단/클릭·균열·펫 피격 중심 일치, 40ms 접촉 전 균열 없음, 접촉 후 유리 파손/파편과 Bomb 균열 없는 불규칙 구멍 확인. 자동 복구 후 Canvas 잔상 0, Tray 누적/균열만 Clear와 저장/재시작 유지.
- [x] 수정 전 [같은 2도구 캡처](qa/phase3b/before-native-toys.png), 수정 후 [접촉·폭발](qa/phase3b/native-toys.png) 및 [파편·충격파 이동](qa/phase3b/native-toys-motion.png)을 저장하고 직접 시각 비교. 첨부 참고 이미지는 디자인 참고로만 사용하고 외부 자산을 가져오지 않았다.
- [x] `node tests/grab-throw.cjs`, `animation-platform.cjs`, `animation-integration.cjs`, `autonomy.cjs`, `jump-landing.cjs`, `pet-expression.cjs`, `local-pets.cjs`, `window-order.cjs` 재실행 통과. 변경 JS/CJS 4개 `node --check`, `node animation/write-browser-profiles.cjs --check`, `git diff --check` 통과. local-pets의 고의로 잘못된 fixture 경고는 예상 결과.
- [ ] 실제 `npm start`에서 물리 마우스로 Hammer 접촉 타이밍/타격감, 반복 Bomb/Hammer의 파편 가독성과 장시간 CPU·메모리, 60/144Hz·고DPI·다중 모니터에서의 투명 오버레이를 확인한다. 자동 캡처는 최종 사용감 판정을 대신하지 않는다.

## Phase 3-B Bomb 균열·Hammer (2026-10-14, 최신)

- [x] `node tests/screen-effects.cjs`: Bomb 광역 기존 충격+155px 균열, Hammer 70px 국소 균열·최상위 적격 펫 1마리 Hit/Throw 계열 외부 충격·비삭제, 자율 점프보다 외부 충격 우선, 보조 효과 OFF에서도 물리 정상. 정지/누적/자동 복구 및 균열만 Clear에서 Draw/collider 보존.
- [x] 효과 상한: Hammer 모션 12, 균열 64개(각 최대 24선분), 파편 160, 링/섬광 각 24. 연속 100회 타격에서 상한과 오래된 효과 정리 확인. 자동 복구 5초, 누적 모드 전환/재시작 저장 확인.
- [x] `node tests/smoke.cjs --toy-preview`: 실제 격리 Electron에서 Hammer 커서·타격 렌더·Hit·국소 반발, Bomb의 더 넓은 균열/충격, Tray 자동/누적 전환·균열만 지우기·설정 재시작 유지, 11개 도구 버튼과 화면 넘침 없음. [동일 조건 실제 Canvas 캡처](qa/phase3b/native-toys.png).
- [x] `node tests/window-order.cjs`: Hammer를 포함한 18개 입력/창 순서 시나리오와 PC click-through 유지 통과. 우클릭 PC 복귀는 Electron smoke에서 확인.
- [x] `node tests/grab-throw.cjs`, `animation-platform.cjs`, `animation-integration.cjs`, `autonomy.cjs`, `jump-landing.cjs`, `pet-expression.cjs`, `screen-effects.cjs`, `local-pets.cjs` 회귀 통과. Sprite 프로필/원본 자산과 자율 점프/Throw/Bomb 물리 상수는 변경하지 않음.
- [x] `node tests/grab-throw.cjs --measure`: 변경 전 HEAD와 현재의 30/60/144Hz × 느림/보통/flick 초기 속도·0.5초 거리·최고 높이 JSON이 동일.
- [ ] 사람이 실제 `npm start`에서 Hammer 연타와 Bomb 연속 사용, 누적 균열 64개 근처의 가독성·CPU/메모리, 60/144Hz·고DPI·다중 모니터·투명 배경의 체감, Tray 전환/우클릭 PC 복귀를 최종 확인. 격리 Electron의 DOM 입력/Canvas 캡처는 물리 마우스 사용감 검증을 대신하지 않는다.

## 애니메이션 통합 회귀 최종 보완 (2026-10-14, 최신)

- [x] 원본9개 WebP의 9/11행×8열 alpha>16 유효 셀을 다시 스캔하고 프로필의 Idle/Walk/Jump/Fall/GrabStart/Held/Release/Throw/Landing/Rest/Sleep/Look 및 fallback 참조가 모두 실제 비어 있지 않은 셀임을 확인. 얼굴냥 row8 col2/3 금지·푸들 좌우 원본 보행 유지. 원본 자산 변경 없음.
- [x] `node tests/animation-platform.cjs`, `node tests/animation-integration.cjs`: 9종 GrabStart120ms once → Held3.2초 순차 loop → Release/Throw/착지 복귀,30/60/144Hz, 단일프레임 hold fallback, 물리좌표·size 불변 통과. 통합14개 포함 중복 제외 단위/renderer 회귀119개.
- [x] `node tests/grab-visual.cjs after`: **실제 프로젝트 `npm start` + RAF + Electron Canvas**에서 9종 각각 Held3.2초/추가시점, Release·빠른 Throw·Landing·복귀 통과. DOM MouseEvent 자동 입력이며 물리 마우스 아님. [전후 영상식 샘플·영업냥 비교](qa/grab-regression/index.html) 확인. 수정 전9종 Held 단일 프레임; 수정 후 관측2~6프레임.
- [x] `git show v1.0.0:renderer.js`의 영업냥 row1/2 8장·size×2.5·offsetY10을 실제 Electron Canvas에서 재생한 `legacy-salary.png`와 현재 원본 **전체 셀** row1/2 0~6을 비교. 내부 crop 제거, union center=.5/foot=199/208, 미완성7열 제외. 자연스러운 전체 픽셀 보존과 좌우·발 기준 확인; 원본의 머리/몸 분리·회전 및 업무→이동 표현 차이는 남음.
- [x] `node tests/smoke.cjs`: 9종81상태401선택프레임 native1x/2x 기준점·금지프레임·좌우 반전,17상태×9종×3시점459렌더 및 기존 Electron 앱/효과/Tray/설정/도구 회귀 통과. `node tests/grab-throw.cjs`, `autonomy.cjs`, `pet-expression.cjs`, `jump-landing.cjs`, `screen-effects.cjs`, `local-pets.cjs`도 재실행 통과.
- [x] `node animation/write-browser-profiles.cjs --check`, 20개 JS/CJS `node --check`, `git diff --check`, 신규 텍스트 공백 검사 통과. 작업 시작 renderer snapshot과 현재 `node tests/grab-throw.cjs --measure`의30/60/144Hz Throw 수치 동일. Phase3-A 효과·IPC/자산 파일 차이 없음.
- [ ] 실제 사람의 마우스로9종을 각각3초 이상 잡아 표정 변화·천천히 놓기·빠른 던지기/착지, 영업냥 원본 분절/업무 전환, 얼굴냥 울음/금지소품, 푸들 보행을 확인. 60/144Hz·고DPI·투명 화면/다수펫의 최종 자연스러움은 자동 검사로 판정하지 않는다.

## Phase 3-A 공통 화면 효과 (2026-10-13)

### 애니메이션 플랫폼 통합 검증 (2026-10-13)

- [x] `node tests/animation-platform.cjs`: 원본 9종 SHA/프로필/금지 셀, fallback·시간 재생, Grab > orbit, 조기 release/공중 전환 중단, 일회 시간 잔여분, 미래 knockout 인터페이스 PASS.
- [x] `node tests/animation-integration.cjs`: 실제 renderer 연결12개 PASS. 9종 GrabStart/Held/느린 release, 빠른 Throw, orbit 구출, 자율 점프→land, 강/약 충돌, Bomb hit 종료, 등반, wake/KO의 물리 독립성, FPS·RAF·삭제 참조 검사.
- [x] 기존 grab-throw55/autonomy12/expression19/jump8/effects11과 통합12, 중복 제외117개 PASS. `node tests/grab-throw.cjs`, `autonomy.cjs`, `pet-expression.cjs`, `jump-landing.cjs`, `screen-effects.cjs`, `local-pets.cjs` 모두 재실행. `--measure`의30/60/144Hz 속도·거리·높이 JSON은 앱 HEAD `50d2fb7`과 동일.
- [x] `node tests/smoke.cjs --animation-preview`: secure Electron 로딩/PC/도구/Draw/Trash/구조물/흡입/Tray 저장·재시작/HTTP0, 기존81상태/418프레임 기준점·1x/2x·반전 및 새9종×17상태×3시점 native459렌더 PASS. 기존 sleepy Rest→Sleep 정책 보존.
- [x] `node animation/write-browser-profiles.cjs --check`: JSON/wrapper 일치. JS/CJS 구문, Python QA encoder 구문, `git diff --check`·신규파일 공백 검사 PASS. `screen-effects.js` 변경 없음.
- [x] `python tests/encode-sprite-preview.py animation`: native51장 무손실 반복 QA 생성. 실제 contact sheet를 직접 보아 방향/몸 크기/기준점/금지 프레임을 점검. 기존 sprite-final before/after는 보존.
- [ ] [통합 QA](qa/animation-integration/README.md)의 Windows 실제 `npm start` 항목: 9종 동적 전환·짧은 Grab→Throw·착지, 60/144Hz·DPI·투명 화면, 장시간 부하. 자동/native 정적 비교로 최종 자연스러움을 확정하지 않는다.

### 화면 효과 관리 검증

- [x] `node tests/screen-effects.cjs`: 관리자 6개 + 실제 renderer 연결 5개, 신규 11개 PASS (기존 Grab/Throw 55개도 함께 실행). 30/60/144Hz 수명·파편 궤적, 불규칙 dt, burst 상한/오래된 효과 제거, auto/accumulate 전환, 잘못된 입력, 화면 밖 파편 정리 검사.
- [x] 실제 RAF 1초 지연 시 물리 dt 상한과 별도로 효과 만료. 효과 OFF에서도 수명 갱신/정리. 균열 전용 초기화와 전체 효과 초기화에서 Draw/collider/Pet 보존 및 BH orbit 참조 정리.
- [x] `node tests/grab-throw.cjs` 55개, `node tests/pet-expression.cjs` 86개(autonomy 12개 포함), `node tests/jump-landing.cjs` 63개 PASS. 중복 제외 기존94개 + 신규11개 = 105개. Throw/Bomb/자율 점프, 펫 비충돌, 활동성 및 애니메이션 회귀 유지.
- [x] `node tests/grab-throw.cjs --measure`: HEAD renderer snapshot과 현재 결과가 30/60/144Hz × 느림/보통/flick의 초기 속도·0.5초 거리·최고 높이 전체에서 동일.
- [x] `node tests/local-pets.cjs`, `node tests/smoke.cjs` PASS. 격리 Electron에서 새 모듈 로드, 기존 Bomb 효과 OFF/ON·저장·재시작, native Canvas 균열 표시/OFF/초기화/alpha 복원, 기존 PC/도구/Draw/Trash/BH/구조물 검증. 잘못된 local-pet fixture 경고는 예상 결과.
- [x] 제품6개/테스트7개 JS `node --check`, `git diff --check`, 신규 파일 공백 검사 PASS.
- [ ] 실제 Windows에서 30/60/144Hz 효과 지속시간·연속 Bomb 조작감·장시간 메모리/CPU 수동 관찰. 자동 테스트의 bounded 객체 수는 실제 메모리 측정을 대신하지 않는다.
- [ ] 당시 3-A 범위에서는 균열 UI/저장·Bomb 균열·Hammer가 미구현이었다. 현재 3-B 자동 검증 결과는 이 문서 맨 위 최신 절을 따른다. BH는 여전히 기존 최대2개, Gun은 미구현.

## Phase 2-B 최종 시각 보완 (2026-10-13)

- [x] 실제9종원본/이전프리뷰를비교. 푸들원본1/2행8장복원(scale1.1),얼굴냥9행방향시선·좌반전·미세기울임/상향bob,영업냥4행2열기립이동/공중과업무/Rest분리,우사기공중scale1.25·소스1/2/3발보정. 정상5종프로필JSON동일.
- [x] `node tests/pet-expression.cjs`: 기존67+표현/품질19=86개PASS. 새6개는원본gait/방향·기울임/기립분리/우사기크기·foot/공통보정유효성/표시hysteresis검사. 기존금지푸들행기대값은최신원본보행복원요구에맞게변경하고얼굴냥금지셀은유지.
- [x] `node tests/jump-landing.cjs`63개,`node tests/autonomy.cjs`67개,`node tests/grab-throw.cjs`55개,`node tests/local-pets.cjs`PASS. 중복제외VM94개.
- [x] `node tests/smoke.cjs --sprite-preview --qa-before/--qa-after`PASS.9종81상태418선택프레임의모든native1x기준점·대표2x/squash·alpha/방향/금지셀·기존전체Electron회귀유지.
- [x] `qa/sprite-final`에동일조건전후PNG/무손실animatedWebP·프로필/rendererSHA보존. 브라우저반복재생에서여러시점과9종전체/주요4종을시각비교. 전환열은합성표시궤적이며실제물리/60·144Hz영상이아님.
- [x] 원본9시트SHA동일,물리상수/업데이트·impulse·활동성코드바이트동일,30/60/144Hz Throw측정JSON동일. 제품5개/JS테스트6개구문·Python인코더구문·`git diff --check`PASS.
- [ ] 실제`npm start`: 푸들원본소품포함보행이원하는표현인지,얼굴냥방향/미세동작,영업냥기립fallback과업무전환,우사기실제점프크기/발위치,9종Grab/Throw/착지/Rest를사용자가확인한다.
- [ ] 실제60/144Hz·100/125/150%DPI·투명화면·장시간다수펫의시각/성능확인. 시각적최종합격은자동수치만으로확정하지않는다.상세수동순서는qa/sprite-final/README.md참고.

## Phase 2-B 품질 보완 검증 (2026-10-13, 최신)

- [x] `node tests/jump-landing.cjs`: 기존55+새8=63개PASS. 바닥/Platform/Draw×30/60/144Hz 자율점프1회→착지vy0→추가반발없음·squash복원, 실제자율floor/Platform 결정이원인표시, 일반낙하안정,Throw반복반발,Throw/Bomb지형반발,점프중Bomb우선·AI복귀,5초deadline,Bomb화면/Draw벽,Grab/Throw/orbit원인정리.
- [x] `node tests/pet-expression.cjs`: 기존55+autonomy12+표현/품질13=80개PASS. 기존겹침·offset·우선순위·설정물리독립과9종개별profile/금지프레임/30·60·144Hz2초clip시간/최고점·저속하강idle깜빡임방지/비반복마지막유지/잘못된frame·순환fallback·Canvas균형확인. 생성Zzz는ON/OFF모두없음.
- [x] `node tests/grab-throw.cjs`55개, `node tests/autonomy.cjs --measure`67개, `node tests/local-pets.cjs`PASS. 중복제외전체VM88개. 초기2-B에서변경된Look/Zzz/클립표현기대값만최신요구대로갱신하고 기존Throw수치기대값은유지.
- [x] `node tests/smoke.cjs --sprite-preview`와최종기본smokePASS. 원본11시트385셀/legacy발검사,실제9프로필81상태428프레임선택alpha/anchor·금지셀·native1x/2x기준점/강·약squash·Brown8프레임반전, 기존도구/PC상태/Tray·저장·프로세스재시작회귀유지.
- [x] 원본9개WebP hash가Inventory와일치.3.2초32장/100ms의실제Pet.draw반복·전환HTML/PNG생성,0/1/2/3초정적캡처비교. 원본이미지·pet.json수정없음.1x/2x/Pause컨트롤은QA산출물에만존재.
- [x] 수정전2-B snapshot대비30/60/144Hz Throw의초기속도·0.5초거리·최고높이전체JSON동일. 성격profile값동일, 점프반발제거에따른실제활동률변화는결정기록에측정.
- [x] 제품5개/테스트6개총11개`node --check`, `git diff --check`및신규파일공백검사PASS.
- [ ] 실제Windows: 황색냥좌우8장·발/깜빡임,얼굴냥안경/손가락없음·표정중심안정,영업냥/푸들fallback자연스러움,9종Grab→Throw→충돌→착지·Rest/Sleep전환검수.
- [ ] 실제마우스의자율점프1회안정착지와빠른Throw반복반발차이,점프도중Bomb·Grab/orbit/Trash·사다리우선순위,보조효과ON/OFF·PCclick-through/Hide/Show·Tray확인.
- [ ] 실제60/144Hz·100/125/150%DPI·화면가장자리·다수펫30분방치FPS/CPU/메모리검수. 합성포즈/가상dt검사는실제사용감이나장시간성능합격이아님.

## Phase 2-B 최초 표현·겹침·표시 설정 (2026-10-13, 당시 결과)

아래는 최초2-B의검증기록이다. Look/Zzz/클립관련동작은위최신품질보완과Inventory확정매핑으로대체되었다.

- [x] `node tests/pet-expression.cjs`: 새9개+기존Grab/Throw55개+autonomy12개=76개 PASS. 같은 위치101마리2초 밀림 없음,20이웃 유무에 Throw 경로 동일, clip/anchor/상태 우선순위, OFF의Zzz만 숨김·물리 동일,41마리 휴식 중 지속 효과 할당 없음.
- [x] 황색냥 실제 원본2행의 잘림/분절 확인, 원본 보존 후1행 반전. Electron에서8프레임 반전 렌더 비교(수평1:1 배율로 GPU subpixel 오차 분리), 정상 타펫 좌측 행 보존.
- [x] 기존11시트55클립385프레임+5override29프레임 decode·alpha·anchor 검사. native11종×5기본자세와10종×Idle/Rest/Look 정적 preview 확인. metadata/자산 변경 없음.
- [x] 새 휴식/Look의 프레임 시간은30/60/144Hz에서 일치하고 draw횟수와 무관. 외부 상태/등반에서 수면 표현 금지.
- [x] Electron4카테고리·기본슬라임1개·한글4이름/기존목록·시작4종 확인. 기존 숨긴 Canvas 정의는 삭제하지 않음.
- [x] 격리 Electron 실제 Tray checkbox 콜백·broadcast, 기존schema1의 필드 누락ON, OFF저장·프로세스 재시작OFF·재활성화ON 확인. 기존defaultPets/customPets 보존. 테스트용 IPC/preload hook은 TEMP 복사본에만 존재.
- [x] 보조 링/파티클/섬광은OFF에서 native Canvas alpha0, 수명/이동은 계속 갱신하고ON에서 표시됨. Bomb impulse와Throw 경로는flag와 무관. 기본 펫 자세/호흡·착지/Draw/블랙홀 흡입·삭제 유지.
- [x] `node tests/grab-throw.cjs`, `node tests/autonomy.cjs --measure`, `node tests/smoke.cjs --sprite-preview`, `node tests/local-pets.cjs`, JS구문10개·`git diff --check` PASS. 2-A/B Throw30/60/144Hz 전체측정JSON 동일, 단독활동10종180초 비율 동일.
- [ ] 실제 Windows: 황색냥 좌측8프레임/방향 전환, 새Rest/Look의 자연스러움·발 접촉·깜빡임, 실눈냥/커비(잠)의 수면과기상, 휴식시간3분 이상 관찰.
- [ ] 실제 Windows: Tray마우스ON/OFF·재실행, Grab/Throw/Trash/Bomb/흡입/구출/등반 도중 전환, 빠른/느린 던지기 체감 보존, PC click-through/Hide/Show 확인.
- [ ] 실제60/144Hz·DPI/화면 가장자리·다수 겹친펫30분·CPU/메모리/FPS 확인. 정적 이미지와 합성dt 검사는 실제 성능·조작감 합격을 의미하지 않는다.

## Phase 2-A 자율 행동 검증 (2026-10-13)

- [x] `node tests/autonomy.cjs --measure`: 기존55개 + 새12개, 총67개 PASS. ID/category/common profile, 정지 감속/탐색 재개, Look 방향 전환, 공중·큰 속도 보호, Bomb 휴식/등반 중단, 양방향 등반, Grab/Throw/orbit 복귀, 강한 착지·squash, 기존 idle fallback.
- [x] Idle/Rest/Look의1초 유지와 중간 방향 전환이 30/60/144Hz에서 일치(시간 오차<1e-6ms, 전환 관찰은1step 이내). 기존 Phase1 애니메이션 dt 검사도 유지.
- [x] 25마리20초 가상 업데이트에서 상태/좌표 유한, 펫 수 유지, 혼합 행동과 공유 구조물 생성 확인. Roam에서 기존 자동 생성 호출, Rest에서는 생성 중지 확인.
- [x] seed731, 60Hz, 1600×900 바닥, 캐릭터별1마리/180초 관찰. Brown 이동45.07%·정지53.38%, Sleepy2종24.62%·75.02%, 시바71.04%·23.96%, 우사기70.20%·21.50%. 전체10종이 정지 구간을 가지며 최장 연속 수평 이동≤7.90초. 전체 수치는 결정 기록 참고.
- [x] `node tests/smoke.cjs`: 실제 Electron에서 Brown rest/idle·1초 시계·Bomb 반응, 기존 모든 smoke와 Sprite11시트55클립385프레임 검사 PASS.
- [x] `node tests/local-pets.cjs`, 9개 JS `node --check`, `git diff --check`, 신규 문서/테스트 공백 검사 PASS.
- [x] 1-D snapshot과 현재 `node tests/grab-throw.cjs --measure`의 30/60/144Hz Throw 거리·높이 JSON 동일.
- [ ] 실제 Windows3분 이상: Brown/Sleepy와 시바/우사기의 활동성·휴식 차이, Look의 약한 기울임/시선, 쉴 때 발 위치와 idle 전환의 자연스러움.
- [ ] 실제25마리/구조물 ON 환경에서 휴식·충돌·등반·경로 공유, Bomb/Grab/Throw/홀 구출 후 행동 회복, Hide/Show와 PC click-through 확인.
- [ ] 실제60/144Hz·DPI 환경/장시간 CPU·메모리·FPS는 별도 확인. 가상 dt 측정은 실제 성능/시각 QA를 대체하지 않음.

## Phase 1-D 상태 정리 회귀 (2026-10-13)

- [x] `node tests/grab-throw.cjs`: 기존 45개 변경 없이 유지 + 1-D 10개, 총55개 PASS.
- [x] orbit 중 Grab 해제, 드래그 위치 유지, 같은 홀 범위 안에서 release 후 옛 orbit 복귀 없음. 범위를 벗어난 뒤 재진입 시 새 포획 가능.
- [x] 홀 만료/최대2개 교체/효과 전체 삭제 후 참조 정리, 오래된 Throw 타이머 재개 없음. 홀 수명 종료 프레임에서 흡수하지 않음.
- [x] 겹친 두 홀에서 orbit 소유자1개, 흡수 완료 시 해당 인스턴스만 제거/정의 유지/이후 재업데이트 없음. 구출 이력 및 Trash held 참조 정리.
- [x] 단일 점·길이0 line/rect/ellipse를 실제 그려진 반지름+지우개 반경 경계에서 제거. 일반 자유형/line/rect/ellipse는 다른 그림을 유지하며 collider 재생성, 전체 그림 삭제 확인.
- [x] 삭제 구조물 방문/targetHistory/lastStructureId 정리, 35초 만료와 현재 공유 경로/등반 보호, OFF의 유효 구조물 보존, 전체 구조물 삭제 시 climbingDown 정리.
- [x] Throw→충돌→착지→AI 복귀 및 반복 Grab/release에서 유한 좌표/복원 확인.
- [x] `node tests/smoke.cjs`: 격리 Electron 합성 입력으로 구출·release, 참조/구조물 이력 정리, 실제 Canvas 점 표시→지우기 alpha0 확인. 기존 기능과 Sprite11시트55클립385프레임 검증 PASS.
- [x] `node tests/local-pets.cjs`, 8개 JS `node --check`, `git diff --check`, 신규 파일 공백/충돌 마커 검사 PASS.
- [x] 1-C TEMP snapshot과 현재 `--measure`의 30/60/144Hz 전체 결과 동일.
- [ ] 실제 Windows 마우스: 흡입 중 Grab→홀 안/밖 이동→정지 release·빠른 Throw·Trash. 겹친 홀 중 다른 홀의 새 포획과 구출한 홀 재진입을 확인.
- [ ] 실제 도구 전환/Hide/효과 초기화/홀 교체 중 구출, 점과 기존 도형의 지우기 경계(DPI별), 사다리 등반 도중 구조물 삭제·OFF/ON 후 회복 확인.
- [ ] 실제 PC click-through/Tray·장시간 다수 펫 검증은 별도 수동 QA. 합성 입력/VM 통과를 실제 Windows 조작감 합격으로 간주하지 않음.

## Phase 1-C 자동/정적 검증 (2026-10-12)

- [x] `node tests/grab-throw.cjs`: 45개(기존34+시각11) PASS. Grab frame reset, Throw 최고점/안정 종료, 안전 fallback, 방향/발 pivot, 강·약 squash와 복원, Canvas 표정.
- [x] 5클립 60/144Hz 재생, 30/60/144Hz 형태 복원, draw 횟수·Throw 속도와 재생 속도 분리.
- [x] `node tests/smoke.cjs --sprite-preview`: 실제 Electron 11시트/55클립/385사용프레임 decode·비어 있지 않은 alpha·profile 검증, 변형 전후 idle 최대 바닥 오차≤1px. 기존 smoke 전체 PASS, 원본 userData 격리.
- [x] TEMP native Canvas preview를 직접 열어 11종×5클립 첫 자세/좌우/발 기준 확인. 원본 sheet 선택 프레임도 확인. 동적 QA와 구분.
- [x] 수정 전후 `--measure` 전체 JSON 동일(30/60/144Hz). 1-B 느린/보통/빠른 Throw 거리/최고 높이 유지.
- [x] `node tests/local-pets.cjs`, 8개 JS `node --check`, `git diff --check`, 신규 파일 공백 검사 PASS.
- [ ] 실제 Windows 마우스: 9종 Grab 표정/offset→느림·빠름 Throw→약/강 착지→원래 모양 복원. 휴지통/등반 도중 Grab 회귀도 확인.
- [ ] Brown/시바/커비/우사기/Sleepy2종 우선: 좌우 전환, 발판/Draw 위 접촉, 모든 프레임 사이 깜빡임·전환 느낌. 원래 시트의 hop/웅크림은 허용하며 클립 바닥 전체를 매 프레임 강제 정렬하지 않음.
- [ ] 실제 60Hz/144Hz 및 DPI 환경에서 같은 시간 동안 재생되는지, 변형이 과도하거나 Grab의 체감 중심이 달라 보이지 않는지 확인.

## Phase 1-A 자동 회귀 (2026-10-12)

- [x] `node tests/grab-throw.cjs`: 20개 사례 통과. 가장자리 offset, timestamp/빈도/단위/cap, 정지 release, 공중 방향 유지, 안정 착지·시간 만료 후 AI 복귀.
- [x] 같은 검사에서 기존 Sprite drag clip/squish, 일반 배회·점프·공유 구조물 생성·사다리 등반/Grab 중단, Touch+Trash 단일 삭제, 입력 취소/재Grab, 25개 생성 확인.
- [x] `node tests/smoke.cjs`: 기존 검사와 추가 Electron 합성 마우스 Grab/Throw/정지/Trash 통과. 원본 userData 격리.
- [x] `node tests/local-pets.cjs` 및 5개 제품 JS/3개 테스트 JS 구문 검사 통과.
- [x] `git diff --check`와 신규 테스트/수정 문서 공백 검사 통과.
- [ ] 실제 마우스의 가장자리 Grab, 빠른 flick, 정지 후 놓기, Trash, 사다리 도중 Grab, 우클릭·blur 취소 조작감.
- [ ] 실제 60Hz/고주사율 및 DPI 변경 환경의 던지기 체감.

VM은 DOM/시계 stub, Electron은 합성 입력이다. 아래의 실화면·애니메이션·충돌 전체 QA를 통과했다는 뜻은 아니다. Bomb/Black Hole/Draw 변경과 Phase 1-B/1-C/1-D는 이번 작업에 포함하지 않았다.

## Phase 1-B 자동 회귀 및 수동 재검증 (2026-10-12)

1-A 실제 사용자 피드백: offset/Trash는 정상, 던지기는 무겁고 속도별 거리 차이가 부족했다. 당시 자동 통과를 사용감 합격으로 취급하지 않는다.

- [x] `node tests/grab-throw.cjs`: 34개 사례. offset/Trash/취소/재Grab 및 기존 배회/점프/공유 구조물/사다리 상승·하강/25개 spawn 보존.
- [x] 느림/보통/빠름의 0.5초 이동 거리와 최대 상승 높이 구분, 짧은 flick/정지 후 release/자연 낙하, 20/30/60/144Hz 및 불규칙 dt 비교.
- [x] 강·약 화면 바닥/좌우/상단 접촉, Platform one-way/반발, Draw 직선·자유곡선·경사·끝점·사각형·타원 벽/바닥/천장 고속 충돌, 약한 Draw 착지 후 AI 복귀.
- [x] `node tests/smoke.cjs`: 기존 Electron smoke + 합성 Throw/Trash/고속 Draw 벽 반발. `node tests/local-pets.cjs`, JS 8개 구문 검사, `git diff --check` 통과.
- [x] 동일한 VM 조건에서 수정 전후 초기 속도/0.5초 거리/최고점 측정과 상수 선택 이유를 결정 기록에 남김.
- [ ] 실제 Windows 마우스의 느림/보통/빠름 거리 구분과 빠른 수평 flick 화면 횡단.
- [ ] 실제 상향/하향 throw, 가만히 놓기, 짧은 정지 release, 바닥·발판·Draw 반복 반발 및 약한 착지 안정성.
- [ ] 실제 offset/Trash/사다리 중 Grab, 고 DPI·고주사율·resize 및 촘촘한 도형/모서리 조작감.
- [ ] 복잡한 Draw와 다수 동시 Throw의 실 FPS/CPU·장시간 안정성.

자동 거리/높이는 경계 없는 가상 공간이며 실제 화면 밖 비행을 의미하지 않는다. 실제 화면에서는 상단·벽·바닥으로 제한된다. Phase 1-C 표현 개선은 포함하지 않았다.

## 환경과 회귀 (전체 v1.1)

- [ ] `npm install` 후 개발 앱이 정상 시작한다.
- [ ] JS 문법 검사, `node tests/local-pets.cjs`, `node tests/smoke.cjs` 수행 및 결과 기록.
- [ ] 기존 `v1.0.0` 태그와 릴리스가 변경되지 않았다.
- [ ] 시작 4마리: 슬라임, Brown, 시바, 커비.
- [ ] 기본 Canvas 메뉴는 슬라임만, 기존 Sprite Pet 메뉴는 유지.
- [ ] 기존 설정 경로 `%APPDATA%\desktop-playground`와 과거 사용자 데이터가 유지된다.
- [ ] 오프라인 상태에서 실행되며 런타임 HTTP(S) 외부 요청이 없다.

## 펫 행동, 물리, 그래픽

- [ ] 4마리, 10마리, 20마리 이상 생성 가능. 20마리 도달 시 신규 추가가 막히거나 기존 펫이 자동 삭제되지 않는다.
- [ ] 캐릭터별 걷기와 쉬기 비중 차이가 관찰된다. 특히 Sleepy는 충분히 쉰다.
- [ ] 3분 관찰 중 계속 같은 방향으로 걷기만 하는 펫이 없다.
- [ ] 화면 클릭해 펫을 잡을 때 위치가 순간적으로 튀지 않는다.
- [ ] 빠른 던지기는 크게 이동하고, 멈춰 놓으면 폭발적으로 튀지 않는다.
- [ ] 던진 뒤 자율 AI가 속도를 즉시 walking 수준으로 낮추지 않는다.
- [ ] 바닥, Draw 벽, Platform의 충돌/반발이 자연스럽고 터널링 문제가 없다.
- [ ] 각 Sprite Pet의 walk, idle, fall, drag, landing 동작에 깨짐, 프레임 뒤섞임, 앵커 문제 없음.
- [ ] Touch + Trash 시 해당 펫 인스턴스 1개만 사라진다.
- [ ] Grab, thrown, hit, knockout 상태가 함께 발생해도 영구 고착하지 않는다.

## 장난감

- [ ] Bomb 클릭 시 균열 없는 구멍·폭발·숫자와 펫 반발. 펫 자동 삭제 없음.
- [ ] Hammer가 Bomb과 명확히 다른 국소 타격 효과를 가진다. 맞은 펫이 반응하되 남는다.
- [ ] 향후 Gun 조준과 클릭이 직관적이다. 명중하면 공통 비살상 Hit·숫자 팝업을 보여 주고 펫은 남는다.
- [ ] 향후 Gun 반복 피격에서도 KO/삭제가 발생하지 않는다.
- [ ] 숫자 팝업, 파편, 탄흔에 수명과 cap이 적용되어 화면에 무한히 남지 않는다.
- [ ] Black Hole 최대 10개 동시 생성 가능.
- [ ] 11번째 생성 시 오래된 홀과 관련 orbit 상태가 안전하게 정리된다.
- [ ] 겹치는 블랙홀에 한 펫이 두 orbit을 동시에 받지 않는다.
- [ ] 블랙홀 중심에 들어가면 기존처럼 해당 펫 인스턴스가 사라진다.
- [ ] 균열 자동 복구 설정에서 자연스럽게 사라진다.
- [ ] 균열 누적 유지 설정에서 지우기 전까지 남고, 안전 상한에서 오래된 것만 정리된다.
- [ ] 균열 초기화가 Draw, Pet, Structure를 삭제하지 않는다.

## UI와 구조물

### Windows 오버레이 창 순서 (2026-10-14)

- [x] 격리 Electron `node tests/window-order.cjs`: Windows HWND z-order/WS_EX_TOPMOST, 일반 창 생성·활성화·최대화·최소화/복원, 오버레이 Hide/Show·최소화/복원, 툴바와 오버레이 순서, 최상위 속성 상실 후 blur 복구, PC/Touch의 native hit target 검사. 기본 시나리오 3회 연속 PASS; 최종 Pet/Draw/Toy 모드·비포커스 검사 PASS.
- [x] `node tests/smoke.cjs`: 기존 모드·우클릭 PC 복귀·Hide/Show·Tray·설정·Draw·Grab/Throw 등 격리 Electron 회귀 PASS.
- [x] `node tests/window-order.cjs --real-apps`: 실행 중인 Chrome을 foreground로 전환한 뒤 오버레이·툴바의 native 순서 PASS. Code/ChatGPT 창의 자동 foreground 요청은 Windows가 거부해 수동 확인 대상으로 남겼다. 탐색기의 별도 파일 창은 탐지되지 않았다.
- [ ] **실제 Windows 수동:** Chrome, 탐색기, VS Code, Codex를 차례로 일반 크기/최대화하여 펫과 툴바가 위에 있는지 확인. 각 창 클릭, Alt+Tab 왕복, 최소화/복원, 툴바 Hide→Tray 복구를 반복한다. 테스트는 같은 창의 다른 상태뿐 아니라 각 앱의 실제 포커스 전환도 포함한다.
- [ ] PC 모드에서 펫이 보이는 자리의 아래 앱 좌클릭·우클릭·휠 스크롤이 모두 전달되고, 툴바 버튼은 동작하는지 확인한다. Touch/Draw/Pet/Toy에서 필요한 입력만 오버레이가 받고 우클릭은 PC로 복귀하는지 확인한다. 자동 native hit target 검사는 휠 이벤트 실전달의 증거가 아니다.
- [ ] 일반 최대화와 Chrome F11 전체 화면을 분리해 확인한다. F11 전체 화면, 별도 항상 위 창, 관리자 권한 창, UAC 보안 데스크톱·Windows 시스템 UI는 일반 창보다 위라는 보장 범위 밖이며 강제로 앞에 띄우지 않는다. 다중 모니터/DPI/작업 표시줄 위치도 수동 확인한다.

- [ ] 펼친 툴바 버튼과 Toy 메뉴의 모든 기능이 올바른 모드를 선택한다.
- [ ] PC 모드에서는 좌클릭, 우클릭, 휠이 아래 Chrome/Explorer에 전달된다.
- [ ] 다른 조작 모드에서 우클릭하면 PC 모드로 돌아온다.
- [ ] 접기/펼치기, Playground 표시/숨김, 툴바만 숨기기가 서로 구분된다.
- [ ] 툴바만 숨긴 뒤 Tray로 복구 가능하다. 복구 단축키가 추가됐다면 별도로 검증한다.
- [ ] 기존 `Ctrl+Alt+Shift+P` 비상 PC 모드 복귀가 유지된다.
- [ ] 펫 썸네일 선택, 현재 인스턴스 선택/개별 삭제, 전체 삭제가 정상 동작한다.
- [ ] 구조물 기본 OFF, 켜면 펫별 장식 적용. 다른 펫도 발판/사다리를 사용할 수 있다.
- [ ] 구조물 삭제와 OFF/ON에 펫이 공중에서 영구 고착되지 않는다.
- [ ] 그리기 자유형/직선/사각형/원형의 collider, 지우개, 전체 지우기가 그대로 작동한다.
- [ ] 점 하나만 그려진 경우의 지우개 동작을 확인한다.

## 로컬 패키지와 장시간 실행

- [ ] 유효한 `pet.json + spritesheet.webp`를 앱에서 가져와 재실행 후 사용한다.
- [ ] 잘못된 JSON/WebP, 과대 이미지, 잘못된 상대경로, ID 충돌에 안전한 오류가 발생한다.
- [ ] 가져온 펫 패키지를 삭제해도 내장 정의와 다른 인스턴스를 훼손하지 않는다.
- [ ] resize/DPI 변경 후 좌표와 UI가 정상 범위에 있다.
- [ ] 60Hz와 고주사율 환경에서 애니메이션 시간과 효과 수명이 크게 다르지 않다.
- [ ] 20마리 + 블랙홀 10개 + 반복 폭탄 환경에서 실제 CPU/메모리/FPS를 관찰하고 결과를 기록한다.
- [ ] 30분 이상 방치 후 UI 입력/종료가 정상 동작하고 메모리의 지속적 이상 증가가 없다.
- [ ] 실제 Windows portable는 build 승인 이후 EXE와 ZIP을 새로 만든 뒤 검증한다.

## 결과 기록 템플릿

| 날짜 | Phase | 테스트 | 결과 | 환경/증거 | 비고 |
| --- | --- | --- | --- | --- | --- |
| 미실행 | 0 | baseline | 미검증 | Windows x64 | 시작 전 |
| 2026-10-12 | 1-A | grab-throw / smoke / local-pets / 구문·공백 | 통과 | Windows x64, Node 24.18.1, Electron 29.4.6 | VM 20개 사례 + 격리 Electron 합성 입력. 실마우스 QA 별도 |
| 2026-10-12 | 1-B | grab-throw / before-after measure / smoke / local-pets / 구문·공백 | 통과 | 같은 환경, VM 34개 사례 및 격리 Electron | 1-A 사용자 체감 피드백 반영. 수정 후 실마우스 재검증 필요 |
| 2026-10-12 | 1-C | grab-throw / native Sprite audit / measure 비교 / smoke / local-pets / 구문·공백 | 통과 | VM45개, Electron11시트55클립385프레임, 정적 preview 확인 | 실마우스·동적 시각 QA 별도, 1-D/2 미착수 |
| 2026-10-13 | 1-D | 상태 회귀 / smoke / local-pets / measure 비교 / 구문·공백 | 통과 | 기존45+추가10=55개, 격리 Electron 합성 입력·native dot alpha | 실제 Windows 조작·장시간 QA 별도, Phase2 미착수 |
| 2026-10-13 | 2-A | autonomy / 전체 Phase1 회귀 / smoke / local-pets / Throw 비교 / 구문·공백 | 통과 | 55+12=67개, 10종×180초 단독 관찰·25마리20초 가상 검증 | 실제 방치 관찰·성능 QA 별도, 2-B 미착수 |

| 2026-10-13 | 2-B | expression/겹침·기존회귀/Tray재시작/native Sprite/구문·공백 | 통과 | 76개VM, 격리Electron11시트+5override, Throw동일 | 실제Windows시각·조작·장시간QA 별도 |

| 2026-10-13 | 2-B 품질보완 | 점프원인/개별Sprite/전체회귀/native1x·2x/구문·공백 | 통과 | 중복제외VM88개,9종81상태428선택프레임,ThrowJSON동일 | 실제Windows동적·조작·장시간QA별도 |

| 2026-10-13 | 2-B 최종 시각 | 원본보행/프레임보정/전체회귀/native·브라우저전후QA | 자동·캡처비교통과 | VM94개,81상태418선택프레임,프로젝트전후캡처보존 | 실제npm start시각확인대기 |
