# Grab/Held 전후 QA

`before/after-held.png`: 실제 npm start의9종 GrabStart →Held(그림은400ms 간격2.4초 지점까지) →Release→Throw→Landing. 최신 `after-samples.json`에는 **3.2초 Held 끝점**도 보존한다. `before/after-salary.png`: 같은 앱의 실제 좌우 이동8개 시점. `legacy-salary.png`: v1.0.0 초기 drawImage 식/8장 선택을 실제 Electron Canvas에서 재생한 비교 자료. `interim-cropped-*`는 최종안 이전의 crop 화면·데이터 보존본이며 현재 제품에서 사용하지 않는다.

`before/after-samples.json`은 실제 RAF 시계·상태·소스셀·geometry·소스SHA, `before/after-profiles.json`은 각 시점 프로필이다. [비교 프리뷰](index.html)는 저장 sample의 재생이며 원본 화면 녹화는 아니다. 직접 마우스를 쓰지 않은 자동 DOM 입력이고 Landing은 낮은 낙하 초기조건을 별도로 설정했다.

재현 명령:

```powershell
node tests/grab-visual.cjs before
# 수정 적용 후
node tests/grab-visual.cjs after
node tests/grab-visual.cjs legacy
```

현재 코드에서 before를 다시 실행하면 기존 자료를 덮어쓰므로 **회귀 재현 시점에서만** 실행한다. 애플리케이션이 이미 실행 중이면 먼저 직접 닫는다. 테스트는 타 앱을 종료하거나 설정을 지우지 않는다. 실제 프로젝트를 실행하므로 앱 종료 시 기존 UI 위치 저장은 정상적으로 발생할 수 있다.

수동 확인: 실제 마우스로9종을3초 이상 잡아 표정 반복/울음, 빠른 놓기/던지기, 착지 후 복귀와 발 기준점을 확인한다. 푸들 현재 보행/원본 소품 유지, 얼굴냥 금지 프레임 부재, 영업냥의 원본 분절·회전 흔적과 책상 전환을 확인한다. 60/144Hz·DPI·투명 화면의 최종 자연스러움은 자동/native 검사로 확정하지 않는다.
