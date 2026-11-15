// 백엔드(찻당 FastAPI) 호출. 엔드포인트는 backend/README.md 기준.
//   GET  /api/products/barcode/{barcode}?grams=   바코드 → 분석 (모르면 404 + needPhoto)
//   GET  /api/products/{id}?grams=                id → 분석 (먹는 양 바꿀 때, 검색·대체품 클릭)
//   GET  /api/search?q=                           제품명 검색
//   POST /api/analyze/photo  files[], barcode, grams   사진 → 분석 (+ issues)
//   GET  /api/compare?ids=a,b&grams=              같은 양 비교
//   GET  /api/demo                                시연 제품
import { API_BASE_URL, USE_MOCK, EXTRACT_FIELD } from '../config'
import { ApiError } from './errors'
import { normalizeAnalysis, normalizeProduct } from './normalize'
import { analyze as localAnalyze } from '../lib/engine'
export { ApiError }

let mockModule = null
async function mock() {
  if (!mockModule) mockModule = await import('./mockApi.js')
  return mockModule
}

async function request(path, { method = 'GET', body, timeout = 15000 } = {}) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeout)
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData
  let res
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method,
      body: body == null ? undefined : isForm ? body : JSON.stringify(body),
      headers: body == null || isForm ? undefined : { 'Content-Type': 'application/json' },
      signal: ctrl.signal,
    })
  } catch (e) {
    if (e.name === 'AbortError') throw new ApiError('응답이 너무 늦어요. 잠시 후 다시 시도해주세요.', { kind: 'timeout' })
    throw new ApiError('인터넷 연결을 확인해주세요.', { kind: 'network' })
  } finally {
    clearTimeout(timer)
  }
  let data = null
  try {
    data = await res.json()
  } catch {
    /* JSON 아님 */
  }
  if (!res.ok) {
    // FastAPI: {detail: "메시지"} 또는 {detail: {needPhoto, message}}
    const d = data?.detail ?? data
    if (d && typeof d === 'object' && d.needPhoto) {
      throw new ApiError(d.message || '아직 모르는 제품이에요. 성분표 사진을 찍어 주세요.', { kind: 'needPhoto', status: res.status })
    }
    const msg = typeof d === 'string' ? d : d?.message || data?.error || `서버 오류가 났어요 (${res.status})`
    throw new ApiError(msg, { kind: res.status === 404 ? 'notfound' : 'server', status: res.status })
  }
  return data
}

const qs = (o) => {
  const s = new URLSearchParams(Object.entries(o).filter(([, v]) => v != null && v !== '')).toString()
  return s ? `?${s}` : ''
}

/** 바코드 → 분석. 모르는 제품이면 ApiError(kind: 'needPhoto') */
export async function analyzeBarcode(barcode, grams) {
  const raw = USE_MOCK
    ? await (await mock()).analyzeBarcode(barcode, grams)
    : await request(`/api/products/barcode/${encodeURIComponent(barcode)}${qs({ grams })}`, { timeout: 10000 })
  return normalizeAnalysis(raw)
}

/** id → 분석 (먹는 양 바꿀 때) */
export async function analyzeById(id, grams) {
  const raw = USE_MOCK
    ? await (await mock()).analyzeById(id, grams)
    : await request(`/api/products/${encodeURIComponent(id)}${qs({ grams })}`)
  return normalizeAnalysis(raw)
}

/** 사진(1~4장) → 분석. 사진에서 읽은 값은 검수 전이라 점수가 없고 issues가 함께 와요 */
export async function analyzePhoto(files, { barcode, grams } = {}) {
  const list = Array.isArray(files) ? files : [files]
  if (USE_MOCK) return normalizeAnalysis(await (await mock()).analyzePhoto(list, { barcode, grams }))
  const fd = new FormData()
  list.slice(0, 4).forEach((f) => fd.append(EXTRACT_FIELD, f, f.name || 'label.jpg'))
  if (barcode) fd.append('barcode', barcode)
  if (grams) fd.append('grams', String(grams))
  return normalizeAnalysis(await request('/api/analyze/photo', { method: 'POST', body: fd, timeout: 60000 }))
}

/** 제품명 검색 → [{id, name, barcode, category, hasNutrition, nutritionEstimated}] */
export async function searchProducts(q) {
  const raw = USE_MOCK ? await (await mock()).search(q) : await request(`/api/search${qs({ q, limit: 20 })}`)
  return (Array.isArray(raw) ? raw : raw?.items || []).map((x) => ({
    ...x,
    id: String(x.id),
    isEstimated: Boolean(x.nutritionEstimated),
  }))
}

/** 같은 양 비교. 서버 제품은 /api/compare, 직접 확인한 제품(local)은 같은 계산식으로 여기서 */
export async function compareProducts(entries, grams) {
  const remote = entries.filter((e) => !e.local)
  let remoteItems = []
  if (remote.length) {
    const raw = USE_MOCK
      ? await (await mock()).compare(remote.map((e) => e.id), grams)
      : await request(`/api/compare${qs({ ids: remote.map((e) => e.id).join(','), grams })}`)
    remoteItems = (raw?.items || []).map(normalizeAnalysis)
  }
  return entries
    .map((e) => {
      if (e.local) return normalizeAnalysis({ ...localAnalyze(e.local, grams, []), local: true })
      return remoteItems.find((a) => a.product.id === e.id || a.product.barcode === e.id) || null
    })
    .filter(Boolean)
}

/** 시연 제품 */
export async function getDemo() {
  const raw = USE_MOCK ? await (await mock()).demo() : await request('/api/demo')
  return (raw || []).map(normalizeAnalysis)
}

/** 사용자가 읽은 숫자를 확인한 제품 → 서버와 같은 계산식으로 점수 (서버를 거치지 않음) */
export function analyzeChecked(product, grams, keepAlternatives = []) {
  const a = normalizeAnalysis({ ...localAnalyze(product, grams, []), local: true })
  a.alternatives = keepAlternatives
  a.localProduct = product
  return a
}

export async function health() {
  if (USE_MOCK) return { status: 'ok', mock: true }
  return request('/', { timeout: 8000 })
}

export { normalizeProduct }
