import { supabase } from '@/integrations/supabase/client';

export const DRIVE_PILOT_EMAIL = 'rangelmaker@gmail.com';
export const DRIVE_PILOT_AUTH_ID = '44d949bf-2c99-47c8-bdb6-9038bfd3c713';

async function headers() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) throw new Error('Entre novamente no sistema.');
  return { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' };
}

export async function pilotRequest<T>(action: string, input?: unknown): Promise<T> {
  const response = await fetch(`/api/drive-pilot?action=${encodeURIComponent(action)}`, {
    method: input === undefined ? 'GET' : 'POST', headers: await headers(),
    ...(input === undefined ? {} : { body: JSON.stringify(input) }),
  });
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('O servidor do teste ainda não está disponível neste endereço.');
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Não foi possível concluir a operação.');
  return body as T;
}

export async function uploadPilot(projectId: string, file: Blob, name: string, onProgress: (value: number) => void, sourcePath?: string) {
  const prepared = await pilotRequest<{ completed?: boolean; recordId: string; uploadUrl: string }>('prepare', { projectId, name, size: file.size, sourcePath });
  if (prepared.completed) { onProgress(100); return; }
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', prepared.uploadUrl);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');
    xhr.timeout = 10 * 60 * 1000;
    xhr.upload.onprogress = event => { if (event.lengthComputable) onProgress(Math.round(event.loaded / event.total * 100)); };
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error('Envio ao Google não concluído. Você pode tentar novamente; o original foi preservado.'));
    xhr.onerror = () => reject(new Error('Falha de conexão durante o envio. Tente novamente.'));
    xhr.ontimeout = () => reject(new Error('O envio demorou demais. Tente novamente.'));
    xhr.send(file);
  });
  await pilotRequest('finish', { recordId: prepared.recordId });
}

export async function downloadPilot(recordId: string, name: string) {
  const response = await fetch('/api/drive-pilot?action=download', { method: 'POST', headers: await headers(), body: JSON.stringify({ recordId }) });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Não foi possível baixar o arquivo.');
  }
  if (!response.headers.get('content-type')?.includes('application/octet-stream')) throw new Error('O servidor do teste ainda não está disponível.');
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
