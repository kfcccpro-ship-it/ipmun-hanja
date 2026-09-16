# 입문한자

초등학교 4학년용 한자 학습 · 쪽지시험 대비 웹앱입니다.

- Apple Pencil 1세대 / Galaxy Tab S Pen 필기 지원
- 교재 페이지 범위 기반 시험 출제
- 읽기 10문제 + 쓰기 10문제
- 글자별 획수 학습 및 펜 입력 획수 확인
- 부모 직접 채점
- 매일 학습시간·학습량·오답 이력 기록

## 배포

GitHub Pages 배포를 기준으로 합니다. 배포 주소는 Pages 활성화 후 고정 URL을 사용합니다.

## 저장소 구조

- `index.html` — 서비스 진입점
- `assets/` — 화면 스타일과 실행 로직
- `data/meta.js`, `data/words-*.js` — 96개 2글자 단어 및 187자 획수 데이터
- `docs/` — 검수 및 변경 기록
- `.github/workflows/pages.yml` — GitHub Pages 자동 배포

## 운영 원칙

`main` 브랜치를 운영 소스의 기준으로 사용합니다. 수정은 버전 단위로 커밋하고, Pages 배포 후 iPad Safari 및 Galaxy Tab Chrome에서 실기기 검수합니다.
