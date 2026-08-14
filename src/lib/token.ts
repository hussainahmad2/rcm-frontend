/** In-memory access token only — never persisted to localStorage. */
let accessToken: string | null = null;
let accessExpiresAt = 0;

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null, expiresInSec?: number) {
  accessToken = token;
  accessExpiresAt = token && expiresInSec ? Date.now() + expiresInSec * 1000 : 0;
}

export function clearAccessToken() {
  accessToken = null;
  accessExpiresAt = 0;
}

export function accessTokenValid() {
  return Boolean(accessToken) && Date.now() < accessExpiresAt - 15_000;
}

export function secondsUntilExpiry() {
  if (!accessToken || !accessExpiresAt) return 0;
  return Math.max(0, Math.floor((accessExpiresAt - Date.now()) / 1000));
}
