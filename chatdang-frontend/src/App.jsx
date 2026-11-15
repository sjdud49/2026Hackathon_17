import { lazy, Suspense } from 'react'
import { BrowserRouter, MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ErrorBoundary, Loading } from './components/ui'
import Home from './pages/Home'
import Lookup from './pages/Lookup'
import Result from './pages/Result'
import Compare from './pages/Compare'
import Confirm from './pages/Confirm'
import Zero from './pages/Zero'

// 바코드 라이브러리가 커서 카메라 화면은 따로 불러와요 (홈에서 미리 받아둠)
export const loadScan = () => import('./pages/Scan')
const Scan = lazy(loadScan)

/** 예전 주소 /photo → 카메라 화면의 성분표 모드 */
function PhotoRedirect() {
  const { search } = useLocation()
  const q = new URLSearchParams(search)
  q.set('mode', 'label')
  return <Navigate to={`/scan?${q}`} replace />
}

// 시연용 링크(claude.ai 페이지)는 주소 경로를 못 써서 메모리 라우터로 빌드해요: VITE_ROUTER=memory
const Router = import.meta.env.VITE_ROUTER === 'memory' ? MemoryRouter : BrowserRouter

export default function App() {
  return (
    <Router>
      <ErrorBoundary>
        <div className="app">
          <Suspense fallback={<Loading title="카메라 준비 중" />}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/scan" element={<Scan />} />
            <Route path="/photo" element={<PhotoRedirect />} />
            <Route path="/p/:barcode" element={<Lookup />} />
            <Route path="/result/:id" element={<Result />} />
            <Route path="/compare" element={<Compare />} />
            <Route path="/confirm" element={<Confirm />} />
            <Route path="/zero" element={<Zero />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          </Suspense>
        </div>
      </ErrorBoundary>
    </Router>
  )
}
