# DesktopPlayground v1.1 단계별 구현 계획

## 0. 작업 시작 규칙

1. 실제 프로젝트 경로를 확인한다. 이전 로컬 `D:\DesktopPet`이 제거됐을 수 있으므로 사용자가 선택한 clone 위치를 기준으로 한다. Codex 분석 보고서의 `D:\DesktopPlayground` 경로를 그대로 믿지 않는다.
2. `v1.0.0` 태그는 수정하지 않는다. `git status` 확인 후 새 작업 브랜치 `feature/v1.1`을 사용한다.
3. README, ASSET_SOURCES, history, 기존 tests와 현재 코드를 비교한다. 이전 문서가 오래됐으면 주석으로 지적하되 삭제하지 않는다.
4. 작업 단위마다 변경 파일과 테스트 범위를 최소화한다. 이전 Phase가 불안정하면 다음 Phase로 넘어가지 않는다.
5. 기능 동작이나 인터페이스 변경이 불가피하면 영향 범위를 설명하고 관련 문서와 테스트를 함께 바꾼다.

## Phase 0. 현행 상태 및 baseline

범위: 읽기 중심, 코드 수정 없음.
- 현재 소스의 실제 startup 4마리, 사용자 표시 Pet 목록, tool modes, Tray, IPC, pet settings와 구조물 OFF를 확인한다.
- `renderer.js`의 Pet.update/drag/throw/animation과 도구 effect, `controls.js`/`main.js`의 UI와 state flow를 매핑한다.
- `tests/smoke.cjs`, `tests/local-pets.cjs`를 실행 가능한 환경에서 기준점으로 삼는다. 기존 구문 검사와 Windows 실제 수동 테스트 필요 항목을 분리한다.
- 보고서에서 확인된 결함(던진 vx 덮어쓰기, Sprite squash 부재, 블랙홀 구출, 오래된 구조물 이력, 점 1개 지우개)을 현재 코드에서 재확인한다.
- 결과: 최소 수정 계획, 변경 대상 파일, 회귀 테스트 대상, 예상 위험을 `DECISIONS_AND_PROGRESS.md`에 기록한다.

## Phase 1. 물리, Grab/Throw, 기존 Pet 시각 보완

우선순위: 가장 높음. 새 UI/도구 추가 금지.
- 포인터 timestamp와 최근 이동 구간으로 throw velocity 산출, 드래그 offset 유지.
- 외부 충격과 자율 roam이 동일 속도를 경쟁하지 않도록 상태 분리. 충분한 감쇠 뒤 자동 복귀.
- 바닥, 화면 경계, Platform, Draw collider의 bounce/slide를 일관성 있게 보정. 기존 그림 충돌 유지.
- 기존 Sprite에 착지 squash, grabbed/hit 반응 fallback을 적용. 프레임/anchor/여백이 깨진 펫만 개별적으로 손본다.
- 외부 충격으로 화면 밖에 영구 체류하거나 얇은 선분을 뚫는 경우 해결.
- 완료: 빠르게 던진 후 즉시 walking 속도로 강제 축소되지 않음. 조용히 놓아도 갑자기 튀어나가지 않음. 모든 기존 펫이 오류 없이 표시됨.

### Phase 1-A 확정 작업 경계 (2026-10-12)

- Grab offset, 최근 100ms timestamp 기반 Throw, 던지기 중 자율 이동/점프/등반의 속도 경쟁 방지만 구현한다.
- 던지기 상태는 안정 착지 후 또는 최대 3초의 물리 갱신 시간 뒤 종료한다. 기존 드래그 표정, 개별 Trash, 배회/점프/공유 구조물은 유지한다.
- 이번 요청에 따라 Bomb와 Black Hole 구현/개수는 변경하지 않는다. Phase 0의 orbit 구출 및 Bomb impulse 연결 제안도 이번 1-A에서는 제외한다.
- 충돌/bounce 재설계, Sprite squash/clip/anchor/시간 전환 등 Phase 1-B/1-C/1-D 작업은 수행하지 않는다. 검증 상세는 결정 기록과 QA 체크리스트 참고.

### Phase 1-B 확정 작업 경계 (2026-10-12)

- 1-A 실제 마우스 피드백(빠른/느린 거리 차이 부족, 무거운 체감)을 우선 반영한다. 입력 마지막 flick 추정/gain/cap, Throw 전용 중력/공중 감쇠/지상 마찰/보호 시간을 조정한다.
- Throw의 화면 경계/Platform/Draw 반발 및 고속 경로 충돌 검사, 약한 접촉 정지를 구현한다. 일반 배회/점프/사다리 물리, Draw 입력/생성, Bomb/Black Hole은 보존한다.
- 초기 속도뿐 아니라 실제 거리/최고 높이·FPS별 차이를 수정 전후 측정해 기록한다. 합성 입력 검증과 실제 사용자 손맛 재검증을 구분한다.
- Sprite 표현 개선과 1-C/1-D, 새 캐릭터/도구/UI는 미착수로 유지한다.

### Phase 1-C 확정 작업 경계 (2026-10-12)

- 실제 로컬 9종과 legacy 2종의 기존 시트/metadata를 대조한다. 현재 drag/fall/walk 행은 유지하며 없는 클립을 가정하거나 새 이미지를 제작하지 않는다.
- Sprite 발/중심/탄성 profile, elapsed-time 재생과 상태 전환 초기화, Sprite·Canvas의 강/약 착지 squash 및 복원만 보완한다. Grab/Throw 1-A/B의 물리·거리 차이와 도구/UI는 보존한다.
- 자동 clip/alpha/anchor/시간·물리 회귀와 정적 native Canvas preview를 확인하되 실제 Windows 조작감/동적 깜빡임은 별도 QA로 남긴다.
- 활동성/휴식/수면, 신규 캐릭터/도구/UI와 Phase 1-D/2는 진행하지 않는다.

### Phase 1-D 확정 작업 경계 (2026-10-13)

- Grab의 orbit 해제/재포획 방지, 블랙홀 종료·교체·효과 삭제와 Pet 삭제 시 참조 정리를 보완한다. 우선순위는 Grab > Black Hole orbit > Throw > 자율 이동이다. 구출된 홀은 놓은 뒤 흡입 범위를 벗어날 때까지 재포획하지 않으며, 재진입하면 새 포획은 가능하다.
- 블랙홀 최대 2개와 3.5회전 후 해당 인스턴스 삭제, 기존 효과를 유지한다. 최대 10개 확장은 Phase 3이다.
- 선분 없는 Draw의 점 fallback에만 원형 지우개 hit test를 추가한다. 기존 도형·collider·전체 그림 삭제는 유지하고 점의 새 충돌체는 추가하지 않는다.
- 구조물 삭제/전체 정리 후 방문·탐색 참조를 정리하고, 기존 5초 cleanup에서 비활성 35초 방문 이력을 만료시킨다. 실제 사용 중인 구조물/이력과 OFF 상태의 유효 구조물은 보존한다.
- 기존 45개 회귀에 상태 예외 검사를 추가한다. 물리·애니메이션 상수 재조정, Phase 2 성격/새 펫/장난감/UI, build/commit/push는 수행하지 않는다.

## Phase 2. 방치 행동과 캐릭터별 활동성

- small state machine: roam, idle, look, rest, sleep.
- 캐릭터 ID별 activity/idle/rest/jump/sleep 비율을 데이터로 관리. 현재 고양이보다 강아지/우사기는 활발하게, Sleepy는 차분하게.
- 전체적으로 이동 빈도를 낮추고 행동 유지시간에 랜덤 범위 부여. 구조물 등반 중 의도치 않은 sleep 금지.
- Sprite clip 실제 행과 frame index 점검, 있는 동작 우선 사용. 스프라이트 이상이 확인되면 asset 수정 또는 렌더 대응만 제한적으로 허용.
- 기본 선택 목록은 슬라임만, 기존 로컬 Sprite 펫은 유지. 무리한 legacy 정의/asset 제거 금지.
- 완료: 대표 펫 3종에서 3분 내 행동 차이가 보임. 한쪽 방향 걷기만 무한 반복하지 않음. 시작 4마리 유지, 계속 spawn 가능.

## Phase 3. 화면 장난감과 안정성

세부 작업은 독립적으로 나눈다.
1. 공통 Impact/Crack 레이어: 자동 복구와 누적 유지, 개별 초기화, Effect cap.
2. Bomb: 현재 충격 유지 + 균열/파편/피격 반응. 기존 펫 삭제 금지.
3. Hammer: 클릭 타격/균열/펫 밀려남. Bomb과 효과 범위 차별화.
4. Gun: cursor aim, 짧은 shot trail, 명중 판정, damage-number popup, knockdown, 인스턴스 1개 제거. 단일 hit -> removal idempotent.
5. Black Hole: cap 10개, 가장 오래된 것 교체, orbit 상태 정리, 기존 흡수 완료 후 삭제 유지.
- 모든 도구는 화면 아래 OS 앱을 실제 수정하지 않는다. 파티클/숫자/탄흔/균열은 모두 cleanup한다.
- 완료: 10개 블랙홀, 폭탄 반복, 총과 망치 연속 타격 중 충돌/메모리 오류 없음. Draw collider는 그대로 동작.

## Phase 4. Toolbar 및 Pet 관리

- PC / 펫 / 만지기 / 놀이 / 그리기 / 더보기 / 접기 재구성. Toy 팝업에서 4개 도구 접근.
- 더보기에서 구조물 ON/OFF, Playground Hide/Show, 툴바 숨김, crack 설정/지우기, 앱 종료.
- 최소 크기에서도 패널 스크롤을 보장하고 펫 썸네일/카테고리/선택 표시 제공.
- 현재 펫 인스턴스 수와 목록, 한 마리 삭제/전체 삭제. Trash는 유지.
- 툴바 숨김 이후 Tray로 복구. 현행 `Ctrl+Alt+Shift+P`는 PC 모드 전환만 하므로 별도 복구 단축키 또는 호환되는 확장안을 설계.
- 완료: 오른쪽 클릭 PC, PC click-through, 접기/펼치기, 프로그램 종료가 안정적. 별도 Tool 모드 선택 시 아래 앱 클릭 통과 제어가 정확함.

## Phase 5. 신규 동물, 구조물 스타일, 로컬 가져오기

- 새로운 오리지널 캐릭터 5종: 말티즈, 포메라니안, 웰시코기, 오리, 하프물범. 그래픽은 별도 준비 후 통합.
- 새 시트 품질 검사와 기본 클립 mapping, fallback. 각 동물 성격 프로필 제공.
- 생성자 정보를 토대로 발판/사다리 시각 스타일 변경. 공유 물리와 생성 제한은 유지.
- 사용자 로컬 sprite package import, 파일 검증, 사용 및 개별 패키지 삭제, 설정 보존. 공개 소스에 개인 캐릭터 이미지를 넣지 않음.
- 완료: 소스 재컴파일 없이 새로운 유효 package를 가져오고, 앱을 재실행해 다시 사용할 수 있음.

## Phase 6. 통합 검증, 배포 전 준비

- `QA_CHECKLIST.md`의 수동/자동 체크 항목을 갱신하고 확인 결과를 기록한다.
- 실제 Windows click-through, 20마리 이상 동시 생성, 10개 블랙홀, 장시간 방치, 일부 화면 DPI/크기 변경을 검증한다.
- v1.0.0 태그, Release는 수정하지 않는다. 공개/개인 자산 분리와 `ASSET_SOURCES.md`를 검수한다.
- 빌드와 v1.1 태그/Release/Push는 사용자 요청을 받은 뒤 진행한다.

## Phase 종료 보고서 형식

- 완료한 범위:
- 변경 파일:
- 실행한 테스트 및 결과:
- 실행 못한 실제 PC 확인:
- 남은 위험/확인 질문:
- 다음 Phase로 넘어가도 되는지:

문서 업데이트는 증거가 있는 사실을 적는다. `git diff --check` 및 실질적인 회귀 검사를 우선한다. 변동 사항이 없으면 자의적으로 기능을 추가하지 않는다.
