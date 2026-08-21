import { createRoot } from 'react-dom/client'
import { DuktaApp } from './DuktaApp'
import './dukta.css'

document.documentElement.classList.add('app-ready', 'dk-route')
document.body.classList.add('dk-route')

const root = document.getElementById('root')
if (!root) throw new Error('#root missing')

createRoot(root).render(<DuktaApp />)
