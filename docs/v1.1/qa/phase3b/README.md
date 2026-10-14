# Phase 3-B Bomb / Hammer 실제 Canvas 비교

최신 보완 비교: `before-hit-sleep-toys.png`는 바로 전 화면을 보존한 캡처다. `native-toys-hit.png`는 같은 격리 Electron Canvas에서 큰 Bomb 구멍·폭발/68 파편과 Hammer의 클릭 즉시 국소 유리 파손·데미지 숫자를 보여 준다. `native-toys-hit-motion.png`는 이후의 충격파/파편 비산과 숫자 상승을 보여 준다. `node tests/smoke.cjs --toy-preview`로 보완 후 두 이미지를 재생성한다. Bomb에는 균열이 없다. 이미지는 실제 앱 Canvas 픽셀이며 검색 참고 이미지를 자산으로 사용하지 않았다.

아래 설명은 이전 시각 보완 단계의 역사 기록이다. 최신 Hammer에는 40ms 접촉 대기가 없고 공통 비살상 Hit/숫자가 추가됐다.

`before-native-toys.png`는 최초 3-B의 Hammer 긴 직선 균열/Bomb 균열을 보존한 수정 전 캡처다. `native-toys.png`는 보완 후 Hammer 머리 접촉·유리 파손과 Bomb의 불규칙 구멍/폭발 순간, `native-toys-motion.png`는 망치가 사라진 뒤 유리 파편과 Bomb 충격파가 퍼지는 모습을 보여 준다. 두 수정 후 이미지는 `node tests/smoke.cjs --toy-preview`가 같은 격리 Electron Canvas에서 생성한다. 모든 그래픽은 투명 앱 오버레이 픽셀이다.

자동 검증은 실제 Electron 렌더/접촉점·펫 충격/효과 종료 후 무잔상/Tray 설정 저장·재시작/균열 전용 Clear를 포함한다. 사람이 `npm start`에서 물리 마우스로 연타·빠른 움직임·우클릭 PC 복귀, 60/144Hz·고DPI·다중 모니터, 누적 64 균열의 가독성과 장시간 CPU/메모리 사용을 별도로 확인해야 한다. 캡처의 시각 비교만으로 실제 사용감 합격을 판정하지 않는다.
