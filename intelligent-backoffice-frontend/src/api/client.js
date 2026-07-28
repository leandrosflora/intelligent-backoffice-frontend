const DEFAULT_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

function normalizeBaseUrl(value) {
  return String(value || DEFAULT_BASE_URL).replace(/\/$/, '')
}

function identityHeaders(identity, correlationId) {
  if (!identity) return {}
  return {
    'X-Subject-Id': identity.subjectId,
    'X-Subject-Type': identity.subjectType,
    'X-Roles': identity.role,
    'X-Tenant-Id': 'tenant-demo',
    'X-Correlation-Id': correlationId,
  }
}

async function decodeResponse(response) {
  const contentType = response.headers.get('content-type') || ''
  if (contentType.includes('application/json')) return response.json()
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
    const correlationId = options.correlationId || `ui-${Date.now()}`
    const headers = {
      Accept: 'application/json',
      ...identityHeaders(options.identity, correlationId),
      ...(options.headers || {}),
    }
    if (options.body !== undefined) headers['Content-Type'] = 'application/json'

    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        method: options.method || 'GET',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
      })
      return {
        ok: response.ok,
        status: response.status,
        data: await decodeResponse(response),
        elapsedMs: Math.round(performance.now() - started),
        correlationId,
        request: {
          method: options.method || 'GET',
          path,
          identity: options.identity?.label || 'Público',
        },
      }
    } catch (error) {
      return {
        ok: false,
        status: 0,
        data: { detail: error instanceof Error ? error.message : 'Falha de rede' },
        elapsedMs: Math.round(performance.now() - started),
        correlationId,
        request: {
          method: options.method || 'GET',
          path,
          identity: options.identity?.label || 'Público',
        },
      }
    }
  }

  health() {
    return this.request('/health')
  }

  metrics() {
    return this.request('/metrics')
  }
}

export const platformClient = new PlatformClient()
