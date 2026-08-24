import { createRoot } from 'react-dom/client'
import { DuktaApp } from './DuktaApp'
import { applyFontPairing, detectFontPairing } from './fonts/pairings'
import './dukta.css'

document.documentElement.classList.add('app-ready', 'dk-route')
document.body.classList.add('dk-route')

if (typeof window !== 'undefined') {
  applyFontPairing(detectFontPairing())
}

const root = document.getElementById('root')
if (!root) throw new Error('#root missing')

createRoot(root).render(<DuktaApp />)
