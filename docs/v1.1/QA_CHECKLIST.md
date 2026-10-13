# DesktopPlayground v1.1 검증 체크리스트

체크 표시 규칙: `[ ]` 미검증, `[x]` 실제 실행 및 통과. 자동 검사와 실제 Windows 수동 확인을 구분한다. 아래 전체 v1.1 항목은 해당 단계가 구현·검증될 때 갱신한다.

## Phase 2-B 최종 시각 보완 (2026-10-13, 최신)

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
| 2026-10-13 | 2-A | autonomy / 전체 Phase1 회귀 / smoke / local-pets / Throw 비교 / 구문·공백 | 통과 | 55+12=67개, 10종×180초 단독 관찰·25마리20초 가상 검증 | 실제 방치 관찰·성능 QA 별도, 2-B 미착수 |

| 2026-10-13 | 2-B | expression/겹침·기존회귀/Tray재시작/native Sprite/구문·공백 | 통과 | 76개VM, 격리Electron11시트+5override, Throw동일 | 실제Windows시각·조작·장시간QA 별도 |

| 2026-10-13 | 2-B 품질보완 | 점프원인/개별Sprite/전체회귀/native1x·2x/구문·공백 | 통과 | 중복제외VM88개,9종81상태428선택프레임,ThrowJSON동일 | 실제Windows동적·조작·장시간QA별도 |

| 2026-10-13 | 2-B 최종 시각 | 원본보행/프레임보정/전체회귀/native·브라우저전후QA | 자동·캡처비교통과 | VM94개,81상태418선택프레임,프로젝트전후캡처보존 | 실제npm start시각확인대기 |
