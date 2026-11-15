import { cacheAnalysis } from './storage'
import { addToCart } from './compareCart'

/** 분석 결과 화면으로 (비교 담기 모드면 담고 비교 화면으로) */
export function openAnalysis(nav, a, { compareWith, replace = false } = {}) {
  cacheAnalysis(a)
  if (compareWith) {
    addToCart({ id: a.product.id, name: a.product.name, local: a.localProduct || null })
    nav('/compare', { replace })
    return
  }
  nav(`/result/${encodeURIComponent(a.product.id)}`, { replace })
}

export function withCompare(path, compareWith) {
  if (!compareWith) return path
  return `${path}${path.includes('?') ? '&' : '?'}compareWith=${encodeURIComponent(compareWith)}`
}
