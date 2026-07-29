import { useEffect, useState } from 'react'
import App from './App.jsx'
import DocumentValidation from './DocumentValidation.jsx'
import { useAuth } from './auth/useAuth.js'
import './Root.css'

function currentRoute() {
  return window.location.hash.replace(/^#/, '') || '/'
}

export default function Root() {
  const [route, setRoute] = useState(currentRoute)
  const auth = useAuth()

  useEffect(() => {
    const handleRouteChange = () => setRoute(currentRoute())
    window.addEventListener('hashchange', handleRouteChange)
    return () => window.removeEventListener('hashchange', handleRouteChange)
  }, [])

  if (auth.status === 'loading') {
    return <AuthState title="Concluindo autenticação…" detail="Validando o retorno do provedor de identidade." />
  }

  if (auth.status === 'error') {
    return (
      <AuthState
        title="Não foi possível autenticar"
        detail={auth.error}
        action={auth.mode === 'oidc' && <button onClick={auth.login}>Tentar novamente</button>}
      />
    )
  }

  if (auth.status === 'unauthenticated') {
    return (
      <AuthState
        title="Acesso protegido"
        detail={auth.error || 'Entre pelo provedor de identidade para acessar o console.'}
        action={<button onClick={auth.login}>Entrar com OIDC</button>}
      />
    )
  }

  if (route === '/document-validation') return <DocumentValidation auth={auth} />

  return (
    <>
      <App auth={auth} />
      <a className="ai-validator-launcher" href="#/document-validation">
        <span>AI</span>
        <div><strong>Validar documento</strong><small>Upload real + revisão humana</small></div>
      </a>
    </>
  )
}

function AuthState({ title, detail, action }) {
  return (
    <main className="auth-state">
      <section>
        <span className="auth-state-mark">IB</span>
        <small>Intelligent Backoffice</small>
        <h1>{title}</h1>
        <p>{detail}</p>
        {action}
      </section>
    </main>
  )
}
