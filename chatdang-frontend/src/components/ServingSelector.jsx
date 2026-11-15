import { useState } from 'react'
import { SPOON_G } from '../config'

/**
 * 한 스푼 / 두 스푼 / 1인분 / 직접 입력
 * onChange({ preset, grams })  — servingGrams null 이면 서버 기본값(1인분) 사용
 */
export default function ServingSelector({ preset, grams, servingGrams, onChange, hideServing = false, options: customOptions }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  const options = customOptions ? [...customOptions] : [
    { key: 'spoon1', label: '한 스푼', sub: `${SPOON_G}g`, grams: SPOON_G },
    { key: 'spoon2', label: '두 스푼', sub: `${SPOON_G * 2}g`, grams: SPOON_G * 2 },
  ]
  if (!hideServing && !customOptions) options.push({ key: 'serving', label: '1인분', sub: servingGrams ? `${servingGrams}g` : '기본', grams: servingGrams ?? null })

  const apply = () => {
    const v = parseFloat(draft)
    if (Number.isFinite(v) && v > 0 && v <= 2000) {
      onChange({ preset: 'custom', grams: Math.round(v * 10) / 10 })
      setEditing(false)
    }
  }

  return (
    <div className="serving">
      <div className="seg" role="radiogroup" aria-label="먹는 양">
        {options.map((o) => (
          <button
            key={o.key}
            role="radio"
            aria-checked={preset === o.key}
            className={`seg-btn ${preset === o.key ? 'on' : ''}`}
            onClick={() => { setEditing(false); onChange({ preset: o.key, grams: o.grams }) }}
          >
            <span>{o.label}</span>
            <small>{o.sub}</small>
          </button>
        ))}
        <button
          role="radio"
          aria-checked={preset === 'custom'}
          className={`seg-btn ${preset === 'custom' ? 'on' : ''}`}
          onClick={() => { setDraft(preset === 'custom' && grams ? String(grams) : ''); setEditing((e) => !e) }}
        >
          <span>직접 입력</span>
          <small>{preset === 'custom' && grams ? `${grams}g` : 'g'}</small>
        </button>
      </div>
      {editing && (
        <form className="custom-input" onSubmit={(e) => { e.preventDefault(); apply() }}>
          <input
            autoFocus
            type="number"
            inputMode="decimal"
            min="1"
            max="2000"
            step="any"
            placeholder="예: 20"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <span className="unit">g</span>
          <button className="btn btn-primary btn-sm" type="submit">적용</button>
        </form>
      )}
    </div>
  )
}
