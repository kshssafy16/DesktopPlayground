# Phase 3-C 실제 Electron Canvas 확인

`node tests/smoke.cjs --gun-preview`가 격리된 Electron 29 Canvas에서 아래 PNG를 생성한다. 캡처는 합성 입력이며 실제 Windows 마우스 조작감·FPS 측정은 아니다.

- `native-weapons.png`: 4종 총 PNG, 커서 오른쪽 위 총구, 빨간 조준점, 발사 중/명중 후 숫자·펫 Hit를 같은 크기의 2행 4열로 비교한다. 그림을 직접 열어 총구가 조준점으로 향하는지, 숫자가 펫 앞에서 읽히는지 확인했다.
- `native-grenade-hammer.png`: 수류탄 비행, 신관 만료 위치의 균열 없는 불규칙 폭발, 동일 지점 Hammer 반복 유리 파손을 비교한다. 투척체·구멍·국소 균열/파편의 분리와 잔여 PNG 표시를 직접 확인했다.
- 이전 디자인 비교 기준은 `../phase3b/before-hit-sleep-toys.png`, `../phase3b/native-toys-hit.png`, `../phase3b/native-toys-hit-motion.png`에 보존한다. 두 시점은 폭발 규모와 Hit 숫자 비교에는 유효하지만 당시 Bomb은 클릭 즉시 폭발했으므로 수류탄 비행은 이번 캡처만 해당한다.

실제 `npm start`에서 물리 마우스 투척 거리, 3초 대기, 자동연사·마우스 놓기, 샷건 숫자 중첩, 상단 화면 밖 복귀, 밝고 어두운 바탕 위 균열/폭발 대비, 다중 모니터·DPI, 20마리 이상 장시간 사용을 확인해야 한다.
