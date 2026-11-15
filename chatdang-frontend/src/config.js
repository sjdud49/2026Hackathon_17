// 앱 전체 설정. 환경 변수는 .env.example 참고.
export const APP_NAME = '찻당'

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')
export const API_BASE_URL = RAW_BASE

// 시연 중 서버가 죽었을 때를 위한 비상 스위치:
//   주소 뒤에 ?mock=1 → mock 모드로 고정, ?mock=0 → 실제 서버로 복귀 (브라우저에 기억됨)
function readForcedMock() {
  try {
    const q = new URLSearchParams(window.location.search).get('mock')
    if (q === '1' || q === '0') localStorage.setItem('forceMock', q)
    return localStorage.getItem('forceMock')
  } catch {
    return null
  }
}

const forced = typeof window !== 'undefined' ? readForcedMock() : null
export const USE_MOCK =
  forced === '1' ? true : forced === '0' ? !RAW_BASE : import.meta.env.VITE_USE_MOCK === 'true' || !RAW_BASE

// 사진 업로드 multipart 필드 이름 (백엔드 /api/analyze/photo 의 files)
export const EXTRACT_FIELD = import.meta.env.VITE_EXTRACT_FIELD || 'files'

// 기본 사용량 프리셋 (g)
export const SPOON_G = 15

// 시연 제품 (시연 순서). 소스 2 → 젤리 → 과자 → 제로 음료
export const DEMO = [
  { barcode: '8801392136085', name: '해찬들 저당 쌈장', type: '소스' },
  { barcode: '8801392141607', name: '해찬들 저당 소불고기 양념', type: '소스' },
  { barcode: '8801117376307', name: '마이구미 포도 ZERO% 설탕제로', type: '젤리' },
  { barcode: '8804433103817', name: '라라스윗 딥크림 웨하스 미니스', type: '과자' },
  { barcode: '8801094083007', name: '코카콜라 제로', type: '음료' },
]
export const DEMO_BARCODES = DEMO.map((d) => d.barcode)
// "같은 '제로' 표시, 다른 결과" 화면에 나란히 보여줄 제품
export const ZERO_SET = ['8801117376307', '8804433103817', '8801094083007']
