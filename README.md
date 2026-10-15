# DesktopPlayground

Windows 화면 위에서 Pet과 놀고, 그림과 시각효과를 사용할 수 있는 투명 데스크톱 플레이그라운드입니다.

## 주요 기능

- 여러 Desktop Pet 생성, 잡기·던지기, Touch + Trash로 개별 삭제
- PC 모드에서 Pet과 그림을 보면서 아래 앱 클릭 통과
- 자유형·직선·사각형·원/타원 그리기와 Pet이 반응하는 선 충돌
- 수류탄·망치·4종 총과 블랙홀 시각효과, 비살상 피격·콤보
- Pet이 공유하는 Platform/Ladder와 구조물 ON/OFF
- Playground 숨기기/보이기, 이동·접기 가능한 조작창, Tray
- 설치 과정 없는 Windows x64 portable 실행

## 실행

GitHub Releases의 `DesktopPlayground-v1.2.0.zip`을 다운로드해 압축을 풀고 `DesktopPlayground.exe`를 실행하세요. v1.2.0은 실제 Windows 수동 검수가 남은 Pre-release입니다. 사용자 PC에 Python, Node.js, npm 또는 Electron을 별도로 설치할 필요가 없습니다.

조작창에서 **PC**는 Playground를 보이게 둔 채 클릭을 통과시킵니다. **펫**으로 Pet을 고르고 화면을 클릭해 추가합니다. **만지기**로 잡고 던지거나 화면 오른쪽 아래 휴지통에 놓아 해당 Pet만 삭제할 수 있습니다. **놀이**에서 수류탄·망치·총·블랙홀·구조물을, **그리기**에서 그리기 도구를 선택합니다. 상호작용 중 우클릭하면 PC 모드로 돌아갑니다. 툴바만 숨기거나 Playground 전체를 숨긴 뒤 Tray에서 복원할 수 있습니다.

## 개발

v1.2.0의 구현 범위와 남은 수동 검수는 [v1.2 로드맵](docs/v1.2/ROADMAP.md)과 [QA 체크리스트](docs/v1.2/QA_CHECKLIST.md)를 확인하세요.

Windows x64와 Electron 29 기반입니다. 소스에서 실행하거나 portable 빌드를 만들려면 개발 PC에서 다음을 사용하세요.

```sh
npm install
npm start
npm run build
```

다중 모니터와 DPI 환경은 제한적으로 검증되었습니다. 실행 파일에 코드 서명이 없어 Windows SmartScreen 경고가 표시될 수 있습니다. Pet 이미지와 아이콘의 공개 재배포 권리는 확인되지 않았습니다. 공개 배포 전 [ASSET_SOURCES.md](ASSET_SOURCES.md)를 확인하세요. 소스코드 라이선스가 Pet 자산에 적용된다고 가정하지 마세요.
