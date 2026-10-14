# 펫 애니메이션 플랫폼 1차 작업 (2026-10-13)

`feceb20` 독립 초안 조사 기록을 보존한다. 이후 선택적으로 연결한 최신 런타임 계약/보완점/검증은 [RUNTIME_INTEGRATION.md](RUNTIME_INTEGRATION.md)를 따른다. 아래 미연결 설명·초기 우선순위/hold 규칙은 당시 기준이다.

범위: `feature/pet-animation`의 독립 프로필, 순수 상태 플레이어, 오프라인 프리뷰와 테스트. 앱 런타임에는 연결하지 않았다. `renderer.js`, `main.js`, `controls.js`, 원본 `pet.json`/WebP는 수정하지 않았다.

## 근거와 현재 코드

- `SPRITE_INVENTORY.md` 6절의 최종 매핑과 `qa/sprite-final/{before,after}-profiles.json`을 비교했다. `profiles.v1.json`은 after의 9종 프로필을 손실 없이 복사한 고정 스냅샷이다. 원본 시트는 모두 1536px/8열/192×208셀이고 9행 또는 11행이다. 각 WebP의 원본 해시와 행별 관찰은 Inventory 1~3절에 있다.
- 기존 `renderer.js`는 `spriteClip()`에서 Grab → 외부운동/블랙홀 → 등반 → 자율점프 → 공중 → 휴식 → 보행을 선택한다. `advanceAnimation()`은 경과 시간으로 프레임을 계산하고 `draw()`는 시간을 진행시키지 않는다. 시각 상태는 `idle/walkRight/walkLeft/jump/fall/drag/rest/sleep/look`의 9개 클립이며 잡기 시작·놓기·착지·피격 같은 이벤트는 독립된 표현 상태가 아직 아니다.
- 기존 QA의 전후 WebP는 실제 `Pet.draw` 32장/100ms 캡처이며 마지막 열은 합성 전환 궤적이다. 이 폴더의 [독립 프리뷰](preview.html)는 원본 WebP와 별도 프로필을 셀 단위로 보여준다. 기준선·크기 계산은 점검용 근사치이므로 실제 앱의 물리, squash, DPI 품질 판정에는 쓰지 않는다.

## 상태 계약

물리와 자율 행동은 앱이 소유한다. 플랫폼 입력은 매 update의 `held`, `thrown`, `stunned`, `orbit`, `climbing`, `airborne`, `vx`, `vy`, `resting`, `sleeping`, `looking`과 발생한 tick에만 보내는 `event`이다. `event`는 `grabStart`, `release`, `bounce`, `land`, `hit`, `wake`, `jumpPrepare` 등이다. `createPlayer(profile).update(input, deltaMs)`는 시각 상태, 원본 row/column, fallback 여부만 반환한다. 위치·속도·collider·삭제를 바꾸지 않는다.

| 종류 | 상태 | 재생·복귀 |
| --- | --- | --- |
| 반복 | idle, look, walkLeft/Right, rest, climbUp/Down, blackHoleOrbit | 경과 시간 modulo 유효 프레임 수. 새 상태로 바뀔 때만 시계 초기화 |
| 1회 | wake, jumpPrepare, jumpRise, land, grabStart, release, bounce, hit | 마지막 프레임을 유지하다 명시한 짧은 표현 시간 뒤 현재 물리 상태로 복귀. 우선순위가 높은 사건은 중단 가능 |
| 자세 유지 | sleep, jumpApex, fall, held, thrown, stunned | 물리 상태가 유지되는 동안 정해진 프레임 고정. 새 운동 원인이 오면 전환 |

우선순위는 블랙홀 > 잡힘/잡기 시작 > 놓기/충돌/착지/피격 > 던지기 > 기절 > 등반 > 공중 > 자율 표현이다. 충돌 시 `bounce`/`hit`를 보내되 물리 반발 유무는 앱이 판단한다. 자율 점프 착지는 `land` 뒤 추가 반발 없이 복귀해야 한다. 삭제 대상은 펫 인스턴스이며 프로필은 보존한다.

현재 9종에는 새 사건 전용 그림이 없으므로 `grabStart/held→drag`, `release/land/wake→idle`, `thrown/bounce→fall`, `hit→drag`가 **명시적 대체 표현**이다. `jumpApex`는 jump 마지막 자세를 유지한다. 대체 표현을 실제 원본 동작으로 오인하면 안 된다. 신규 패키지는 같은 상태 이름의 전용 클립을 추가할 수 있게 하되, 현재 독립 플레이어는 우선 기존 9종 클립 이름에 연결한다.

## 프레임·기하 규칙

1. 프로필은 원본 ID가 아닌 앱 내부 ID에 연결한다. 원본 시트를 다시 인코딩하지 않고, 0-based row와 유효 column 목록만 재생한다. 반복 셀·비연속 목록을 허용하고 금지 셀을 선택하지 않는다. 같은 상태가 유지되는 tick마다 0번 프레임으로 재시작하지 않는다.
2. 프레임은 `elapsedMs/frameMs`로 선택한다. 30/60/144Hz에서 같은 1초는 같은 프레임이어야 한다. 그리기 호출은 시계를 바꾸지 않는다. one-shot은 clip 자체의 loop 설정과 무관하게 상태 재생 방식이 우선한다.
3. 기본 신체 배율은 클립 단위로 고정한다. 원본의 의도된 도약·웅크림을 자동 alpha bbox 정규화로 지우지 않는다. 발 원점(`feet`)과 얼굴냥의 중심 원점(`center`)을 구분한다. 원본 셀 소품과 몸통의 경계를 혼동하지 않는다.
4. 우사기 공중처럼 검증된 소수 프레임만 `frameAdjustments`의 **원본 column**에 연결한다. 이 값은 표시 geometry만 조정하고 물리 발/충돌 상자를 이동시키지 않는다. 좌우 반전은 검증된 프로필의 `mirrorOf`에서 한 번만 수행한다.
5. 상태 전환 때 다른 클립의 자세 차이는 남을 수 있다. 특히 영업냥의 책상↔기립은 현재 원본의 불연속이다. 새 프레임이나 소품을 합성해 숨기지 않는다.

## 9종 판정 및 다음 개선 순서

| ID | 이번에 확인한 실제 선택 | 남은 점 / 개선 방향 |
| --- | --- | --- |
| `cat_brown` | 우측 원본 8장, 좌측은 같은 행 반전. 왼쪽 원본 행의 깨짐을 회피 | 발 기준과 좌우 전환을 실화면에서 재검수 |
| `cat_face` | 9행 시선 전환과 좌측 반전, 중심 원점, 작은 tilt/bob | 0-based row8 col2/3 안경·손가락 금지 유지. 얼굴 크기와 방향 전환의 순간 변화 수동 검수 |
| `cat_sleepy` | 원본 좌우 보행, 웅크린 rest/sleep | 기상 전용 원본 클립은 없음. 정지↔이동 연결 확인 |
| `salary-cat` | 업무 idle(row8), 키보드 rest(row6), 기립 이동(row4 col2) | 이전 v1.0/Phase1 코드는 row1/2 각 8장을 좌우 이동으로 썼다. 원본 행은 몸 분절·측면 소품 문제, before QA는 업무 자세가 이동하여 미끄러짐. after 기립은 방향성은 있으나 발걸음이 없고 책상이 순간 출현. **복원 후보:** row1/2의 유효 셀을 프레임별로 다시 선별해 실화면 A/B 검수; 안전하지 않으면 현재 기립 유지. 원본 교체·새 소품은 별도 자산 작업 |
| `doge` | 원본 좌우 8장과 점프 3장 | 착지·잡힘 전용 동작이 없어 명시적 fallback 검수 |
| `puddle` | 원본 row1/2 좌우 8장, scale1.1. 전후 QA에서 앞발 제자리 동작보다 보행감 개선 | 푸른 소품은 원본에 존재. 낮은 측면 몸통·소품 포함 크기와 발 기준을 실화면 검수. 소품 없는 걸음은 별도 자산 필요 |
| `usagi` | 공중 3장 scale1.25, source col1/2/3 발 보정. 전후 QA에서 축소 완화 | 실제 점프의 물리 높이와 원본 셀의 구운 높이가 겹치지 않는지 검수 |
| `kirby` | 원본 좌우 8장과 rest/sleep | 피격·충돌 전용 표정 후보는 의미 검수 전까지 자동 배정하지 않음 |
| `kirby_sleepy` | 모자 포함 좌우 보행과 잠 자세 | 수면→기상 시 모자/몸 크기 연결 검수 |

영업냥의 "이전에 자연스러운 좌우" 기록은 코드상 row1/2 보행 선택의 존재를 확인한다. 해당 시기의 실사용 승인 영상은 저장소에서 찾지 못했으므로 자연스러움 자체를 확정하지 않는다. before/after 프리뷰에서는 업무 자세 이동보다 기립 포즈가 미끄러짐을 줄였으나 보행 품질의 최종 답은 아니다.

## 새 캐릭터와 통합 경계

신규 동물은 `pet.json` + 원본 `spritesheet.webp` + 검증된 이 스키마 프로필만 준비한다. 등록 전 셀 크기·행열·비어 있지 않은 선택 셀·anchor·좌우 의미·금지 프레임을 확인한다. 8열/192×208이 아닌 패키지는 검증된 어댑터가 필요하며 현재 로더가 임의 외부 패키지를 읽는다는 뜻이 아니다. 내장/개인용 패키지 권리 구분과 ID 호환성은 유지한다.

앱 통합 담당자는 현재 `renderer.js`의 `definition.animation` 참조와 `spriteClip/advanceAnimation/spriteGeometry` 사이에 이 상태 선택기를 연결하고, 충돌·Grab/Throw·자율 점프에서 event를 **한 번** 공급해야 한다. 프로필을 이 파일로 이동할 때 중복 사본이 runtime에 공존하지 않게 한다. `main.js`/`controls.js` 변경은 이 플랫폼에 필요하지 않다. 통합 전 최신 앱 브랜치와 프로필 해시를 다시 비교한다.

## 검증과 한계

- `node tests/animation-platform.cjs`: 9종 프로필과 기존 after 스냅샷 동일성, 원본 파일 존재/RIFF, 상태 fallback, 전환, 금지 셀, 주요 4종 매핑, 30/60/144Hz 시간 선택.
- `node animation/write-preview.cjs`: 오프라인 [preview.html](preview.html) 갱신. 브라우저에서 9종·상태별 클립을 직접 확인한다.
- `qa/sprite-final/index.html`: 이전 실제 렌더 전후 자료. 동적 Windows 사용감과 새 이벤트 동작은 이번 브랜치에서 직접 실행하지 않았다.
