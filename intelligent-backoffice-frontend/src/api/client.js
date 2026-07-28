const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/$/, '')
}

function correlationId() {
  return globalThis.crypto?.randomUUID?.() || '00000000-0000-4000-8000-000000000001'
}

function identityHeaders(identity, requestCorrelationId, tenantId, authorityLimit) {
  if (!identity) return {}
  const roles = Array.isArray(identity.roles) ? identity.roles.join(',') : identity.role
  const headers = {
    'X-Subject-Id': identity.subjectId,
    'X-Subject-Type': identity.subjectType,
    'X-Roles': roles,
    'X-Tenant-Id': tenantId,
    'X-Correlation-Id': requestCorrelationId,
  }
  if (authorityLimit !== undefined && authorityLimit !== null && authorityLimit !== '') {
    headers['X-Authority-Limit'] = String(authorityLimit)
  }
  return headers
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
  constructor(baseUrl = DEFAULT_BASE_URL) {
    this.baseUrl = normalizeBaseUrl(baseUrl)
  }

  async request(path, options = {}) {
    const started = performance.now()
    const requestCorrelationId = options.correlationId || correlationId()
    const method = options.method || 'GET'
    const headers = {
      Accept: 'application/json',
      ...identityHeaders(
        options.identity,
        requestCorrelationId,
        options.tenantId || 'tenant-demo',
        options.authorityLimit,
      ),
      ...(options.headers || {}),
    }
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method,
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      })
      return {
        ok: response.ok,
        status: response.status,
        data: await decodeResponse(response),
        location: response.headers.get('location'),
        elapsedMs: Math.round(performance.now() - started),
        correlationId: requestCorrelationId,
        request: {
          method,
          path,
          identity: options.identity?.label || 'Público',
        },
      }
    } catch (error) {
      return {
        ok: false,
        status: 0,
        data: { detail: error instanceof Error ? error.message : 'Falha de rede' },
        location: null,
        elapsedMs: Math.round(performance.now() - started),
        correlationId: requestCorrelationId,
        request: {
          method,
          path,
          identity: options.identity?.label || 'Público',
        },
      }
    }
  }

  health() {
    return this.request('/health')
  }
}
