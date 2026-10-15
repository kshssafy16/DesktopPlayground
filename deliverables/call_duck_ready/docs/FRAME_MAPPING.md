# 콜덕 프레임 매핑

모든 행·열은 0부터 센다. 1536×1872 투명 WebP, 8열×9행, 셀 192×208.
`assets/pets/call_duck/pet.json`은 현재 DesktopPlayground 로더의 최소 필드(id, displayName, spritesheetPath)를 사용한다.
프로필은 `animation/call_duck.profile.json`에 있으며 앱에는 아직 등록하지 않았다.

## 출처와 조립

- 새 Idle: `call_duck_idle.png` SHA-256 `acb16a375f1dd4c0c6117d75e4fe6b3ab8883cbf89a46002bbb8a57119eb082e`. 실제 4×2 배열의 8개 그림을 0행 0–7열에 배치.
- 새 WalkRight: `call_duck_walk_right.png` SHA-256 `0e7a5ce72b5275e0c5d1dc8836adb15ffbc34e4c8b93fb2a4d6995ae4c3e7b60`. 실제 한 줄의 8개 그림을 알파 연결 영역별로 분리해 1행 0–7열에 배치. 보통 4×2 또는 균등 8분할하면 부리/꼬리가 잘린다.
- 기존 ZIP: `DesktopPlayground-call-duck.zip` SHA-256 `3ae0254226e14f6d11e148ced497ef8923c91d33df4962efd3ccd888480b7850`. 3–7행의 기존 그림과 상태 구성을 재사용.
- 2·8행과 6행 4–7열은 예약 투명 셀. 빈 프레임을 복제하지 않았다.
- 원본의 알파 0 픽셀에 남은 RGB 색상은 표시되지 않는 값이므로 조립 중 0으로 정규화했다. 표시되는 캐릭터 원화는 유지했다.
- 기존 4·6·7행의 작은 노란/파란 모션 선은 실제 알파가 있는 기존 연출이다. 배경 오염으로 지우지 않았다.
- 기존 wake 3장에 맞춰 frameMs 80→60으로 조정해 180ms 이벤트 안에 세 장이 표시되게 했다.
- 새 16장만 셀 중심 x=96·접지선 y=192에 맞춰 비율을 유지한 채 축소했다. 기존 행은 옮기거나 크롭하지 않았다.

## 사용 중인 클립

| 클립 | 행 | 열 | 출처 |
| --- | ---: | --- | --- |
| idle | 0 | 0,1,2,3,4,5,6,7 | 새 PNG |
| walkRight | 1 | 0,1,2,3,4,5,6,7 | 새 PNG |
| walkLeft | 1 | 0,1,2,3,4,5,6,7 | 새 PNG (WalkRight 반전) |
| jump | 3 | 0,1,2 | 기존 ZIP |
| fall | 3 | 3,4 | 기존 ZIP |
| land | 3 | 5,6,7 | 기존 ZIP |
| grabStart | 4 | 0,1 | 기존 ZIP |
| drag | 4 | 2,3,4,5 | 기존 ZIP |
| release | 4 | 6,7 | 기존 ZIP |
| sleep | 5 | 0 | 기존 ZIP |
| rest | 5 | 1,2,3,4 | 기존 ZIP |
| wake | 5 | 5,6,7 | 기존 ZIP |
| hit | 6 | 0,1,2 | 기존 ZIP |
| stunned | 6 | 3 | 기존 ZIP |
| look | 7 | 0,1,2,3,4,5,6,7 | 기존 ZIP |

## 확인 범위

- 참조하는 비반전 셀 52개 모두 비어 있지 않고, 셀 가장자리에 알파 픽셀이 닿지 않았다. 최소 좌우 여백 6px.
- GIF는 클립 순서·타이밍·좌우 반전을 보여 주는 미리보기다. 실제 앱 물리/입력은 시뮬레이션하지 않는다.
- 실제 Windows 앱에서 보행 루프, Grab→Held→Release, Jump→Fall→Land, 피부색/외곽선/크기 전환을 최종 확인해야 한다.
- `local-pets.js`의 고정 ID 목록과 앱 프로필 카탈로그·브라우저 사본 연결은 앱 담당 통합 범위다.
