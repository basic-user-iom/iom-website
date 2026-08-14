import { createRoot } from 'react-dom/client'
import { KellyKettlePage } from './KellyKettlePage'

document.documentElement.classList.add('app-ready', 'kk-route')
document.body.classList.add('kk-route')

const root = document.getElementById('root')
if (!root) throw new Error('#root missing')

createRoot(root).render(<KellyKettlePage />)
