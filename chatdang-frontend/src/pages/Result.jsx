import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { analyzeById, analyzeChecked } from '../api/client'
import { useAnalysis } from '../hooks'
import { cacheAnalysis, saveHistory } from '../lib/storage'
import { BASIS_LABEL, servingPresets, servingSentence, shortMaker, sourceLabel } from '../lib/format'
import { addToCart, getCart, inCart, MAX_COMPARE } from '../lib/compareCart'
import { Disclaimer, ErrorView, Loading, Page } from '../components/ui'
import ServingSelector from '../components/ServingSelector'
import { AltCard, Breakdown, EstimatedBanner, GutWarning, HiddenCarbs, Reasons, ScoreCard, Summary } from '../components/result'

export default function Result() {
  const { id } = useParams()
  const nav = useNavigate()
  const { a: loaded, loading, error, reload } = useAnalysis(id)
  const [a, setA] = useState(loaded)
  const [sel, setSel] = useState({ preset: 'serving', grams: null })
  const [defaultGrams, setDefaultGrams] = useState(null)
  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState(null)
  const [cartMsg, setCartMsg] = useState('')
  const [cartTick, setCartTick] = useState(0)
  const reqRef = useRef(0)
  const altRef = useRef(null)
  const detailRef = useRef(null)

  // 처음 불러온 결과 = 1인분(서버 기본 1회 섭취량)
  useEffect(() => {
    if (!loaded) return
    setA(loaded)
    setSel({ preset: 'serving', grams: null })
    setDefaultGrams(loaded.result?.servingGrams ?? null)
    saveHistory(loaded)
    window.scrollTo(0, 0)
  }, [loaded])

  // 먹는 양을 바꾸면 다시 계산 (서버: /api/products/{id}?grams= , 직접 확인한 제품: 같은 계산식으로 바로)
  const changeServing = ({ preset, grams }) => {
    setSel({ preset, grams })
    if (!a) return
    const g = preset === 'serving' ? null : grams
    const my = ++reqRef.current
    setUpdateError(null)
    if (a.local && a.localProduct) {
      const next = analyzeChecked(a.localProduct, g, a.alternatives)
      setA(next)
      cacheAnalysis(next)
      return
    }
    setUpdating(true)
    analyzeById(a.product.id, g)
      .then((next) => {
        if (my !== reqRef.current) return
        setA(next)
      })
      .catch((e) => my === reqRef.current && setUpdateError(e))
      .finally(() => my === reqRef.current && setUpdating(false))
  }

  if (loading) return <Page title="분석 결과"><Loading title="분석 결과를 불러오고 있어요" /></Page>
  if (error || !a)
    return (
      <Page title="분석 결과">
        <ErrorView error={error || { message: '제품 정보를 찾지 못했어요.', kind: 'notfound' }} onRetry={reload}>
          <Link className="btn btn-ghost" to="/scan">다시 찍기</Link>
        </ErrorView>
      </Page>
    )

  const { product, result } = a
  const grams = result?.servingGrams ?? sel.grams ?? defaultGrams
  const basis = result?.servingBasis
  const photoUrl = `/scan?mode=label${product.barcode ? `&barcode=${encodeURIComponent(product.barcode)}` : ''}`
  const checkUrl = `/confirm?id=${encodeURIComponent(product.id)}`
  const presets = [
    ...servingPresets(product),
    { key: 'serving', label: '1인분', sub: defaultGrams ? `${defaultGrams}g` : '기본', grams: defaultGrams },
  ]
  const presetLabel = presets.find((o) => o.key === sel.preset)?.label
  const scroll = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <Page
      title="분석 결과"
      onBack={() => nav('/')}
      footer={
        <div className="footer-actions">
          {inCart(product.id) ? (
            <Link className="btn btn-ghost" to="/compare">비교 보기 ({getCart().length})</Link>
          ) : (
            <button
              className="btn btn-ghost"
              onClick={() => {
                const ok = addToCart({ id: product.id, name: product.name, local: a.localProduct || null })
                setCartMsg(ok ? `비교에 담았어요 (${getCart().length}/${MAX_COMPARE})` : `비교는 ${MAX_COMPARE}개까지 담을 수 있어요`)
                setCartTick((t) => t + 1)
              }}
            >
              비교에 담기
            </button>
          )}
          <Link className="btn btn-primary" to="/scan">다른 제품 찍기</Link>
        </div>
      }
    >
      <header className="product-head">
        <p className="ph-meta">{[product.category, shortMaker(product.maker)].filter(Boolean).join(' · ')}</p>
        <h2 className="ph-name">{product.name}</h2>
        <div className="chips">
          {product.nutritionSource && <span className="src-chip">영양성분: {sourceLabel(product.nutritionSource)}</span>}
          {product.isEstimated && <span className="est-chip">추정</span>}
          {product.needsCheck && <span className="est-chip warn">확인 필요</span>}
        </div>
      </header>

      <Summary
        a={a}
        grams={grams}
        updating={updating}
        onAlts={() => scroll(altRef)}
        onDetail={() => scroll(detailRef)}
        onCheck={() => nav(checkUrl)}
        onPhoto={() => nav(photoUrl)}
      />

      {a.scored && (
        <section className="card serving-card">
          <p className="serving-sentence">
            {servingSentence({ preset: sel.preset, presetLabel, grams, result, product })}
            {sel.preset === 'serving' && basis && BASIS_LABEL[basis] && <span className={`basis-chip b-${basis}`}>{BASIS_LABEL[basis]}</span>}
          </p>
          {sel.preset === 'serving' && result.servingNote && <p className="serving-note">{result.servingNote}</p>}
          <ServingSelector options={presets} preset={sel.preset} grams={sel.grams} onChange={changeServing} />
          {updateError && (
            <p className="inline-error">
              점수를 갱신하지 못했어요. <button className="link-btn" onClick={() => changeServing(sel)}>다시 시도</button>
            </p>
          )}
        </section>
      )}

      <EstimatedBanner a={a} onPhoto={() => nav(photoUrl)} />

      <section className="section" ref={altRef}>
        <div className="section-head">
          <h2>{a.goodChoice ? '이미 좋은 선택이에요' : '같은 계열 대체품'}</h2>
          {grams && a.alternatives.length > 0 ? <span className="muted small">같은 {grams}g 기준 점수</span> : null}
        </div>
        {a.goodChoice ? (
          <p className="empty">숨은 탄수화물이 100g당 4g 미만이라 바꿀 필요가 없어요.</p>
        ) : a.alternatives.length === 0 ? (
          <p className="empty">같은 계열에서 검수된 값으로 더 나은 제품을 아직 찾지 못했어요. 이 제품은 먹는 양을 조절하는 게 좋아요.</p>
        ) : (
          <div className="alt-list">
            {a.alternatives.map((alt) => (
              <AltCard key={alt.id} alt={alt} onOpen={() => nav(`/result/${encodeURIComponent(alt.id)}`)} />
            ))}
          </div>
        )}
      </section>

      <div ref={detailRef} className="detail-anchor" />
      {a.scored && <ScoreCard result={result} />}
      <Reasons reasons={result.reasons} />
      <HiddenCarbs a={a} grams={grams} />
      <Breakdown items={result.breakdown} />
      <GutWarning a={a} grams={grams} />
      {(a.local || product.nutritionSource === 'photo_ai') && (
        <Link className="btn btn-ghost" to={checkUrl}>{a.local ? '확인한 숫자 고치기' : '읽은 숫자 확인하기'}</Link>
      )}

      <Disclaimer />
      {cartMsg && <div className="toast" key={cartTick} onAnimationEnd={() => setCartMsg('')}>{cartMsg}</div>}
    </Page>
  )
}

