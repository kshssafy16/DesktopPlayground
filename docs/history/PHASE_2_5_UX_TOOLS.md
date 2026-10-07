# Phase 2.5 입력·도구 구현 기준

작성일: 2026-10-06. 현재 Phase 2 소스를 기준으로 한다.

이 문서는 Phase 2.5 당시 기준이다. 현재 Phase 3.5 도구 목록과 Draw collider 동작은 CURRENT_STATE.md를 따른다.

## 입력 안전

- 시작 mode는 `PC`. PC에서는 Pet과 효과가 보이고 overlay는 mouse 입력을 무시한다. interactive mode는 사용자가 다른 mode를 고르기 전까지 유지한다. focus loss, drag release, Hide/Show, second instance가 mode를 바꾸지 않는다.
- Overlay는 primary display의 `workArea`에 맞춰 taskbar 영역을 침범하지 않는다. controls는 overlay보다 높은 always-on-top level에 두고 상태 변경·재표시 뒤에도 위로 올린다. controls는 별도 BrowserWindow다.
- Controls의 PC, Tray의 PC Mode, 등록 가능한 global shortcut `Ctrl+Alt+Shift+P`는 명시적인 수동 탈출 경로다. Exit는 controls와 Tray에서 접근 가능하다. mode가 PC일 때 외부 프로그램 클릭·우클릭·wheel을 막지 않는다.
- 화면·창·파일을 수정하지 않는다. 모든 도구는 앱 overlay 내부 Canvas/DOM 효과만 만든다.

## Controls와 mode

- 펼친 toolbar: `PC | Pets | Touch | Tools ▾ | Hide/Show | ⋯`와 작은 drag handle. Tools 목록은 Hammer, Gun, Paint, Draw, Bomb이다. ⋯ 목록은 Collapse, Hide Controls, Clear Effects, Clear Drawing, Reset Playground, Exit다.
- Pets 메뉴는 기본 5종, 활성 Custom, Add Custom Pet, Manage Pets를 포함한다. Phase 2의 파일 검증·복사·settings 유지, 활성/비활성/삭제, collapsed/drag/위치 저장을 유지한다.
- Pet 선택은 spawn mode로 들어간다. Touch, 각 도구, spawn mode는 반복 입력을 허용한다. Hide/Show는 overlay 표시만 바꾸고 mode·Pet 세션을 보존한다.
- Clear Effects는 crack/impact/bullet/paint/bomb 잔상만 정리한다. Clear Drawing은 stroke만 정리한다. Reset Playground는 화면 Pet과 모든 임시 효과를 정리한다. Custom asset/settings는 건드리지 않는다.

## 도구 효과

- Hammer: 기존 crack·짧은 shake에 impact/소수 particle/가까운 Pet의 약한 impulse를 더한다.
- Gun: bullet mark, flash/debris, 약한 Pet impulse. 실제 Windows에는 영향이 없다.
- Paint: 선택한 기본 색으로 click/drag 위치에 수가 제한된 splat·blot·streak를 만든다.
- Draw: freehand stroke, 기본 색 몇 개, 굵기 3개, eraser. 각 stroke와 전체 point 수를 제한한다.
- Bomb: 클릭 즉시 flash·확장 ring·particle·crack/약한 shake와 범위 내 Pet impulse. 효과 객체 수와 수명을 제한한다.

## 종료와 확인

- 모든 Exit 요청은 main의 `requestAppQuit()`을 통과한다. 저장 대기, global shortcut 해제, Tray destroy, 창 종료, app.quit을 한 번만 수행한다. 일반 controls close는 hide다.
- 실제 Electron에서 Phase 2 Pet/Custom 회귀, mode 유지, PC click-through 상태, controls Z 순서와 클릭, taskbar workArea, 도구 반복, Hide/Show, Tray/second-instance, 반복 종료, HTTP(S) 0건을 검사한다.
- Chrome/Explorer/desktop/taskbar의 물리 mouse 입력과 native 파일 picker/Tray 입력은 가능한 범위에서 Windows에서 확인하고, 자동화가 불확실하면 수동 확인으로 명시한다.
- 기존 v0.2-beta EXE/ZIP과 `dist/`, `build/`는 보존한다. 이번 작업에서 최종 portable 빌드는 하지 않는다.
