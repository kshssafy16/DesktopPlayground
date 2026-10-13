# v1.1 결정 기록과 진행 현황

## 문서 운영 규칙

- 이 파일은 개발 중 발견, 선택, 변경, 완료 상태를 기록하는 살아있는 로그다.
- 사용자가 확정한 요구를 최상위 기준으로 삼는다. 이전 분석 보고서에서 제안한 값은 별도 승인 없이는 확정 요구가 아니다.
- 새로운 사실이나 문제가 발견되면 원인, 대안, 변경 영향, 테스트 결과를 여기에 기록하고 필요한 기획 문서를 업데이트한다.
- 우선 기존 코드의 동작을 확인한다. 기록만 있고 재현되지 않은 버그는 미확인으로 표시한다.
- `docs/history/`는 과거 기록으로 보존한다.

## 2026-10-12 결정 확정

| 항목 | 확정 | 이전 논의와 달라진 점 |
| --- | --- | --- |
| 기본 Canvas 펫 | 슬라임만 메뉴에 남김 | Robot/Ghost/Star/Cloud 선택 제거 |
| 기존 Sprite 펫 | 유지, 품질 문제는 제한적으로 수정 허용 | 기존 에셋의 오류 보정 가능 |
| 시작 펫 | Slime/Brown/시바/커비 4개 | v1.0.0 유지 |
| 동시 Pet 수 | **상한 추가하지 않음** | 이전에 논의한 hard cap 20 취소 |
| 활동성 | 전체 roam 비중 낮춤, 캐릭터별 차등 | 고양이 차분, 강아지 활동적, 우사기 매우 활동적 |
| 블랙홀 | 최대 10개, 흡입 후 **삭제만** | 삭제/방출 선택 기능 취소 |
| Bomb | 기존 충격 + 균열/그래픽 강화 | 전역 파괴가 아닌 오버레이 연출 |
| Hammer | 신규 구현, 국소 타격 + 펫 반발 | 과거 제거했던 기능 복귀 |
| Gun | 신규 구현, 숫자 데미지 팝업 + 쓰러짐 후 삭제 | 단순 탄흔보다 펫 반응 중시 |
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
| 1. 물리/반응 | 1-A/B/C/D 구현·자동 검증 완료 | 1-D orbit/점 지우개/구조물 이력 정리 완료. 실제 마우스·동적 시각·장시간 QA는 별도, Phase2 미착수 |
| 2. 활동성/성격 | 대기 | |
| 3. Bomb/Hammer/Gun/Black Hole | 대기 | |
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

## 변경 기록 템플릿

### YYYY-MM-DD / Phase X / 변경 제목

- 현행 사실과 문제:
- 변경 전 결정/동작:
- 변경 후 제안/동작:
- 수정 파일과 호환성 영향:
- 사용자 승인 필요 여부:
- 실행한 테스트와 결과:
- 남은 문제와 다음 조치:
