// 서버 응답 → 화면에서 쓰는 형태로 맞추는 곳.
// 백엔드 형식이 바뀌면 이 파일만 고치면 돼요.

// 백엔드 기준 3단계: GL 10 이하 낮음 / 20 미만 보통 / 20 이상 높음  (점수 = GL ÷ 25 × 100 → 40 / 80)
const LEVELS = {
  낮음: 'low', low: 'low',
  보통: 'mid', 중간: 'mid', medium: 'mid', mid: 'mid',
  높음: 'high', high: 'high',
  '매우 높음': 'high', vhigh: 'high',
}
export function levelKey(level) {
  const s = String(level ?? '').trim()
  return LEVELS[s] || LEVELS[s.toLowerCase()] || null
}
export const LEVEL_LABEL = { low: '낮음', mid: '보통', high: '높음' }
export function levelFromScore(score) {
  if (score == null) return null
  return score <= 40 ? '낮음' : score < 80 ? '보통' : '높음'
}

export function impactKey(impact) {
  const s = String(impact ?? '')
  if (/거의|없음|낮음|none|zero|low/i.test(s)) return 'low'
  if (/중간|일부|보통|partial|medium/i.test(s)) return 'mid'
  if (/높음|큼|high/i.test(s)) return 'high'
  return 'unknown'
}

function num(v) {
  const n = typeof v === 'string' ? parseFloat(v) : v
  return Number.isFinite(n) ? n : null
}

export function normalizeProduct(p) {
  if (!p || typeof p !== 'object') return null
  const per = p.per100g || {}
  const ss = p.servingSize || {}
  return {
    ...p,
    id: String(p.id ?? p.barcode ?? ''),
    barcode: p.barcode ?? null,
    name: p.name || '이름 없는 제품',
    maker: p.maker || p.manufacturer || '',
    category: p.category || '',
    frontClaims: Array.isArray(p.frontClaims) ? p.frontClaims : [],
    per100g: {
      carb: num(per.carb),
      sugar: num(per.sugar),
      fiber: num(per.fiber),
      sweeteners: per.sweeteners || {},
    },
    ingredients: Array.isArray(p.ingredients) ? p.ingredients : [],
    // basis 'total'은 총 내용량이라 1회 사용량으로 쓰지 않아요 (예: 소스 290g)
    servingSize: ss.basis === 'total'
      ? { value: null, unit: ss.unit || 'g', basis: null }
      : { value: num(ss.value), unit: ss.unit || 'g', basis: ss.basis ?? null },
    missing: Array.isArray(p.missing) ? p.missing : [],
    needPhoto: Boolean(p.needPhoto),
    ...estimation(p),
  }
}

// 영양값이 실제(포장지·공공데이터)인지 모델 추정인지 — 백엔드 필드 이름이 정해지면 여기만 맞추면 돼요
function estimation(p) {
  const fields = p.estimatedFields || p.estimated_fields || []
  const src = String(p.nutritionSource || p.nutrition_source || p.valueSource || '')
  const flag = p.isEstimated ?? p.estimated ?? p.nutritionEstimated ?? p.per100g?.estimated
  const isEstimated = Boolean(flag) || fields.length > 0 || /estim|추정|model|pred/i.test(src)
  const verified = p.verified ?? p.reviewed ?? p.isVerified ?? null
  return { isEstimated, estimatedFields: fields, verified }
}

export function normalizeScore(r) {
  if (!r || typeof r !== 'object') return null
  const range = r.range && num(r.range.min) != null && num(r.range.max) != null
    ? { min: num(r.range.min), max: num(r.range.max) }
    : null
  return {
    ...r,
    score: num(r.score),
    level: r.level ?? levelFromScore(num(r.score)),
    levelKey: levelKey(r.level ?? levelFromScore(num(r.score))),
    range,
    servingGrams: num(r.servingGrams),
    servingBasis: r.servingBasis ?? null,
    servingNote: r.servingNote || '',
    hiddenCarbGrams: num(r.hiddenCarbGrams),
    hiddenShare: num(r.hiddenShare),
    lowSugarLabel: r.lowSugarLabel ?? null,
    gl: r.gl && typeof r.gl === 'object' ? r.gl : num(r.gl) != null ? { mid: num(r.gl) } : null,
    verdict: r.verdict ?? null,
    // 재료별 계산표용: grams(1회 사용량 기준 추정 g), gi, gl 이 오면 표로 보여줘요
    breakdown: (Array.isArray(r.breakdown) ? r.breakdown : []).map((b) => ({
      ...b,
      ingredient: b.ingredient || b.name || '',
      impactKey: impactKey(b.impact),
      grams: num(b.grams ?? b.estGrams ?? b.g),
      gi: num(b.gi ?? b.GI),
      gl: num(b.gl ?? b.GL),
    })),
    reasons: Array.isArray(r.reasons) ? r.reasons : [],
  }
}

// /api/compare: 배열 / {results} / {products} / {items} 모두 허용
export function normalizeCompare(res, products) {
  const list = Array.isArray(res) ? res : res?.results || res?.products || res?.items || []
  return list.map((item, i) => {
    const product = normalizeProduct(item.product || products[i] || item)
    const score = normalizeScore(item.result || item.score_result || item)
    return { product, result: score }
  })
}

// /api/alternatives: 배열 / {alternatives} / {items}
export function normalizeAlternatives(res) {
  const list = Array.isArray(res) ? res : res?.alternatives || res?.items || res?.results || []
  return list.map((a) => {
    const change = a.sweetenerChange || {}
    return {
      ...a,
      id: String(a.id ?? a.product?.id ?? a.barcode ?? a.name),
      barcode: a.barcode ?? a.product?.barcode ?? null,
      name: a.name || a.product?.name || '',
      score: num(a.score ?? a.result?.score),
      level: a.level ?? a.result?.level ?? levelFromScore(num(a.score ?? a.result?.score)),
      levelKey: levelKey(a.level ?? a.result?.level ?? levelFromScore(num(a.score ?? a.result?.score))),
      from: change.from ?? a.sweetenerFrom ?? a.fromSweetener ?? null,
      to: change.to ?? a.sweetenerTo ?? a.toSweetener ?? null,
      reason: a.reason || '',
      hiddenCarbPer100g: num(a.hiddenCarbPer100g),
      product: a.product ? normalizeProduct(a.product) : null,
    }
  })
}

/** 백엔드 분석 응답 {product, family, goodChoice, hiddenCarbPer100g, result, alternatives, issues, needPhoto} */
export function normalizeAnalysis(a) {
  if (!a) return null
  const product = normalizeProduct(a.product || {})
  const result = normalizeScore(a.result || {})
  const status = result.scoreStatus || (result.score != null || result.range ? 'scored' : 'ingredients_only')
  return {
    product: {
      ...product,
      nutritionSource: a.product?.nutritionSource ?? null,
      isEstimated: Boolean(a.product?.nutritionEstimated) || product.isEstimated,
      needsCheck: Boolean(a.product?.needsCheck),
    },
    family: a.family || null,
    goodChoice: Boolean(a.goodChoice),
    hiddenCarbPer100g: num(a.hiddenCarbPer100g),
    unverified: Boolean(a.nutritionValuesUnverified),
    result: { ...result, scoreStatus: status, scoreNote: result.scoreNote || '', caution: result.caution || null },
    scored: status === 'scored',
    alternatives: normalizeAlternatives(a.alternatives || []),
    issues: Array.isArray(a.issues) ? a.issues : [],
    needPhoto: Boolean(a.needPhoto),
    local: Boolean(a.local),
  }
}
