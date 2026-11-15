import { useCallback, useEffect, useState } from 'react'
import { analyzeById, analyzeChecked } from './api/client'
import { cacheAnalysis, getCachedAnalysis, getHistory } from './lib/storage'

/** 분석 결과 찾기: 캐시 → (직접 확인한 제품이면) 다시 계산 → 서버 */
export function useAnalysis(id) {
  const [state, setState] = useState(() => {
    const a = id ? getCachedAnalysis(id) : null
    return { a, loading: !a && !!id, error: null }
  })

  const load = useCallback(async () => {
    if (!id) return
    const cached = getCachedAnalysis(id)
    if (cached) return setState({ a: cached, loading: false, error: null })
    const h = getHistory().find((x) => x.id === id)
    if (h?.local) {
      const a = analyzeChecked(h.local, null, h.alternatives || [])
      cacheAnalysis(a)
      return setState({ a, loading: false, error: null })
    }
    setState({ a: null, loading: true, error: null })
    try {
      const a = await analyzeById(id)
      cacheAnalysis(a)
      setState({ a, loading: false, error: null })
    } catch (e) {
      setState({ a: null, loading: false, error: e })
    }
  }, [id])

  useEffect(() => {
    load()
  }, [load])

  return { ...state, reload: load }
}
