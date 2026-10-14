# Electron 런타임 연결 (2026-10-13)

최신 회귀 수정: [GRAB_REGRESSION.md](GRAB_REGRESSION.md)의 GrabStart once→Held loop와 영업냥 원본 좌우 행·전체 셀 표시 규칙이 우선한다. 최초 보완의 내부 crop은 최신 사용자 요구에 따라 제거했다. 아래 내용은 최초 통합 기록이며 Held 고정 및 snapshot과 완전 동일했던 당시 프로필은 이후 사용자 피드백으로 보완했다.

기준 앱 `feature/v1.1` HEAD `50d2fb7`, 애니메이션 `feature/pet-animation` HEAD `feceb20`. 시작 시 두 worktree 모두 clean이었다. 앱 통합 담당 한쪽에서 필요한 파일만 선택적으로 가져왔다. 전체 merge/cherry-pick, 다른 worktree 수정, commit/build/push는 하지 않았다.

## 데이터와 로딩

- 독립 player, 9종 JSON 프로필, 독립 프리뷰/생성기/설계 기록과 테스트를 가져왔다. 애니메이션 브랜치의 결정 기록도 원문으로 앱 기록에 추가했으며 Phase 3-A와 이전 기록은 보존했다.
- 9종 JSON은 기존 `qa/sprite-final/after-profiles.json`과 동일하다. renderer의 중복 9종 설정만 제거하고 같은 프로필을 참조한다. Legacy Cat/Magpie adapter와 Canvas/GIF 렌더는 유지한다.
- 로딩 순서: `screen-effects.js → animation/pet-animation.cjs → animation/profiles.browser.js → renderer.js`. player는 Node에서 CJS, 격리 브라우저에서 `PlaygroundPetAnimation`을 제공한다. fetch/새 preload API/Node 통합은 사용하지 않는다.
- `profiles.v1.json`이 원본이다. `node animation/write-browser-profiles.cjs`로 wrapper를 생성하고 `--check`로 동일성을 검사한다. 앱은 wrapper 하나만 읽는다. package allowlist와 VM/smoke 로드 목록에 player/wrapper를 추가했다. 프로필 변경 시 JSON과 wrapper를 함께 갱신한다.
- `screen-effects.js`는 바이트 변경이 없다. RAF의 uncapped 효과 경과 시간을 Sprite에도 전달하되 물리 dt clamp와 Hide/Show 일시정지 정책은 유지한다. 물리 위치/속도/크기/collider, 활동성, Throw/Bomb·자율 점프, Draw/구조물/펫 비충돌/시작4종/무제한 생성, 원본 자산/metadata, UI/IPC/설정은 변경하지 않는다.

## 상태 연결

| 앱 입력/사건 | 시각 상태 |
| --- | --- |
| 자율 정지/좌우 이동/Look/Rest | idle, walkLeft/Right, look, rest; 기존 sleepy Rest는 sleep |
| 자율 점프 상승/최고점/하강 | jumpRise, jumpApex, fall; 물리 단계 변경 즉시 전환 |
| 일반 착지 속도 >1.5 | land 130ms; 중력에 의한 평상시 지면 접촉은 반복하지 않음 |
| 강한 외부 바닥/벽/Draw 충돌 | bounce 140ms; 반발은 기존 물리만 결정 |
| 잡힘 시작/유지 | grabStart 120ms → held; 그리기마다 재시작하지 않음 |
| 느린 놓기/빠른 던지기 | release 120ms / 즉시 thrown; 120ms 전에 놓아도 GrabStart 중단 |
| Bomb | hit 180ms → 현재 외부 운동 표현; 기존 impulse/최대5초 보호 유지 |
| 사다리 상승/하강, 흡입 | climbUp/Down, blackHoleOrbit |
| 휴식 종료 | wake 180ms → 현재 자율 상태 |

`Pet.queueAnimationEvent(event)`는 유효한 일회 사건만 받아 update까지 하나로 합친다. 충돌 substep마다 별도 타이머/효과를 생성하지 않는다. `Pet.setAnimationReaction(null|'stunned'|'knockout')`는 향후 도구용 시각 override이다. 물리/삭제/HP를 구현하지 않으며 향후 호출자가 유한한 게임플레이 상태 종료 때 null로 복구해야 한다. 지금 실제 Gun/KO 게임플레이나 삭제 예약은 없다.

`animationVisualState`는 새 의미 상태, `animationState`는 기존 공통 clip 이름이다. frame/animationMs는 player 결과이며 draw는 시간을 늘리지 않는다. 기존 scale/anchor/frameAdjustments/tilt/bob·squash 렌더가 이를 소비한다.

## 독립 초안에서 보완한 점

- Grab > orbit 우선순위와 기존 구출 물리를 맞췄다. jumpRise 대기가 실제 apex/fall을 늦추지 않고, 놓기도 GrabStart를 즉시 중단한다.
- 일회 재생의 초과 ms를 다음 상태에 넘겨 FPS별 시간 손실을 막는다. 새 사건이 다시 발생할 때만 같은 사건을 재시작한다.
- 기존 fall/thrown의 `loop:false`는 프레임을 한 번 진행한 뒤 마지막 자세 유지로 해석한다. apex는 jump 마지막, sleep은 hold 자세다. **Held는 최신 보완에서 다중 drag 프레임 loop**로 바뀌었다. 전용 그림이 없는 grabStart/held/hit/knockout는 drag, land/release/wake는 idle, thrown/bounce는 fall fallback이다.
- 기존 테스트의 clock 직접 덮어쓰기를 실제 player 진행으로 바꿨다. GrabStart 후 Held clock은 120ms를 제외한 잔여 시간으로 검사한다. 원본 셀/금지 프레임/보정값 기대치는 완화하지 않았다.

## 검증과 한계

변경 파일: `renderer.js`, `index.html`, `package.json`; 신규 `animation/{pet-animation.cjs,profiles.v1.json,profiles.browser.js,write-preview.cjs,write-browser-profiles.cjs}`; `tests/{animation-platform.cjs,animation-integration.cjs,grab-throw.cjs,pet-expression.cjs,smoke.cjs,encode-sprite-preview.py}`; `docs/v1.1/{ANIMATION_WORKSTREAM,DECISIONS_AND_PROGRESS,IMPLEMENTATION_PLAN,PET_ANIMATION_PLATFORM,QA_CHECKLIST,V1_1_SPEC}.md`와 신규 `animation/{README.md,RUNTIME_INTEGRATION.md,preview.html}`, `qa/animation-integration/` 자료. 원본 독립 preview는 초안 자료로 보존하며 실제 앱 QA와 구분한다.

플랫폼 테스트, 통합12개, 기존 Grab55/autonomy12/expression19/jump8/effects11 (중복 제외117개 단위/renderer 사례), local-pets와 Electron smoke 통과. 원본 SHA·9종 프로필 동일성, 기존81개 clip 선택/418프레임·1x/2x 기준점·반전, 새17상태×9종×3시점의 native 렌더459개를 확인했다. Throw의30/60/144Hz 초기속도·0.5초거리·최고높이는 `50d2fb7`과 동일하다.

[실제 Pet.draw QA 자료](../qa/animation-integration/README.md)는 스크립트 시각 입력이며 실제 마우스/물리 영상은 아니다. 정적 contact sheet에서 9종 방향/전환/기준점과 금지 소품 부재를 직접 확인했다. 영업냥의 책상↔기립 자세 차이·실제 보행 부재, 푸들 원본 소품, 일부 원본 포즈의 몸 크기 차이는 남는다. 전용 land/hit/KO/wake 그림은 없다. Windows 투명 화면·DPI·60/144Hz 동적 자연스러움과 조작감 최종 판정은 사용자 확인으로 남긴다.
