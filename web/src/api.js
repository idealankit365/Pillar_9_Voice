// Thin client for the limited /demo-api surface. The demo key stays in this tab and is
// sent as a header; provider and administrator keys never leave the server.
const KEY_STORE = 'p9_demo_key';

export const savedKey = () => { try { return sessionStorage.getItem(KEY_STORE) || ''; } catch { return ''; } };
export const rememberKey = (key) => { try { sessionStorage.setItem(KEY_STORE, key); } catch { /* private mode */ } };

export async function api(path, key, options = {}) {
  const headers = { 'x-p9-demo-key': key, ...(options.body ? { 'content-type': 'application/json' } : {}) };
  const response = await fetch(path, { ...options, headers });
  const body = await response.json().catch(() => ({ ok: false, error: { message: 'Backend returned an unreadable response.' } }));
  if (!response.ok || !body.ok) {
    const error = new Error(body.error?.message || 'Request failed.');
    error.code = body.error?.code;
    throw error;
  }
  return body.data;
}
