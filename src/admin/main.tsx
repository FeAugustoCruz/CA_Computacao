import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../styles/index.css'
import { Admin } from './Admin'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Admin />
  </StrictMode>,
)
