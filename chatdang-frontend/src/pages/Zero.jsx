import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { analyzeBarcode } from '../api/client'
import { ZERO_SET } from '../config'
import { cacheAnalysis } from '../lib/storage'
import { getVerdict } from '../lib/verdict'
import { hiddenPer100 } from '../lib/engine'
import { Disclaimer, ErrorView, Page, Spinner } from '../components/ui'

const r1 = (n) => Math.round(n * 10) / 10
const CLAIM_RE = /제로|zero|설탕|저당|sugar|슈가|당류/i

/** 시연: 같은 '제로·저당' 표시인데 숨은 탄수화물은 제각각 */
export default function Zero() {
  const nav = useNavigate()
  const [rows, setRows] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setError(null)
    setRows(null)
    const res = await Promise.allSettled(ZERO_SET.map((b) => analyzeBarcode(b)))
    const ok = res.filter((r) => r.status === 'fulfilled').map((r) => r.value)
    ok.forEach(cacheAnalysis)
    if (!ok.length) setError(res.find((r) => r.status === 'rejected')?.reason)
    setRows(ok)
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const max100 = Math.max(10, ...(rows || []).map((a) => a.hiddenCarbPer100g ?? hiddenPer100(a.product) ?? 0))

  return (
    <Page title="같은 '제로', 다른 결과">
      <h1 className="zero-title">'제로'·'저당' 표시는 같아도<br /><em>숨은 탄수화물</em>은 달라요</h1>
      <p className="muted">숨은 탄수화물 = 당류로 표시되지 않지만 혈당을 올리는 전분·당알코올 등 (100g당)</p>

      {error && <ErrorView error={error} onRetry={load} />}
      {!rows && !error && <div className="center pad"><Spinner /></div>}

      {rows && (
        <ul className="zero-list">
          {rows.map((a) => {
            const v = getVerdict(a)
            const claim = (a.product.frontClaims || []).find((c) => CLAIM_RE.test(c)) || (/제로/.test(a.product.name) ? '제로' : '')
            const h = a.hiddenCarbPer100g
            return (
              <li key={a.product.id}>
                <button className={`zero-row v-${v.key}`} onClick={() => { cacheAnalysis(a); nav(`/result/${encodeURIComponent(a.product.id)}`) }}>
                  <div className="zr-head">
                    <span className="chip chip-claim">{claim ? `'${claim}'` : '표시 없음'}</span>
                    <span className="vh-badge sm">{v.key === 'match' ? '진짜' : v.key === 'pending' ? 'AI 값 · 확인 전' : v.label}</span>
                  </div>
                  <b className="zr-name">{a.product.name}</b>
                  {a.scored ? (
                    <>
                      <div className="zr-bar"><i style={{ width: `${Math.max(2, ((h ?? 0) / max100) * 100)}%` }} className={v.key === 'match' ? 'ok' : ''} /></div>
                      <p className="zr-num">숨은 탄수화물 <b>100g당 {r1(h ?? 0)}g</b>{a.result.servingGrams ? ` · ${a.result.servingGrams}g 먹으면 ${r1(a.result.hiddenCarbGrams ?? 0)}g` : ''}</p>
                    </>
                  ) : hiddenPer100(a.product) != null ? (
                    <>
                      <div className="zr-bar"><i className="pending" style={{ width: `${Math.max(2, (hiddenPer100(a.product) / max100) * 100)}%` }} /></div>
                      <p className="zr-num">AI가 읽은 숫자로는 숨은 탄수화물 <b>100g당 약 {r1(hiddenPer100(a.product))}g</b> <span className="muted">(확인 전 · 점수 보류)</span></p>
                    </>
                  ) : (
                    <p className="zr-num muted">{v.desc}</p>
                  )}
                  {a.result.caution && <p className="zr-caution">🚻 {a.result.caution}</p>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
      <Disclaimer />
    </Page>
  )
}
