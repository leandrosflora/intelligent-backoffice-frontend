import { useEffect, useState } from 'react'
import App from './App.jsx'
import DocumentValidation from './DocumentValidation.jsx'
import './Root.css'

function currentRoute() {
  return window.location.hash.replace(/^#/, '') || '/'
}

export default function Root() {
  const [route, setRoute] = useState(currentRoute)

  useEffect(() => {
    const handleRouteChange = () => setRoute(currentRoute())
    window.addEventListener('hashchange', handleRouteChange)
    return () => window.removeEventListener('hashchange', handleRouteChange)
  }, [])

  if (route === '/document-validation') return <DocumentValidation />

  return (
    <>
      <App />
      <a className="ai-validator-launcher" href="#/document-validation">
        <span>AI</span>
        <div><strong>Validar documento</strong><small>Upload real + revisão humana</small></div>
      </a>
    </>
  )
}
