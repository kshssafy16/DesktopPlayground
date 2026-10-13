# Phase 3 장난감 구현 준비 및 영향 범위

상태: Phase 3-A 공통 효과 관리 구현 완료. Bomb 균열 연결(3-B), 신규 도구와 애니메이션 모듈 통합은 미진행. 아래 코드 조사 표는 3-A 이전 기준이며 최신 동작은 다음 완료절을 따른다.
기준: 2026-10-13, `feature/v1.1`의 `26c23fa` (Phase 2-B checkpoint).
요구사항의 근거: V1_1_SPEC의 4·5절, IMPLEMENTATION_PLAN의 Phase 3, QA_CHECKLIST의 장난감 항목.

## 작업 소유권

- 앱 작업: `D:\DesktopPlayground`, `feature/v1.1`. 물리, 도구, 구조물, UI/Tray/IPC, 설정, 전체 회귀 및 최종 통합.
- 애니메이션 작업: `D:\DesktopPlayground-animation`, `feature/pet-animation`. 펫별 클립·크기·기준점·프레임·시각 보정, 독립 모듈과 프리뷰/관련 테스트. 상세 경계는 ANIMATION_WORKSTREAM.md를 따른다.
- 이 계획은 애니메이션 공통 API나 재생기를 새로 정의하지 않는다. 앱 측은 기존 렌더링을 유지하며 도구의 판정·물리·수명만 담당한다. 독립 모듈이 완성되면 실제 인터페이스를 검토하여 단일 담당자가 연결한다.
- 애니메이션 전용 문서와 `animation/`, `docs/v1.1/animation/`, `tests/animation-platform.cjs`는 앱 측에서 중복 수정하지 않는다. 공유 SPEC/계획/QA/결정 기록은 각 담당 범위에 한정하여 추가하고 통합 시 함께 대조한다.

## 실제 코드와 기획의 차이

| 영역 | 현재 코드에서 확인한 사실 | Phase 3 변경 지점 |
| --- | --- | --- |
| Bomb | `renderer.js:fireBomb`에 거리 기반 충격, 자국 최대 8개, 링/섬광 각각 24개와 파티클 제한이 있음. Grab/orbit 중인 펫은 제외 | 기존 충격 수식 보존, 공통 균열과 보조 효과 연결. 펫 삭제 금지 |
| 효과 시간 | `drawEffects()`의 자국/링/섬광/파티클 수명과 파티클 이동은 호출 횟수 기준. `animate(dt)`가 이 함수에 dt를 전달하지 않음 | 신규 효과는 경과 시간 기준. 기존 효과를 연결할 때 60Hz 기준 수명/이동을 보존하고 30/60/144Hz 비교. Pet 애니메이션 시간 코드는 수정하지 않음 |
| 공통 균열 | 별도 데이터·설정·초기화 없음. Bomb의 `holes`는 자국이며 Draw나 Black Hole과 다른 데이터 | Draw/collider와 분리된 균열 저장, 자동 복구/누적 유지/상한/전용 초기화 |
| 외부 충격 | `Pet.beginImpact()`와 물리 선택/속도 제한에 `bomb` source 분기. Throw와 자율 점프는 이미 분리 | Hammer 등 새 원인의 최소 확장 검토. 기존 Throw/Bomb 프로필과 종료 조건을 그대로 보존. 시각 상태 매핑은 애니메이션 담당 |
| Gun 삭제 | hit/knockout/삭제 예약 없음. `Pet.remove()`는 참조/이미지를 정리하지만 배열 제거는 각 호출자가 담당 | 인스턴스 단위 중복 방지 종료 경로와 수명 관리. 정의/패키지 삭제 API 사용 금지. Trash/흡입/전체 삭제와 경합 검사 |
| Black Hole | `addBlackHole` 최대 2개, 오래된 홀 교체 및 `pruneBlackHoleReferences` 있음. dt 기반 회전/수명, 3.5회전 후 인스턴스 흡수 삭제 | 최대 10개 확장, 11번째 교체·동시 orbit·구출 회귀 및 부하 측정 |
| 입력/보안 | main/preload의 모드 검증과 controls/renderer 모드 분기. Hammer/Gun 없음 | 새 모드 접근 경로와 whitelist를 함께 확장. 신뢰 sender 검사/격리 유지, 우클릭 PC·접기·Hide/Show·Grab 해제 회귀 |
| 설정 | schemaVersion 1, `auxiliaryEffectsEnabled` 없는 값은 ON, 직렬/atomic 저장 | 균열 설정의 optional field/fallback 추가 검토. 기존 userData 경로와 값 보존 |
| 효과 OFF | 보조 렌더만 숨김. Bomb 자국/BH 본체·물리·삭제는 유지 | 숫자/스파크/파편을 같은 flag에 연결. OFF여도 명중/KO/삭제와 효과 수명 정리는 진행. 신규 균열의 핵심 표시 분류는 구현 전 명시 |
| 새 런타임 파일 | package.json의 명시적 포함 목록과 smoke의 TEMP 앱 복사 목록 사용 | 모듈을 추가할 경우 index 로딩 순서·두 목록을 함께 점검. 이 점검은 빌드 실행을 의미하지 않음 |

## 작은 구현 단위 제안

기존 Phase 3 순서를 유지한다. 아래 번호는 후속 요청을 위한 작업 단위 제안이며 이번에 구현하지 않는다.

1. **3-A 공통 화면 효과/균열**: 경과 시간 기반 수명, 자동 복구/누적 유지, bounded 데이터와 전용 초기화. 설정은 기존 Tray 등 최소 접근 경로로 검증하고 Phase 4 툴바 재구성은 보류한다. 자동 복구 약 5초는 명세의 초기 실험값이며 확정 밸런스가 아니다. 누적 상한과 cooldown은 구현 시 측정하여 기록한다. 먼저 Draw/collider·기존 효과 삭제와의 독립성을 검증한다.
2. **3-B Bomb 연결**: 3-A 균열/파편 연결, 현재 impulse/반발/비삭제 정책 유지. 효과 OFF와 연속 클릭에서도 물리·수명 정리가 동일해야 한다. 기존 dt 기반이 아닌 효과를 수정한다면 이 범위에서 별도 회귀로 검증한다.
3. **3-C Hammer**: 좁은 클릭 판정, 국소 충격/균열, 비삭제. 도구 접근은 최소 UI 또는 Tray 경로를 선택하고 전체 툴바 재설계는 하지 않는다. Grab/orbit 우선순위는 기존 Bomb의 제외 정책을 초기 후보로 삼고 확정 내용을 기록한다.
4. **3-D Gun**: 즉시 명중과 짧은 궤적, 숫자, 유한한 hit → knockout → 인스턴스 제거. HP/연사/복잡한 탄도는 추가하지 않는다. 시각 궤적 최대 24개·2초 이내를 명세 기준으로 검증하고 숫자에도 별도 상한을 둔다. 겹친 펫에서 한 클릭의 대상 선택 순서, Grab/orbit/KO 중 재피격 정책은 구현 전에 정하고 테스트한다. 쓰러짐 클립/프레임은 만들지 않고 완성된 애니메이션 모듈의 지원 상태와 fallback을 담당 측과 대조하여 연결한다.
5. **3-E Black Hole 10개**: 기존 흡수/구출/교체 구현의 상한 확장과 스트레스 회귀. 방출 모드, 새로운 펫 cap, 새 구조물 디자인은 제외한다.

최초 권장 구현은 **3-A만**이다. 균열 표시 설정과 신규 도구 접근 UI의 세부안은 제품 요구를 변경하지 않는 범위에서 후속 작업에 구체화한다. 확정 요구와 충돌하는 변경은 사용자 확인 없이 적용하지 않는다.

## 애니메이션 통합 전 확인

- 이번 조사에서 양 브랜치 HEAD는 `26c23fa`로 동일하고 앱 작업 트리는 clean이었다. 애니메이션 worktree에는 독립 `animation/`, `docs/v1.1/animation/`, `tests/animation-platform.cjs`의 미추적 파일이 있었다. 아직 구현 내용을 검수하거나 충돌 없음으로 판정하지 않았다.
- 통합 직전 양쪽 HEAD/미커밋 변경/추가 파일을 다시 확인한다. 앱 작업을 잠시 멈추고 한쪽에서만 런타임 연결한다. 지금 merge/cherry-pick/파일 복사하지 않는다.
- 주요 공유 지점은 `Pet.update/draw` 호출부, 물리 결과를 시각 상태에 전달하는 부분, `index.html` 로딩 순서, package 목록, smoke TEMP 복사 및 렌더 assertion, 공유 QA 문서다.
- 위치/속도·움직임 원인·Grab/orbit·삭제 여부의 최종 소유권은 앱이다. 애니메이션 모듈은 이를 읽어 표현하고 물리 collider나 속도를 바꾸지 않는지 검토한다. 충격 강도/방향 및 KO 시간 전달 방식은 실제 모듈을 받은 후 맞추며, 지금 새 공통 상태 머신을 중복 구현하지 않는다.
- 통합 검증은 자율 점프 무바운스, Throw/Bomb 반발·거리·높이, 활동성, 펫 비충돌, 시작 4종/무제한 생성, 삭제 경합, 구조물, PC/Tray/설정과 애니메이션 전용 테스트를 함께 포함한다. 최종 자연스러움은 사용자의 Windows `npm start` 확인으로 남긴다.

## 검증 계획 (모두 후속 구현 시 실행)

- 기존 `node tests/grab-throw.cjs --measure`, `node tests/jump-landing.cjs`, `node tests/autonomy.cjs --measure`, `node tests/pet-expression.cjs`, `node tests/local-pets.cjs`, `node tests/smoke.cjs`를 회귀 기준으로 유지한다. 상속 실행되는 테스트 수를 중복 합산하지 않는다.
- 도구 전용 테스트: 균열 TTL/누적 상한/초기화 독립성, 효과 OFF와 설정 재시작, Bomb/Hammer 비삭제, Gun miss/겹침/중복 hit/Trash·BH와 삭제 경합, BH 10/11개·구출·만료와 참조 정리.
- 30/60/144Hz에서 같은 가상 시간의 효과 수명/이동 및 기존 던지기 측정 비교. 반복 입력에서 효과 수와 펫 인스턴스 참조가 계속 증가하지 않는지 검사한다.
- JS 구문 검사와 `git diff --check`. 새 모듈은 격리 smoke 복사/실제 로딩 확인까지 수행한다. portable 빌드·버전 변경·commit·push는 별도 요청 전 실행하지 않는다.
- Windows 수동: 조준/타격 조작감, PC 클릭 통과·우클릭 복귀, Hide/Show·Tray, 보조 효과 OFF의 구분, 20마리 이상 + BH 10개 + 반복 도구의 FPS/CPU/메모리와 실제 시각 반응. 자동 테스트 통과로 대체하지 않는다.

## Phase 3-A 완료: 공통 효과 관리

- `screen-effects.js`는 Pet/DOM/IPC/애니메이션 참조 없이 효과 데이터만 관리한다. `add(kind, data, durationMs)`, `update(elapsedMs, viewport)`, `clear(kind?)`를 제공한다. 기존 renderer 생성 함수의 frame 단위 수명 인자는 60Hz 기준 밀리초로 변환하는 호환 adapter이며, 내부 객체는 `durationMs/remainingMs`를 사용한다.
- 실제 RAF 경과 시간을 효과에 전달한다. 기존 Pet 물리의 dt clamp·상수와 Black Hole 갱신은 변경하지 않는다. Playground Hide/Show로 RAF를 멈춘 동안은 기존처럼 일시정지하며 재개 첫 프레임에서 숨긴 시간을 소급하지 않는다.
- 상한: particle 160, ring 24, impact 24, crater 8은 기존 값 유지. crack 64는 초기 안전 제한이며 펫 생성 상한과 무관하다. 상한 초과 시 해당 효과의 오래된 객체부터 제거한다. 배열은 제자리 압축/초기화하며, 파티클은 화면 경계 32px 밖에서 조기 제거한다. 생성 burst 자체도 160개로 제한한다.
- 파티클은 기존 60Hz 이동/중력(.09 px/reference-frame²)의 닫힌 식으로 갱신하여 FPS별 이동 오차를 막는다. Bomb 자국은 5초, 링/섬광/파티클은 기존 60Hz 수명을 유지한다. Pet의 Bomb impulse와 Throw/자율 점프 원인 구분 코드는 수정하지 않는다.
- `addCrack`은 6갈래×3선분, 반경 최대 200px의 고정 geometry를 한 번 생성한다. 기본 auto는 5초 뒤 정리, accumulate는 시간 만료 없이 상한 내 유지, auto로 돌아오면 기존 균열에 새 5초 복구 기간을 준다. `clear('crack')`은 다른 효과/Draw/collider/Pet/BH와 독립적이다. 전체 효과 초기화는 기존 BH 참조 정리와 함께 관리자도 비운다.
- 균열/링/섬광/파편은 `auxiliaryEffectsEnabled`에 따른 보조 효과다. OFF에서도 갱신·만료한다. Bomb 자국/BH 본체의 기존 표시 정책은 유지한다. 균열은 내부 API와 렌더만 준비했으며 현재 클릭 도구에서 생성하지 않는다. 모드 선택 UI·IPC·저장 설정 추가는 이번 범위가 아니다.
- 향후 애니메이션 통합 시 `index.html` script 순서, package 포함 목록, VM/smoke 로딩 목록, renderer RAF/효과 호출부를 보존한다. Pet mapping·frame·크기·anchor와 물리 업데이트는 이 단계에서 수정하지 않았다.
