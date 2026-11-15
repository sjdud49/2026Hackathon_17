// 스캔 기록(localStorage)과 화면 사이 분석 결과 전달용 캐시(sessionStorage)

const HISTORY_KEY = 'scanHistory:v2'
const CACHE_KEY = 'analysisCache:v2'
const MAX_HISTORY = 30
const MAX_CACHE = 20

function read(storage, key, fallback) {
  try {
    const v = storage.getItem(key)
    return v ? JSON.parse(v) : fallback
  } catch {
    return fallback
  }
}
function write(storage, key, value) {
  try {
    storage.setItem(key, JSON.stringify(value))
  } catch {
    /* 저장 공간 부족, 사파리 사생활 보호 모드 등 → 조용히 무시 */
  }
}

/** 기록: 제품 요약 + (직접 확인한 제품이면) 다시 계산용 원본 */
export function getHistory() {
  const list = read(localStorage, HISTORY_KEY, [])
  return Array.isArray(list) ? list.filter((h) => h?.id) : []
}

export function saveHistory(a) {
  if (!a?.product?.id) return
  const id = a.product.id
  const list = getHistory().filter((h) => h.id !== id)
  list.unshift({
    id,
    name: a.product.name,
    barcode: a.product.barcode,
    maker: a.product.maker,
    category: a.product.category,
    score: a.result?.score ?? null,
    level: a.result?.level ?? null,
    scoreStatus: a.result?.scoreStatus ?? null,
    servingGrams: a.result?.servingGrams ?? null,
    local: a.localProduct || null,
    alternatives: a.local ? a.alternatives : undefined,
    scannedAt: Date.now(),
  })
  write(localStorage, HISTORY_KEY, list.slice(0, MAX_HISTORY))
}

export function removeHistory(id) {
  write(localStorage, HISTORY_KEY, getHistory().filter((h) => h.id !== id))
}
export function clearHistory() {
  write(localStorage, HISTORY_KEY, [])
}

export function cacheAnalysis(a) {
  if (!a?.product?.id) return
  const cache = read(sessionStorage, CACHE_KEY, {})
  cache[a.product.id] = { ...a, cachedAt: Date.now() }
  const keys = Object.keys(cache).sort((x, y) => (cache[y].cachedAt || 0) - (cache[x].cachedAt || 0))
  keys.slice(MAX_CACHE).forEach((k) => delete cache[k])
  write(sessionStorage, CACHE_KEY, cache)
}

export function getCachedAnalysis(id) {
  return read(sessionStorage, CACHE_KEY, {})[id] || null
}
