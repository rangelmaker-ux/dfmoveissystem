import { create } from 'zustand';

type SyncState = 'idle' | 'saving' | 'error';
interface ServerState {
  connected: boolean | null;
  pending: number;
  errors: Record<string, boolean>;
  scopes: Record<string, SyncState>;
}
export const useServerStatus = create<ServerState>(() => ({ connected: null, pending: 0, errors: {}, scopes: {} }));
export function setServerConnected(connected: boolean) { useServerStatus.setState({ connected }); }
export function setSyncScope(key: string, value: SyncState) {
  useServerStatus.setState(state => ({ scopes: { ...state.scopes, [key]: value } }));
}
export function clearPendingScope(key: string) {
  if (useServerStatus.getState().scopes[key] === 'saving') setSyncScope(key, 'idle');
}
export function indicatorState(state: ServerState): 'green' | 'yellow' | 'red' {
  if (state.connected === false || Object.values(state.errors).some(Boolean) || Object.values(state.scopes).includes('error')) return 'red';
  if (state.connected === null || state.pending > 0 || Object.values(state.scopes).includes('saving')) return 'yellow';
  return 'green';
}
export async function trackServerTask<T>(key: string, task: () => Promise<T>, sending = true): Promise<T> {
  if (sending) useServerStatus.setState(state => ({ pending: state.pending + 1 }));
  try {
    const value = await task();
    useServerStatus.setState(state => ({ connected: true, errors: { ...state.errors, [key]: false } }));
    return value;
  } catch (error) {
    useServerStatus.setState(state => ({ errors: { ...state.errors, [key]: true } }));
    throw error;
  } finally {
    if (sending) useServerStatus.setState(state => ({ pending: Math.max(0, state.pending - 1) }));
  }
}
export const observedServerFetch: typeof fetch = async (input, init) => {
  const method = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
  const url = input instanceof Request ? input.url : String(input);
  const key = `${method}:${new URL(url, 'http://localhost').pathname}`;
  const sending = !['GET', 'HEAD', 'OPTIONS'].includes(method);
  // Preserve Supabase's response contract: HTTP failures are tracked but remain readable by its SDK.
  let response: Response | undefined;
  try {
    return await trackServerTask(key, async () => {
      response = await fetch(input, init);
      if (!response.ok) throw new Error('Server request failed');
      return response;
    }, sending);
  } catch (error) {
    if (response) return response;
    throw error;
  }
};
