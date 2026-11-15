// '저당' 표시 검증 판정 + 복통(당알코올) 경고

const LOW_CLAIM = /저당|무당|제로|zero|무설탕|슈가|슈거|sugar|당류|로우|low|설탕/i

export function claimsLowSugar(product, result) {
  if (result?.lowSugarLabel === true) return true
  const text = `${(product.frontClaims || []).join(' ')} ${product.name || ''}`
  return LOW_CLAIM.test(text)
}

/**
 * 판정 (a = 분석 응답 normalizeAnalysis 결과)
 *  - pending: 점수 보류 (사진 AI 값 검수 전 / 추정값 / 확인 필요 / 영양성분 없음) — 백엔드 scoreStatus
 *  - fake:    저당·제로 표시인데 혈당 부담 보통 이상, 또는 숨은 탄수화물 100g당 15g 이상 → 가짜 저당 의심
 *  - partial: 숨은 탄수화물 100g당 4g 이상이고 부담의 절반 이상이 숨은 원료 → 부분적으로만 저당
 *  - match:   표시와 실제가 비슷함 (진짜 저당·제로)
 *  - none:    저당·제로 표시가 없는 제품
 * 서버가 verdict 를 주면 그걸 우선해요.
 */
const PENDING = {
  unverified: { label: 'AI가 읽은 값 · 확인 전', desc: '사진에서 읽은 숫자는 확인 전이라 점수를 보류했어요. 숫자를 확인하면 바로 점수를 계산해요.' },
  needs_check: { label: '확인 필요', desc: '감미료 함량을 못 읽어서 숨은 탄수화물이 부풀려졌을 수 있어요. 성분표를 확인해 주세요.' },
  estimated: { label: '추정값 · 점수 보류', desc: '영양성분이 표시되지 않아 비슷한 제품으로 추정한 참고값이에요. 성분표를 찍으면 정확해져요.' },
  ingredients_only: { label: '영양성분 없음', desc: '영양성분 정보가 없어 원재료로 확인된 성분과 주의 정보만 보여드려요.' },
}

export function getVerdict(a) {
  if (!a?.result) return null
  const { product, result } = a
  if (!a.scored) {
    const p = PENDING[result.scoreStatus] || PENDING.ingredients_only
    return { key: 'pending', status: result.scoreStatus, ...p, times: null, share: null }
  }
  const share = result.hiddenShare
  const times = share != null && share > 0.2 ? (share >= 0.95 ? null : Math.round((1 / (1 - share)) * 10) / 10) : null
  const lk = result.levelKey
  const h100 = a.hiddenCarbPer100g
  const server = String(result.verdict || '')
  let key
  if (/가짜|의심|fake/i.test(server)) key = 'fake'
  else if (/부분|partial/i.test(server)) key = 'partial'
  else if (/비슷|일치|match/i.test(server)) key = 'match'
  else if (!claimsLowSugar(product, result)) key = 'none'
  else if (lk === 'mid' || lk === 'high' || (h100 ?? 0) >= 15) key = 'fake'
  else if ((h100 ?? 0) >= 4 && (share ?? 0) >= 0.5) key = 'partial'
  else key = 'match'

  const TEXT = {
    fake: { label: '가짜 저당 의심', desc: "'당류'는 적지만, 당류로 표시되지 않는 원료(전분·당알코올 등) 때문에 실제 혈당 부담이 커요." },
    partial: { label: '부분적으로만 저당', desc: "먹는 양 기준 부담은 크지 않지만, 부담의 대부분이 '당류'에 안 잡히는 원료에서 와요. 많이 먹으면 달라져요." },
    match: { label: '표시와 실제가 같아요', desc: "표시대로 숨은 탄수화물이 거의 없어요." },
    none: { label: `혈당 부담 ${result.level || ''}`.trim(), desc: '저당·제로 표시가 없는 제품이라 등급만 보여드려요.' },
  }
  return { key, ...TEXT[key], times, share }
}

/* ---------------- 복통 경고 ---------------- */
// 대략적인 불편 기준량 (1회, g) — 보고서 값
const POLYOL_LIMIT = { 소르비톨: 10, 만니톨: 10, 말티톨: 20, 이소말트: 20, 락티톨: 20, 자일리톨: 20, 폴리글리시톨: 20, 에리스리톨: 40 }
const POLYOL_RE = /말티톨|소르비톨|에리스리톨|자일리톨|이소말트|락티톨|만니톨|폴리글리시톨/g

export function getGutWarning(product, result, grams, sensitive) {
  if (!grams) return null
  const per = product.per100g || {}
  const sw = per.sweeteners || {}
  const ingText = (product.ingredients || []).join(' ')
  const names = [...new Set(ingText.match(POLYOL_RE) || [])]

  // 양 추정: 서버/계산표의 당알코올 g → 없으면 표기된 당알코올 → 없으면 모름
  const rows = (result?.breakdown || []).filter((b) => b.grams != null && POLYOL_LIMIT[b.ingredient])
  let items = rows.map((b) => ({ name: b.ingredient, grams: b.grams, estimated: !!b.estimated }))
  const labelled = Number(sw.sugar_alcohol ?? sw.maltitol ?? sw.sorbitol ?? 0) || 0
  if (!items.length && labelled > 0) {
    items = [{ name: names[0] || '당알코올', grams: Math.round(labelled * grams) / 100, estimated: false }]
  }
  const erythritol = Number(sw.erythritol || 0)
  if (erythritol > 0 && !items.some((i) => i.name === '에리스리톨'))
    items.push({ name: '에리스리톨', grams: Math.round(erythritol * grams) / 100, estimated: false })

  if (!items.length && !names.length) return null

  const factor = sensitive ? 0.5 : 1
  const checked = items.map((i) => {
    const limit = (POLYOL_LIMIT[i.name] ?? 20) * factor
    return { ...i, limit, ratio: i.grams / limit }
  })
  const worst = checked.sort((a, b) => b.ratio - a.ratio)[0]
  const totalPer100 = labelled + erythritol || (rows.length ? rows.reduce((a, b) => a + b.grams, 0) * (100 / grams) : 0)
  const over10 = totalPer100 >= 10

  let level = 'info'
  if (worst && worst.ratio >= 1) level = 'danger'
  else if (worst && worst.ratio >= 0.5) level = 'warn'
  else if (over10 || sensitive) level = 'warn'

  return { level, items: checked, worst, names, over10, unknownAmount: !items.length, sensitive }
}
