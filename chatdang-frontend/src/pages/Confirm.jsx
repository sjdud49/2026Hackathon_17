import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { getCachedAnalysis } from '../lib/storage'
import { openAnalysis } from '../lib/nav'
import { analyzeChecked } from '../api/client'
import { parseRawmtrl } from '../lib/engine'
import { Disclaimer, Page } from '../components/ui'

const CATEGORIES = ['과자·스낵', '초콜릿·사탕', '빵·시리얼', '음료', '빙과·아이스크림', '유제품', '소스·양념', '기타']
const SAUCE_RE = /소스|양념|장|드레싱|케첩|케찹/

/** '26g', '3,2', '1g 미만' → 숫자 */
export function parseNum(v) {
  if (v == null) return null
  const s = String(v).trim()
  if (!s) return null
  if (/미만/.test(s)) {
    const n = parseFloat(s.replace(',', '.').replace(/[^\d.]/g, ''))
    return Number.isFinite(n) ? n / 2 : null
  }
  const n = parseFloat(s.replace(/(\d),(\d)/, '$1.$2').replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : null
}

/** 원재료명 한 줄 → 목록 (괄호 안 쉼표는 나누지 않음) */
export function splitIngredients(text) {
  const out = []
  let depth = 0
  let cur = ''
  for (const ch of String(text || '')) {
    if ('([{'.includes(ch)) depth++
    if (')]}'.includes(ch)) depth = Math.max(0, depth - 1)
    if ((ch === ',' || ch === '\n') && depth === 0) {
      if (cur.trim()) out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

const fmt = (n) => (n == null ? '' : String(Math.round(n * 100) / 100))

function initForm(p) {
  const per = p?.per100g || {}
  const sw = per.sweeteners || {}
  return {
    name: p?.name && p.name !== '이름 없는 제품' ? p.name : '',
    category: p?.category || '',
    claims: (p?.frontClaims || []).join(', '),
    basis: '100',
    basisG: '',
    carb: fmt(per.carb),
    sugar: fmt(per.sugar),
    fiber: fmt(per.fiber),
    sugarAlcohol: fmt(sw.sugar_alcohol ?? sw.maltitol),
    allulose: fmt(sw.allulose),
    ingredients: p?.ingredientsText || (p?.ingredients || []).join(', '),
    serving: p?.servingSize?.value ? fmt(p.servingSize.value) : '',
  }
}

export default function Confirm() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const id = sp.get('id')
  const compareWith = sp.get('compareWith')
  const orig = useMemo(() => (id ? getCachedAnalysis(id) : null), [id])
  const base = orig ? orig.localProduct || orig.product : null
  const fromAi = base?.nutritionSource === 'photo_ai' || base?.source === 'photo_ai'
  const [f, setF] = useState(() => initForm(base))
  const [touched, setTouched] = useState(false)
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }))

  const aiMissing = (k) => fromAi && !String(f[k] || '').trim()
  const carbOk = parseNum(f.carb) != null
  const isSauce = SAUCE_RE.test(`${f.category} ${f.name}`)

  const submit = (e) => {
    e.preventDefault()
    setTouched(true)
    if (!carbOk) return
    // 영양정보 기준량 → 100g당으로 환산
    const div = f.basis === '100' ? 100 : parseNum(f.basisG)
    const to100 = (v) => {
      const n = parseNum(v)
      return n == null || !div ? n : Math.round(((n * 100) / div) * 100) / 100
    }
    const sweeteners = {}
    const sa = to100(f.sugarAlcohol)
    const al = to100(f.allulose)
    if (sa) sweeteners.sugar_alcohol = sa
    if (al) sweeteners.allulose = al
    const [ingredients, ingredientsFlat] = parseRawmtrl(f.ingredients.replace(/\n/g, ','))
    const serving = parseNum(f.serving)
    const per100g = { carb: to100(f.carb), sugar: to100(f.sugar), fiber: to100(f.fiber), sweeteners }
    // 사용자가 직접 확인한 값 → 서버와 같은 계산식으로 점수 (nutritionSource: 'user_checked')
    const product = {
      id: base?.id?.startsWith('checked_') ? base.id : `checked_${base?.id || Date.now()}`,
      name: f.name.trim() || '이름 없는 제품',
      category: f.category,
      barcode: base?.barcode || null,
      maker: base?.maker || '',
      source: 'user_checked',
      nutritionSource: 'user_checked',
      frontClaims: f.claims.split(/[,\n]/).map((x) => x.trim()).filter(Boolean),
      per100g,
      ingredients,
      ingredientsFlat,
      servingSize: serving != null ? { value: serving, basis: 'label', note: '포장지 1회 제공량 (직접 확인)' } : {},
    }
    const a = analyzeChecked(product, null, orig?.alternatives || [])
    openAnalysis(nav, a, { compareWith, replace: true })
  }

  // 컴포넌트로 만들면 입력할 때마다 포커스가 풀려서 함수로 그려요
  const field = ({ k, label, unit = 'g', hint }) => (
    <label key={k} className={`field ${aiMissing(k) ? 'ai-miss' : ''} ${touched && k === 'carb' && !carbOk ? 'invalid' : ''}`}>
      <span className="f-label">{label}</span>
      <span className="f-input">
        <input inputMode="decimal" value={f[k]} onChange={set(k)} placeholder={aiMissing(k) ? '못 읽음' : '-'} />
        {unit && <em>{unit}</em>}
      </span>
      {hint && <small>{hint}</small>}
    </label>
  )

  return (
    <Page
      title={fromAi ? 'AI가 읽은 내용 확인' : '직접 입력'}
      footer={<button className="btn btn-primary btn-xl" form="confirm-form" type="submit">{fromAi ? '확인했어요 · 점수 보기' : '혈당 부담 분석'}</button>}
    >
      {fromAi ? (
        <div className="notice inline">
          <b>포장지와 숫자가 같은지만 확인해 주세요</b>
          <span>AI가 읽은 값은 확인 전이라 점수를 보류했어요. 확인을 누르면 서버와 같은 계산식으로 바로 점수를 보여드려요. 노란 칸은 AI가 못 읽은 부분이에요.</span>
        </div>
      ) : (
        <p className="muted">제품 뒷면의 영양정보와 원재료명을 보고 입력해주세요. '26g', '3,2'처럼 써도 숫자만 읽어요.</p>
      )}

      <form id="confirm-form" className="form" onSubmit={submit}>
        <section className="card form-card">
          <h2 className="card-title">제품</h2>
          <label className="field">
            <span className="f-label">제품명</span>
            <span className="f-input"><input value={f.name} onChange={set('name')} placeholder="예: 제로 초코칩 쿠키" /></span>
          </label>
          <label className="field">
            <span className="f-label">카테고리</span>
            <span className="f-input">
              <select value={f.category} onChange={set('category')}>
                <option value="">선택</option>
                {f.category && !CATEGORIES.includes(f.category) && <option value={f.category}>{f.category}</option>}
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </span>
          </label>
          <label className="field">
            <span className="f-label">앞면 문구</span>
            <span className="f-input"><input value={f.claims} onChange={set('claims')} placeholder="예: 저당, 제로슈거" /></span>
            <small>쉼표로 나눠 적어요. '저당'·'제로' 표시 검증에 써요.</small>
          </label>
        </section>

        <section className="card form-card">
          <h2 className="card-title">영양정보</h2>
          <div className="seg basis-seg">
            <button type="button" className={`seg-btn ${f.basis === '100' ? 'on' : ''}`} onClick={() => setF((x) => ({ ...x, basis: '100' }))}><span>100g당</span></button>
            <button type="button" className={`seg-btn ${f.basis === 'other' ? 'on' : ''}`} onClick={() => setF((x) => ({ ...x, basis: 'other' }))}><span>다른 기준량</span></button>
          </div>
          {f.basis === 'other' && field({ k: "basisG", label: "기준량 (총 내용량 또는 1회 제공량)", hint: "표에 '1회 제공량 30g당'이라고 적혀 있으면 30" })}
          <div className="grid2">
            {field({ k: "carb", label: "탄수화물 *" })}
            {field({ k: "sugar", label: "당류" })}
            {field({ k: "fiber", label: "식이섬유" })}
            {field({ k: "sugarAlcohol", label: "당알코올", hint: "표에 있을 때만" })}
            {field({ k: "allulose", label: "알룰로스", hint: "표에 있을 때만" })}
          </div>
          {touched && !carbOk && <p className="inline-error">탄수화물은 꼭 필요해요.</p>}
        </section>

        <section className="card form-card">
          <h2 className="card-title">원재료명</h2>
          <label className={`field ${aiMissing('ingredients') ? 'ai-miss' : ''}`}>
            <span className="f-input">
              <textarea rows={4} value={f.ingredients} onChange={set('ingredients')} placeholder="예: 밀가루, 말티톨, 식물성유지, 초콜릿칩(코코아매스, 말티톨), 전분" />
            </span>
            <small>적힌 순서 그대로 넣어주세요. 순서로 숨은 당의 양을 추정해요. 비워두면 점수를 범위로 보여드려요.</small>
          </label>
        </section>

        <section className="card form-card">
          <h2 className="card-title">1회 제공량</h2>
          {field({ k: "serving", label: "포장지 1회 제공량", hint: isSauce ? '비워두면 식약처 1회 섭취참고량(소스 15g·비빔장 10g)으로 계산해요' : '비워두면 식약처 1회 섭취참고량(과자 30g·음료 200mL 등)으로 계산해요' })}
        </section>
      </form>
      <Disclaimer />
    </Page>
  )
}
