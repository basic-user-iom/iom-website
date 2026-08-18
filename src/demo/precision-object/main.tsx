import { createRoot } from 'react-dom/client'
import { PrecisionObjectPage } from './PrecisionObjectPage'

document.documentElement.classList.add('app-ready', 'pov-route')
document.body.classList.add('pov-route')

const root = document.getElementById('root')
if (!root) throw new Error('#root missing')

createRoot(root).render(<PrecisionObjectPage />)
