import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { compareProducts } from '../api/client'
import { addToCart, clearCart, getCart, MAX_COMPARE, removeFromCart } from '../lib/compareCart'
import { getHistory } from '../lib/storage'
import { shortMaker } from '../lib/format'
import { getVerdict } from '../lib/verdict'
import { Disclaimer, ErrorView, LevelPill, Page, Spinner } from '../components/ui'
import ServingSelector from '../components/ServingSelector'

const OPTIONS = [
  { key: 'g15', label: '15g', sub: '소스 1스푼', grams: 15 },
  { key: 'g30', label: '30g', sub: '과자 1회', grams: 30 },
  { key: 'g100', label: '100g', sub: '표시 기준', grams: 100 },
]
const r1 = (n) => Math.round(n * 10) / 10

/** 가장 큰 혈당 요인: 영향 '높음' 원료 중 원재료 순서가 앞선 것 */
function topFactor(result) {
  const b = (result?.breakdown || []).filter((x) => x.impactKey === 'high' || x.kind === 'polyol')
  return b.sort((x, y) => (x.rank ?? 99) - (y.rank ?? 99))[0]?.ingredient || null
}

export default function Compare() {
  const nav = useNavigate()
  const [cart, setCart] = useState(getCart)
  const [sel, setSel] = useState({ preset: 'g30', grams: 30 })
  const [state, setState] = useState({ rows: null, loading: false, error: null })
  const [retry, setRetry] = useState(0)

  useEffect(() => {
    if (cart.length < 2) return
    let alive = true
    setState((s) => ({ ...s, loading: true, error: null }))
    compareProducts(cart, sel.grams)
      .then((rows) => alive && setState({ rows, loading: false, error: null }))
      .catch((e) => alive && setState((s) => ({ ...s, loading: false, error: e })))
    return () => {
      alive = false
    }
  }, [cart, sel.grams, retry])

  const remove = (id) => {
    removeFromCart(id)
    setCart(getCart())
  }

  if (cart.length < 2) {
    const history = getHistory().filter((h) => !cart.some((c) => c.id === h.id))
    return (
      <Page title="같은 양 비교">
        <section className="card">
          <p className="card-title">제품을 2개 이상 담아주세요</p>
          <p className="muted small">결과 화면의 '비교에 담기'로 최대 {MAX_COMPARE}개까지 담을 수 있어요. 모두 같은 양으로 다시 계산해서 혈당 부담 순으로 보여드려요.</p>
          {cart.length === 1 && <p className="cart-one">담긴 제품: <b>{cart[0].name}</b></p>}
        </section>
        <Link className="btn btn-primary" to="/scan">찍어서 담기</Link>
        {history.length > 0 && (
          <section className="section">
            <div className="section-head"><h2>최근 확인한 제품에서 담기</h2></div>
            <ul className="list">
              {history.map((h) => (
                <li key={h.id}>
                  <button className="list-item" onClick={() => { addToCart({ id: h.id, name: h.name, local: h.local || null }); setCart(getCart()) }}>
                    <div className="li-main"><b>{h.name}</b><span>{shortMaker(h.maker) || h.category || ' '}</span></div>
                    <span className="add-chip">+ 담기</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}
      </Page>
    )
  }

  // 정렬: 점수 있는 제품(GL 낮은 순) → 점수 보류 제품
  const gl = (a) => (a.scored ? a.result.gl?.mid ?? a.result.score / 4 : null)
  const rows = state.rows ? [...state.rows].sort((x, y) => (gl(x) ?? 1e9) - (gl(y) ?? 1e9)) : null
  const maxGl = Math.max(0.1, ...(rows || []).map((x) => (x.scored ? x.result.gl?.max ?? gl(x) : 0)))
  const lowestId = rows?.find((x) => x.scored)?.product.id

  return (
    <Page title="같은 양 비교" right={<button className="link-btn" onClick={() => { clearCart(); setCart([]) }}>비우기</button>}>
      <section className="card serving-card">
        <p className="serving-sentence">담은 {cart.length}개를 모두 <b>{sel.grams}g</b> 기준으로 다시 계산했어요</p>
        <ServingSelector options={OPTIONS} preset={sel.preset} grams={sel.grams} onChange={setSel} />
      </section>

      {state.error && !rows && <ErrorView error={state.error} title="비교하지 못했어요" onRetry={() => setRetry((r) => r + 1)} />}
      {!rows && state.loading && <div className="center pad"><Spinner /></div>}

      {rows && (
        <ol className={`rank-list ${state.loading ? 'is-updating' : ''}`}>
          {rows.map((a, i) => {
            const { product, result } = a
            const v = getVerdict(a)
            const g = gl(a)
            return (
              <li key={product.id} className={`rank-item lv-${a.scored ? result.levelKey || 'none' : 'none'}`}>
                <div className="ri-head">
                  <span className="ri-rank">{a.scored ? i + 1 : '–'}</span>
                  <button className="ri-name" onClick={() => nav(`/result/${encodeURIComponent(product.id)}`)}>{product.name}</button>
                  <button className="icon-btn del" aria-label={`${product.name} 빼기`} onClick={() => remove(product.id)}>×</button>
                </div>
                {a.scored ? (
                  <>
                    <div className="ri-score">
                      <strong>{result.score}</strong><span>점</span>
                      <LevelPill level={result.level} levelKey={result.levelKey} />
                      {product.id === lowestId && <span className="best-chip">가장 낮음</span>}
                      {v?.key === 'fake' && <span className="fake-chip">가짜 저당 의심</span>}
                    </div>
                    <div className="ri-bar" aria-hidden>
                      <i className={`lv-${result.levelKey || 'none'}`} style={{ width: `${((g || 0) / maxGl) * 100}%` }} />
                    </div>
                    <dl className="ri-dl">
                      <div><dt>혈당부하(GL)</dt><dd>{g != null ? r1(g) : '-'}</dd></div>
                      <div><dt>숨은 탄수화물</dt><dd>{result.hiddenCarbGrams != null ? `${r1(result.hiddenCarbGrams)}g` : '-'}</dd></div>
                      <div><dt>당류</dt><dd>{product.per100g?.sugar != null ? `${r1((product.per100g.sugar * sel.grams) / 100)}g` : '-'}</dd></div>
                      <div className="wide"><dt>가장 큰 요인</dt><dd>{topFactor(result) || '숨은 원료 없음'}</dd></div>
                    </dl>
                  </>
                ) : (
                  <p className="ri-pending">{v?.label} · 점수 없이 비교에서 빠졌어요{topFactor(result) ? ` (주의 원료: ${topFactor(result)})` : ''}</p>
                )}
              </li>
            )
          })}
        </ol>
      )}
      <p className="muted small">막대 길이는 혈당부하(GL)에 비례해요. 검수되지 않은 값은 점수 없이 아래에 둬요.</p>
      {cart.length < MAX_COMPARE && <Link className="btn btn-ghost" to="/scan">제품 더 담기</Link>}
      <Disclaimer />
    </Page>
  )
}
