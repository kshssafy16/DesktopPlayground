# Phase 3: local Pets, Trash, shared structures

기록일: 2026-10-06 (Asia/Seoul). 조사 위치: C:\Users\SSAFY\.codex\pets. 조사 시점의 실제 폴더명과 pet.json의 id를 따로 적었다. 후보 ID와 디렉터리명이 다른 항목이 있다.

## Local package inventory

각 폴더에는 pet.json과 spritesheet.webp가 있고 WebP는 이미지로 디코딩되었다. 다른 파일은 없었다. GIF-only 0개, 불완전 package 0개다. 1536×1872는 8열×9행, 1536×2288은 8열×11행이다.

| 실제 폴더 | pet.json id / 표시명 | 시트 | 판단 |
| --- | --- | --- | --- |
| cat_sleepy | diandian--lllucasxu / Diandian | 1536×1872 | 정상, 추가 선택 후보 |
| doge | doge / Doge | 1536×1872 | 정상, 기본 Dog 채택 |
| kirby_sleepy | haaap / Haaap (Kirby) | 1536×1872 | 정상, 대체 Kirby 후보 |
| cat_face | hami--tat / Hami | 1536×2288 | 정상, 추가 선택 후보 |
| kirby | kirby / Kirby | 1536×1872 | 정상, 기본 Kirby 채택 |
| salary-cat | monthly-salary-cat / Monthly salary cat | 1536×1872 | 정상, 추가 선택 후보 |
| Patchi | patchi / Patchi | 1536×2288 | 정상, 추가 선택 후보 |
| Ripple | ripple / Ripple | 1536×2288 | 정상, 추가 선택 후보 |
| cat_brown | sanqian / 三千 | 1536×2288 | 정상, 추가 선택 후보 |
| puddle | tudou / 土豆 | 1536×2288 | 정상, 추가 선택 후보 |
| usagi | usachi--jack / usagi | 1536×1872 | 정상, 추가 선택 후보 |

이번 앱에 포함한 것은 doge, kirby 두 package뿐이다. main은 이 두 고정 디렉터리의 metadata, 파일 길이, RIFF/WebP 헤더, 시트 크기를 검사하며 이상하면 건너뛴다. 다른 local package를 런타임에 자동 스캔하지 않는다. 자산은 프로젝트 내부에 복사했으며 원본 WebP와 SHA-256이 일치한다. Codex 설치와 온라인 사이트는 런타임에 필요 없다.

최종 기본 5종: Slime, Cat, Bird(기존 Magpie 자산), Dog(Doge), Kirby. Robot/Bug는 선택 펫으로 유지한다. Dog/Kirby도 기존 sprite renderer를 사용하며 9행 시트 metadata를 적용한다. Kirby는 local-only asset이다. 공개 재배포 전 권리·고지를 별도로 검토해야 한다.

## Trash와 구조물 규칙

Touch에서 Pet을 잡을 때만 오른쪽 아래 Trash drop zone을 표시한다. Pet 중심을 Trash에 놓으면 잡은 instance 하나만 제거한다. 같은 definition의 다른 Pet, Custom asset, 활성 상태와 공유 구조물은 그대로다.

world.structures가 Platform/Ladder를 소유한다. 각 구조물은 고유 id, type, bounds, creatorPetId를 갖는다. creator는 출처 정보이며 소유권 제한이 아니다. Cat/Dog/Kirby가 연결된 Platform/Ladder를 가끔 만들고, 다른 Pet도 착지·등반·하강에 사용한다. global 생성 cooldown 7초, Pet별 15초, Platform 10개·Ladder 8개 상한이다. 초기 경로와 상단 경로를 이어 floor→low→mid→high 이동이 가능하다.

Platform은 하강 발 교차일 때만 착지한다. 밑에서 위로 점프하면 통과한다. 지지된 Pet은 걷고 점프할 수 있으며 사다리로 올라가거나 내려온다. Clear Structures는 공용 구조물만 제거하고 Pet의 지지/등반 상태를 해제해 낙하시킨다. Clear Pets는 Pet instance만 제거하고, Reset Playground는 Pet·구조물·그림·효과를 제거한다. Clear와 Trash는 definition, Custom 복사본, settings를 삭제하지 않는다.

## 확인과 제한

격리된 실제 Electron 실행 통합 검사 99개에서 local Pet 생성, Trash 3마리 중 1마리 삭제, 다른 Pet의 creator 구조물 사용, 사다리 상승/하강, 발판 착지/걷기/상향 통과, 다층 경로, 제한과 Clear 후 낙하, Phase 2.5/Custom 회귀, 5회 clean Exit, HTTP(S) 요청 0건을 확인했다. 별도 local package 검사에서 정상 로드와 malformed JSON·잘못된 WebP·누락 파일 skip을 확인했다. 실제 Windows mouse로 둥근 toolbar의 Pets/Tools 메뉴와 Dog 선택을 확인하고 overlay에서 Pet·발판·사다리를 시각 확인했다.

현재 이동 규칙은 가까운 사다리와 확률 기반이다. 복잡한 pathfinding, 구조물 저장, 다중 모니터 월드는 없다. 실제 Windows mouse로 Trash drop과 장시간 자율 이동, DPI/화면 변경, native Tray 메뉴를 추가 확인해야 한다. 최종 portable는 재빌드하지 않았다.

## Phase 3.5 후속 변경 (2026-10-06)

Platform/Ladder 생성은 후보 여러 개의 간격·연결성·5개 화면 zone 점수를 비교한다. 같은 종류의 근접 중복을 거부하고, 연결된 사다리/발판 접촉만 허용한다. 기존 공유 사다리로 상승할 수 있으면 새 구조물을 만들지 않는다. Draw collider와도 일정 거리를 둔다. Clear Structures는 zone 생성 기록을 초기화한다.

Toolbar와 메뉴는 더 둥근 pill/한국어 라벨로 바뀌었고 도구는 만지기·망치·총·그리기·폭탄·블랙홀이다. Draw의 자유곡선/직선/사각형/타원을 별도 `world.drawnShapes`와 최대 1200개 segment collider로 관리한다. Pet은 그 위에 착지하고 닫힌 도형의 벽·천장에 충돌한다. 지우개는 해당 shape 전체를 제거한다. Clear Drawing은 그림과 collider만 제거한다. 블랙홀은 최대 2개, 한정된 수명/반경으로 주변 Pet instance만 제거한다. 망치는 유리 금, 총은 작은 탄흔, 폭탄은 큰 구멍/링으로 구분된다.

격리된 Electron 통합 검사 119개와 local package 단위 검사가 통과했다. 실제 마우스의 연속 그리기/드래그, 장시간 자율 이동과 native Tray/DPI 확인은 남아 있다. 이번 단계에서 portable를 다시 빌드하지 않았다.

## Phase 3.6 안정화 (2026-10-07)

구조물은 Platform 7개·Ladder 5개, 바닥 경로 3개로 제한한다. 5개 가로 zone 배치와 근접 중복 방지는 유지하며, 중간 Platform으로 나뉜 연속 사다리는 허용해 상층 이동을 막지 않는다. `lastUsedAt` 기준 90초간 쓰지 않은 구조물은 정리하고 지지·등반·목표로 사용 중인 경로는 보존한다. 구조물 토글 OFF는 신규 생성과 유휴 정리만 중지해 기존 구조물을 유지한다. 다시 ON으로 바꾸면 기존 구조물의 사용 시각을 갱신한다.

Pet의 목표는 약 9초 안에 만료된다. 도착·추락 시 갱신하고 최근 방문한 사다리, 같은 목표의 Pet 수, zone의 Pet 수, 거리와 높이를 점수에 반영한다. 바닥 이동 목표는 5개 가로 zone에서 고르며 오래 머무른 zone을 피한다. 가까운 Pet끼리는 약하게 밀어 겹침을 줄인다. 310초 가상 시간·18마리 시뮬레이션에서 5개 가로 zone과 저·중·고 높이 구역을 탐색했고 같은 사다리를 연속 목표로 고른 사례는 0회였다. 복잡한 pathfinding은 추가하지 않았다.

Custom 이미지 업로드는 제거했지만 기존 사용자 펫 복사본과 설정은 보존한다. 최종 도구는 그리기·폭탄·블랙홀이다. 69개 Electron 통합 검사와 local package 검사를 통과했고 HTTP(S) runtime 요청은 0건이었다. 기존 portable 배포본은 변경하지 않았다.
