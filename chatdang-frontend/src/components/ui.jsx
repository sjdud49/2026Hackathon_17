import { Component, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { USE_MOCK } from '../config'

export function Page({ title, back = true, onBack, right, children, footer, className = '' }) {
  const nav = useNavigate()
  return (
    <div className={`page ${className}`}>
      {(title || back) && (
        <header className="topbar">
          {back ? (
            <button className="icon-btn" aria-label="뒤로" onClick={onBack || (() => (window.history.length > 1 ? nav(-1) : nav('/')))}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
          ) : (
            <span className="icon-btn-spacer" />
          )}
          <h1 className="topbar-title">{title}</h1>
          <div className="topbar-right">{right}</div>
        </header>
      )}
      <main className="page-body">{children}</main>
      {footer && <div className="page-footer">{footer}</div>}
      {USE_MOCK && <div className="mock-badge" title="mock 데이터로 동작 중">MOCK</div>}
    </div>
  )
}

export function Spinner({ size = 28 }) {
  return <span className="spinner" style={{ width: size, height: size }} aria-hidden />
}

/** 단계별 문구가 바뀌는 로딩 화면 (사진 분석은 수 초 걸림) */
export function Loading({ title = '불러오고 있어요', steps }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!steps?.length) return
    const t = setInterval(() => setI((x) => Math.min(x + 1, steps.length - 1)), 1600)
    return () => clearInterval(t)
  }, [steps])
  return (
    <div className="state-screen" role="status" aria-live="polite">
      <Spinner size={40} />
      <p className="state-title">{title}</p>
      {steps?.length > 0 && (
        <ol className="loading-steps">
          {steps.map((s, k) => (
            <li key={s} className={k < i ? 'done' : k === i ? 'now' : ''}>{s}</li>
          ))}
        </ol>
      )}
    </div>
  )
}

const ERROR_TITLE = {
  network: '인터넷 연결이 끊겼어요',
  timeout: '응답이 늦어지고 있어요',
  notfound: '정보를 찾지 못했어요',
  camera: '카메라를 열 수 없어요',
  server: '문제가 생겼어요',
}

export function ErrorView({ error, title, onRetry, children }) {
  const kind = error?.kind || 'server'
  return (
    <div className="state-screen" role="alert">
      <div className="state-icon">!</div>
      <p className="state-title">{title || ERROR_TITLE[kind] || ERROR_TITLE.server}</p>
      <p className="state-desc">{error?.message || '잠시 후 다시 시도해주세요.'}</p>
      <div className="state-actions">
        {onRetry && <button className="btn btn-primary" onClick={onRetry}>다시 시도</button>}
        {children}
      </div>
    </div>
  )
}

export function Disclaimer() {
  return (
    <p className="disclaimer">
      이 정보는 <b>의료 진단이 아닙니다.</b> 포장지·공공 데이터와 AI 추정을 바탕으로 한 참고용 정보예요.
      혈당 관리가 필요하다면 의료진과 상담하세요.
    </p>
  )
}

export function LevelPill({ level, levelKey, children }) {
  return <span className={`pill pill-${levelKey || 'none'}`}>{children ?? level ?? '확인 필요'}</span>
}

export class ErrorBoundary extends Component {
  state = { error: null }
  static getDerivedStateFromError(error) {
    return { error }
  }
  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info)
  }
  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="page">
        <ErrorView
          error={{ message: '화면을 그리다가 문제가 생겼어요. 홈으로 돌아가 다시 시도해주세요.' }}
          onRetry={() => this.setState({ error: null })}
        >
          <button className="btn btn-ghost" onClick={() => { this.setState({ error: null }); window.location.reload() }}>홈으로</button>
        </ErrorView>
      </div>
    )
  }
}
