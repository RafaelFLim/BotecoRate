import { auth } from './firebaseConfig';
import { getActiveUser } from './authService';

export const apiUrl = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/, '');

export function assertSession(uid) {
  if (getActiveUser()?.id !== uid || getActiveUser()?.origem !== 'firebase' || auth?.currentUser?.uid !== uid) {
    const error = new Error('A conta mudou durante a sincronização.');
    error.sessionChanged = true;
    throw error;
  }
}

export async function apiRequest(uid, path, { body, form } = {}) {
  assertSession(uid);
  if (!apiUrl.startsWith('https://')) throw new Error('Configure EXPO_PUBLIC_API_URL com a URL HTTPS do servidor.');
  const token = await auth.currentUser.getIdToken();
  assertSession(uid);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(apiUrl + path, {
      method: body || form ? 'POST' : 'GET', signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, ...(body ? {'Content-Type':'application/json'} : {}) },
      body: form || (body ? JSON.stringify(body) : undefined),
    });
    assertSession(uid);
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.message || 'Falha ao acessar o servidor.');
      error.status = response.status; error.body = result;
      throw error;
    }
    return result;
  } finally { clearTimeout(timeout); }
}
