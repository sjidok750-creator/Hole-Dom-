# NEON HOLD'EM — 네온 홀덤

빠르고 화려한 브라우저 텍사스 홀덤. 빌드 없이 어떤 기기에서든 바로 실행됩니다.

## 게임 모드
- **퀵 캐시** — 6인 테이블, 4가지 스테이크(루키 → VIP 라운지). 언제든 나가서 정산.
- **1:1 헤즈업 보스전** — 성향이 다른 4명의 보스 AI. 승리 시 판돈 2배.
- **Sit & Go 토너먼트** — 6인/9인, 블라인드·앤티 상승, 상위 입상자 상금 지급, 터보 모드.

## 특징
- 7장 핸드 평가기 + 사이드 팟, 콜되지 않은 베팅 환불 등 정확한 홀덤 규칙
- 성향(공격성·루즈·블러프)이 다른 12종 AI, 몬테카를로 에퀴티 기반 판단, 숏스택 푸시/폴드
- 일일 미션 4개(매일 로테이션) + 13개 업적, XP/레벨, 통계
- 내 핸드 이름과 예상 승률 표시, 턴 타이머, 키보드 단축키(F/C/R/A, 방향키)
- 네온 컬러 연출: 카드 딜링·칩 이동·승리 파티클·골드 레인, 합성 사운드(에셋 없음)
- **기기별 최적화**: CPU/메모리/화면 기반 품질 티어 자동 감지 + 첫 프레임 실측으로 강등, `prefers-reduced-motion` 존중, 세로/가로 반응형 레이아웃, PWA(홈 화면 추가·오프라인)
- 속도 3단계(일반/빠름/터보), 다음 핸드 탭 스킵, 히어로 폴드 시 AI 가속

## 플레이
GitHub Pages로 자동 배포됩니다: https://sjidok750-creator.github.io/Hole-Dom-/

## 로컬 실행
```bash
# 그냥 index.html 을 브라우저로 열어도 됩니다. (PWA/서비스워커는 http 에서만 동작)
python3 -m http.server 8080
# → http://localhost:8080
```

## 테스트
```bash
node tests/evaluator.test.js   # 핸드 평가기
node tests/engine.test.js      # 엔진 시뮬레이션 (칩 보존, 사이드 팟, 환불)
```

## 구조
```
index.html            화면 골격
css/style.css         스타일 (품질 티어별 이펙트 조절)
js/utils.js           공용 유틸
js/cards.js           카드/덱
js/evaluator.js       핸드 평가 / 에퀴티
js/engine.js          베팅 라운드·사이드 팟 상태 머신 (UI 독립, node 에서 실행 가능)
js/ai.js              AI 성향과 의사결정
js/tournament.js      블라인드 구조·상금
js/missions.js        일일 미션·업적
js/profile.js         저장(localStorage)
js/perf.js            기기 성능 감지
js/audio.js           WebAudio 합성 효과음
js/fx.js              파티클 캔버스
js/ui.js              테이블 렌더링·애니메이션·액션 바·모달
js/main.js            홈/모드 설정/세션 루프
sw.js, manifest.webmanifest, icon.svg   PWA
```
