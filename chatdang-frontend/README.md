# 찾당 프론트엔드

매장에서 바코드나 성분표를 찍으면 몇 초 안에 **'저당·제로' 표시와 실제 혈당 부담의 차이**를 보여주는 모바일 웹.
React (Vite) + react-router + html5-qrcode. 백엔드: `sjdud49/2026Hackathon_17` 의 `backend/` (FastAPI).

## 실행

```bash
npm install
npm run dev        # http://localhost:5173  (.env 없으면 mock 데이터로 동작)
npm run build      # dist/
```

`.env` (또는 Vercel 환경 변수)

| 변수 | 값 |
| --- | --- |
| `VITE_API_BASE_URL` | `https://chatdang-backend.onrender.com` (끝에 `/` 없이). 비우면 mock |
| `VITE_USE_MOCK` | `true`면 주소가 있어도 mock |

**시연 중 서버가 죽었을 때**: 주소 뒤에 `?mock=1` → mock으로 고정, `?mock=0` → 서버로 복귀. mock이면 오른쪽 위에 `MOCK` 표시.

## 속도 목표와 구성

| 목표 | 화면 구성 | 측정 (로컬 백엔드) |
| --- | --- | --- |
| 앱 실행 2초 | 홈은 가볍게, 카메라 코드는 홈에서 미리 받아둠 | 0.6초 |
| 상품 없으면 성분표 촬영까지 5초 | 버튼 한 번 → 카메라 → 4초 안에 바코드 안 잡히면 **같은 카메라 그대로** 성분표 모드 (성분표 모드에서도 바코드 계속 인식). DB에 없으면 즉시 전환 | 카메라 0.2초, 자동 전환 4초 |
| 인식 후 분석 2초 | 바코드 1회 호출로 제품·점수·대체품 한 번에 | 0.2초 |
| 결과 판단 5초 | 첫 화면: 판정 배지 → 한 줄 결론 → 숫자 3개 → 먹어도 되는 양·배탈 기준 → [대체품 보기] | — |

## 화면

```
홈 ─ [찍어서 확인하기] ─▶ /scan (바코드 → 안 되면 성분표) ─▶ /result/:id
 ├ 같은 '제로', 다른 결과 /zero          ├ 점수 보류(사진 AI 값) → [읽은 숫자 확인] /confirm → 점수
 ├ 제품명 검색 / 최근 확인 / 시연 제품     ├ 비교에 담기 (최대 8개) → /compare
 └ 직접 입력 /confirm                     └ 대체품 카드 → /result/:id
```

### 판정 (`src/lib/verdict.js`)
- **점수 보류**: 백엔드 `scoreStatus`가 `scored`가 아니면 (사진 AI 값 검수 전·추정값·확인 필요·영양성분 없음) 점수 없이 성분·주의 정보만
- **가짜 저당 의심**: 저당·제로 표시 + (혈당 부담 보통 이상 또는 숨은 탄수화물 100g당 15g 이상)
- **부분적으로만 저당**: 숨은 탄수화물 100g당 4g 이상이고 부담의 절반 이상이 숨은 원료
- **표시와 실제가 같아요**: 그 외 (코카콜라 제로 = 숨은 탄수화물 0g)
- 서버가 `result.verdict`를 주면 그걸 우선

### '판정 이상'으로 보여주는 것
- **먹어도 되는 양**: GL은 먹는 양에 비례 → "몇 g까지 '낮음'"
- **배탈 기준량**: 당알코올(말티톨 20g, 소르비톨 10g, 에리스리톨 40g 기준) → "몇 g 넘게 먹으면 배탈"
- **대체품**: 같은 계열, 검수된 값만 (백엔드 `alternatives`) / `goodChoice`면 "이미 좋은 선택"
- **추정값 라벨**: `nutritionEstimated` → '추정' + "성분표를 찍으면 정확해져요"

### 사진 값 '사용자 확인' (`/confirm`)
백엔드는 사진 AI 값으로 점수를 내지 않아요(검수 전). 사용자가 읽은 숫자를 포장지와 대조해 확인하면
**백엔드와 같은 계산식**(`src/lib/engine.js`, score.py·analyze.py·parse.py를 옮김)으로 점수를 보여주고 '직접 확인한 값' 라벨을 붙여요.
백엔드 계산식이 바뀌면 `engine.js`도 같이 고쳐야 해요.

## 백엔드 API (사용 중)

| 호출 | 용도 |
| --- | --- |
| `GET /api/products/barcode/{barcode}?grams=` | 바코드 → 분석. 404 + `needPhoto` → 성분표 모드 |
| `GET /api/products/{id}?grams=` | 먹는 양 바꿀 때, 검색·대체품 클릭 |
| `GET /api/search?q=` | 제품명 검색 |
| `POST /api/analyze/photo` (`files`, `barcode`, `grams`) | 사진 분석 (+ `issues`) |
| `GET /api/compare?ids=a,b&grams=` | 같은 양 비교 |
| `GET /api/demo` | (mock에서만 사용) |

응답 형식이 바뀌면 `src/api/normalize.js`의 `normalizeAnalysis`만 고치면 돼요.

## mock 데이터
`src/mock/mock.json` = 백엔드(11/13 커밋) `data.load()` 결과 스냅샷 557개. 백엔드 데이터가 바뀌면 다시 뽑아야 해요.
mock 사진 분석은 가상 예시 '제로 포도 젤리 (가상 제품)'를 돌려줘요. 바코드 `9999999999999` 네트워크 오류, `0000000000000` 서버 오류.
