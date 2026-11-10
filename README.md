# i love spc

SPC 사건사고, 사법 기록, 계열사 및 팟캐스트 아카이브 웹 애플리케이션입니다. Cloudflare Workers(Assets)로 배포됩니다.

- 사이트: <https://i-love-spc.inkstone.workers.dev/>

## 메뉴 구성
1. **계열사 & 브랜드 맵**: 30개 브랜드 초성 검색 및 2026 상미당홀딩스 지배구조도
2. **재판 기록부**: 허영인 회장 노조탈퇴 강요 1심 및 배임·뇌물 매수 팩트체크
3. **중대재해 타임라인**: 2017 불법파견부터 SPL·샤니·삼립 산재 및 안전투자 이행률
4. **팟캐스트 아카이브**: XSFM 《그것은 알기 싫다》 '좋게된 제빵사' 12편 직링크

## 로컬 실행
```bash
npm install
npm run dev
```

## 배포
`main` 브랜치에 푸시하면 GitHub Actions가 Cloudflare Workers로 자동 배포합니다.

### 최초 1회 설정 (자동 배포 켜기)
Pickle의 GitHub 연동에는 `workflows` 권한이 없어 워크플로 파일만은 직접 추가해야 합니다.

1. **Secrets 등록** — Settings → Secrets and variables → Actions → New repository secret
   - `CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit 권한 토큰)
   - `CLOUDFLARE_ACCOUNT_ID`
2. **워크플로 파일 추가** — 저장소 루트의 [`deploy-workflow.yml`](deploy-workflow.yml) 내용을 복사해
   `.github/workflows/deploy.yml` 로 새 파일 생성 후 커밋
3. 커밋이 푸시되면 자동으로 `https://i-love-spc.inkstone.workers.dev/` 에 배포됩니다.
