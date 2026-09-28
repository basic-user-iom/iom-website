import { createRoot } from 'react-dom/client'
import { LinarApp } from './LinarApp'

document.documentElement.classList.add('app-ready', 'linar-route')
document.body.classList.add('linar-route')

const root = document.getElementById('root')
if (!root) throw new Error('#root missing')

createRoot(root).render(<LinarApp />)
