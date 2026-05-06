import { createRoot } from 'react-dom/client'
import { DialRoot } from 'dialkit'

import "./styles/fonts.css";
import './styles/reset.css'
import './styles/global.css'
import 'dialkit/styles.css'

import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
  <>
    <App />
    <DialRoot />
  </>
  // </StrictMode>,
)
