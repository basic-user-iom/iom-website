import { createRoot } from 'react-dom/client'
import { DuktaLinarConceptPage } from './DuktaLinarConceptPage'

document.documentElement.classList.add('app-ready', 'linar-route')
document.body.classList.add('linar-route')

const root = document.getElementById('root')
if (!root) throw new Error('#root missing')

createRoot(root).render(<DuktaLinarConceptPage />)
