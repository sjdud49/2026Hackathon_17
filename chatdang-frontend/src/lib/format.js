import { SPOON_G } from '../config'

export const MISSING_LABEL = {
  carb: '탄수화물',
  sugar: '당류',
  fiber: '식이섬유',
  sweeteners: '감미료 함량',
  ingredients: '원재료명',
  servingSize: '1회 제공량',
}

export const SOURCE_LABEL = {
  label: '공공데이터 표시값',
  verified: '실물 라벨 검수',
  photo_ai: 'AI가 사진에서 읽음',
  estimated: 'AI 추정',
  user_checked: '직접 확인한 값',
  foodqr: '푸드QR',
  haccp: 'HACCP',
  c002: '식품안전나라',
}
export function sourceLabel(src) {
  if (!src) return ''
  return String(src)
    .split('+')
    .map((s) => SOURCE_LABEL[s] || s)
    .join(' + ')
}

export const BASIS_LABEL = {
  label: '포장지 기준',
  serving: '포장지 기준',
  reference: '식약처 참고량',
  default: '기본값',
  ai_estimate: 'AI 추정',
}

export function fmtG(n) {
  if (n == null || !Number.isFinite(n)) return '-'
  return `${Math.round(n * 10) / 10}g`
}

export function scoreText(r) {
  if (!r) return '-'
  if (r.range && r.range.min !== r.range.max) return `${r.range.min}~${r.range.max}`
  if (r.score != null) return String(r.score)
  return '?'
}

/**
 * 사용량 설명 문구
 * preset: 'spoon1' | 'spoon2' | 'serving' | 'custom'
 */
/** 제품 유형에 맞는 먹는 양 버튼 */
export function servingPresets(product) {
  const t = `${product?.name || ''} ${product?.category || ''}`
  if (/음료|콜라|사이다|탄산|주스|에이드|우유|라떼|두유|커피|차음료|워터|ml/i.test(t))
    return [{ key: 'cup', label: '한 컵', sub: '200mL', grams: 200 }, { key: 'bottle', label: '한 병', sub: '500mL', grams: 500 }]
  if (/소스|양념|장|드레싱|케첩|케찹|마요|시럽|잼|청/.test(t))
    return [{ key: 'spoon1', label: '한 스푼', sub: '15g', grams: 15 }, { key: 'spoon2', label: '두 스푼', sub: '30g', grams: 30 }]
  return [{ key: 'snack1', label: '조금', sub: '15g', grams: 15 }, { key: 'snack2', label: '넉넉히', sub: '60g', grams: 60 }]
}

export function servingSentence({ preset, presetLabel, grams, result, product }) {
  const g = Math.round(grams * 10) / 10
  if (presetLabel && preset !== 'serving' && preset !== 'custom') return `${presetLabel}(약 ${g}${/cup|bottle/.test(preset) ? 'mL' : 'g'}) 기준으로 계산했어요`
  if (preset === 'spoon1') return `한 스푼(약 ${SPOON_G}g) 기준으로 계산했어요`
  if (preset === 'spoon2') return `두 스푼(약 ${SPOON_G * 2}g) 기준으로 계산했어요`
  if (preset === 'custom') return `직접 입력한 ${g}g 기준으로 계산했어요`
  const basis = result?.servingBasis || product?.servingSize?.basis
  if (basis === 'label' || basis === 'serving') return `포장지 1회 제공량(${g}g) 기준으로 계산했어요`
  if (basis === 'reference') return `식약처 1회 섭취참고량(${g}g) 기준으로 계산했어요`
  if (basis === 'ai_estimate') return `AI가 추정한 ${g}g 기준으로 계산했어요`
  if (basis === 'default') return `기본값 ${g}g 기준이에요. 실제 먹는 양으로 바꿔보세요`
  return `${g}g 기준으로 계산했어요`
}

export function shortMaker(m) {
  return String(m || '').split('(')[0].trim()
}

export function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return '방금'
  if (s < 3600) return `${Math.floor(s / 60)}분 전`
  if (s < 86400) return `${Math.floor(s / 3600)}시간 전`
  return `${Math.floor(s / 86400)}일 전`
}

/** 포장지 이미지 http → https (혼합 콘텐츠 차단 방지) */
export function safeImage(url) {
  if (!url) return null
  return String(url).replace(/^http:\/\//, 'https://')
}
