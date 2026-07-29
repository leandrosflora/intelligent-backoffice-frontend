const DEFAULT_SCOPE = 'openid profile'

function firstValue(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== '')
}

function withoutTrailingSlash(value) {
  return String(value).replace(/\/+$/, '')
}

export function resolveAuthConfig({
  runtimeConfig = {},
  buildConfig = {},
  browserLocation = globalThis.location,
} = {}) {
  const mode = String(firstValue(
    runtimeConfig.authMode,
    buildConfig.VITE_AUTH_MODE,
    'headers',
  )).trim().toLowerCase()

  if (!['headers', 'oidc'].includes(mode)) {
    throw new Error(`AUTH_MODE inválido: "${mode}". Use "headers" ou "oidc".`)
  }

  const origin = browserLocation?.origin
  if (!origin) throw new Error('Não foi possível determinar a origem do frontend.')

  const config = {
    mode,
    authority: firstValue(runtimeConfig.oidcAuthority, buildConfig.VITE_OIDC_AUTHORITY),
    clientId: firstValue(runtimeConfig.oidcClientId, buildConfig.VITE_OIDC_CLIENT_ID),
    scope: String(firstValue(runtimeConfig.oidcScope, buildConfig.VITE_OIDC_SCOPE, DEFAULT_SCOPE)).trim(),
    audience: firstValue(runtimeConfig.oidcAudience, buildConfig.VITE_OIDC_AUDIENCE),
    redirectUri: new URL('/auth/callback', origin).toString(),
    postLogoutRedirectUri: new URL('/', origin).toString(),
  }

  if (mode === 'headers') return config
  if (!config.authority) throw new Error('OIDC_AUTHORITY é obrigatório no modo OIDC.')
  if (!config.clientId) throw new Error('OIDC_CLIENT_ID é obrigatório no modo OIDC.')
  if (!config.scope.split(/\s+/).includes('openid')) {
    throw new Error('OIDC_SCOPE deve incluir "openid".')
  }

  try {
    config.authority = withoutTrailingSlash(new URL(config.authority).toString())
  } catch {
    throw new Error('OIDC_AUTHORITY deve ser uma URL absoluta válida.')
  }

  return config
}

export function readAuthConfig() {
  return resolveAuthConfig({
    runtimeConfig: globalThis.__BACKOFFICE_CONFIG__ || {},
    buildConfig: import.meta.env || {},
    browserLocation: globalThis.location,
  })
}

export function safeReturnUrl(value, origin = globalThis.location?.origin) {
  if (!origin || typeof value !== 'string' || !value.trim()) return '/'

  try {
    const candidate = new URL(value, origin)
    if (candidate.origin !== origin || candidate.pathname === '/auth/callback') return '/'
    return `${candidate.pathname}${candidate.search}${candidate.hash}` || '/'
  } catch {
    return '/'
  }
}

function claimList(value) {
  if (Array.isArray(value)) return value.map(String)
  if (typeof value === 'string') return value.split(/[\s,]+/).filter(Boolean)
  return []
}

export function summarizeClaims(profile = {}) {
  const roles = [...new Set([
    ...claimList(profile.roles),
    ...claimList(profile.role),
  ])]

  return {
    subjectId: profile.sub || '',
    displayName: profile.name || profile.preferred_username || profile.email || profile.sub || 'Usuário autenticado',
    tenantId: profile.tenant_id || '',
    subjectType: profile.subject_type || '',
    purpose: profile.purpose || '',
    authorityLimit: profile.authority_limit ?? '',
    roles,
  }
}
