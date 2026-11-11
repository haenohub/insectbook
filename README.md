# 서치! 곤충도감

저장된 색연필 손그림과 국립수목원 곤충도감 원문을 연결한 반응형 웹페이지입니다. 현재 스냅샷은 실제 생성된 **721종**을 포함합니다. 그림 추가 생성 작업은 중단 상태를 유지하며 웹페이지 작업은 원본 PNG와 수집 레코드를 수정하지 않습니다.

## 실행

Node.js 22.12 이상을 사용합니다.

```sh
npm ci
npm run dev
```

개발 서버는 클라우드 안의 `http://localhost:5173`에서 실행됩니다. 개인 컴퓨터의 `localhost` 주소는 이 서버에 연결되지 않습니다. 새 클라우드 세션에서는 `npm run dev`를 다시 실행하고 5173번 포트의 미리보기를 이용하세요.

GitHub Pages 배포 주소: **https://haenohub.github.io/insectbook/**. 배포 성공 여부는 저장소의 [Actions](https://github.com/haenohub/insectbook/actions/workflows/deploy-pages.yml)에서 확인합니다.

```sh
npm run build
npm run preview
```

`dist/`는 정적 웹사이트입니다. 배포에는 원본 PNG에서 자르지 않고 만든 WebP 사본(최대 1280px, 품질 90)과 연결된 원문 JSON을 사용합니다. 현재 721장 사본은 약 95MiB로 GitHub Pages 용량 제한 안에 들어갑니다. PNG 원본과 이전 수정본은 클라우드의 `assets/illustrations/`에 보존하며 Git에는 포함하지 않습니다. 배포용 WebP와 원본·사본 해시는 `assets/web-illustrations/manifest.json`으로 관리합니다. 이미지 생성 작업은 계속 중단 상태입니다.

## GitHub Pages 배포

`main`에 push하면 `.github/workflows/deploy-pages.yml`이 의존성 설치, 테스트, `/insectbook/` 경로 빌드, 721장과 원문 파일 검증, Pages 배포를 수행합니다. 저장소 **Settings → Pages → Build and deployment → Source**는 **GitHub Actions**를 사용합니다. 최초 자동 설정에 권한이 부족하면 이 항목을 직접 선택하고 Actions에서 워크플로를 다시 실행하세요.

Git에 저장된 WebP만으로 빌드할 수 있어 전체 PNG 원본을 내려받을 필요가 없습니다. 클라우드에서 그림을 추가한 뒤에는 `npm run prepare:images`로 배포 사본을 갱신하세요. 이 명령은 원본 PNG가 있는 환경에서만 실행합니다.

```sh
VITE_BASE_PATH=/insectbook/ npm run build
npm run verify:build
VITE_BASE_PATH=/insectbook/ npm run preview -- --port 4173
```

이 빌드의 미리보기 경로는 `/insectbook/`입니다. 루트 경로에 배포하려면 `VITE_BASE_PATH` 없이 빌드하세요. 네트워크가 제한된 클라우드에서는 GitHub API 확인에 `api.github.com`, 게시 사이트 확인에 `haenohub.github.io` 허용이 필요합니다.

## 기능

- 한국어 이름·학명·과·속·특징 타이틀 통합 검색 및 검색 범위 선택. 라틴명은 대소문자를 구분하지 않으며 타이틀은 띄어쓰기 없이도 검색할 수 있습니다.
- 과·속 필터, 17개 타이틀, 복수 타이틀 교집합, 능력치 정렬과 페이지 이동. 검색 조건은 URL에 반영되어 새로고침 후에도 유지됩니다.
- 손그림 상세, 분류 정보, 원문 관찰 노트와 국립수목원 출처 링크. 설명 조회 실패 시 재시도할 수 있습니다.
- 타이틀별 부여 이유와 원문/분류/공통 게임 별명 구분. 설명이 부족할 때는 종별 생태를 임의로 지어내지 않고 공통 게임 별명을 사용합니다.
- 로컬 관찰함, 두 곤충 선택 배틀 및 서로 다른 두 종의 랜덤 매칭, 배틀 선수 검색 창.
- HP·공격력·방어력·민첩성·회피율, 라운드 애니메이션, 3배속·결과 바로 보기, 다시 대결, 최근 10개 대결 기록.
- 모바일 필터 패널, 상세 대화상자, 선택 트레이와 배틀 화면. 동작 줄이기 설정을 따릅니다.

관찰함과 대결 기록은 해당 브라우저의 `localStorage`에 보관합니다. 서버 계정이나 기기 간 동기화는 없습니다. 저장소 접근이 제한되면 현재 탭의 메모리 안에서 동작합니다.

## 데이터와 타이틀

`scripts/build-web-data.mjs`는 수집 데이터의 `generated` 또는 `approved` 상태이면서 실제 파일이 있고 `blocked`가 아닌 항목만 읽습니다. 원본을 바꾸지 않고 `data/web-catalog.json`을 생성합니다. `npm run dev`와 `npm run build`에서 자동 실행하므로 이후 그림이 늘어나면 현재 저장 목록을 다시 반영할 수 있습니다.

타이틀과 스탯 규칙은 `src/lib/profiles.mjs`에 있습니다. 예를 들어 원문의 월동 기록은 생존왕, 보호색·의태 기록은 위장술사에 연결됩니다. 몸 크기는 `몸길이`와 `체장`에서 mm/cm를 읽으며 날개편 길이는 몸길이로 쓰지 않습니다. 알려진 몸 크기가 없으면 분류군 기본값을 사용합니다. 분류에서 착안한 별명은 종별 식성·측정 성능을 확정하는 주장이 아닙니다. 이름에 들어간 ‘벌’ 등의 문자열만으로 생태를 추정하지 않습니다.

스탯은 분류군 기본값에 기록된 몸 크기와 타이틀 보정을 더한 **게임 규칙**입니다. 실제 생물의 성능 측정값이나 우열을 뜻하지 않습니다. 생물종 원문에는 정보량·사진 품질 차이가 있으며 손그림은 기존 생성본을 사용합니다. 과거 생성 검토 사항은 `data/illustration-review.json`에 보존되어 있습니다.

## 배틀 규칙

- 매 라운드 선공 확률: 자신의 민첩성 / 두 선수의 민첩성 합.
- 피격 선수의 회피율을 적용합니다. 회피에 성공하면 피해는 0입니다.
- 일반 피해: `max(5, round(공격력 × (0.90~1.15) - 상대 방어력 × 0.42))`.
- 비회피 공격에는 10% 확률로 1.5배 치명타가 적용됩니다. 치명타 계산 후 반올림합니다.
- HP는 0 이하로 내려가지 않으며 한 선수가 쓰러지면 다음 공격을 하지 않습니다.
- 최대 40라운드. 모두 살아 있으면 남은 HP 비율로 판정하고 같으면 무승부입니다.
- 매 대결마다 새 시드를 사용하며, 배속과 건너뛰기는 결과를 바꾸지 않습니다.

## 검증

```sh
npm test
npm run test:e2e
npm run build
```

단위 테스트는 실제 데이터 연결, 타이틀 근거·크기 단위, 검색, 필터 교집합, 무작위 중복 방지 및 수백 회 대결의 HP·종료 조건을 검증합니다. 브라우저 테스트는 Chromium으로 검색·분류·상세·관찰함 영속성·선택/랜덤 배틀·기록·모바일·정보 조회 실패 복구를 확인합니다.

E2E 실행 전 개발 서버가 켜져 있어야 합니다. 기본 브라우저 경로는 `/usr/bin/chromium`입니다. 다른 환경은 `PLAYWRIGHT_CHROMIUM_PATH`로 경로를 지정하거나 Playwright에 설치된 Chromium을 사용하세요. 이 클라우드의 기본 샌드박스는 포트·브라우저 소켓을 제한하므로 서버와 브라우저 실행에 실행 도구의 권한 확대가 필요할 수 있습니다.

## 주요 파일

- `src/App.jsx`, `src/styles.css`: 페이지와 반응형 화면
- `src/lib/profiles.mjs`: 특징 근거, 타이틀 및 스탯
- `src/lib/search.mjs`: 검색·분류·정렬
- `src/lib/battle.mjs`: 시뮬레이션·랜덤 매칭
- `scripts/build-web-data.mjs`: 현재 저장된 이미지 목록 생성
- `data/README.md`: 수집 범위, 출처와 원문 데이터 설명

정보 출처: [국립수목원 국가생물종지식정보시스템](https://www.nature.go.kr/kbi/insct/pilbk/selectInsctPilbkGnrlList.do).
