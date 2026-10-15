# 앱 개발 Codex 첫 프롬프트 (그대로 복사)

`D:\DesktopPlayground`에서 DesktopPlayground v1.2 개발을 시작하세요.

현재 GitHub `main`의 v1.1.0 릴리스는 기준점으로 보존합니다. 먼저 `git status`, 현재 브랜치, 최신 커밋과 `AGENTS.md`, `docs/v1.2/ROADMAP.md`, `WORKSTREAMS_AND_MODEL_BUDGET.md`, `docs/v1.1/DECISIONS_AND_PROGRESS.md`, 현행 코드를 확인하세요. 이미 작업중인 미커밋 변경이 있으면 덮어쓰지 말고 보고하세요.

기존 `AGENTS.md`나 과거 v1.1 문서에 KO/삭제·Bomb 즉시 폭발 등이 남아 있어도 **현재 v1.1.0 실제 코드 및 최신 사용자 결정(총·망치·수류탄 비살상)**이 우선입니다. 역사 기록을 일괄 삭제하지 마세요.

이번 작업은 **Phase 3-D: Black Hole 2개 → 최대 10개**만 구현합니다.

- 기존 흡입 3.5회전 후 **해당 펫 인스턴스만 삭제**하는 동작 유지.
- 동시에 최대 10개. 11번째 생성 시 가장 오래된 홀을 안전하게 정리/교체하되, 관련 펫의 orbit, 재포획, Grab 구출 참조를 정확히 해제.
- 하나의 펫이 동시에 여러 홀에 속하지 않게 하고, 홀 근처를 다시 통과하면 정상적으로 신규 포획될 수 있게.
- 효과 만료와 사용자 삭제/Hide/Show/PC 모드에서도 상태 누수 없이 정리.
- 10개 활성화 시 불필요한 중복 계산/파티클 누적 감소. 사용자 펫 생성 개수에 하드 상한을 추가하지 않음.
- Gun 4종, 수류탄 24개, Hammer, Draw, Sleep 5~60분, Hit, Grab/Throw, 상단 개방, 작업표시줄 범위, 툴바 숨김, Tray, click-through/창 topmost, 설정 경로와 현재 애니메이션 동작 유지.
- 기존 `feature/pet-animation` 브랜치 내용은 이번 단계에 병합하거나 애니메이션 모듈을 수정하지 않음.

변경 JS 구문 검사, Black Hole 상태 관련 핵심 단위 테스트 1개 정도, `git diff --check`만 수행하세요. 대량 미리보기, 장시간 테스트 및 통합 전체 테스트는 실행하지 마세요. 실제 조작감은 사용자가 직접 확인합니다.

`docs/v1.2/ROADMAP.md`와 관련 진행 로그에 수정 사항과 남은 수동 확인만 짧게 기록하세요. 빌드, commit, push, 버전 변경, 다른 Phase 구현 금지. 수정 파일, 핵심 로직, 최소 검증 결과만 보고하세요.
