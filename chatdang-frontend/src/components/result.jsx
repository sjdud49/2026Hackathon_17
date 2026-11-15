import { useState } from 'react'
import { LEVEL_LABEL } from '../api/normalize'
import { EXPLAIN } from '../lib/engine'
import { getGutWarning, getVerdict } from '../lib/verdict'
import { scoreText } from '../lib/format'
import { LevelPill, Spinner } from './ui'

const r1 = (n) => Math.round(n * 10) / 10
const CLAIM_RE = /저당|무당|제로|zero|sugar|슈가|슈거|당류|설탕|low|저칼로리|칼로리|알룰로/i
const firstClaim = (product) =>
  (product.frontClaims || []).find((c) => CLAIM_RE.test(c)) || (/제로|zero/i.test(product.name) ? '제로' : /저당/.test(product.name) ? '저당' : null)

/* ================= 첫 화면 요약 ================= */
/**
 * 5초 안에 판단하도록: 판정 배지 → 한 줄 결론 → 숫자 3개 → 먹어도 되는 양·배탈 기준 → [대체품 보기]
 */
export function Summary({ a, grams, onAlts, onDetail, onCheck, onPhoto, updating }) {
  const { product, result } = a
  const v = getVerdict(a)
  const per = product.per100g || {}
  const k = grams ? grams / 100 : null
  const claim = firstClaim(product)
  const h100 = a.hiddenCarbPer100g
  const sw = per.sweeteners || {}
  const polyol100 = Number(sw.sugar_alcohol ?? 0) || 0
  const altCount = a.alternatives.length

  if (v?.key === 'pending') return <PendingSummary a={a} v={v} grams={grams} onCheck={onCheck} onPhoto={onPhoto} onAlts={onAlts} />

  let headline
  if (v.key === 'fake')
    headline = <>{claim ? `'${claim}'` : '저당 표시'}인데<br />숨은 탄수화물 <em>100g당 {r1(h100 ?? 0)}g</em></>
  else if (v.key === 'partial')
    headline = <>{claim ? `'${claim}'` : '저당'}은 맞지만<br />부담의 <em>{Math.round((v.share ?? 0) * 100)}%</em>가 숨은 원료</>
  else if (v.key === 'match')
    headline = (h100 ?? 0) < 0.5
      ? <>{claim ? `'${claim}'` : '표시'} 그대로,<br />숨은 탄수화물 <em className="good">0g</em></>
      : <>{claim ? `'${claim}'` : '표시'} 그대로,<br />숨은 탄수화물 <em className="good">{r1(h100 ?? 0)}g</em>뿐</>
  else headline = <>혈당 부담 <em>{result.level || '확인 필요'}</em></>

  // 먹어도 되는 양: GL은 먹는 양에 비례 → '낮음'(점수 40 이하) 유지 최대량
  const tips = []
  if (result.score > 0 && grams && !result.range) {
    const safe = Math.floor((grams * 40) / result.score)
    if (result.score > 40) tips.push({ icon: '⚖️', text: <>한 번에 <b>{safe}g 이하</b>로 먹으면 혈당 부담 '낮음'이에요</>, warn: true })
    else if (safe < 2000) tips.push({ icon: '⚖️', text: <><b>{safe}g</b>까지는 혈당 부담 '낮음'이에요 (지금 {grams}g)</> })
  }
  const gut = getGutWarning(product, result, grams, false)
  if (gut?.worst?.grams > 0 && grams) {
    const limitG = Math.round((grams * gut.worst.limit) / gut.worst.grams)
    tips.push({ icon: '🚻', text: <><b>{limitG}g</b> 넘게 먹으면 배탈이 날 수 있어요 (당알코올 {gut.worst.limit}g 기준)</>, warn: limitG <= grams * 2 })
  } else if (result.caution) tips.push({ icon: '🚻', text: result.caution, warn: true })

  return (
    <section className={`summary t-${v.key} ${updating ? 'is-updating' : ''}`}>
      <div className="sm-top">
        <span className="vh-badge">{v.label}</span>
        <span className={`sm-score lv-${result.levelKey || 'none'}`}>
          {result.score ?? scoreText(result)}<small>점</small> · {result.level || '-'}
          {updating && <Spinner size={14} />}
        </span>
      </div>
      <h2 className="sm-headline">{headline}</h2>
      <div className="sm-metrics">
        <div><span>숨은 탄수화물</span><b>{result.hiddenCarbGrams != null ? `${r1(result.hiddenCarbGrams)}g` : '-'}</b></div>
        <div><span>당알코올</span><b>{polyol100 > 0 && k ? `${r1(polyol100 * k)}g` : '-'}</b></div>
        <div><span>표시된 당류</span><b>{per.sugar != null && k ? `${r1(per.sugar * k)}g` : '-'}</b></div>
      </div>
      <p className="sm-basis">{grams ? `${grams}g 먹을 때 기준` : ''}{a.local && <span className="est-chip ok">직접 확인한 값</span>}</p>
      {tips.length > 0 && (
        <ul className="sm-tips">
          {tips.map((t, i) => <li key={i} className={t.warn ? 'warn' : ''}><i aria-hidden>{t.icon}</i><span>{t.text}</span></li>)}
        </ul>
      )}
      <div className="sm-actions">
        {a.goodChoice ? (
          <button className="btn btn-dark" disabled>이미 좋은 선택이에요</button>
        ) : (
          <button className="btn btn-dark" onClick={onAlts} disabled={altCount === 0}>
            {altCount > 0 ? `대체품 보기 (${altCount})` : '같은 계열 대체품 없음'}
          </button>
        )}
        <button className="btn btn-ghost" onClick={onDetail}>근거 자세히</button>
      </div>
    </section>
  )
}

/** 점수 보류 화면: 검수 전 값이라 점수 대신 '확인된 성분과 주의 정보' + 다음 행동 */
function PendingSummary({ a, v, grams, onCheck, onPhoto, onAlts }) {
  const { product, result } = a
  const claim = firstClaim(product)
  const risky = (result.breakdown || []).filter((b) => b.impactKey === 'high' || b.impactKey === 'mid' || b.kind === 'polyol')
  const canCheck = v.status === 'unverified' || v.status === 'needs_check'
  return (
    <section className="summary t-pending">
      <div className="sm-top">
        <span className="vh-badge">{v.label}</span>
        {product.isEstimated && <span className="est-chip">추정</span>}
      </div>
      <h2 className="sm-headline">
        {risky.length ? (
          <>{claim ? `'${claim}'` : '이 제품'}에 혈당을 올리는<br /><em>{risky.slice(0, 2).map((b) => b.ingredient.replace(/\(.*\)/, '')).join('·')}</em>{risky.length > 2 ? ` 외 ${risky.length - 2}개` : ''}</>
        ) : canCheck ? (
          <>숫자만 확인하면<br />바로 점수가 나와요</>
        ) : (
          <>성분표를 찍으면<br />정확히 알려드려요</>
        )}
      </h2>
      <p className="sm-note">{v.desc}</p>
      {result.caution && <p className="sm-caution">🚻 {result.caution}</p>}
      {a.issues?.length > 0 && <ul className="sm-issues">{a.issues.map((x, i) => <li key={i}>{x}</li>)}</ul>}
      <div className="sm-actions">
        {canCheck ? (
          <button className="btn btn-primary" onClick={onCheck}>읽은 숫자 확인하고 점수 보기</button>
        ) : (
          <button className="btn btn-primary" onClick={onPhoto}>성분표 찍고 정확히 보기</button>
        )}
        {a.alternatives.length > 0 && <button className="btn btn-ghost" onClick={onAlts}>대체품 ({a.alternatives.length})</button>}
      </div>
      {grams ? <p className="sm-basis">{grams}g 먹을 때 기준 · {result.servingNote}</p> : null}
    </section>
  )
}

/* ================= 점수 막대 (근거 자세히) ================= */
export function ScoreCard({ result }) {
  const lk = result?.levelKey
  const hasRange = result?.range && result.range.min !== result.range.max
  const pos = (v) => `${Math.max(0, Math.min(100, v ?? 0))}%`
  return (
    <section className={`score-card lv-${lk || 'none'}`}>
      <div className="score-top">
        <span className="score-label">혈당 부담 점수</span>
        <LevelPill level={result?.level} levelKey={lk}>{result?.level || (lk ? LEVEL_LABEL[lk] : '확인 필요')}</LevelPill>
      </div>
      <div className="score-num">
        <strong>{scoreText(result)}</strong>
        <span>점</span>
        {result?.gl?.mid != null && <small className="gl-chip">혈당부하 GL {result.gl.mid}</small>}
      </div>
      <div className="gauge" aria-hidden>
        <div className="gauge-track"><i className="z z1" /><i className="z z2" /><i className="z z3" /></div>
        {hasRange ? (
          <div className="gauge-band" style={{ left: pos(result.range.min), width: `calc(${pos(result.range.max)} - ${pos(result.range.min)})` }} />
        ) : result?.score != null ? (
          <div className="gauge-mark" style={{ left: pos(result.score) }} />
        ) : null}
        <div className="gauge-legend"><span style={{ width: '40%' }}>낮음</span><span style={{ width: '40%' }}>보통</span><span style={{ width: '20%' }}>높음</span></div>
      </div>
      {hasRange && <p className="score-note">원료를 하나로 확정할 수 없어서 가능한 범위({result.range.min}~{result.range.max}점)도 같이 보여드려요.</p>}
      <p className="score-note">점수 = 1회 섭취량 기준 혈당부하(GL) ÷ 25 × 100 · GL 10 이하 낮음, 20 이상 높음</p>
    </section>
  )
}

/* ================= 숨은 탄수화물 ================= */
const SWEETENER_NAME = { allulose: '알룰로스', sugar_alcohol: '당알코올' }
export function HiddenCarbs({ a, grams }) {
  const per = a.product.per100g || {}
  if (per.carb == null || !grams || !a.scored) return null
  const k = grams / 100
  const carb = per.carb * k
  const sugar = (per.sugar ?? 0) * k
  const fiber = (per.fiber ?? 0) * k
  const swEntries = Object.entries(per.sweeteners || {}).filter(([, v]) => Number(v) > 0)
  const sw = swEntries.reduce((s, [, v]) => s + Number(v), 0) * k
  const hidden = a.result.hiddenCarbGrams ?? Math.max(0, carb - sugar - fiber - sw)
  const total = Math.max(carb, sugar + sw + hidden + fiber, 0.0001)
  const seg = [
    { key: 'sugar', label: '당류 (표시됨)', v: sugar },
    { key: 'sweet', label: swEntries.map(([n]) => SWEETENER_NAME[n] || n).join('·') || '표시된 감미료', v: sw },
    { key: 'hidden', label: '숨은 탄수화물', v: hidden },
    { key: 'fiber', label: '식이섬유', v: fiber },
  ].filter((s) => s.v > 0.04)
  return (
    <section className="card">
      <h2 className="card-title">숨은 탄수화물</h2>
      <p className="hc-lead">
        {grams}g에 든 탄수화물 <b>{r1(carb)}g</b> 중 '당류'로 표시된 건 <b>{r1(sugar)}g</b>
        {hidden > 0.04 ? <>뿐이에요. 당류로 안 잡히는 탄수화물이 <b className="hl">{r1(hidden)}g</b> 더 있어요.</> : '이에요.'}
      </p>
      {seg.length > 0 && (
        <>
          <div className="stack" role="img" aria-label="탄수화물 구성">
            {seg.map((s) => <div key={s.key} className={`stack-seg s-${s.key}`} style={{ width: `${(s.v / total) * 100}%` }} />)}
          </div>
          <ul className="stack-legend">
            {seg.map((s) => <li key={s.key}><i className={`dot s-${s.key}`} />{s.label}<b>{r1(s.v)}g</b></li>)}
          </ul>
        </>
      )}
      <p className="hc-foot">숨은 탄수화물 = 탄수화물 − 당류 − 식이섬유 − 알룰로스·당알코올 (100g당 {a.hiddenCarbPer100g ?? '-'}g)</p>
    </section>
  )
}

/* ================= 원재료 쉬운 설명 ================= */
export function Breakdown({ items }) {
  if (!items?.length) return null
  const order = { high: 0, mid: 1, low: 2, unknown: 3 }
  const sorted = [...items].sort((x, y) => order[x.impactKey] - order[y.impactKey] || (x.rank ?? 99) - (y.rank ?? 99))
  return (
    <section className="card">
      <h2 className="card-title">원재료 쉬운 설명</h2>
      <ul className="bd-list">
        {sorted.map((b, i) => (
          <li key={`${b.ingredient}-${i}`} className="bd-item">
            <div className="bd-main">
              <div className="bd-name">
                <b>{b.ingredient}</b>
                {b.raw && b.raw !== b.ingredient && <span className="bd-raw">{b.raw}</span>}
              </div>
              {(b.explain || EXPLAIN[b.ingredient]) && <p className="bd-explain">{b.explain || EXPLAIN[b.ingredient]}</p>}
              {b.rank != null && <span className="bd-rank">원재료 {b.rank}번째</span>}
            </div>
            <span className={`impact impact-${b.impactKey}`}>{b.impact || '확인 필요'}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ================= 근거 ================= */
export function Reasons({ reasons }) {
  if (!reasons?.length) return null
  return (
    <section className="card">
      <h2 className="card-title">왜 이렇게 나왔나요?</h2>
      <ul className="reasons">{reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
    </section>
  )
}

/* ================= 복통 경고 ================= */
const SENS_KEY = 'sweetenerSensitive'
export function GutWarning({ a, grams }) {
  const [sensitive, setSensitive] = useState(() => {
    try { return localStorage.getItem(SENS_KEY) === '1' } catch { return false }
  })
  const w = getGutWarning(a.product, a.result, grams, sensitive)
  if (!w && !a.result.caution) return null
  const toggle = () => {
    const v = !sensitive
    setSensitive(v)
    try { localStorage.setItem(SENS_KEY, v ? '1' : '0') } catch { /* 무시 */ }
  }
  const level = w?.level || 'warn'
  return (
    <section className={`gut gut-${level}`}>
      <p className="gut-title">{level === 'danger' ? '복통·설사 주의' : '많이 먹으면 배가 아플 수 있어요'}</p>
      {!w || w.unknownAmount ? (
        <p className="gut-desc">{w?.names?.length ? `${w.names.join(', ')}이(가) 들어 있어요. ` : ''}당알코올은 한꺼번에 많이 먹으면 복통·설사를 일으킬 수 있어요.</p>
      ) : (
        <ul className="gut-list">
          {w.items.map((i) => (
            <li key={i.name}>
              <b>{i.name}</b> 약 {r1(i.grams)}g{!a.scored ? ' (AI가 읽은 값)' : ''}
              <span> · {sensitive ? '예민한 사람 기준' : '보통'} {i.limit}g부터 불편할 수 있어요</span>
            </li>
          ))}
        </ul>
      )}
      {w?.over10 && <p className="gut-note">당알코올이 10% 이상이라 '과량 섭취 시 설사' 주의문구 대상이에요.</p>}
      <label className="gut-toggle">
        <input type="checkbox" checked={sensitive} onChange={toggle} />
        <span>나는 감미료에 예민한 편이에요</span>
      </label>
    </section>
  )
}

/* ================= 추정값 안내 ================= */
export function EstimatedBanner({ a, onPhoto }) {
  if (!a.product.isEstimated) return null
  return (
    <section className="missing est">
      <div>
        <p className="missing-title"><span className="est-chip">추정</span> 탄수화물·당류가 추정값이에요</p>
        <p className="missing-desc">공공데이터에 값이 없어 비슷한 제품으로 추정했어요 (평균 오차 약 13g). 성분표를 찍으면 정확해져요.</p>
      </div>
      <button className="btn btn-dark btn-sm" onClick={onPhoto}>성분표 찍기</button>
    </section>
  )
}

/* ================= 대체품 카드 ================= */
export function AltCard({ alt, onOpen }) {
  return (
    <button className="alt-card" onClick={onOpen}>
      <div className="alt-head">
        <b className="alt-name">{alt.name}</b>
        <span className={`alt-score lv-${alt.levelKey || 'none'}`}>{alt.score != null ? alt.score : '?'}<small>점</small></span>
      </div>
      <div className="alt-swap">
        {alt.hiddenCarbPer100g != null && <span className="chip chip-good">숨은 탄수화물 100g당 {alt.hiddenCarbPer100g}g</span>}
        {alt.nutritionEstimated && <span className="est-chip">추정</span>}
      </div>
      {alt.reason && <p className="alt-reason">{alt.reason}</p>}
    </button>
  )
}
