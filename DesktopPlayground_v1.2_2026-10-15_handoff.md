# DesktopPlayground v1.2 작업 인계 및 PC 초기화 대비

기준: 2026-10-15, 사용자 및 Codex 보고 기반. 실제 원격 푸시와 빌드/릴리스 결과는 별도 확인 필요.

## 저장소와 작업 구조

- GitHub: https://github.com/kshssafy16/DesktopPlayground
- 앱 개발: `D:\DesktopPlayground`, 브랜치 `feature/v1.2`
- 애니메이션 개발: `D:\DesktopPlayground-animation`, 브랜치 `feature/v1.2-animation`
- 기준 공개 버전: `v1.1.0` (`main`의 이전 릴리스). 새 v1.2 작업이 아직 병합/배포되었다고 가정하면 안 됨.
- 두 로컬 폴더는 Git worktree 관계일 수 있으므로 `git worktree list`와 `git rev-parse --git-common-dir`로 먼저 확인.
- 역할: 앱 Codex(런타임/툴바/빌드), 애니메이션 Codex(WebP·프로필·ZIP), ChatGPT 이미지 제작 채팅(원화 PNG), PM 채팅(계획/인계).

## 구현된 기능 (사용자·Codex 보고)

- 블랙홀 최대 10개, 11번째 생성 시 오래된 홀 교체.
- Gun(4종), Bomb(투척 수류탄), Hammer, Draw, Grab/Throw, 구조물, 펫 관리, PC 모드, 툴바 표시/숨김.
- 수류탄의 그리기 선/도형 반발, 비살상 일반 펫 Hit, 상단 열린 이동 공간.
- 콤보 수치·단계별 효과, 드문 보스 소환·체력바·퇴장 효과, 수면 시 작은 z 이펙트.
- 콜덕(`call_duck`)과 아기 하프물범(`baby_harp_seal`) 앱 등록 완료. 아기 펭귄 패키지는 완성했으나 앱 통합은 별도 확인 필요.
- 시작 펫은 커비, 황색냥, 시바 3마리. 기존 9종 원본 유지.
- 최근 앱 수정: 작업 표시줄 Z-order 복구(`main.js`, `taskbar-zorder.ps1`, 테스트), 아직 사용자가 Windows에서 최종 확인 필요.
- 최근 애니메이션 수정: 영업냥 Sleep을 기존 시트 0행 0열로 매핑; 하프물범 Idle 8프레임 순서 조정. **앱 worktree에 동기화되었는지 확인 필요**.

## 애니메이션 제작 현황

- 콜덕: WebP/JSON/ZIP 완료.
- 아기 하프물범: WebP/JSON/ZIP 완료 및 최근 Idle 수정 ZIP 갱신.
- 아기 펭귄: WebP/JSON/ZIP 완료, 앱 통합은 확인 필요.
- 닥스훈트: 원화 PNG 확보, 조립은 확인 필요.
- 웰시코기: 원화 PNG 확보, 조립은 확인 필요.
- 말티즈: 첫 원화 시트가 스타일 가이드와 달라 재제작 진행 예정.
- 포메라니안, 돌고래, 범고래: 원화 제작 예정.
- 애니메이션 deliverables 경로 예: `D:\DesktopPlayground-animation\deliverables\DesktopPlayground-call-duck-ready.zip`, `...baby-harp-seal-ready.zip`, `...baby-penguin-ready.zip`.
- ChatGPT 스타일 기준 자료: `DesktopPlayground_pet_style_reference.zip` 및 `DesktopPlayground_PET_STYLE_STANDARD.md` (개인 로컬 다운로드와 원격 백업 여부 반드시 확인).

## 현재 알려진 문제 및 후속 QA

1. 아기 하프물범 Idle에서 시선/몸 방향이 좌우로 번갈아 튀는 듯한 현상. 단순 두 프레임 루프인지, 원화의 방향 변화인지, 앱에 프로필이 미반영된 것인지 구분. Idle은 고정 방향/숨쉬기/눈깜빡임 중심으로, 고개 돌리기는 Look 이벤트로 분리 권장.
2. 최근 영업냥 Sleep 매핑과 하프물범 Idle 순서를 앱으로 동기화해야 함.
3. 작업 표시줄 Z-order: WebP 뷰어, 탐색기, `Win+Shift+S`, 툴바/Playground 숨김-복원, PC 모드 클릭 통과 직접 확인 필요.
4. 장시간 실행 중 종료 의심 이력: 재발 시 `%APPDATA%\desktop-playground\lifecycle.log` 확인.
5. 수면 포즈 접지, 신규 펫 Walk→Idle/Jump/Sleep 전환감 확인.
6. 새 말티즈 원화는 기존 확정 스타일 가이드와의 일치 여부를 먼저 확인.

## PC 초기화 전에 반드시 원격으로 보존

1. 양쪽 worktree의 `git status`, `git worktree list`, 현재 브랜치/원격 상태 확인.
2. 애니메이션 worktree의 미커밋 소스/프로필/문서를 커밋하고 `feature/v1.2-animation` 원격에 push.
3. 앱 worktree의 미커밋 구현/자산/문서를 커밋하고 `feature/v1.2` 원격에 push.
4. 서로 다른 worktree의 애니메이션 변경을 앱 브랜치에 통합. 단순 파일 전체 덮어쓰기 금지: 공통 프로필에 이미 등록된 펫/상태 매핑을 보존하고 충돌 해결. 원격에 통합 커밋 push.
5. 배포할 경우 `main`으로 병합 후 기존 릴리스 절차로 Windows EXE/ZIP 제작, `v1.2.0` 태그와 GitHub Release의 바이너리 자산 업로드. QA 미완료라면 prerelease로 표시.
6. 원화 PNG, 스타일 가이드, 최종 패키지 ZIP, 애니메이션 소스와 문서, 테스트 및 빌드 스크립트가 GitHub 저장소 또는 GitHub Release **실제 업로드된 파일**로 존재하는지 확인. `.gitignore`에 의해 누락된 자료는 별도 보관.
7. Github 웹에서 두 개발 브랜치, 최신 `main`, 태그/Release 파일, 첨부 용량을 확인. 검증 전 로컬 데이터 삭제/PC 초기화 금지.
8. 개발 계정 인증 정보나 `.env`, 서명키 등은 Git에 추가하지 말고 별도 안전 저장. 초기화 후 다시 설치/로그인 필요.

## 초기화 후 복원

```bash
# Git Bash, D:가 있는 Windows PC 예시
cd /d
git clone https://github.com/kshssafy16/DesktopPlayground.git DesktopPlayground
cd DesktopPlayground
npm ci
npm start

# 애니메이션 개발 브랜치가 원격에 존재할 때
cd /d/DesktopPlayground
git fetch origin
git worktree add --track -b feature/v1.2-animation \
  /d/DesktopPlayground-animation origin/feature/v1.2-animation
```

`v1.2` 작업을 계속하려면 현재 `main`이 아니라 `feature/v1.2` 또는 별도 후속 개발 브랜치를 선택. 로컬에 없던 `incoming/`, `deliverables/`의 자료는 Git 추적 또는 Release 백업 여부에 따라 별도 복구 필요.

## 다음 세션 우선순위

1. GitHub 업로드와 릴리스의 실제 성공 확인, 다운로드한 EXE/ZIP 실행 확인.
2. 하프물범 Idle 자연스러운 방향/호흡 루프 보정, 영업냥 Sleep 프로필 반영 및 Windows Z-order QA.
3. 말티즈 스타일 재제작본 검토; 닥스훈트/웰시코기/말티즈 신규 펫 패키지 순차 제작/통합.
4. 포메라니안→돌고래→범고래 원화 제작 및 패키징.

원칙: 새 기능 개발보다 원격 백업과 손실 없는 복원 우선. 미커밋 작업 초기화, `git clean -fdx`, 원격 태그 강제 이동, 중복 이미지 대량 삭제 금지.
