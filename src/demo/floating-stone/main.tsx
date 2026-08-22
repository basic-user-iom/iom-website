import { createRoot } from 'react-dom/client'
import { App } from './App'

document.documentElement.classList.add('app-ready', 'fs-route')
document.body.classList.add('fs-route')

const root = document.getElementById('root')
if (!root) throw new Error('#root missing')

createRoot(root).render(<App />)
