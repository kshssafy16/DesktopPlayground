# DesktopPlayground v1.1 검증 체크리스트

체크 표시 규칙: `[ ]` 미검증, `[x]` 실제 실행 및 통과. 자동 검사와 실제 Windows 수동 확인을 구분한다. 아래 전체 v1.1 항목은 해당 단계가 구현·검증될 때 갱신한다.

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

- [ ] Bomb 클릭 시 화면 균열, 폭발, 펫 반발. 펫 자동 삭제 없음.
- [ ] Hammer가 Bomb과 명확히 다른 국소 타격 효과를 가진다. 맞은 펫이 반응하되 남는다.
- [ ] Gun 조준과 클릭이 직관적이다. 빗나가면 삭제되지 않고, 명중하면 숫자 팝업과 쓰러짐 후 해당 인스턴스만 사라진다.
- [ ] Gun 반복 피격 시 동일 인스턴스에 중복 KO/삭제가 발생하지 않는다.
- [ ] 숫자 팝업, 파편, 탄흔에 수명과 cap이 적용되어 화면에 무한히 남지 않는다.
- [ ] Black Hole 최대 10개 동시 생성 가능.
- [ ] 11번째 생성 시 오래된 홀과 관련 orbit 상태가 안전하게 정리된다.
- [ ] 겹치는 블랙홀에 한 펫이 두 orbit을 동시에 받지 않는다.
- [ ] 블랙홀 중심에 들어가면 기존처럼 해당 펫 인스턴스가 사라진다.
- [ ] 균열 자동 복구 설정에서 자연스럽게 사라진다.
- [ ] 균열 누적 유지 설정에서 지우기 전까지 남고, 안전 상한에서 오래된 것만 정리된다.
- [ ] 균열 초기화가 Draw, Pet, Structure를 삭제하지 않는다.

## UI와 구조물

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
