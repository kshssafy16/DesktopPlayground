# Codex에 전달할 작업 시작 프롬프트

주의(2026-10-14): 아래 Phase 0 프롬프트는 당시 요청의 역사 기록이다. 현재 Bomb은 균열 없이 폭발을 표시하고 Bomb/Hammer/향후 Gun은 모두 공통 비살상 Hit·숫자를 사용한다. Gun KO/삭제 문구를 새 작업 지시로 재사용하지 않는다. 최신 결정은 [DECISIONS_AND_PROGRESS.md](DECISIONS_AND_PROGRESS.md)를 따른다.

## A. 첫 세션: 현행 코드 확인과 Phase 0

아래 내용 전체를 Codex에 복사해 보낸다.

```text
DesktopPlayground v1.1을 준비한다. 기능을 한 번에 모두 구현하지 마라.

현재 프로젝트 루트에서 AGENTS.md, README.md, ASSET_SOURCES.md,
docs/v1.1/V1_1_SPEC.md, IMPLEMENTATION_PLAN.md, CHARACTER_GUIDE.md,
QA_CHECKLIST.md, DECISIONS_AND_PROGRESS.md 및 기존 코드/테스트를 읽어라.

기준은 이미 배포한 v1.0.0이다. 사용자 요구의 최근 변경을 최우선으로 적용한다.
특히 다음을 주의하라.
- 펫 생성 수 하드 제한 추가 금지. 여러 마리 계속 추가 가능한 기존 방식 유지.
- 기본 Canvas 선택은 슬라임만. 기존 Sprite Pet 보존.
- 전반적 활동성 완화 + 캐릭터별 roam/rest/jump/sleep 차등.
- Black Hole은 최대 10개, 기존 흡수 후 인스턴스 삭제 유지. 방출 모드 추가 금지.
- Bomb 강화, Hammer/Gun 추가, Gun 피해 숫자와 knockout 후 인스턴스 삭제.
- Draw 기존 동작 보존, 시작 4마리 유지, 유저 설정 위치 보존.
- 기존 Sprite/clip가 깨진 경우에만 검증 근거를 갖고 수정 가능.
- 신규 동물 이미지 5종은 아직 제작되지 않았다. 에셋을 임의 수집하지 마라.

이번 단계에서는 Phase 0만 진행해라.
1. 실제 checkout 경로, 브랜치, working tree, v1.0.0 기준점 확인.
2. main.js / renderer.js / controls.js / local-pets.js / preload.js의 현재 동작 확인.
3. 기존 tests의 실행 방법 파악 및 가능한 baseline 검사.
4. 분석 보고의 던지기 감속, sprite squash, 블랙홀 orbit, 시간 처리,
   구조물 누적 이슈가 현재 실제 코드에서도 존재하는지 확인.
5. 결과를 docs/v1.1/DECISIONS_AND_PROGRESS.md에 근거와 함께 기록.
6. Phase 1의 최소 수정 범위, 위험, 필요한 테스트만 제시.

Phase 0에서는 제품 코드, 이미지, UI를 수정하지 않는다.
build, commit, push, tag, release 생성도 하지 않는다.
보고는 핵심 발견과 실제 테스트 결과 중심으로 간결하게 작성해라.
```

## B. Phase 1 시작: Phase 0을 확인한 뒤 별도로 전달

```text
DesktopPlayground v1.1 Phase 1만 구현해라.
AGENTS.md 및 docs/v1.1의 최신 문서와 Phase 0 검증 결과를 읽어라.

범위: grab offset 유지, timestamp 기반 throw, 외부 충격 중 AI 속도 덮어쓰기 방지,
자연스러운 bounce/landing, 기존 Sprite squash와 필요한 clip/anchor 결함 수정.

새 펫, 새 장난감, UI 재설계, 20마리 cap은 만들지 마라.
기존 Pet spawn 무제한과 시작 4마리, Draw collider, Touch+Trash,
PC click-through, 우클릭 PC 복귀, Tray, 구조물 OFF 시작을 보존한다.

코드 수정 후 관련 자동 테스트를 보완 및 실행해라.
실제 Windows 조작이 필요한 항목은 미검증으로 명시해라.
DECISIONS_AND_PROGRESS.md와 QA_CHECKLIST.md를 업데이트하고,
수정 파일, 테스트 결과, 확인 필요한 위험을 간략히 보고해라.
별도 지시 없이는 build/commit/push하지 마라.
```

## C. 이후 Phase 공통 시작 템플릿

```text
DesktopPlayground v1.1의 Phase [번호/작업명]만 진행해라.
AGENTS.md, docs/v1.1/V1_1_SPEC.md, IMPLEMENTATION_PLAN.md,
DECISIONS_AND_PROGRESS.md, QA_CHECKLIST.md를 먼저 읽고 실제 코드와 대조해라.
이미 구현된 기능을 중복 구현하지 마라. 현재 브랜치와 변경사항 확인 후 작업해라.
선택한 Phase 외 기능 추가, 재설계, 이미지 임의 다운로드, 대량 삭제는 금지한다.
자동 테스트를 실제 실행하고 문서와 회귀 검사를 업데이트해라.
불확실하거나 제품 결정이 필요한 변경은 구현 전에 질문해라.
build, commit, push는 승인받기 전 하지 마라.
```

## D. 각 Phase 종료 보고 방식

```text
1. 완료한 요구와 수정 파일
2. 실제 수행한 테스트/결과
3. 남은 버그와 사용자 PC에서 확인할 항목
4. 문서 업데이트 내역
5. 다음 작업 제안(한 단계만)
```

## E. 저장소가 삭제된 경우의 로컬 초기 준비

Git Bash, 해당 작업 폴더가 아직 없다면:

```bash
cd /d
# 디렉터리가 이미 있으면 clone 전에 기존 내용과 git status를 확인한다.
git clone https://github.com/kshssafy16/DesktopPlayground.git DesktopPet
cd /d/DesktopPet
npm install
# 반드시 현재 branch와 uncommitted changes 확인
git status
# v1.0.0을 보존하고 별도 브랜치에서 개발
git switch -c feature/v1.1
```

이미 프로젝트가 있다면 **다시 clone하거나 기존 파일을 덮어쓰지 말고** 기존 저장소를 사용한다.
문서 ZIP은 이 저장소의 루트에 풀어 `AGENTS.md`, `docs/v1.1/`을 추가한다.
`npm start` 등 실제 앱 실행 테스트는 Codex가 작업 환경을 확인한 뒤 수행한다.

## F. 토큰 절약

- 대량 조사와 UI 구상은 문서에서 끝낸 뒤 작은 Phase 단위 코드 수정만 요청한다.
- 반복적으로 프로젝트 전체를 읽으라고 지시하지 말고 핵심 파일과 관련 함수 위주로 확인하게 한다.
- 같은 이슈의 반복 서술을 피하고 `DECISIONS_AND_PROGRESS.md`에 진척을 남긴다.
- 새로운 동물의 디자인/시트 생성은 별도 작업. 그림이 없는 상태에서 가짜 이미지를 임의 사용하지 않는다.
