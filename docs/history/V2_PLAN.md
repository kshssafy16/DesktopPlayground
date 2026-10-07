# Desktop Playground v2 계획과 단계

갱신일: 2026-10-07 (Asia/Seoul). 현재 구현 기준은 CURRENT_STATE.md와 PHASE_3_PETS_STRUCTURES.md다.

## 제품 원칙

Windows 화면 위의 투명 desktop toy다. 아래 앱·파일·웹페이지를 수정하지 않는다. PC 기본 mode에서 overlay는 click-through이며 Pet은 보인다. 사용자가 Touch, Pet 배치 또는 도구를 직접 선택하면 그 mode를 유지한다. Controls와 Tray는 언제든 사용할 수 있게 별도 창과 workArea 경계를 사용한다. 기본 실행에 인터넷이나 Codex 설치가 필요하지 않다.

Electron main은 창·Tray·settings를 소유하고, sandboxed renderer는 제한된 preload API만 사용한다. Pet definition과 화면 instance는 별도다. world.structures는 모든 Pet이 공유하며 creator가 사라져도 유지된다. 신규 Custom 이미지 업로드는 제거했고 기존 복사본과 설정은 보존한다.

## 단계 현황

| 단계 | 현재 결과 |
| --- | --- |
| Phase 1 | 투명 overlay, 분리된 controls, click-through, Tray, secure preload의 기반 구현 |
| Phase 1.5 | controls drag/collapse/hide, UI 좌표 복원과 workArea clamp |
| v0.2-beta | Phase 1.5 단일 portable EXE/ZIP 검증 완료. 현재 소스 변경은 이 기존 배포본에 미반영 |
| Phase 2 | Slime/Cat/Magpie/Robot/Bug definition/instance, Custom PNG/JPG/JPEG/WebP/GIF, Pet 설정 저장·관리 |
| Phase 2.5 | PC/Touch/Pet/tool sticky mode, 최초 Hammer/Gun/Paint/Draw/Bomb, Hide/Show, 단일 Exit 경로 |
| Phase 3 | 로컬 Dog/Kirby 기본 자산, Bird=기존 Magpie, 개별 instance Trash, 공용 Platform/Ladder, 시간 기준 Pet update, 수직 이동, 둥근 toolbar |
| Phase 3.5 | 구조물 간격·5-zone 후보 배치·공유 경로 재사용, 한국어 pill UI, Paint 제거, Black Hole 추가, 도구 효과 분화, Draw world collider. Electron 통합 119개 및 local package 검사 통과 |
| Phase 3.6 | Custom 업로드와 Hammer/Gun 제거, 3개 도구·간결한 한국어 toolbar, 구조물 ON/OFF·7/5 상한·idle 정리, 방문 이력/군집 기반 탐색, Bomb/Black Hole 표현과 수명 안정화. Electron 통합 69개, 310초 자율 시뮬레이션 통과 |
| UI/기본 Pet 정리 | 우클릭→PC, 구조물 OFF 시 표시·충돌 비활성 및 데이터 보존, 10아이콘 toolbar와 3버튼 접기, 지정된 5그룹 Pet·시작 5마리, Draw slider/6색·outline collider, Black Hole 22px consume radius. 짧은 smoke 통과; 전체 회귀는 재실행하지 않음 |

## Phase 3 결정

기본 5종은 Slime, Cat, Bird(Magpie), Dog(Doge), Kirby다. Robot/Bug는 추가 선택 펫으로 유지한다. Dog/Kirby package는 프로젝트에 포함해 Codex 없는 PC에서도 로드한다. main에서 고정 경로 pet.json과 spritesheet.webp를 검증하며 잘못된 package는 건너뛴다. Kirby는 로컬 사용만 허용된 자산으로 문서화하고, 다음 배포 전에 재배포 권한을 검토한다.

Platform은 하강 착지/상향 통과 방식이고 Ladder는 연결된 Platform으로 오르내리는 통로다. Cat/Dog/Kirby가 cooldown과 개수 제한 아래 연결 경로를 만든다. 현재 AI는 가까운 사다리와 간단한 확률을 사용하는 가벼운 규칙이며 복잡한 route search가 아니다. 구조물은 현재 세션에만 존재한다.

Clear Effects, Clear Drawing, Clear Structures, Clear Pets, Reset Playground는 별도 범위다. Clear/Trash는 Pet definition이나 Custom 파일을 지우지 않는다.

Phase 3.6의 도구는 그리기, 폭탄, 블랙홀이다. 만지기와 Pet 배치는 별도 mode다. Draw는 자유곡선/직선/사각형/원과 지우개를 제공하고 segment collider는 Pet 착지·벽 충돌에 참여한다. Bomb는 거리별 radial impulse, Black Hole은 약 3.5바퀴 나선 후 instance만 삭제한다. 구조물은 가까운 사다리가 있으면 재사용하며 5개 가로 zone, 최근 방문·군집·높이를 바탕으로 Pet이 목표를 순환한다. 복잡한 pathfinding과 영속 world 저장은 범위 밖이다.

## 다음 작업

실제 Windows mouse의 Explorer click-through는 확인했다. 다음에는 물리 Trash drop, 여러 Pet의 장시간 수직 이동, taskbar/Tray 접근, 고 DPI와 화면 변경을 확인한다. 구조물 경로 선택이 막히거나 진동하는 사례가 나오면 제한된 이동 규칙만 조정한다. 다음 별도 기능 단계에서는 Ball, Sound, Note, Theme 등을 우선순위에 따라 검토한다. Codex pet 사이트 연동과 최종 portable 재빌드는 현재 범위 밖이다.

배포 직전에는 Kirby 등 local asset의 재배포 허가·고지, 깨끗한 PC의 offline 실행, 실제 portable EXE의 입력·종료 회귀를 확인해야 한다. 기존 v0.2-beta EXE/ZIP은 보존한다.
