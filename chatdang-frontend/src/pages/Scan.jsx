import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Html5Qrcode, Html5QrcodeSupportedFormats as F } from 'html5-qrcode'
import { analyzeBarcode, analyzePhoto } from '../api/client'
import { openAnalysis } from '../lib/nav'
import { grabFrame, shrinkFile } from '../lib/image'
import { Loading, Page, Spinner } from '../components/ui'

/**
 * 카메라 한 화면에서 끝내기
 *  1) 열리자마자 바코드 인식
 *  2) 4초 안에 안 잡히거나, DB에 없는 바코드면 → 같은 카메라 그대로 '성분표 촬영'으로 전환
 *     (성분표 모드에서도 바코드가 잡히면 바로 조회)
 *  3) 셔터 → AI 분석 → 결과
 */
const FORMATS = [F.EAN_13, F.EAN_8, F.UPC_A, F.UPC_E, F.CODE_128]
const AUTO_LABEL_MS = 4000

function cameraErrorMessage(err) {
  if (!window.isSecureContext) return '카메라는 HTTPS 주소에서만 쓸 수 있어요.'
  const s = String(err?.name || err?.message || err)
  if (/NotAllowed|Permission/i.test(s)) return '카메라 권한이 꺼져 있어요. 브라우저 설정에서 허용하거나, 아래 버튼으로 사진을 찍어주세요.'
  if (/NotFound|Devices/i.test(s)) return '사용할 수 있는 카메라를 찾지 못했어요.'
  if (/NotReadable|in use/i.test(s)) return '다른 앱이 카메라를 쓰고 있어요.'
  return '이 화면에서는 카메라를 열 수 없어요. 아래 버튼으로 사진을 찍어주세요.'
}

const PHOTO_STEPS = ['사진 보내는 중', '성분 읽는 중…', '숨은 탄수화물 찾는 중']

export default function Scan() {
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const compareWith = sp.get('compareWith')
  const scannerRef = useRef(null)
  const busyRef = useRef(false)
  const lastCodeRef = useRef(null)

  const [mode, setMode] = useState(sp.get('mode') === 'label' ? 'label' : 'barcode')
  const [cam, setCam] = useState('starting') // starting | on | error
  const [camError, setCamError] = useState('')
  const [busy, setBusy] = useState(null) // null | 'lookup' | 'extract'
  const [notice, setNotice] = useState(sp.get('notfound') ? '아직 데이터에 없는 제품이에요. 뒷면 성분표를 찍어주세요.' : '')
  const [error, setError] = useState(null)
  const [manual, setManual] = useState(false)
  const [code, setCode] = useState('')
  const [attempt, setAttempt] = useState(0)
  const barcodeRef = useRef(sp.get('barcode'))

  const toLabel = (msg) => {
    setMode('label')
    if (msg) setNotice(msg)
    navigator.vibrate?.(20)
  }

  async function lookup(barcode) {
    if (busyRef.current) return
    busyRef.current = true
    lastCodeRef.current = barcode
    barcodeRef.current = barcode
    setBusy('lookup')
    setError(null)
    navigator.vibrate?.(50)
    try {
      const a = await analyzeBarcode(barcode)
      if (a.needPhoto) {
        // 이름은 찾았지만 영양성분이 없음 → 성분표 촬영으로
        toLabel(`'${a.product.name}' 영양성분이 아직 없어요. 뒷면 성분표를 찍어주세요.`)
        return
      }
      openAnalysis(nav, a, { compareWith, replace: true })
    } catch (e) {
      if (e.kind === 'needPhoto') {
        toLabel('아직 데이터에 없는 제품이에요. 뒷면 성분표를 찍어주세요.')
        return
      }
      setError(e)
      lastCodeRef.current = null // 같은 바코드로 다시 시도 가능
    } finally {
      busyRef.current = false
      setBusy(null)
    }
  }

  async function analyze(file) {
    if (busyRef.current) return
    busyRef.current = true
    setBusy('extract')
    setError(null)
    try {
      const a = await analyzePhoto([file], { barcode: barcodeRef.current })
      const p = a.product
      if (!p?.id || (p.per100g?.carb == null && !p.ingredients?.length)) {
        throw Object.assign(new Error(a.issues?.[0] || '성분표 글자를 읽지 못했어요. 영양정보·원재료명이 네모 안에 크게 들어오게 다시 찍어주세요.'), { kind: 'notfound' })
      }
      openAnalysis(nav, a, { compareWith, replace: true })
    } catch (e) {
      setError(e)
    } finally {
      busyRef.current = false
      setBusy(null)
    }
  }

  // 카메라 시작 (바코드 인식은 모드와 상관없이 계속 켜 둠)
  useEffect(() => {
    let cancelled = false
    setCam('starting')
    const scanner = new Html5Qrcode('reader', {
      formatsToSupport: FORMATS,
      verbose: false,
      experimentalFeatures: { useBarCodeDetectorIfSupported: true },
    })
    scannerRef.current = scanner
    scanner
      .start(
        { facingMode: 'environment' },
        {
          fps: 12,
          qrbox: (w, h) => ({ width: Math.floor(w * 0.86), height: Math.floor(Math.min(h, w) * 0.42) }),
          videoConstraints: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        },
        (text) => {
          const digits = String(text).replace(/\D/g, '')
          if (digits.length >= 8 && digits.length <= 14 && digits !== lastCodeRef.current) lookup(digits)
        },
        () => {},
      )
      .then(() => {
        if (cancelled) return scanner.stop().catch(() => {})
        setCam('on')
      })
      .catch((err) => {
        if (cancelled) return
        console.warn('[scan] camera error', err)
        setCamError(cameraErrorMessage(err))
        setCam('error')
        setMode('label')
      })
    return () => {
      cancelled = true
      const s = scannerRef.current
      if (s?.isScanning) s.stop().then(() => s.clear()).catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt])

  // 4초 동안 바코드가 안 잡히면 성분표 촬영으로
  useEffect(() => {
    if (mode !== 'barcode' || cam !== 'on' || busy) return
    const t = setTimeout(() => toLabel('바코드가 잘 안 잡혀요. 뒷면 성분표를 찍어도 바로 분석해요.'), AUTO_LABEL_MS)
    return () => clearTimeout(t)
  }, [mode, cam, busy])

  const shoot = async () => {
    try {
      const video = document.querySelector('#reader video')
      analyze(await grabFrame(video))
    } catch (e) {
      setError(e)
    }
  }
  const onPick = async (e) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (f) analyze(await shrinkFile(f))
  }
  const submitManual = (e) => {
    e.preventDefault()
    const digits = code.replace(/\D/g, '')
    if (digits.length >= 8) {
      setManual(false)
      lookup(digits)
    }
  }

  return (
    <Page title={compareWith ? '비교할 제품 찍기' : mode === 'label' ? '성분표 찍기' : '바코드 찍기'} className="scan-page">
      <div className="camera-wrap">
        <div id="reader" className="reader" />
        {cam === 'on' && (
          <div className={`scan-overlay ${mode}`} aria-hidden>
            {mode === 'barcode' ? (
              <div className="scan-frame"><i className="laser" /></div>
            ) : (
              <div className="label-frame">
                <i className="c tl" /><i className="c tr" /><i className="c bl" /><i className="c br" />
              </div>
            )}
          </div>
        )}
        {cam === 'starting' && <p className="camera-msg">카메라 켜는 중…</p>}
        {cam === 'error' && (
          <div className="camera-error">
            <p className="state-title">카메라 화면을 열 수 없어요</p>
            <p className="state-desc">{camError}</p>
            <label className="btn btn-primary">
              성분표 사진 찍기
              <input type="file" accept="image/*" capture="environment" onChange={onPick} hidden />
            </label>
            <button className="btn btn-ghost btn-sm" onClick={() => setAttempt((a) => a + 1)}>카메라 다시 시도</button>
          </div>
        )}
        {busy === 'lookup' && (
          <div className="camera-busy"><Spinner size={34} /><p>제품 찾는 중…</p></div>
        )}
        {busy === 'extract' && (
          <div className="camera-busy solid"><Loading title="성분표 분석 중" steps={PHOTO_STEPS} /></div>
        )}
      </div>

      <div className="scan-bottom">
        <div className="mode-tabs" role="tablist">
          <button role="tab" aria-selected={mode === 'barcode'} className={mode === 'barcode' ? 'on' : ''} onClick={() => { setMode('barcode'); setNotice('') }} disabled={cam === 'error'}>바코드</button>
          <button role="tab" aria-selected={mode === 'label'} className={mode === 'label' ? 'on' : ''} onClick={() => setMode('label')}>성분표</button>
        </div>

        {error ? (
          <div className="hint-card error">
            <b>{error.kind === 'network' ? '인터넷 연결을 확인해주세요' : error.kind === 'notfound' ? '다시 찍어주세요' : '문제가 생겼어요'}</b>
            <p>{error.message}</p>
          </div>
        ) : notice ? (
          <p className="scan-notice">{notice}</p>
        ) : (
          <p className="scan-guide">
            {mode === 'barcode' ? <>뒷면 <b>바코드</b>를 네모 안에 맞춰주세요</> : <><b>영양정보</b>와 <b>원재료명</b>이 네모 안에 들어오게 찍어주세요</>}
          </p>
        )}

        {mode === 'label' && cam !== 'error' && (
          <div className="shutter-row">
            <label className="btn btn-ghost btn-sm gallery-btn">
              앨범
              <input type="file" accept="image/*" onChange={onPick} hidden />
            </label>
            <button className="shutter" aria-label="성분표 촬영" onClick={shoot} disabled={cam !== 'on' || !!busy}>
              <span />
            </button>
            <Link className="btn btn-ghost btn-sm gallery-btn right" to="/confirm">직접 입력</Link>
          </div>
        )}

        {manual ? (
          <form className="custom-input" onSubmit={submitManual}>
            <input autoFocus inputMode="numeric" pattern="[0-9]*" placeholder="바코드 숫자 13자리" value={code} onChange={(e) => setCode(e.target.value)} />
            <button className="btn btn-primary btn-sm" type="submit">조회</button>
          </form>
        ) : (
          <button className="link-btn center-link" onClick={() => setManual(true)}>바코드 번호 직접 입력</button>
        )}
      </div>
    </Page>
  )
}
