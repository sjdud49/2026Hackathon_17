import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// StrictMode는 개발 중 카메라를 두 번 켜는 문제가 있어서 쓰지 않아요.
createRoot(document.getElementById('root')).render(<App />)
