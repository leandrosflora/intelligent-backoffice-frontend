import { UserManager, WebStorageStateStore } from 'oidc-client-ts'

let singleton = null
let singletonKey = ''

export function getUserManager(config) {
  const key = JSON.stringify(config)
  if (singleton && singletonKey === key) return singleton

  const sessionStore = new WebStorageStateStore({ store: globalThis.sessionStorage })
  singleton = new UserManager({
    authority: config.authority,
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    post_logout_redirect_uri: config.postLogoutRedirectUri,
    response_type: 'code',
    scope: config.scope,
    userStore: sessionStore,
    stateStore: sessionStore,
    automaticSilentRenew: true,
    monitorSession: false,
    loadUserInfo: false,
    revokeTokensOnSignout: true,
    extraQueryParams: config.audience ? { audience: config.audience } : undefined,
  })
  singletonKey = key
  return singleton
}
