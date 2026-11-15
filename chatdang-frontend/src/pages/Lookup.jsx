import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { analyzeBarcode } from '../api/client'
import { openAnalysis, withCompare } from '../lib/nav'
import { ErrorView, Loading, Page } from '../components/ui'

/** /p/:barcode → 제품 조회 → 결과 화면 (못 찾으면 바로 성분표 촬영) */
export default function Lookup() {
  const { barcode } = useParams()
  const [sp] = useSearchParams()
  const compareWith = sp.get('compareWith')
  const nav = useNavigate()
  const [error, setError] = useState(null)

  const run = useCallback(async () => {
    setError(null)
    try {
      const a = await analyzeBarcode(barcode)
      if (a.needPhoto) {
        nav(withCompare(`/scan?mode=label&barcode=${encodeURIComponent(barcode)}&notfound=1`, compareWith), { replace: true })
        return
      }
      openAnalysis(nav, a, { compareWith, replace: true })
    } catch (e) {
      if (e.kind === 'needPhoto') {
        nav(withCompare(`/scan?mode=label&barcode=${encodeURIComponent(barcode)}&notfound=1`, compareWith), { replace: true })
        return
      }
      setError(e)
    }
  }, [barcode, compareWith, nav])

  useEffect(() => {
    run()
  }, [run])

  return (
    <Page title="제품 찾기">
      {error ? (
        <ErrorView error={error} onRetry={run}>
          <Link className="btn btn-ghost" to={withCompare(`/scan?mode=label&barcode=${encodeURIComponent(barcode)}`, compareWith)}>성분표 찍기</Link>
          <Link className="btn btn-ghost" to="/">홈으로</Link>
        </ErrorView>
      ) : (
        <Loading title="제품 정보를 찾고 있어요" steps={[`바코드 ${barcode}`, '공공 데이터에서 찾는 중']} />
      )}
    </Page>
  )
}
