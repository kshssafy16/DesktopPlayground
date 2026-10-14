# DesktopPlayground 개발 에이전트 지침

## 프로젝트와 문서 우선순위

- 이 저장소는 Windows x64용 Electron 기반 투명 데스크톱 펫 앱이다. 핵심 목적은 방치형 귀여움, 가벼운 스트레스 해소, 작업을 방해하지 않는 조작이다.
- 현재 배포된 `v1.0.0` 태그와 릴리스는 보존한다. v1.1 작업은 별도 브랜치에서 한다.
- 작업 전 `README.md`, `ASSET_SOURCES.md`, `docs/v1.1/V1_1_SPEC.md`, `docs/v1.1/IMPLEMENTATION_PLAN.md`, `docs/v1.1/DECISIONS_AND_PROGRESS.md`, 관련 코드와 테스트를 읽는다.
- `docs/history/`는 과거 개발 경위 기록이다. 일부 문서는 현재 v1.0.0과 다를 수 있으므로 현재 코드와 `tests/`를 실제 구현 판단의 근거로 우선한다.
- 변경된 사용자 요구와 결정은 `docs/v1.1/DECISIONS_AND_PROGRESS.md`에 기록한다. 확정 요구사항을 임의로 바꾸지 말고, 충돌이 있으면 사용자 확인을 요청한다.

## 변경 경계

- 매번 하나의 작은 Phase 또는 하위 작업만 수행한다. 전체 코드를 한 번에 재작성하지 않는다.
- 사용자에게 확인된 핵심 동작을 유지한다. PC click-through, 우클릭 PC 모드 복귀, Hide/Show, Tray 복구, 기존 비상 PC 모드 단축키, Drag+Trash, Draw와 collider, 구조물 공유, 시작 펫 4종, 모든 작업의 offline 동작을 보존한다.
- **펫 인스턴스 생성에 하드 상한을 새로 도입하지 않는다.** 10~20마리는 일반 사용 규모이지만 기존의 계속 추가 가능한 방식은 유지한다. 성능 문제는 측정, 캐시, 근접 판정, 부하 완화 등으로 대응한다.
- 블랙홀은 최대 10개를 목표로 하되 흡입 후 해당 펫 인스턴스만 삭제한다. 방출 모드나 삭제/방출 전환 UI를 새로 구현하지 않는다.
- 망치와 총은 시각적이고 비현실적인 화면 장난감이다. 실제 Windows 창, 파일, 디스플레이를 손상시키지 않는다. 유혈, 잔혹 표현 없이 타격, 숫자, 쓰러짐, 사라짐 효과를 사용한다.
- 기존 Sprite Pet은 유지하고, 표시가 깨진 프레임, anchor, clip, hitbox 등은 검증 후 보완할 수 있다. 기존 정상 에셋을 근거 없이 교체하지 않는다.
- 기본 Canvas 선택지는 슬라임만 노출한다. 보이지 않는 기존 정의나 자산은 참조 여부를 확인한 뒤에만 정리한다.
- 새 동물 캐릭터는 말티즈, 포메라니안, 웰시코기, **오리**, 하프물범이다. 이미지 제작은 별도 작업이며, 준비되지 않은 에셋을 임의 다운로드하거나 생성하지 않는다.
- 공개 배포 자산과 개인용 캐릭터 패키지는 분리한다. 공개 GitHub에 제3자 유명 캐릭터 자산을 무심코 추가하지 않는다. 기존 `ASSET_SOURCES.md`도 유지한다.

## 구현과 검증 원칙

- `main.js`, `preload.js`, `renderer.js`, `controls.js`, `local-pets.js`의 현재 IPC/보안 경계를 유지한다. `nodeIntegration:false`, `contextIsolation:true`, sandbox, 최소 preload API를 유지한다.
- 원본 userData 위치 `%APPDATA%\\desktop-playground`를 바꾸거나 기존 설정을 삭제하지 않는다. 설정 스키마가 바뀌면 migration/fallback을 둔다.
- 렌더링과 물리 시간은 frame count보다 elapsed time을 우선한다. Pet 정의와 Pet 인스턴스의 삭제 범위를 구분한다.
- Draw 도구는 사용자가 만족한 현재 사용성을 보존한다. 확인된 결함만 최소 수정한다.
- 완료 보고에는 수정 파일, 실제 테스트 명령과 결과, 직접 실행하지 못한 항목, 회귀 위험을 포함한다. 테스트를 실행하지 않았으면 통과했다고 쓰지 않는다.
- 필요하면 해당 Phase 문서와 테스트를 함께 업데이트한다. 오래된 `docs/history/` 원문은 함부로 다시 쓰지 않는다.
- 사용자의 별도 지시 없이 build, 버전 변경, commit, push, release, 파일 대량 삭제를 수행하지 않는다.

## 먼저 참고할 파일

- 제품 명세: `docs/v1.1/V1_1_SPEC.md`
- 단계별 구현과 허용 범위: `docs/v1.1/IMPLEMENTATION_PLAN.md`
- 캐릭터 및 스프라이트: `docs/v1.1/CHARACTER_GUIDE.md`
- 검증: `docs/v1.1/QA_CHECKLIST.md`
- 결정 기록과 진행 상황: `docs/v1.1/DECISIONS_AND_PROGRESS.md`
- Codex에 전달할 단계별 프롬프트: `docs/v1.1/CODEX_PROMPTS.md`
