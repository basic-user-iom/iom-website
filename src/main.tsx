import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { CustomCursor } from './cursor'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <CustomCursor />
    <App />
  </StrictMode>,
)
