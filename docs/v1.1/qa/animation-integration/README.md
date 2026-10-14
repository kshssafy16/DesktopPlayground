# 통합 플랫폼 실제 Canvas QA

- `runtime-states.png`: 9종 × 17상태 시작 자세, 발 기준선과 상태 이름.
- `runtime-preview.html` / `runtime-preview.webp`: Electron `Pet.draw`의 51장(17상태×3시점), 80ms 간격, 4.08초 반복.
- `samples.json`: 459개 sample의 상태/소스 row·column/scale/anchor.

자료는 **스크립트 시각 입력**의 전환이며 실제 점프/던지기 궤적이나 Windows 마우스 영상이 아니다. 실눈냥·커비(잠)의 Rest는 기존 Sleep 표현이다. 다른 펫의 Sleep/KO는 인터페이스 QA를 위해 명시적으로 입력했으며 자동 수면/KO 게임플레이를 추가하지 않았다. 보조 이모지/새 소품/원본 변경은 없다.

재생성:

```powershell
node tests/smoke.cjs --animation-preview
python tests/encode-sprite-preview.py animation
```

Python은 Pillow를 사용하는 개발 QA 인코딩이며 제품 실행에는 필요 없다. 첫 명령은 임시 PNG frame JSON과 자체 재생 HTML, 두 번째는 무손실 WebP와 작은 HTML을 만든다. 기존 sprite-final before/after는 보존한다.

실제 `npm start`에서 확인할 사항:

1. 9종의 정지→좌우 이동→점프/하강→착지→휴식, GrabStart→Held→느린/빠른 놓기. 짧게 잡고 바로 던져도 표현이 붙잡히지 않아야 한다.
2. 자율 점프 무바운스, Throw/Bomb 반발·거리, 사다리 양방향, orbit 구출, Touch/Trash.
3. 얼굴냥 방향/금지 프레임 부재, 푸들 보행·원본 소품, 우사기 공중 크기·발 위치, 영업냥 기립↔책상 전환 한계.
4. 60/144Hz·100/125/150% DPI에서 깜빡임/크기/중심/발 접촉. native 1x/2x는 실제 DPI/주사율 검증을 대신하지 않는다.
5. 효과 OFF·반복 Bomb·Hide/Show·PC 클릭 통과·20마리 이상 장시간 사용. 캡처만으로 품질 합격을 확정하지 않는다.
