const BUILD_CONFIG = import.meta.env || {}
const DEFAULT_BASE_URL = BUILD_CONFIG.VITE_API_BASE_URL || '/api'

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/$/, '')
}

function correlationId() {
  return globalThis.crypto?.randomUUID?.() || '00000000-0000-4000-8000-000000000001'
}

function identityHeaders(identity, tenantId, authorityLimit) {
  if (!identity) return {}
  const roles = Array.isArray(identity.roles) ? identity.roles.join(',') : identity.role
  const headers = {
    'X-Subject-Id': identity.subjectId,
    'X-Subject-Type': identity.subjectType,
    'X-Roles': roles,
    'X-Tenant-Id': tenantId,
  }
  if (authorityLimit !== undefined && authorityLimit !== null && authorityLimit !== '') {
    headers['X-Authority-Limit'] = String(authorityLimit)
  }
  return headers
}

const OIDC_PROTECTED_HEADERS = new Set([
  'authorization',
  'x-authority-limit',
  'x-roles',
  'x-subject-id',
  'x-subject-type',
  'x-tenant-id',
])

function requestHeaders(value, authMode) {
  const result = {}
  new Headers(value || {}).forEach((headerValue, name) => {
    if (authMode !== 'oidc' || !OIDC_PROTECTED_HEADERS.has(name.toLowerCase())) {
      result[name] = headerValue
    }
  })
  return result
}

function now() {
  return globalThis.performance?.now?.() ?? Date.now()
}

async function decodeResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json') || contentType.includes('application/problem+json')) {
    return response.json()
  }
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

export class PlatformClient {
  constructor(baseUrl = DEFAULT_BASE_URL, {
    authMode = 'headers',
    getAccessToken = async () => null,
    identityLabel = '',
  } = {}) {
    this.baseUrl = normalizeBaseUrl(baseUrl)
    this.authMode = authMode
    this.getAccessToken = getAccessToken
    this.identityLabel = identityLabel
  }

  async request(path, options = {}) {
    const started = now()
    const requestCorrelationId = options.correlationId || correlationId()
    const method = options.method || 'GET'
    const headers = {
      Accept: 'application/json',
      'X-Correlation-Id': requestCorrelationId,
      ...(this.authMode === 'headers'
        ? identityHeaders(
          options.identity,
          options.tenantId || 'tenant-demo',
          options.authorityLimit,
        )
        : {}),
      ...requestHeaders(options.headers, this.authMode),
    }
    const isFormData = options.body instanceof FormData
    if (options.body !== undefined && !isFormData) headers['Content-Type'] = 'application/json'

    if (this.authMode === 'oidc' && !options.anonymous) {
      let token
      try {
        token = await this.getAccessToken()
      } catch (error) {
        return this.authenticationFailure(
          path,
          method,
          requestCorrelationId,
          started,
          error instanceof Error ? error.message : 'Falha ao obter o access token.',
        )
      }
      if (!token) {
        return this.authenticationFailure(
          path,
          method,
          requestCorrelationId,
          started,
          'Entre novamente para continuar.',
        )
      }
      headers.Authorization = `Bearer ${token}`
    }

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: options.body === undefined ? undefined : isFormData ? options.body : JSON.stringify(options.body),
      })
      return {
        ok: response.ok,
        status: response.status,
        data: await decodeResponse(response),
        location: response.headers.get('location'),
        elapsedMs: Math.round(now() - started),
        correlationId: requestCorrelationId,
        request: {
          method,
          path,
          identity: this.authMode === 'oidc'
            ? this.identityLabel || 'Sessão OIDC'
            : options.identity?.label || 'Público',
        },
      }
    } catch (error) {
      return {
        ok: false,
        status: 0,
        data: { detail: error instanceof Error ? error.message : 'Falha de rede' },
        location: null,
        elapsedMs: Math.round(now() - started),
        correlationId: requestCorrelationId,
        request: {
          method,
          path,
          identity: this.authMode === 'oidc'
            ? this.identityLabel || 'Sessão OIDC'
            : options.identity?.label || 'Público',
        },
      }
    }
  }

  authenticationFailure(path, method, requestCorrelationId, started, detail) {
    return {
      ok: false,
      status: 401,
      data: {
        type: 'https://backoffice.local/problems/authentication-required',
        title: 'Autenticação necessária',
        detail,
      },
      location: null,
      elapsedMs: Math.round(now() - started),
      correlationId: requestCorrelationId,
      request: {
        method,
        path,
        identity: this.identityLabel || 'Sessão OIDC',
      },
    }
  }

  health() {
    return this.request('/health', { anonymous: true })
  }
}
