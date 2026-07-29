import assert from 'node:assert/strict'
import test from 'node:test'

import { PlatformClient } from './client.js'

const identity = {
  subjectId: 'manager-1',
  subjectType: 'HUMAN',
  roles: ['case-manager'],
  label: 'Case manager',
}

function jsonResponse(body = { ok: true }) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  })
}

test('modo headers preserva a identidade da baseline', async (context) => {
  let request
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    request = { url, options }
    return jsonResponse()
  })

  const client = new PlatformClient('http://api.test')
  const result = await client.request('/v1/cases', {
    tenantId: 'tenant-a',
    identity,
    authorityLimit: 500,
  })

  const headers = new Headers(request.options.headers)
  assert.equal(result.ok, true)
  assert.equal(headers.get('x-subject-id'), 'manager-1')
  assert.equal(headers.get('x-subject-type'), 'HUMAN')
  assert.equal(headers.get('x-roles'), 'case-manager')
  assert.equal(headers.get('x-tenant-id'), 'tenant-a')
  assert.equal(headers.get('x-authority-limit'), '500')
  assert.equal(headers.get('authorization'), null)
})

test('modo OIDC envia bearer e remove headers de identidade controláveis pelo navegador', async (context) => {
  let request
  context.mock.method(globalThis, 'fetch', async (url, options) => {
    request = { url, options }
    return jsonResponse()
  })

  const client = new PlatformClient('http://api.test', {
    authMode: 'oidc',
    getAccessToken: async () => 'signed-access-token',
    identityLabel: 'Operador autenticado',
  })
  const result = await client.request('/v1/cases', {
    tenantId: 'spoofed-tenant',
    identity,
    authorityLimit: 999999,
    headers: {
      'X-Tenant-Id': 'also-spoofed',
      'X-Roles': 'administrator',
      'X-Subject-Id': 'attacker',
      'X-Subject-Type': 'WORKLOAD',
      'X-Authority-Limit': '999999',
      Authorization: 'Bearer caller-controlled',
      'If-Match': '3',
    },
  })

  const headers = new Headers(request.options.headers)
  assert.equal(result.ok, true)
  assert.equal(headers.get('authorization'), 'Bearer signed-access-token')
  assert.equal(headers.get('x-tenant-id'), null)
  assert.equal(headers.get('x-roles'), null)
  assert.equal(headers.get('x-subject-id'), null)
  assert.equal(headers.get('x-subject-type'), null)
  assert.equal(headers.get('x-authority-limit'), null)
  assert.equal(headers.get('if-match'), '3')
  assert.ok(headers.get('x-correlation-id'))
})

test('modo OIDC sem token falha fechado antes de chamar a rede', async (context) => {
  const fetchMock = context.mock.method(globalThis, 'fetch', async () => jsonResponse())
  const client = new PlatformClient('http://api.test', {
    authMode: 'oidc',
    getAccessToken: async () => null,
  })

  const result = await client.request('/v1/cases')

  assert.equal(result.ok, false)
  assert.equal(result.status, 401)
  assert.equal(result.data.title, 'Autenticação necessária')
  assert.equal(fetchMock.mock.callCount(), 0)
})

test('health permanece anônimo no modo OIDC', async (context) => {
  let headers
  context.mock.method(globalThis, 'fetch', async (_url, options) => {
    headers = new Headers(options.headers)
    return jsonResponse({ status: 'ok' })
  })
  const client = new PlatformClient('http://api.test', {
    authMode: 'oidc',
    getAccessToken: async () => {
      throw new Error('não deveria obter token')
    },
  })

  const result = await client.health()

  assert.equal(result.ok, true)
  assert.equal(headers.get('authorization'), null)
})
