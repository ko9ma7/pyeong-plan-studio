# 평수 도면 스튜디오

대지·마당·건물의 **외부 틀부터 실제 규격으로 생성**하고, 그 안에 실내 공간과 문·창문을 편집하면서 ㎡와 평을 계산하는 로컬 우선 건축 도면형 웹서비스입니다.

새 도면은 다음 순서로 시작합니다.

```text
작업 조건 선택
→ 건물만 / 대지 + 마당 + 건물
→ 외곽 형상 선택
→ 실제 규격 입력
→ 외부 틀 생성
→ 실내 공간 / 문 / 창문 편집
→ 면적 확인 / 저장 / 출력
```

## Preview

첫 방문과 **새 도면**에서는 외곽 설정 창이 먼저 열립니다. 작업 조건·외곽 형상·규격을 확정해야 편집을 시작할 수 있으며, 별도의 **예시 도면으로 둘러보기** 버튼으로 건물 외곽과 실내 공간이 포함된 샘플을 확인할 수 있습니다.

데스크톱에서는 좌측 외곽/편집 도구, 중앙 SVG 도면, 우측 면적 결과·속성 편집의 3열 구조를 사용합니다. 모바일에서는 도면을 우선 표시하고 외곽 설정·편집 도구·결과 패널을 세로 흐름으로 재배치합니다.

## Features

### 외부 틀 / 작업 조건

- `건물만` 작업
- `대지 + 마당 + 건물` 작업
- 대지와 건물을 서로 독립된 외곽 객체로 관리
- 대지/건물 형상 선택
  - 사각형
  - ㄱ자형
  - ㄷ자형
  - 사다리꼴
- 전체 가로·세로 및 형상별 세부 치수 입력
- 대지 안에서 건물의 왼쪽/위쪽 배치 여백 지정
- 생성 후 외곽 전체 이동
- 외곽 꼭짓점 드래그 및 X/Y 좌표 직접 편집
- 규격형 외곽을 다시 입력해 즉시 재생성
- 기존 v1 저장 도면은 실내 공간의 바운딩 영역으로 건물 외곽을 자동 추정하는 호환 마이그레이션

### 면적 계산

- 대지 면적 / 평수
- 건축 외곽 면적 / 평수
- 대지에서 건축 외곽을 제외한 마당·여유 면적
- 실내 공간별 면적 / 평수
- 실내 공간 합계
- 공간별 벽선 길이 집계
- 기준: `1평 = 3.305785㎡`

> 이 서비스의 외곽 면적은 입력된 폴리곤의 기하학적 면적입니다. 법정 대지면적, 건축면적, 연면적, 전용면적 등은 실제 측량값과 관련 법규 기준을 별도로 확인해야 합니다.

### 도면 편집

- mm / cm / m 입력·표시 단위 전환
- 사각형 드래그 생성
- 자유 다각형 생성
- 실내 공간 이동
- 꼭짓점 드래그 및 좌표 직접 입력
- 여닫이문 / 미닫이문 / 창문
- 문·창문 폭, 좌표, 0/90/180/270° 회전 편집
- 그리드 스냅
- 확대 / 축소 / 화면 맞춤
- 외곽 및 실내 치수선 표시
- Undo / Redo
- Delete / Esc / Ctrl(Cmd)+S 단축키

### 저장 / 백업 / 출력

- LocalStorage 자동 저장
- 여러 도면 저장 및 불러오기
- JSON 백업 / 복원
- 구버전 JSON 자동 호환
- SVG 내보내기
- PNG 내보내기
- 브라우저 인쇄를 통한 PDF 저장
- 라이트 / 다크 테마

### 웹 배포 / 브랜딩

- GitHub Pages 하위 경로 대응 상대 asset URL
- GitHub Actions Pages 배포
- `.nojekyll`
- `404.html`
- SVG / PNG / ICO favicon
- Apple Touch Icon
- 192×192 / 512×512 PWA icon
- `site.webmanifest` 및 호환용 `manifest.webmanifest`
- Open Graph / Twitter Card 메타데이터
- 1200×630 OG 이미지
- 1280×640 GitHub Repository Social Preview

## Tech Stack

- HTML5
- CSS3
- JavaScript ES Modules
- SVG 기반 도면 편집기
- LocalStorage
- Node.js 표준 라이브러리 기반 정적 빌드
- GitHub CLI 기반 Windows Bootstrap
- GitHub Actions / GitHub Pages

외부 런타임 라이브러리에 의존하지 않아 정적 호스팅에서 단순하고 안정적으로 동작하도록 구성했습니다.

## Project Structure

```text
/
├─ .github/
│  └─ workflows/
│     └─ deploy.yml
├─ public/
│  ├─ .nojekyll
│  ├─ 404.html
│  ├─ favicon.ico
│  ├─ favicon.svg
│  ├─ favicon-32x32.png
│  ├─ apple-touch-icon.png
│  ├─ apple-touch-icon.svg
│  ├─ icon-192.png
│  ├─ icon-512.png
│  ├─ og-image.png
│  ├─ og-image.svg
│  ├─ repository-social-preview.png
│  ├─ manifest.webmanifest
│  ├─ site.webmanifest
│  ├─ sitemap.xml
│  └─ robots.txt
├─ scripts/
│  ├─ build.mjs
│  ├─ configure-site.mjs
│  └─ dev.mjs
├─ src/
│  ├─ lib/
│  │  ├─ geometry.js
│  │  └─ storage.js
│  ├─ main.js
│  └─ styles.css
├─ .gitattributes
├─ .gitignore
├─ github-bootstrap.cmd
├─ LICENSE
├─ README.md
├─ index.html
├─ package-lock.json
└─ package.json
```

## Local Development

Node.js LTS가 설치되어 있다면:

```bash
npm ci
npm run dev
```

브라우저에서 개발 서버가 안내하는 로컬 주소로 접속합니다.

## Build

```bash
npm ci
npm run build
```

빌드 결과는 `dist/`에 생성됩니다. `dist/`는 Git에 커밋하지 않고 GitHub Actions에서 생성합니다.

## Windows One-click GitHub Bootstrap

Windows 10/11에서는 프로젝트 루트의 **`github-bootstrap.cmd` 하나만** 실행합니다. 별도 PowerShell 보조 스크립트는 사용하지 않습니다.

> ZIP 안에서 직접 실행하지 말고, ZIP 전체를 새 폴더에 압축 해제한 뒤 `index.html`, `package.json`, `.github` 폴더가 함께 보이는 `floorplan-calculator` 폴더에서 실행하세요.

CMD 상단 변수만 바꾸면 Repository 이름과 About 정보를 변경할 수 있습니다.

```bat
set "REPO_NAME=pyeong-plan-studio"
set "REPO_DESCRIPTION=Floor plan, site boundary, area and pyeong calculator for GitHub Pages"
set "VISIBILITY=public"
set "TOPICS=floor-plan area-calculator architecture svg-editor github-pages korean-webapp"
set "INITIAL_TAG=v1.0.0"
```

Bootstrap은 다음 작업을 순서대로 수행합니다.

1. Git / GitHub CLI(`gh`) 확인
2. `gh auth status` 확인 및 필요 시 브라우저 로그인
3. **현재 프로젝트 폴더에 독립적인 `.git` 저장소 생성/검증**
4. `.cache`, `codex-runtimes`, `node_modules` 등 런타임 파일이 stage되지 않았는지 안전 검사
5. Node.js가 있으면 `npm run build` 사전 검사; 없어도 GitHub Actions 빌드로 진행
6. `pyeong-plan-studio` Repository가 없으면 생성, 있으면 재사용
7. `origin` 연결, commit, `main` push
8. GitHub **About의 Description / Website / Topics / Default branch** 설정
9. GitHub Pages를 Actions 방식으로 활성화
10. `deploy.yml`을 직접 실행하고 `gh run watch --exit-status`로 실제 배포 성공까지 확인
11. `v1.0.0` tag / Release가 없으면 생성
12. 최종 Repository URL과 Pages URL 출력

소프트웨어를 자동 설치하지 않으므로 실행 중 `winget`이나 관리자 권한 설치가 갑자기 시작되지 않습니다. Git 또는 GitHub CLI가 없다면 설치 명령만 표시하고 즉시 종료합니다.

현재 기본값:

- Repository: `pyeong-plan-studio`
- Visibility: `public`
- Default branch: `main`
- Initial tag: `v1.0.0`
- Initial commit: `feat: release site and building floor-plan studio`
- Topics: `floor-plan`, `area-calculator`, `architecture`, `svg-editor`, `github-pages`, `korean-webapp`

실행 로그는 같은 폴더의 `github-bootstrap.log`에 저장됩니다. 이미 Repository/remote/commit/Pages/tag/release가 존재하면 가능한 범위에서 그대로 재사용합니다.

## GitHub Pages Deployment

수동 설정을 원하는 경우:

1. GitHub Repository에 프로젝트를 push합니다.
2. 기본 branch를 `main`으로 설정합니다.
3. Repository → **Settings → Pages**에서 **GitHub Actions**를 사용하도록 설정합니다.
4. `main` push 또는 **Actions → Deploy to GitHub Pages → Run workflow**를 실행합니다.
5. `.github/workflows/deploy.yml`이 `npm ci → npm run build → dist 업로드 → deploy-pages` 순으로 배포합니다.

일반적인 배포 URL:

```text
https://USERNAME.github.io/REPOSITORY/
```

## Configuration

- 초기 예시 도면 / 외곽 기본값: `src/main.js`
  - `defaultFrameConfig()`
  - `seedProject()`
- 평 환산 기준: `src/lib/geometry.js`
- 디자인 토큰: `src/styles.css`의 `:root`
- GitHub Repository 기본값: `github-bootstrap.cmd` 상단 변수
- GitHub Actions: `.github/workflows/deploy.yml`

## Social Preview

- 웹 공유: `public/og-image.png` — 1200×630
- GitHub Repository Social Preview: `public/repository-social-preview.png` — 1280×640

실제 Repository 생성 후 GitHub Repository → **Settings → General → Social preview**에서 `repository-social-preview.png`를 업로드하면 됩니다.

## Custom Domain

커스텀 도메인을 사용할 경우 `public/CNAME`에 도메인 하나만 기록하고 GitHub Pages의 Custom domain 설정과 DNS를 구성합니다. HTTPS 인증서 발급 전에는 DNS 설정이 올바른지 확인하세요.

## Data & Privacy

도면 데이터는 기본적으로 사용자 브라우저의 LocalStorage에 저장됩니다. 서버로 자동 전송하지 않습니다. 다른 기기에서 사용하려면 JSON 백업/복원을 사용하세요.

민감 개인정보, 비밀번호, API Secret, Access Token 등을 도면 데이터나 공개 Repository에 저장하지 마세요.

## License

MIT License. 자세한 내용은 [`LICENSE`](LICENSE)를 확인하세요.


## v1.1.0 - 벽 기준 배치 및 확대/축소 개선

- 캔버스 확대/축소 범위: 2% ~ 400%
- 큰 대지/건물에서도 `맞춤`이 실제 전체 외곽이 보이는 배율까지 자동 축소
- `벽 기준` 실내 공간 생성: 기준 벽 선택 → 시작 오프셋 → 길이 → 깊이 → 방향
- 여닫이문/미닫이문/창문을 벽에 자동 스냅하고 벽 각도로 자동 회전
- 배치된 문/창문을 드래그할 때도 근처 벽에 다시 스냅

이미 GitHub Repository가 있다면 `github-update.cmd`를 실행해 v1.1.0으로 업데이트할 수 있습니다.
