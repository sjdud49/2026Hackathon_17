// 백엔드 계산식(backend/app/score.py · analyze.py · parse.py)을 그대로 옮긴 것.
// 쓰는 곳: ① mock 모드  ② 사용자가 '읽은 숫자 확인'을 마친 제품의 점수 계산 (서버와 같은 식)
// 백엔드 계산식이 바뀌면 이 파일도 같이 고쳐야 해요. scripts/check_engine 으로 서버와 결과를 비교할 수 있어요.

/* ---------------- parse.py ---------------- */
const OPEN = '([{'
const CLOSE = ')]}'
const COUNTRIES = '국|국내|수입|외국|미국|중국|호주|캐나다|베트남|태국|칠레|브라질|인도|독일|프랑스|이탈리아|스페인|뉴질랜드|러시아|아르헨티나|말레이시아|인도네시아|필리핀|터키|튀르키예|덴마크|네덜란드|일본|대만|헝가리|폴란드|우크라이나|미얀마|파키스탄|페루|멕시코|벨기에|영국|아일랜드|스위스|오스트리아|에콰도르|가나|코트디부아르'
const ORIGIN = `(?:${COUNTRIES})산`

export function isEmpty(v) {
  return v == null || ['', '알수없음', 'None', 'null', '-', 'nan'].includes(String(v).trim())
}

export function splitOutsideParens(text) {
  const parts = []
  let buf = ''
  let depth = 0
  for (const ch of String(text ?? '')) {
    if (OPEN.includes(ch)) depth++
    else if (CLOSE.includes(ch)) depth = Math.max(depth - 1, 0)
    if (ch === ',' && depth === 0) {
      if (buf.trim()) parts.push(buf.trim())
      buf = ''
    } else buf += ch
  }
  if (buf.trim()) parts.push(buf.trim())
  return parts
}

function isOriginOrAmount(s) {
  s = s.trim()
  if (/^[\d.\s%]+$/.test(s) || new RegExp(`^${ORIGIN}\\s*:`).test(s)) return true
  return new RegExp(`^(?:${ORIGIN}|${COUNTRIES})[\\s\\d.%]*(?:[\\(\\[].*[\\)\\]])?$`).test(s)
}

function parseIngredient(item) {
  item = item.trim()
  const m = item.match(/^(.*?)[([{](.*)[)\]}]\s*$/s)
  if (!m) return { name: item, sub: [] }
  const name = m[1].trim()
  const inner = m[2]
  if (splitOutsideParens(inner).every(isOriginOrAmount)) return { name: name || item, sub: [] }
  const subs = []
  for (let s of splitOutsideParens(inner)) {
    s = s.trim()
    if (!s.includes('(') && !s.includes('[')) s = s.replace(new RegExp(`\\s*:\\s*${ORIGIN}.*$`), '')
    if (s && !isOriginOrAmount(s)) subs.push(s)
  }
  const flat = []
  for (const s of subs) {
    const p = parseIngredient(s)
    flat.push(p.name, ...p.sub)
  }
  return { name: name || item, sub: flat }
}

/** 원재료 문자열 → [상위 원재료, 하위까지 펼친 목록] */
export function parseRawmtrl(text) {
  if (isEmpty(text)) return [[], []]
  const top = splitOutsideParens(text).map(parseIngredient)
  const names = top.map((t) => t.name)
  const flat = []
  for (const t of top) flat.push(t.name, ...t.sub)
  return [names, flat]
}

/* ---------------- score.py ---------------- */
const INGREDIENT_TABLE = [
  ['난소화성말토덱스트린(식이섬유)', ['난소화성말토덱스트린', '난소화성덱스트린', '저항성말토덱스트린', '저항성덱스트린'], 'zero', 0],
  ['폴리덱스트로스(식이섬유)', ['폴리덱스트로스'], 'zero', 0],
  ['말토덱스트린', ['말토덱스트린'], 'hidden', 95],
  ['환원물엿(당알코올)', ['환원물엿', '말티톨시럽', '말티톨액'], 'polyol', 52],
  ['말티톨', ['말티톨'], 'polyol', 35],
  ['소르비톨', ['소르비톨', '솔비톨'], 'polyol', 9],
  ['자일리톨', ['자일리톨'], 'polyol', 13],
  ['에리스리톨', ['에리스리톨', '에리트리톨'], 'zero', 0],
  ['이소말트', ['이소말트'], 'polyol', 2],
  ['락티톨', ['락티톨'], 'polyol', 6],
  ['만니톨', ['만니톨'], 'zero', 0],
  ['알룰로스', ['알룰로스', '알룰로오스', '사이코스'], 'zero', 0],
  ['스테비아', ['스테비', '효소처리스테비아'], 'zero', 0],
  ['수크랄로스', ['수크랄로스'], 'zero', 0],
  ['아스파탐', ['아스파탐'], 'zero', 0],
  ['아세설팜칼륨', ['아세설팜'], 'zero', 0],
  ['나한과', ['나한과'], 'zero', 0],
  ['물엿', ['물엿', '콘시럽', '옥수수시럽', '맥아시럽'], 'sugar', 90],
  ['포도당', ['포도당', '결정포도당'], 'sugar', 100],
  ['올리고당', ['올리고당'], 'sugar', 30],
  ['과당', ['과당', '액상과당', '고과당'], 'sugar', 25],
  ['설탕', ['설탕', '백설탕', '정백당', '황설탕', '흑설탕', '원당', '자당'], 'sugar', 65],
  ['꿀', ['꿀', '벌꿀'], 'sugar', 60],
  ['조청', ['조청'], 'sugar', 90],
  ['덱스트린', ['덱스트린'], 'hidden', 90],
  ['전분', ['전분', '변성전분', '감자전분', '옥수수전분', '타피오카전분'], 'hidden', 80],
  ['밀가루', ['소맥분', '밀가루'], 'hidden', 70],
  ['쌀가루', ['쌀가루', '찹쌀가루'], 'hidden', 80],
]

export const EXPLAIN = {
  말토덱스트린: '전분을 잘게 분해한 가루예요. 단맛은 거의 없지만 포도당만큼 빠르게 혈당을 올려요.',
  덱스트린: "전분을 분해해 만든 탄수화물이에요. '당류'로 표시되지 않지만 혈당을 빠르게 올려요.",
  전분: "감자·옥수수 등에서 뽑은 탄수화물로, 걸쭉하게 만들 때 써요. '당류'로 안 잡히지만 혈당을 올려요.",
  밀가루: "밀을 빻은 가루로 대부분 전분이에요. '당류'로 표시되지 않지만 혈당을 올려요.",
  쌀가루: "쌀을 빻은 가루로 대부분 전분이에요. '당류'로 표시되지 않지만 혈당을 올려요.",
  '환원물엿(당알코올)': '물엿을 가공한 당알코올이에요. 설탕보다는 덜하지만 혈당을 꽤 올리고, 많이 먹으면 배탈이 날 수 있어요.',
  말티톨: '설탕 대신 쓰는 당알코올이에요. 혈당을 설탕의 절반 정도 올리고, 많이 먹으면 배탈이 날 수 있어요.',
  소르비톨: '과일에도 있는 당알코올이에요. 혈당 영향은 작지만 많이 먹으면 배탈이 날 수 있어요.',
  자일리톨: '껌에 많이 쓰는 당알코올이에요. 혈당 영향은 작지만 많이 먹으면 배탈이 날 수 있어요.',
  이소말트: '사탕·과자에 쓰는 당알코올이에요. 혈당 영향은 작지만 많이 먹으면 배탈이 날 수 있어요.',
  락티톨: '당알코올의 한 종류예요. 혈당 영향은 작지만 많이 먹으면 배탈이 날 수 있어요.',
  에리스리톨: '당알코올이지만 거의 흡수되지 않고 그대로 배출돼서 혈당을 거의 올리지 않아요.',
  만니톨: '당알코올의 한 종류로 혈당을 거의 올리지 않아요. 많이 먹으면 배탈이 날 수 있어요.',
  알룰로스: '자연에도 조금 있는 희소당이에요. 단맛은 있지만 몸에서 거의 쓰이지 않아 혈당을 거의 올리지 않아요.',
  스테비아: '스테비아 잎에서 뽑은 감미료예요. 아주 적은 양으로 단맛을 내고 혈당을 올리지 않아요.',
  수크랄로스: '설탕보다 수백 배 단 인공감미료예요. 아주 조금만 들어가고 혈당을 올리지 않아요.',
  아스파탐: '설탕보다 훨씬 단 인공감미료예요. 아주 조금만 들어가고 혈당을 올리지 않아요.',
  아세설팜칼륨: '설탕보다 훨씬 단 인공감미료예요. 아주 조금만 들어가고 혈당을 올리지 않아요.',
  나한과: '나한과 열매에서 뽑은 감미료예요. 혈당을 거의 올리지 않아요.',
  '난소화성말토덱스트린(식이섬유)': '이름은 비슷하지만 소화되지 않는 식이섬유예요. 혈당을 거의 올리지 않아요.',
  '폴리덱스트로스(식이섬유)': '소화되지 않는 식이섬유예요. 혈당을 거의 올리지 않아요.',
  물엿: '전분을 분해한 끈적한 시럽으로 포도당이 많아요. 혈당을 빠르게 올려요.',
  포도당: '혈당 그 자체예요. 가장 빠르게 혈당을 올려요.',
  올리고당: '단맛이 덜한 당이에요. 설탕보다는 덜하지만 혈당을 올려요.',
  과당: '과일의 단맛 성분이에요. 혈당은 덜 올리지만 많이 먹으면 몸에 부담이 될 수 있어요.',
  설탕: '가장 흔한 당이에요. 혈당을 빠르게 올려요.',
  꿀: '대부분 당(포도당·과당)이에요. 혈당을 올려요.',
  조청: '곡물을 졸여 만든 시럽으로 엿당·포도당이 많아요. 혈당을 빠르게 올려요.',
}

function classify(name) {
  const n = String(name).replace(/\s/g, '')
  for (const [std, words, kind, gi] of INGREDIENT_TABLE) {
    if (words.some((w) => n.includes(w))) return { std, kind, gi }
  }
  return null
}

function carbSources(p) {
  const found = []
  const seen = new Set()
  const top = p.ingredients || []
  const flat = p.ingredientsFlat?.length ? p.ingredientsFlat : top
  let rank = 0
  let topI = -1
  for (const ing of flat) {
    if (topI + 1 < top.length && ing === top[topI + 1]) {
      topI++
      rank = topI + 1
    }
    const c = classify(ing)
    if (c && !seen.has(c.std)) {
      seen.add(c.std)
      found.push({ ...c, rank: rank || 1, raw: ing })
    }
  }
  return found
}

const SERVING_REF = [
  ['덮밥', 165, '덮밥소스 165g (식약처 1회 섭취참고량)'],
  ['카레', 165, '덮밥소스 165g 준용 (식약처 1회 섭취참고량)'],
  ['짜장', 165, '덮밥소스 165g 준용 (식약처 1회 섭취참고량)'],
  ['케첩', 10, '토마토케첩 10g (식약처 1회 섭취참고량)'],
  ['혼합장', 10, '혼합장 10g (식약처 1회 섭취참고량)'],
  ['비빔장', 10, '혼합장 10g 준용 (식약처 1회 섭취참고량)'],
  ['향미유', 5, '향미유 5g (식약처 1회 섭취참고량)'],
  ['드레싱', 15, '소스/드레싱 15g (식약처 1회 섭취참고량)'],
  ['소스', 15, '소스/드레싱 15g (식약처 1회 섭취참고량)'],
  ['과자', 30, '과자 30g (식약처 1회 섭취참고량)'],
  ['스낵', 30, '스낵과자 30g (식약처 1회 섭취참고량)'],
  ['빵', 70, '빵 70g (식약처 1회 섭취참고량)'],
  ['음료', 200, '음료 200mL (식약처 1회 섭취참고량)'],
  ['우유', 200, '음료 200mL (식약처 1회 섭취참고량)'],
  ['라떼', 200, '음료 200mL (식약처 1회 섭취참고량)'],
  ['두유', 200, '음료 200mL (식약처 1회 섭취참고량)'],
  ['주스', 200, '음료 200mL (식약처 1회 섭취참고량)'],
  ['콜라', 200, '음료 200mL (식약처 1회 섭취참고량)'],
  ['사이다', 200, '음료 200mL (식약처 1회 섭취참고량)'],
  ['탄산', 200, '음료 200mL (식약처 1회 섭취참고량)'],
  ['에이드', 200, '음료 200mL (식약처 1회 섭취참고량)'],
]
const FALLBACK_SERVING = 30
const SUGAR_GI = 65
const CARB_RANGE = [
  ['소스', [10, 45]], ['드레싱', [5, 30]], ['장', [15, 45]], ['케첩', [20, 30]], ['시럽', [40, 90]], ['잼', [30, 70]],
  ['음료', [0, 15]], ['과자', [50, 80]], ['캔디', [60, 100]], ['초콜릿', [30, 65]], ['아이스크림', [15, 35]],
]

function carbRangeOf(p) {
  const cat = String(p.category ?? '') + String(p.name ?? '')
  for (const [k, v] of CARB_RANGE) if (cat.includes(k)) return v
  return [5, 60]
}

function defaultServing(p) {
  for (const text of [String(p.name ?? ''), String(p.category ?? '')]) {
    for (const [k, g, note] of SERVING_REF) if (text.includes(k)) return [g, note]
  }
  return [FALLBACK_SERVING, '기본값 30g (식약처 참고량 미확인 유형)']
}

function servingOf(p, grams) {
  if (grams) return [Number(grams), 'user', '사용자가 선택한 양']
  const s = p.servingSize || {}
  if (s.value) return [Number(s.value), s.basis || 'label', s.note || '포장지 1회 제공량']
  const [g, note] = defaultServing(p)
  return [g, note.includes('식약처') ? 'reference' : 'default', note]
}

const IMPACT = (gi) => (gi <= 5 ? '거의 없음' : gi <= 20 ? '낮음' : gi <= 55 ? '중간' : '높음')
const glToScore = (gl) => pyRound(Math.min(100, Math.max(0, (gl / 25) * 100)))
const levelOf = (gl) => (gl <= 10 ? '낮음' : gl < 20 ? '보통' : '높음')
// 파이썬 round()와 같게: 실제 이진수 값 기준으로 반올림하고, 정확히 .5일 때만 짝수 쪽으로
function pyRound(x, d = 0) {
  const m = 10 ** d
  const v = x * m
  if (Number.isFinite(v) && v - Math.floor(v) === 0.5 && Number.isInteger(v * 2)) {
    const f = Math.floor(v)
    return (f % 2 === 0 ? f : f + 1) / m
  }
  return Number(x.toFixed(d))
}

export function calculateScore(p, servingGrams) {
  const [g, sBasis, sNote] = servingOf(p, servingGrams)
  const n = p.per100g || {}
  const { carb, sugar, fiber } = n
  const sweet = n.sweeteners || {}
  const srcs = carbSources(p)
  const hiddenSrcs = srcs.filter((s) => s.kind === 'hidden' || s.kind === 'polyol')
  const reasons = []
  const breakdown = srcs.map((s) => ({
    ingredient: s.std, raw: s.raw, impact: IMPACT(s.gi), rank: s.rank, kind: s.kind, explain: EXPLAIN[s.std] || '',
  }))

  if (carb != null) {
    const f = g / 100
    const sugarG = (sugar || 0) * f
    const declared = Object.fromEntries(Object.entries(sweet).filter(([, v]) => v).map(([k, v]) => [k, v * f]))
    const polyolGis = srcs.filter((x) => x.kind === 'polyol').map((x) => x.gi)
    const zeroPolyol = srcs.some((x) => x.std === '에리스리톨' || x.std === '만니톨')
    const saGi = polyolGis.length ? Math.max(...polyolGis) : zeroPolyol ? 0 : 40
    const declaredGl = Object.entries(declared).reduce((a, [k, v]) => a + (v * (k === 'allulose' ? 0 : saGi)) / 100, 0)
    const declaredSum = Object.values(declared).reduce((a, b) => a + b, 0)
    const hiddenG = Math.max(0, carb * f - sugarG - (fiber || 0) * f - declaredSum)
    const sugarGl = (sugarG * SUGAR_GI) / 100
    let giMin, giMid, giMax
    if (hiddenG > 0 && hiddenSrcs.length) {
      const gis = hiddenSrcs.map((s) => s.gi)
      const w = hiddenSrcs.map((s) => 1 / s.rank)
      giMid = gis.reduce((a, gi, i) => a + gi * w[i], 0) / w.reduce((a, b) => a + b, 0)
      giMin = Math.min(...gis)
      giMax = Math.max(...gis)
    } else if (hiddenG > 0) {
      ;[giMin, giMid, giMax] = [0, 40, 80]
      reasons.push('당류로 표시되지 않은 탄수화물이 있지만 어떤 원료인지 원재료에서 확인되지 않았어요.')
    } else giMin = giMid = giMax = 0

    const base = sugarGl + declaredGl
    const glMin = base + (hiddenG * giMin) / 100
    const glMid = base + (hiddenG * giMid) / 100
    const glMax = base + (hiddenG * giMax) / 100
    const totalGl = glMid || 0.0001
    const hiddenShare = glMid > 0 ? pyRound((hiddenG * giMid) / 100 / totalGl, 2) : 0
    const lowSugar = sugar != null && sugar < 5
    const score = glToScore(glMid)
    const rng = Math.abs(glMax - glMin) < 1 ? null : { min: glToScore(glMin), max: glToScore(glMax) }

    if (lowSugar && hiddenShare >= 0.5 && hiddenG >= 0.5)
      reasons.unshift(`당류는 100g당 ${sugar}g으로 '저당' 기준을 충족하지만, 혈당 부담의 약 ${Math.trunc(hiddenShare * 100)}%가 당류로 표시되지 않는 원료에서 와요.`)
    for (const s of [...hiddenSrcs].sort((a, b) => a.rank - b.rank).slice(0, 2))
      reasons.push(`${s.std}(${s.raw})이(가) 원재료 ${s.rank}번째에 있어요. 혈당 영향: ${IMPACT(s.gi)}.`)
    const zeros = srcs.filter((s) => s.kind === 'zero').map((s) => s.std)
    if (zeros.length) reasons.push(`${zeros.join(', ')}은(는) 혈당에 거의 영향을 주지 않아요.`)
    return {
      score, level: levelOf(glMid), range: rng, servingGrams: g, servingBasis: sBasis, servingNote: sNote,
      gl: { min: pyRound(glMin, 1), mid: pyRound(glMid, 1), max: pyRound(glMax, 1) },
      hiddenCarbGrams: pyRound(hiddenG, 1), hiddenShare, lowSugarLabel: lowSugar,
      breakdown, basis: 'nutrition', reasons,
    }
  }

  const [loC, hiC] = carbRangeOf(p)
  const f = g / 100
  const gis = srcs.filter((s) => s.kind !== 'zero').map((s) => s.gi)
  const [giLo, giHi] = gis.length ? [Math.min(...gis), Math.max(...gis)] : [0, 30]
  const glLo = (loC * f * giLo) / 100
  const glHi = (hiC * f * giHi) / 100
  for (const s of srcs.filter((x) => x.gi >= 30).sort((a, b) => a.rank - b.rank).slice(0, 3))
    reasons.push(`${s.std}(${s.raw})이(가) 원재료 ${s.rank}번째에 있어요. 혈당 영향: ${IMPACT(s.gi)}.`)
  reasons.push('영양성분 정보가 없어 원재료와 식품유형으로 추정했어요. 성분표를 찍으면 정확해져요.')
  return {
    score: null, level: '추정', range: { min: glToScore(glLo), max: glToScore(glHi) }, servingGrams: g, servingBasis: sBasis, servingNote: sNote,
    gl: { min: pyRound(glLo, 1), mid: null, max: pyRound(glHi, 1) }, hiddenCarbGrams: null, hiddenShare: null, lowSugarLabel: null,
    breakdown, basis: 'ingredients_only', reasons,
  }
}

const STOP = new Set(['소스', '용', '맛', '제로', '저당', '슈가', '프리', '골드', '프리미엄', '오리지널', 'kg', 'g', 'ml'])
const TOKEN_KEYS = ['비빔', '불고기', '데리야끼', '바베큐', '돈까스', '떡볶이', '짜장', '카레', '칠리', '마라', '간장', '고추장', '굴', '스테이크', '케첩', '마요', '드레싱', '파스타', '토마토', '크림', '갈비']
function nameTokens(name) {
  const toks = String(name ?? '').match(/[가-힣]{2,}|[a-zA-Z]{3,}/g) || []
  const out = new Set()
  for (const t of toks) {
    if (STOP.has(t)) continue
    out.add(t)
    for (const k of TOKEN_KEYS) if (t.includes(k)) out.add(k)
  }
  return out
}
function similarity(a, b) {
  const ta = nameTokens(a.name)
  const tb = nameTokens(b.name)
  const inter = [...ta].filter((x) => tb.has(x)).length
  const nameSim = inter / Math.max(1, new Set([...ta, ...tb]).size)
  const ia = new Set((a.ingredients || []).slice(0, 5))
  const ib = new Set((b.ingredients || []).slice(0, 5))
  const ii = [...ia].filter((x) => ib.has(x)).length
  const ingSim = ii / Math.max(1, new Set([...ia, ...ib]).size)
  return 0.6 * nameSim + 0.4 * ingSim
}

/* ---------------- analyze.py ---------------- */
const FAMILY = {
  '고추장·비빔장': ['고추장', '비빔장', '쌈장', '초장', '볶음고추장'],
  '간장·데리야끼·불고기': ['데리야끼', '불고기', '굴소스', '제육', '돈카츠', '돈까스', '갈비양념', '갈비소스'],
  '토마토·케찹·바비큐': ['케찹', '케첩', '토마토', '바비큐', '바베큐', '파스타'],
  '매운 소스': ['핫소스', '칠리', '숯불매콤', '마라'],
  드레싱: ['드레싱', '마요'],
  떡볶이: ['떡볶이'],
  '팝콘·과자': ['팝콘', '과자', '쿠키', '웨하스', '칩'],
  '초콜릿·캔디': ['초코', '캔디', '젤리', '구미'],
}
export function familyOf(p) {
  const name = String(p.name ?? '').replace(/ /g, '')
  for (const [fam, words] of Object.entries(FAMILY)) if (words.some((w) => name.includes(w))) return fam
  return null
}

export function hiddenPer100(p) {
  const n = p.per100g || {}
  if (n.carb == null) return null
  const sw = Object.values(n.sweeteners || {}).reduce((a, v) => a + (v || 0), 0)
  return pyRound(Math.max(0, n.carb - (n.sugar || 0) - (n.fiber || 0) - sw), 1)
}

// 'user_checked' = 사용자가 사진에서 읽은 숫자를 직접 확인한 값 (프론트에서만 씀)
const TRUSTED = ['label', 'verified', 'user_checked']
const isTrusted = (p) => TRUSTED.includes(p.nutritionSource) && !needsCheck(p)

export function needsCheck(p) {
  const n = p.per100g || {}
  if (n.carb == null || Object.keys(n.sweeteners || {}).length) return false
  const text = [...(p.frontClaims || []), ...(p.ingredientsFlat || p.ingredients || []), p.name].map(String).join(' ').toLowerCase()
  const mentions = ['알룰로스', 'allulose', '말티톨', '에리스리톨', '당알코올', '이소말트'].some((w) => text.includes(w))
  return mentions && (hiddenPer100(p) || 0) > 8
}

function scoreStatus(p) {
  const src = p.nutritionSource
  if (needsCheck(p)) return ['needs_check', '감미료 함량을 읽지 못한 값이 있어 점수 대신 확인된 성분과 주의 정보만 보여드려요.']
  if (TRUSTED.includes(src)) return ['scored', '']
  if (src === 'photo_ai') return ['unverified', '사진에서 AI가 읽은 값은 아직 검수 전이라 점수 계산에 쓰지 않았어요. 확인된 성분과 주의 정보만 보여드려요.']
  if (src === 'estimated') return ['estimated', '영양성분이 표시되지 않아 비슷한 제품으로 추정한 참고값이에요. 점수 계산에는 쓰지 않았어요. 성분표를 찍으면 정확해져요.']
  return ['ingredients_only', '영양성분 정보가 없어 점수 대신 원재료로 확인된 성분과 주의 정보만 보여드려요.']
}

export function publicView(p) {
  const keys = ['id', 'name', 'barcode', 'category', 'maker', 'manufacturer', 'source', 'per100g', 'ingredients', 'frontClaims', 'servingSize', 'nutritionSource', 'images']
  const out = {}
  for (const k of keys) {
    const v = p[k]
    const empty = v == null || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && !Array.isArray(v) && !Object.keys(v).length)
    if (!empty) out[k] = v
  }
  out.nutritionEstimated = p.nutritionSource === 'estimated'
  out.needsCheck = needsCheck(p)
  return out
}

const GOOD_ENOUGH = 4.0
const MIN_GAIN = 2.0

export function findAlternatives(p, grams, products, k = 3) {
  const trusted = isTrusted(p)
  const baseH = trusted ? hiddenPer100(p) : null
  if (baseH != null && baseH < GOOD_ENOUGH) return []
  const fam = familyOf(p)
  const baseScore = calculateScore(p, grams)
  const g = baseScore.servingGrams
  const cands = []
  for (const q of products || []) {
    if (q === p || (q.barcode && q.barcode === p.barcode)) continue
    const qh = hiddenPer100(q)
    if (qh == null || !isTrusted(q)) continue
    if (String(q.name).includes('덮밥') !== String(p.name).includes('덮밥')) continue
    let sim = null
    if (fam) {
      if (familyOf(q) !== fam) continue
    } else {
      if (p.category && q.category && p.category !== q.category) continue
      sim = similarity(p, q)
      if (sim < 0.2) continue
    }
    if (baseH != null && qh > baseH - MIN_GAIN) continue
    const r = calculateScore(q, g)
    if (trusted && baseH == null && baseScore.score != null && (r.score || 0) >= baseScore.score) continue
    if (!trusted && qh >= GOOD_ENOUGH) continue
    const why = [baseH != null ? `숨은 탄수화물 100g당 ${baseH}g → ${qh}g` : `같은 계열에서 검수된 값 기준 숨은 탄수화물 100g당 ${qh}g`]
    const zeros = r.breakdown.filter((b) => b.kind === 'zero').map((b) => b.ingredient)
    if (zeros.length) why.push(`${zeros.slice(0, 2).join(', ')} 사용`)
    const sw = q.per100g?.sweeteners || {}
    if (sw.allulose && !zeros.includes('알룰로스')) why.push(`알룰로스 ${sw.allulose}g(혈당 영향 거의 없음)`)
    cands.push({
      id: q.id, name: q.name, barcode: q.barcode ?? null, hiddenCarbPer100g: qh, score: r.score, level: r.level,
      nutritionEstimated: q.nutritionSource === 'estimated',
      reason: why.join(' · ') || '같은 계열에서 혈당 부담이 더 낮아요',
      _sort: [q.nutritionSource === 'estimated' ? 1 : 0, qh, -(sim || 0)],
    })
  }
  cands.sort((a, b) => a._sort[0] - b._sort[0] || a._sort[1] - b._sort[1] || a._sort[2] - b._sort[2])
  return cands.slice(0, k).map(({ _sort, ...c }) => c) // eslint-disable-line no-unused-vars
}

export function analyze(p, grams, products) {
  const r = calculateScore(p, grams)
  const n = p.per100g || {}
  const sw = n.sweeteners || {}
  if (n.carb && Object.keys(sw).length) {
    const names = { allulose: '알룰로스', sugar_alcohol: '당알코올' }
    const parts = Object.entries(sw).filter(([, v]) => v).map(([k, v]) => `${names[k] || k} ${v}g`)
    r.reasons.push(`탄수화물 ${n.carb}g(100g당) 중 ${parts.join(', ')}은(는) 혈당을 거의 올리지 않거나 적게 올려서 계산에서 따로 봤어요.`)
  }
  const polyols = [
    ...r.breakdown.filter((b) => b.kind === 'polyol').map((b) => b.ingredient),
    ...r.breakdown.filter((b) => b.ingredient === '에리스리톨' || b.ingredient === '만니톨').map((b) => b.ingredient),
  ]
  if (polyols.length || sw.sugar_alcohol) {
    const who = polyols.length ? `${polyols.slice(0, 2).join(', ')} 같은 당알코올은` : '당알코올이 들어 있어서'
    r.reasons.push(`${who} 한 번에 많이 먹으면 배가 아프거나 설사를 할 수 있어요. 처음엔 1회 섭취량만큼만 드셔 보세요.`)
    r.caution = '당알코올 과량 섭취 시 배탈 주의'
  }
  const [status, note] = scoreStatus(p)
  r.scoreStatus = status
  r.scoreNote = note
  if (status !== 'scored') {
    for (const k of ['score', 'level', 'range', 'gl', 'hiddenCarbGrams', 'hiddenShare']) r[k] = null
    r.reasons = r.reasons.filter((x) => !x.includes('혈당 부담의 약'))
    r.reasons.unshift(note)
  }
  const h = status === 'scored' ? hiddenPer100(p) : null
  return {
    product: publicView(p),
    family: familyOf(p),
    goodChoice: h != null && h < GOOD_ENOUGH,
    hiddenCarbPer100g: h,
    nutritionValuesUnverified: ['unverified', 'estimated', 'needs_check'].includes(status),
    result: r,
    alternatives: findAlternatives(p, grams, products),
  }
}
