import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { APP_NAME, DEMO } from '../config'
import { levelKey } from '../api/normalize'
import { searchProducts } from '../api/client'
import { clearHistory, getHistory, removeHistory } from '../lib/storage'
import { shortMaker, timeAgo } from '../lib/format'
import { Disclaimer, Page, Spinner } from '../components/ui'

export default function Home() {
  const nav = useNavigate()
  const [history, setHistory] = useState(getHistory)
  const [q, setQ] = useState('')
  const [search, setSearch] = useState({ status: 'idle', items: [] })

  // 카메라 화면 코드를 미리 받아두면 버튼을 누르자마자 열려요
  useEffect(() => {
    const t = setTimeout(() => import('./Scan').catch(() => {}), 300)
    const onFocus = () => setHistory(getHistory())
    window.addEventListener('focus', onFocus)
    return () => {
      clearTimeout(t)
      window.removeEventListener('focus', onFocus)
    }
  }, [])

  const runSearch = async (e) => {
    e.preventDefault()
    const term = q.trim()
    if (!term) return
    setSearch({ status: 'loading', items: [] })
    try {
      setSearch({ status: 'done', items: await searchProducts(term) })
    } catch (err) {
      setSearch({ status: 'error', items: [], message: err.message })
    }
  }

  return (
    <Page back={false} className="home">
      <section className="hero">
        <p className="brand">{APP_NAME}</p>
        <h1 className="hero-title">
          <span className="mark">'저당'</span>·<span className="mark">'제로'</span>,<br />진짜일까요?
        </h1>
        <p className="hero-sub">
          찍기만 하면 '당류'로 표시되지 않는 전분·당알코올까지 찾아서, 먹는 양 기준 실제 혈당 부담과 대체품을 알려드려요.
        </p>
        <Link to="/scan" className="btn btn-primary btn-xl">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8a2 2 0 012-2h1.5l1.2-2h6.6l1.2 2H18a2 2 0 012 2v9a2 2 0 01-2 2H6a2 2 0 01-2-2z" /><circle cx="12" cy="12.5" r="3.5" /></svg>
          찍어서 확인하기
        </Link>
        <p className="hero-hint">바코드를 먼저 읽고, 안 되면 바로 성분표 촬영으로 넘어가요 · <Link to="/confirm" className="link-btn">직접 입력</Link></p>
      </section>

      <Link to="/zero" className="zero-teaser">
        <div>
          <b>같은 '제로' 표시, 다른 결과</b>
          <span>마이구미 ZERO · 라라스윗 웨하스 · 코카콜라 제로</span>
        </div>
        <span className="chev">›</span>
      </Link>

      <section className="section">
        <form className="search" onSubmit={runSearch} role="search">
          <input type="search" enterKeyHint="search" placeholder="제품명으로 찾기 (예: 쌈장, 마이구미)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="제품명 검색" />
          <button className="btn btn-dark btn-sm" type="submit">검색</button>
        </form>
        {search.status === 'loading' && <div className="center pad"><Spinner /></div>}
        {search.status === 'error' && <p className="muted pad">{search.message}</p>}
        {search.status === 'done' &&
          (search.items.length ? (
            <ul className="list">
              {search.items.map((p) => (
                <li key={p.id}>
                  <button className="list-item" onClick={() => nav(`/result/${encodeURIComponent(p.id)}`)}>
                    <div className="li-main">
                      <b>{p.name}</b>
                      <span>{[p.category, !p.hasNutrition && '영양성분 없음'].filter(Boolean).join(' · ') || ' '}</span>
                    </div>
                    {p.isEstimated && <span className="est-chip">추정</span>}
                    <span className="chev">›</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="empty">
              <p>'{q}'에 맞는 제품을 못 찾았어요.</p>
              <Link to="/scan?mode=label" className="btn btn-ghost btn-sm">성분표 찍어서 확인하기</Link>
            </div>
          ))}
      </section>

      <section className="section">
        <div className="section-head">
          <h2>최근 확인한 제품</h2>
          {history.length > 0 && <button className="link-btn" onClick={() => { clearHistory(); setHistory([]) }}>전체 삭제</button>}
        </div>
        {history.length === 0 ? (
          <p className="empty">아직 확인한 제품이 없어요. 매장에서 '저당'·'제로' 제품을 찍어보세요.</p>
        ) : (
          <ul className="list">
            {history.map((h) => {
              const lk = levelKey(h.level)
              const pending = h.scoreStatus && h.scoreStatus !== 'scored'
              return (
                <li key={h.id}>
                  <button className="list-item" onClick={() => nav(`/result/${encodeURIComponent(h.id)}`)}>
                    <span className={`mini-score lv-${pending ? 'none' : lk || 'none'}`}>{pending ? '보류' : h.score ?? '?'}</span>
                    <div className="li-main">
                      <b>{h.name}</b>
                      <span>{[h.servingGrams && `${h.servingGrams}g 기준`, shortMaker(h.maker), timeAgo(h.scannedAt)].filter(Boolean).join(' · ')}</span>
                    </div>
                  </button>
                  <button className="icon-btn del" aria-label={`${h.name} 기록 삭제`} onClick={() => { removeHistory(h.id); setHistory(getHistory()) }}>×</button>
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="section">
        <div className="section-head"><h2>시연 제품</h2></div>
        <ul className="list compact">
          {DEMO.map((d) => (
            <li key={d.barcode}>
              <button className="list-item" onClick={() => nav(`/p/${d.barcode}`)}>
                <span className="type-chip">{d.type}</span>
                <div className="li-main"><b>{d.name}</b><span>{d.barcode}</span></div>
                <span className="chev">›</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <Disclaimer />
    </Page>
  )
}
