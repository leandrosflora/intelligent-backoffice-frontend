import assert from 'node:assert/strict'
import test from 'node:test'

import { resolveAuthConfig, safeReturnUrl, summarizeClaims } from './config.js'

const browserLocation = { origin: 'https://console.example.com' }

test('modo headers é o default e não exige provedor', () => {
  const config = resolveAuthConfig({ browserLocation })

  assert.equal(config.mode, 'headers')
  assert.equal(config.redirectUri, 'https://console.example.com/auth/callback')
})

test('modo OIDC exige authority, client id e openid', () => {
  assert.throws(
    () => resolveAuthConfig({ runtimeConfig: { authMode: 'oidc' }, browserLocation }),
    /OIDC_AUTHORITY/,
  )
  assert.throws(
    () => resolveAuthConfig({
      runtimeConfig: {
        authMode: 'oidc',
        oidcAuthority: 'https://id.example.com',
        oidcClientId: 'backoffice-spa',
        oidcScope: 'profile',
      },
      browserLocation,
    }),
    /openid/,
  )
})

test('configuração OIDC produz Authorization Code callback same-origin', () => {
  const config = resolveAuthConfig({
    runtimeConfig: {
      authMode: 'oidc',
      oidcAuthority: 'https://id.example.com/realms/backoffice/',
      oidcClientId: 'backoffice-spa',
      oidcScope: 'openid profile roles',
      oidcAudience: 'backoffice-api',
    },
    browserLocation,
  })

  assert.equal(config.authority, 'https://id.example.com/realms/backoffice')
  assert.equal(config.clientId, 'backoffice-spa')
  assert.equal(config.audience, 'backoffice-api')
  assert.equal(config.redirectUri, 'https://console.example.com/auth/callback')
  assert.equal(config.postLogoutRedirectUri, 'https://console.example.com/')
})

test('return URL bloqueia redirecionamento externo e callback recursivo', () => {
  assert.equal(safeReturnUrl('https://evil.example/phishing', browserLocation.origin), '/')
  assert.equal(safeReturnUrl('/auth/callback?code=again', browserLocation.origin), '/')
  assert.equal(safeReturnUrl('/#/document-validation', browserLocation.origin), '/#/document-validation')
})

test('claims são somente resumidas para contexto visual', () => {
  const claims = summarizeClaims({
    sub: 'user-42',
    preferred_username: 'operador',
    tenant_id: 'tenant-a',
    subject_type: 'HUMAN',
    roles: ['analyst', 'approver'],
    role: 'auditor',
    purpose: 'APPROVAL',
    authority_limit: 500,
  })

  assert.deepEqual(claims.roles, ['analyst', 'approver', 'auditor'])
  assert.equal(claims.displayName, 'operador')
  assert.equal(claims.authorityLimit, 500)
})
