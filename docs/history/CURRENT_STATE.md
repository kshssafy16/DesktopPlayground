# Desktop Playground 현재 상태

갱신일: 2026-10-07 (Asia/Seoul). 기준: D:\DesktopPet 현재 Electron 소스. Phase 3.6 안정화 소스이며 기존 v0.2-beta portable EXE/ZIP은 Phase 1.5 결과물이다.

## 실행과 입력

Electron 29.4.6의 main은 투명 overlay, 별도 floating controls, Tray를 소유한다. 두 renderer는 nodeIntegration=false, contextIsolation=true, sandbox=true이며 제한된 preload API로만 통신한다. 시작은 Playground 표시 + PC mode다. PC는 Pet·그림·구조물을 보이게 둔 채 클릭을 통과시키고, Hide는 Playground 전체를 숨기며 즉시 mouse input을 해제한다. 만지기·그리기·폭탄·블랙홀·Pet 배치에서 우클릭하면 진행 중 입력을 취소하고 즉시 PC mode로 전환한다.

Overlay는 primary display의 workArea에 한정한다. Controls는 overlay보다 높은 always-on-top level이며 작은 drag handle로 이동한다. 접기·펼치기·숨기기·Tray 복구와 위치 저장은 유지한다. Controls/Tray의 PC Mode, Ctrl+Alt+Shift+P는 수동 탈출 경로다. Exit는 requestAppQuit 하나로 모아 저장 대기, shortcut 해제, Tray·창 종료를 수행한다. second instance는 중복 overlay 없이 controls를 복구한다.

Controls는 PC | 펫 | 만지기 | 그리기 | 폭탄 | 블랙홀 | 구조물 | 숨기기/보이기 | 종료 | 접기 아이콘을 한 줄 capsule에 둔다. Black Hole 아이콘은 local inline SVG다. Pet/Draw popover는 DOM을 재사용하고 Pet 관리 메뉴는 없다. 접기는 PC mode로 전환하며 접힌 창에는 Hide/Show·펼치기·조작창 숨기기 버튼 3개만 있다. 조작창은 Tray/second-instance로 다시 표시할 수 있다. 기존 효과·그림·구조물·펫 지우기와 전체 초기화는 Tray 정리 메뉴에서 사용한다.

## Pet과 local 기본 자산

시작 Pet은 기본(Canvas), 기본 Cat, 까치, 시바(Doge), 기본 Kirby 각 1마리로 총 5마리다. Pet popover는 기본(기본·슬라임·로봇·벌레·유령·별·구름), 고양이(기본·Brown·Face·Sleepy·Salary), 새(까치), 강아지(푸들/Puddle·시바/Doge), 캐릭터(우사기·커비·커비(잠))를 표시한다. 기본 계열은 외부 asset 없이 Canvas로 그린다. local package 9개를 pet.json ID와 WebP 크기로 검사해 offline 로드한다. Ripple·Patchi는 제외했다. Kirby 등 외부 자산의 재배포 권한은 별도 검토가 필요하다.

Custom 이미지 업로드와 Pet 관리 UI는 없다. 이전 설정과 Custom 이미지 복사본은 삭제하지 않는다. 기본 Pet 설정은 schemaVersion 1을 유지하고 인스턴스 위치와 구조물은 저장하지 않는다.

## Phase 3 world

renderer의 world.structures는 모든 Platform/Ladder를 공유한다. 구조물에는 id, type, 위치·크기, creatorPetId, lastUsedAt가 있고 creator Pet의 생명주기에 종속되지 않는다. Cat/Dog/Kirby가 floor 또는 platform에 있을 때 확률적으로 연결된 경로를 만든다. global 7초 및 Pet별 15초 cooldown, Platform 최대 7개·Ladder 최대 5개, 바닥 경로 최대 3개를 적용한다. 시작 구조물 상태는 항상 OFF이며 controls→main IPC→renderer로 동기화한다. 구조물 토글 OFF는 데이터는 유지하면서 신규 생성·표시·충돌·등반·유휴 정리를 중지한다. 다시 ON으로 바꾸면 기존 구조물의 사용 시각을 갱신한다. ON 상태에서 90초간 쓰지 않은 구조물은 정리하되 Pet이 지지·등반·목표로 사용하는 경로는 보존한다.

Pet 물리는 60fps 기준 delta를 사용하고 한 프레임의 delta를 제한한다. 하강 중 발이 Platform 상단을 통과할 때 착지하는 one-way 충돌이다. 위에서는 걷고 점프하며, 사다리로 올라가거나 내려올 수 있다. A가 만든 경로를 B도 사용할 수 있다. Clear Structures는 Pet을 남기고 지지/등반 상태를 해제해 낙하시킨다.

배치는 Platform/Ladder 간 최소 간격과 Draw collider 여유를 검사한다. 화면을 5개 zone으로 나누고 후보를 점수화하며 직전 zone·많이 사용한 zone을 피한다. 가까운 공유 사다리로 위로 이동할 수 있으면 새 경로를 억제한다. 이어진 상하 사다리는 중간 Platform을 사이에 둔 경우 허용한다. Pet은 구조물 목표를 시간 만료·도착·낙하 때 해제하고 최근 방문, 군집, 거리·높이 차이를 반영해 다음 사다리 또는 바닥 구역을 고른다. 약한 separation force로 겹침을 줄인다.

도구는 그리기·폭탄·블랙홀이다. 폭탄은 불규칙한 구멍 효과와 거리별 바깥 방향 충격을 만들고 Pet은 삭제하지 않는다. 블랙홀은 최대 2개, 약 9초 수명이며 약 3.5바퀴 spiral 후 22px consume radius에서 해당 instance만 제거한다. Draw popup은 자유형·직선·사각형·원/타원 아이콘, 0~100 굵기 slider(실제 1~30px), 6색 swatch, 지우개로 구성한다. 최대 80개 그림·600개 collider segment·자유곡선당 100점이다. 모든 outline은 stroke 두께를 반영한 collider이며 원/타원은 표시 경로와 같은 32개 선분을 사용한다.

Touch 중 Pet을 잡으면 overlay 오른쪽 아래에 Trash zone이 나타난다. 그곳에 놓으면 잡은 instance 하나만 제거된다. 같은 종류의 다른 instance, definition, Custom asset과 활성 상태는 유지된다.

## 저장·배포·검증

UI 좌표/접힘 상태는 %APPDATA%\desktop-playground\playground\ui-state.json, Pet 활성 상태/기존 Custom 목록은 같은 playground 아래 settings.json, 기존 Custom 이미지 복사본은 assets 아래에 저장한다. 구조물·Pet 위치·mode·그림·효과·구조물 ON/OFF는 세션 상태다. 외부 HTTP(S) runtime 요청은 없다.

package.json packaging allowlist에 local-pets.js와 local 9개 package 파일을 반영했지만 이번 작업에서 빌드하지 않았다. 기존 dist, build, dist-beta, release-beta, DesktopPlayground-v0.2-beta.zip은 변경하지 않았다. Git commit/push도 하지 않았다.

이전 Phase 3.6 기준으로 격리된 Electron 통합 검사 69개와 local package 검사를 통과했다. 이번 변경 후 전체 회귀·장시간 시뮬레이션은 재실행하지 않았다. 실제 마우스 UX와 장시간 이동은 사용자 확인 대상이다.


## 이번 UI/Pet 정리 확인

JavaScript syntax와 약 3초의 격리된 Electron smoke를 통과했다. 시작 Pet 5마리·최종 variant, 우클릭→PC, 접기→PC와 3버튼, 구조물 ON/OFF 표시·착지 충돌, Draw 원/타원 collider, 블랙홀 22px consume radius·3.5바퀴, Hide/Show, HTTP(S) resource 0건, Exit를 확인했다.
