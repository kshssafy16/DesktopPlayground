# 애니메이션 Codex 첫 프롬프트 (그대로 복사)

`D:\DesktopPlayground-animation`의 **최신 `main`에서 분기한 `feature/v1.2-animation`**에서 작업하세요. 기존 구형 `feature/pet-animation`을 수정하거나 다른 worktree의 앱 개발 브랜치 파일을 직접 변경하지 마세요.

먼저 `AGENTS.md`, `docs/v1.2/ROADMAP.md`, `WORKSTREAMS_AND_MODEL_BUDGET.md`, `docs/v1.1/PET_ANIMATION_PLATFORM.md`, `SPRITE_INVENTORY.md`, 현재 `animation/` 프로필, 9종 로컬 `pet.json`과 시트를 확인하세요.

이번 작업은 **9종 애니메이션 품질 점검과 신규 동물 5종을 위한 프로필 규격 설계**까지만 진행합니다.

- 9종의 idle/walk/jump/fall/landing/grabStart/held/release/hit/rest/sleep/Look 매핑을 실제 원본 시트와 대조해 사용 중인 프레임의 문제를 기록.
- Sleep은 편안한 표정만, Hit/Held는 울음/당황과 구분. 사용자 피드백으로 정상 판정받은 현재 시트와 클립은 건드리지 않음.
- 상태 전환시 크기/발 위치/프레임 루프 끊김, 억지 크롭 방지.
- 말티즈, 포메라니안, 웰시코기, 오리, 하프물범을 위한 **데이터 프로필 스키마와 제작 체크리스트만** 준비. 이미지가 없는 상태에서 임의 스프라이트 파일을 생성하지 않음.
- 공통 이벤트/프로필 계약이 앱 코드 변경을 요구하면 `docs/v1.2/ANIMATION_HANDOFF.md`에 요청 사항을 기록하고 앱 담당에게 넘김.
- 소유 파일은 `animation/`, `docs/v1.2/` 중 애니메이션 영역, 관련 독립 테스트/프리뷰에 한정. `renderer.js`, `main.js`, `controls.*` 수정 금지.
- 이미지 제작/전체 시트 재생성/광역 리팩터링/대량 테스트/빌드/commit/push 금지.

JS 구문/단위 검증과 diff 검사 등 최소한만 실행하고, 9종 문제 목록, 신규 캐릭터 프로필 규격, 앱 담당에 전달할 계약만 보고하세요.
