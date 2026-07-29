import { useCallback, useEffect, useMemo, useState } from 'react'

import { readAuthConfig, safeReturnUrl, summarizeClaims } from './config.js'
import { AuthContext } from './context.js'
import { getUserManager } from './manager.js'

const callbackRequests = new Map()

function callbackOnce(manager, url) {
  if (!callbackRequests.has(url)) {
    callbackRequests.set(url, manager.signinRedirectCallback(url))
  }
  return callbackRequests.get(url)
}

export default function AuthProvider({ children }) {
  const resolved = useMemo(() => {
    try {
      return { config: readAuthConfig(), error: null }
    } catch (error) {
      return { config: null, error }
    }
  }, [])
  const config = resolved.config
  const manager = useMemo(
    () => (config?.mode === 'oidc' ? getUserManager(config) : null),
    [config],
  )
  const [session, setSession] = useState(() => ({
    status: resolved.error ? 'error' : config?.mode === 'oidc' ? 'loading' : 'authenticated',
    user: null,
    error: resolved.error?.message || '',
  }))

  useEffect(() => {
    if (!manager) return undefined
    let active = true

    const userLoaded = (user) => {
      if (active) setSession({ status: 'authenticated', user, error: '' })
    }
    const userUnloaded = () => {
      if (active) setSession({ status: 'unauthenticated', user: null, error: '' })
    }
    const tokenExpired = () => {
      if (active) setSession({ status: 'unauthenticated', user: null, error: 'A sessão expirou. Entre novamente.' })
    }
    const silentRenewError = () => {
      if (active) setSession((current) => ({ ...current, error: 'Não foi possível renovar a sessão.' }))
    }

    manager.events.addUserLoaded(userLoaded)
    manager.events.addUserUnloaded(userUnloaded)
    manager.events.addAccessTokenExpired(tokenExpired)
    manager.events.addSilentRenewError(silentRenewError)

    async function restoreSession() {
      try {
        if (globalThis.location.pathname === '/auth/callback') {
          const callbackUrl = globalThis.location.href
          const user = await callbackOnce(manager, callbackUrl)
          const returnUrl = safeReturnUrl(user?.state?.returnUrl)
          globalThis.history.replaceState(null, globalThis.document.title, returnUrl)
          if (active) setSession({ status: 'authenticated', user, error: '' })
          return
        }

        const user = await manager.getUser()
        if (!active) return
        setSession(user && !user.expired
          ? { status: 'authenticated', user, error: '' }
          : { status: 'unauthenticated', user: null, error: '' })
      } catch (error) {
        if (active) {
          setSession({
            status: 'error',
            user: null,
            error: error instanceof Error ? error.message : 'Falha ao concluir a autenticação.',
          })
        }
      }
    }

    restoreSession()
    return () => {
      active = false
      manager.events.removeUserLoaded(userLoaded)
      manager.events.removeUserUnloaded(userUnloaded)
      manager.events.removeAccessTokenExpired(tokenExpired)
      manager.events.removeSilentRenewError(silentRenewError)
    }
  }, [manager])

  const login = useCallback(async () => {
    if (!manager) return
    const returnUrl = safeReturnUrl(
      `${globalThis.location.pathname}${globalThis.location.search}${globalThis.location.hash}`,
    )
    await manager.signinRedirect({ state: { returnUrl } })
  }, [manager])

  const logout = useCallback(async () => {
    if (!manager) return
    await manager.signoutRedirect()
  }, [manager])

  const getAccessToken = useCallback(async () => {
    if (!manager) return null
    const user = await manager.getUser()
    if (!user || user.expired || !user.access_token) {
      setSession({ status: 'unauthenticated', user: null, error: 'A sessão não está disponível. Entre novamente.' })
      return null
    }
    return user.access_token
  }, [manager])

  const claims = useMemo(() => summarizeClaims(session.user?.profile), [session.user])
  const value = useMemo(() => ({
    mode: config?.mode || 'headers',
    status: session.status,
    error: session.error,
    user: session.user,
    claims,
    login,
    logout,
    getAccessToken,
  }), [claims, config?.mode, getAccessToken, login, logout, session])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
