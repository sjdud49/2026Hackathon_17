// mock 서버: 백엔드 데이터 스냅샷(src/mock/mock.json) + 백엔드와 같은 계산식(src/lib/engine.js)
// 응답 형식은 실제 서버와 같아요.
// - 바코드 9999999999999 → 네트워크 오류, 0000000000000 → 서버 오류 (오류 화면 확인용)
// - 그 밖에 없는 바코드 → 404 needPhoto
import data from '../mock/mock.json'
import { ApiError } from './errors'
import { analyze } from '../lib/engine'
import { DEMO_BARCODES } from '../config'

const P = data.products
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const byBarcode = new Map(P.filter((p) => p.barcode).map((p) => [p.barcode, p]))
const byId = new Map(P.map((p) => [String(p.id), p]))
const added = new Map() // 사진으로 새로 등록된 제품

function find(key) {
  return added.get(key) || byId.get(String(key)) || byBarcode.get(String(key)) || null
}

export async function analyzeBarcode(barcode, grams) {
  await wait(150)
  const code = String(barcode || '').replace(/\D/g, '')
  if (code === '9999999999999') throw new ApiError('인터넷 연결을 확인해주세요.', { kind: 'network' })
  if (code === '0000000000000') throw new ApiError('서버에서 오류가 났어요 (500)', { kind: 'server', status: 500 })
  const p = byBarcode.get(code) || added.get(`photo_${code}`)
  if (!p) throw new ApiError('아직 모르는 제품이에요. 성분표 사진을 찍어 주세요.', { kind: 'needPhoto', status: 404 })
  const res = analyze(p, grams, P)
  res.needPhoto = p.per100g?.carb == null
  return res
}

export async function analyzeById(id, grams) {
  await wait(120)
  const p = find(id)
  if (!p) throw new ApiError('제품을 찾을 수 없어요', { kind: 'notfound', status: 404 })
  return analyze(p, grams, P)
}

export async function search(q) {
  await wait(150)
  const norm = (s) => String(s ?? '').replace(/[^0-9a-zA-Z가-힣]/g, '').toLowerCase()
  const key = norm(q)
  if (!key) return []
  const rank = { photo_ai: 0, label: 1, verified: 1, estimated: 2 }
  return P.filter((p) => norm(p.name).includes(key))
    .sort((a, b) => (rank[a.nutritionSource] ?? 3) - (rank[b.nutritionSource] ?? 3) || (a.name || '').length - (b.name || '').length)
    .slice(0, 20)
    .map((p) => ({
      id: p.id, name: p.name, barcode: p.barcode ?? null, category: p.category ?? null,
      hasNutrition: p.per100g?.carb != null, nutritionEstimated: p.nutritionSource === 'estimated',
    }))
}

/**
 * 사진 분석 흉내: 바코드가 데이터에 있으면 그 제품을 '사진에서 읽은 값'(photo_ai, 검수 전)으로,
 * 없으면 가상 예시 제품을 돌려줘요. 실제 서버처럼 점수는 없고 issues가 붙어요.
 */
export async function analyzePhoto(_files, { barcode, grams } = {}) {
  await wait(2200)
  const base = (barcode && byBarcode.get(barcode)) || null
  const p = base
    ? { ...base, id: `photo_${barcode}`, source: 'photo_ai', nutritionSource: 'photo_ai', servingSize: {} }
    : {
        id: `photo_demo_${Date.now()}`,
        name: '예시: 제로 포도 젤리 (가상 제품)',
        maker: '',
        category: '캔디류',
        source: 'photo_ai',
        nutritionSource: 'photo_ai',
        barcode: barcode || null,
        frontClaims: ['ZERO%', '설탕제로'],
        per100g: { carb: 74, sugar: 0, fiber: null, sweeteners: { sugar_alcohol: 55.5 } },
        ingredients: ['말티톨시럽', '젤라틴', '농축포도과즙', '구연산', '사과산', '변성전분', '향료', '수크랄로스'],
        ingredientsFlat: ['말티톨시럽', '젤라틴', '농축포도과즙', '구연산', '사과산', '변성전분', '향료', '수크랄로스'],
        servingSize: {},
      }
  added.set(p.id, p)
  const res = analyze(p, grams, P)
  res.issues = base ? [] : ['식이섬유 값을 읽지 못했어요.']
  return res
}

export async function compare(ids, grams) {
  await wait(200)
  const g = Number(grams) || 15
  return {
    servingGrams: g,
    items: ids.map(find).filter(Boolean).map((p) => {
      const r = analyze(p, g, [])
      return { product: r.product, hiddenCarbPer100g: r.hiddenCarbPer100g, result: r.result }
    }),
  }
}

export async function demo() {
  await wait(200)
  return DEMO_BARCODES.map((b) => byBarcode.get(b)).filter(Boolean).map((p) => analyze(p, null, P))
}
