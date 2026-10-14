# DesktopPlayground — 재사용 가능한 Pet Animation Platform 규격

Grab 회귀 보완: [animation/GRAB_REGRESSION.md](animation/GRAB_REGRESSION.md). Held는 다중 유효 프레임 loop(단일 프레임만 hold)이며 GrabStart는120ms once이다. 영업냥 보행은 원본 좌우 행의 전체 셀을 표시하고 `center=.5`, `foot=199/208`로 맞춘다. 셀 내부 crop은 최신 사용자 요구에 따라 사용하지 않는다.

최신 Electron 통합 계약은 [animation/RUNTIME_INTEGRATION.md](animation/RUNTIME_INTEGRATION.md)를 따른다. `feceb20`의 독립 player와 9종 프로필을 선택적으로 연결했고 기존 geometry 보정·물리는 보존했다. 아래 과거 설계/7~8절의 클립 보정 근거는 유지하되 상태 선택/loop·once·hold와 이벤트 공급은 최신 통합절이 우선한다.

기준: `pets.zip` 9종과 GitHub 공개 v1.0.0 소스 구조를 분석하여 제안한 **v1.1 확장 설계**. Phase 2-B 품질 보완에서 definition 기반 프로필을 구현했다. 아래 animation.json 예시는 향후 파일 규격 제안이며, 현재 실제 인터페이스와 우선순위는 7절을 기준으로 한다.

## 목표와 경계

- 하나의 공통 `Pet` 상태·물리·렌더러를 유지하고, **각 캐릭터의 행동 성향과 시각적 클립만 데이터로 구성**한다.
- 8×9 / 8×11 시트뿐 아니라 이후 추가되는 패키지도, 검증된 레이아웃과 프레임 목록만 갖추면 동일한 시스템에서 동작하도록 확장한다.
- 스프라이트의 행은 *파일 제작 규격에 따라* 달라질 수 있다. `row 5 = fall` 등을 모든 캐릭터에 강제하지 않는다.
- **물리 상태**, **자율 행동**, **표현 애니메이션**, **시각 효과 설정**은 서로 다른 개념으로 분리한다.
- 이모지, 안경, 말풍선, 임의 장식은 기본적으로 **추가하지 않는다**. 기존 시트의 소품도 의도적으로 선택한 클립에서만 재생한다.
- 이번 Phase 2-B 보완에서는 새 동물 제작, 사용자 import UI, 총/망치, 특수 스킬과 구조물 외형 추가는 하지 않는다.

## 1. ID 및 디렉터리 규칙

```text
assets/pets/cat_brown/
  pet.json                 # 기존 원본 패키지 정보, 원본 id 유지
  spritesheet.webp         # 원본 시트
  animation.json           # 선택적 앱 전용 애니메이션 프로필(구현 시 추가)
```

- `cat_brown`은 **앱 내부 고유 ID**로 계속 사용한다. 원본 `pet.json.id`의 `sanqian`과 화면 표시명 `황색냥`은 별개다.
- `cat_face`, `cat_sleepy`, `salary-cat`, `doge`, `puddle`, `kirby`, `kirby_sleepy`, `usagi`도 같은 원칙을 적용한다.
- 폴더명 / 내부 ID 이름을 예쁘게 바꾸기 위해 변경하지 않는다. 불가피하면 saved settings 마이그레이션과 회귀 테스트가 필요하다.
- 한글 표시명은 앱 카탈로그의 로컬 레이블과 연결한다. 원본의 `pet.json.displayName`를 무조건 덮어쓰지 않는다.
- `animation.json`은 **권장 설계**이다. Phase 2-B에서는 기존 definition에 프로필을 부착하는 형태로 시작해도 되며, 둘을 동시에 중복 구현하지 않는다.

## 2. 향후 animation.json 파일 형식 예시 (현재 미지원)

아래 값은 설명용으로, **실제 황색냥 클립 판정 및 기준점 값이 검증된 것이 아니다.** Codex는 원본 시트와 현재 렌더러를 검사한 후 최종 값을 기록한다.

```json
{
  "schemaVersion": 1,
  "sprite": { "columns": 8, "rows": 11, "cellWidth": 192, "cellHeight": 208 },
  "render": {
    "origin": "feet",
    "baseScale": 1.0,
    "anchorX": 0.5,
    "anchorY": 0.94
  },
  "clips": {
    "idle": { "row": 0, "frames": [0, 1, 2, 3, 4, 5], "frameMs": 160, "loop": true },
    "walkRight": { "row": 1, "frames": [0, 1, 2, 3, 4, 5, 6, 7], "frameMs": 90, "loop": true },
    "walkLeft": { "mirrorOf": "walkRight" },
    "rest": { "row": 5, "frames": [0, 1, 2, 3], "frameMs": 180, "loop": true }
  },
  "fallback": { "look": "idle", "sleep": "rest", "fall": "idle", "drag": "idle" }
}
```

- `row`, `frames`는 **0-based**. 음수·범위 초과·빈 셀·허용되지 않은 타입은 로더 검증 단계에서 거부한다.
- `mirrorOf`는 원본의 반대쪽 클립 품질이 낮을 때만 사용한다. 시트 자체가 이미 좌우 반전 상태인지 검사하고 *이중 반전*을 막는다.
- 프레임이 불연속이면 `[0,1,4,5]` 같은 목록으로 지정할 수 있어야 한다. 얼굴냥 안경 등 특정 셀 제외에 필요하다.
- `frameMs`로 실제 경과 시간을 사용한다. 루프 종료가 필요한 동작은 `loop:false`를 사용한다. 현재 구현은 마지막 프레임을 유지하고 물리/행동 상태가 바뀔 때 새 clip/fallback으로 전환한다.
- 클립 선택 기능을 한 군데에 모아 **잡기 > 던지기/외부 충격 > 등반 > 공중 > 자율 상태** 등 기존 우선순위를 보존한다. 기존 코드에서 사용하는 상세 우선순위가 다르면 현재 코드에 맞춰 문서화한다.
- 없는 동작은 검증된 fallback으로 연결하되, 존재하지 않는 동작을 강제로 표시하지 않는다. 자동으로 무관한 표정/소품 프레임을 선택해서는 안 된다.

## 3. 표현과 물리 분리

- 물리 `size`, collision bounds, velocity, gravity, throw state는 기존 Phase 1 구현을 유지한다.
- 스프라이트 렌더의 `anchorX/Y`, `baseScale`, origin(`feet` 또는 `center`)은 **물리 좌표와 분리**한다.
- 원본 시트의 공통 셀 크기가 같아도 몸의 점유율은 다르다. 펫별 초기 렌더 기준점과 스케일을 지정한다.
- 표정 변화/휴식 때문에 얼굴 방향과 몸 크기가 순간적으로 튀는 경우 우선 **상태 간 anchor 규칙**을 점검한다.
- 고양이 얼굴만 있는 `cat_face`는 발 기준보다 중심 기준이 자연스러울 수 있다. 원형 몸체·누운 자세·노트북 소품 포함 캐릭터는 같은 발 기준을 기계적으로 적용하지 않는다.
- 프레임마다 alpha bbox를 일정 크기로 만들기 위한 동적 stretch/scale은 금지한다. 실제 걷기/점프/웅크리기 같은 의도된 형태 차이를 보존한다.
- 같은 동작의 특정 프레임만 흔들린다면 `frameOffsetX/Y` 같은 **검증된 소수 예외**를 데이터로 둘 수 있으나, 기본은 클립/캐릭터 단위 anchor다.
- 애니메이션 프레임 변경은 진행 시간과 clip identity로 결정하고, 새 상태로 바뀔 때만 재생 시간을 초기화한다. 프레임마다 임의 리셋하거나 리소스를 재생성하지 않는다.

## 4. 자율 행동은 공통 행동 엔진 + 성격 preset

| 성향 | 예시 펫 | 방향 |
|---|---|---|
| 매우 차분함 | 실눈냥, 커비(잠) | 쉬기/졸기 우선, 짧은 이동 |
| 차분함 | 황색냥, 영업냥 | 느긋하게 걷고 오래 정지 |
| 보통 | 얼굴냥, 푸들, 슬라임 | 짧은 이동과 대기 균형 |
| 약간 활발함 | 커비 | 이동·표정과 휴식 혼합 |
| 활발함 | 시바 | 자주 탐색, 가끔 점프 |
| 매우 활발함 | 우사기 | 빠른 상태 전환, 높은 탐색 비율 |

- 새 캐릭터는 가능하면 기존 preset 중 하나를 선택하고, 필요한 경우 소수 설정(휴식 확률/시간, 점프 확률, 회전 빈도)을 override한다.
- `roam/rest/look/sleep`은 자율 의도이고, `walkRight/idle/drag/fall` 등은 **보이는 애니메이션 클립**이다. 일대일이 아닐 수 있다.
- 펫끼리는 겹쳐도 된다. 충돌·밀어내기 금지. 다만 탐색을 위한 군집 계산은 물리 간섭이 없을 때만 유지 가능하다.
- 폭탄, 잡기, 던지기, 블랙홀 등 외부 입력이 자율 행동보다 우선한다. 기존 블랙홀 흡수 후 인스턴스 삭제 정책과 무제한 펫 생성 정책을 보존한다.

## 5. 향후 캐릭터 추가용 확장 포인트

단계적 도입을 권장한다.

1. **지금(Phase 2-B 보완):** 내장 9종의 클립/anchor/profile 데이터 분리, 누락 프레임 검사, 렌더 프리뷰 자동화. 기존 정적 `LOCAL_PETS` 목록과 `package.json` allowlist는 유지 가능.
2. **신규 오리지널 펫 제작:** 오리, 하프물범, 말티즈, 포메라니안, 웰시코기 등에 동일한 `pet.json`, `spritesheet.webp`, 선택적 `animation.json` 규격 활용. 이름·성격·클립·기본 렌더 기준점을 검증해 등록.
3. **개인 패키지 import(별도 Phase):** 유저 폴더/파일 선택 후 JSON과 이미지 검사, ID 충돌 방지, userData 복사, 목록 등록 및 재실행 복구. `pet.json`에 임의 JavaScript 코드 실행은 허용하지 않는다. 크기·픽셀 수·행열·파일 경로·허용 확장자를 검증한다.
4. **후속 특수 스킬:** 각 캐릭터의 `skillId`, cooldown, 목표 범위, 임팩트 상태 등을 별도 도구/스킬 모듈에서 처리. 커비 흡입 등은 *후속 후보*이며 이번 범위에서는 구현하지 않는다.

**구현 주의:** source package의 `spriteVersionNumber`와 우리 앱의 `animation.schemaVersion`은 다른 개념이다. 오리지널 에셋과 제3자 IP가 포함된 개인용 패키지는 공개 배포와 분리한다.

## 6. 최소 검증 계약

| 종류 | 검사 |
|---|---|
| 에셋 유효성 | 파일 존재, RIFF/WebP, 이미지 디코딩, 가로·세로, 셀 정수 분할, 파일/픽셀 상한 |
| 프레임 | 행/열 범위, 실체 있는 셀만 재생, 예외 제외 프레임 차단 |
| 표현 | idle↔walk, 좌↔우, rest↔sleep, grab→throw→land 전환, 흔들림·깜빡임 |
| 안정성 | fps 30/60/144에서 시간 비슷함, 이미지 객체 캐시, 과도한 매 프레임 배열 생성 금지 |
| 회귀 | 기존 Grab/Throw, 충돌, 구조물, Draw, 펫 개별 삭제, PC click-through, Tray 효과 토글 |
| 수동 | 실제 Windows 1x/125%/150% DPI와 투명 오버레이에서 손맛·발 위치 검사 |

검증 로그는 `docs/v1.1/DECISIONS_AND_PROGRESS.md`에 남기고 실패한 에셋은 안전한 fallback을 선택한다. 개발 중 실제로 새 규칙이 필요해지면 이 문서를 업데이트하되, 확정된 사용자 요구를 임의로 바꾸지는 않는다.

## 7. 현재 구현 계약: Phase 2-B 품질 보완 (2026-10-13)

- 구현 위치: `renderer.js`의 spriteProfiles → 로컬 definition.animation 참조 → 공통 Pet.spriteClip/advanceAnimation/draw. 로컬9종은 공통 sheetClips 행을 런타임 매핑으로 사용하지 않는다. legacy Cat/Magpie만 옛 row/count/speed adapter를 유지한다. 새 프로필 파일 로더/Import UI는 아직 없다.
- 프로필 필드: `rows`, `origin`(`feet`/`center`), `elasticity`, `sleeping`, `clips`, `fallback`. clip 필드: `row`, **frames 정수 배열**(비연속/되돌아보기/반복 셀 가능), `frameMs`, `loop`(생략true), 정규화한 `center`, `foot`, center origin의 `centerY`, 선택적 고정`scale`.
- `mirrorOf`는 같은 프로필의 직접 source clip을 참조한다. 초기화 때 한 번만 source 프레임/anchor와 flip을 연결한다. 없는 source나 mirror-chain은 제외하고 fallback한다. 매 프레임 프레임 배열/이미지를 생성하지 않는다. 검증된 좌측 원본은 그대로 사용한다.
- row/column/프레임목록/양수frameMs/유한anchor/scale/loop 타입을 선택 시 확인하며 잘못된 clip은 bounded fallback(최대10회)을 따른다. 순환/모두 invalid이면 draw를 건너뛰되 Canvas save/restore는 균형을 유지한다. 실제 빈 셀/금지 셀은 native QA가 검사한다. 외부 animation.json을 읽는 보안 로더가 구현되었다는 뜻은 아니다.
- clip identity는 상태와 고정clip 정보로 관리한다. 경과시간으로 frame을 계산하며 loop:false는 마지막 프레임에서 멈춘다. draw 호출은 시간을 증가시키지 않는다. jump→fall/drag/quiet 상태 전환에서만 시간을 재시작한다.
- 선택 우선순위: Grab → 외부 충격/로컬orbit → 등반 → 자율점프(상승·최고점jump, 하강fall) → 그 외 불안정공중 → 안정Rest의sleep 표현 → Look/Rest → 방향별walk/idle. Fall/Jump fallback도 상태 identity를 유지한다. 물리 우선순위와 시각적 clip은 서로 독립적이다.
- 물리중심/size/collider는 렌더 설정과 별개다. 얼굴냥만 center origin, 나머지는 physical foot pivot을 사용한다. clip anchor는 선택된 셀 union에서 고정하고 authored hop·꼬리·웅크림을 유지한다. 영업냥 Drag의 고정scale .9 외에 프레임마다 bbox 크기를 맞추는 처리는 없다.
- 생성 Zzz/이모지/말풍선/안경/장식 오버레이는 사용하지 않는다. 원본에 있는 소품도 확정 clip에서만 선택한다. 보조 효과 ON/OFF 저장 구조는 그대로 유지하며 기존 Canvas 땀방울·폭탄 보조 렌더와 향후 명시적으로 승인된 효과에 적용된다.

### 움직임 원인과 착지

- `motionCause`: null(일반), `autonomous-jump`, `throw`, `bomb`. `externalMotion`은 source/elapsedMs/stableMs를 갖는 물리 소유권 상태다. 직접 자율 점프는 beginAutonomousJump, Throw는 beginThrow, 폭탄은 기존 impulse 적용 뒤 beginImpact로 진입한다.
- 외부 소유권이 없으면 바닥/Platform/Draw에 착지할 때 vy=0, squash만 적용한다. 자율 점프 원인은 착지 때 정리하고 최소200ms 반응 보호(기존 강한착지300ms와 max)를 둔 후 기존 자율 행동으로 복귀한다. 전역 restitution을 낮추지 않는다.
- Throw의 gravity .22/air .996/ground .94/restitution .65/wall .72/max54/최대8초는 그대로다. Bomb은 이전 일반 gravity .5/air .98/ground .98/바닥반발 .6/벽반발1/수평cap18을 유지하면서 외부 충격의 swept Draw·Platform 반발/자율보호를 사용한다. 기존 폭탄 초기 성분cap19는 그대로, 외부 vy 안전 상한54를 공유한다.
- Bomb 보호는 안정 접촉120ms·경과200ms 조건 또는 최대5초로 종료한다. Throw는 기존 최대8초다. Bomb이 자율 점프 중 들어오면 Bomb이 소유권을 가져가며 Grab/orbit/삭제도 이전 원인을 정리한다. 현재 Ladder와 자율 활동성 데이터는 그대로 유지한다.

현재 확정한 각 row/frames/frameMs/anchor와 fallback은 `SPRITE_INVENTORY.md` 6절, 실행 결과는 QA와 결정 기록을 참고한다.

## 8. 최종 시각 보완의 표시 보정 계약 (2026-10-13)

- clip.frameAdjustments는 **소스column(0~7)**을 키로 하는 선택적객체다. center/foot/centerY는해당셀의정규화기준점,scale은clip.scale에곱하는고정배율,offsetX/Y는기본표시상자(2.5×physical size)의정규화위치다. 재생index가아니므로[2,0,2]시퀀스의두col2에같은보정이적용된다.
- 원본프레임검수로확인된소수예외에만사용한다. 현재우사기jump/fall의소스1/2/3foot만사용하며runtime alpha측정이나자동bbox정규화는하지않는다. frame별scale/offset은공통구조와테스트로지원하되불필요한종에는설정하지않는다. crop은필요근거가없어추가하지않았다.
- 공통Pet.spriteGeometry가sourcecolumn,표시배율/기준점/offset/tilt/bob를계산하며draw만소비한다. hitbox/size/x/y/vx/vy는바꾸지않는다. 보정값의유한성·범위·타입을검증하고invalid clip은기존fallback으로처리한다.
- tilt는최대 .25rad의clip기울임이며mirror를한번적용한뒤함께반전된다. bob은size비율(최대 .1)과양수bobMs의elapsed-time 상향미세이동이다. 얼굴냥 .025×size/.035rad,영업냥기립이동 .018×size/.025rad에만쓴다. 공중/Grab/휴식에이동bob를강제로적용하지않는다.
- 로컬Sprite의walk진입속도 .5/유지속도 .15 hysteresis는표현경계만안정화한다. 원래활동성/탐색/물리상수/상태종료조건은그대로다.안정휴식과외부상태가항상우선한다.
- 푸들의원본1/2행과기존푸른소품복원은최신사용자피드백에따른의도적선택이다. 원본소품을지우거나새소품을생성하지않는다. 영업냥의기립대체표현은진짜보행이라고간주하지않는다.현재정확한매핑은Inventory6절과qa/sprite-final/after-profiles.json을기준으로한다.
