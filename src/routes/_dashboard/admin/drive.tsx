import { createFileRoute, redirect } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { validateStoredAccess } from '@/hooks/use-auth';
import { supabase } from '@/integrations/supabase/client';
import { DRIVE_PILOT_AUTH_ID, DRIVE_PILOT_EMAIL, pilotRequest, uploadPilot, downloadPilot } from '@/lib/drive-pilot';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';

export const Route = createFileRoute('/_dashboard/admin/drive')({
  beforeLoad: async () => {
    if (typeof window === 'undefined') return;
    const access = await validateStoredAccess();
    const { data } = await supabase.auth.getUser();
    const hidden = data.user ? await supabase.from('users').select('is_hidden').eq('auth_user_id', data.user.id).maybeSingle() : null;
    if (!access.authorized || access.account?.role !== 'ADMIN' || data.user?.id !== DRIVE_PILOT_AUTH_ID || data.user.email?.toLowerCase() !== DRIVE_PILOT_EMAIL || hidden?.data?.is_hidden !== true) {
      throw redirect({ to: '/projetista/dashboard' });
    }
  },
  component: DrivePilotPage,
});

interface Status { configured: boolean; connected: boolean; missing?: string[]; email?: string; folderId?: string }
interface Project { id: string; nome: string; clientes: { nome: string } | null }
interface DriveFile { id: string; name: string; size_bytes: number; state: 'pending' | 'ready'; source_path: string | null }
interface Original { name: string; id: string | null; metadata?: { size?: number } | null }

function DrivePilotPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState('');
  const [originals, setOriginals] = useState<Original[]>([]);
  const [files, setFiles] = useState<DriveFile[]>([]);
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const next = await pilotRequest<Status>('status');
        const result = await supabase.from('projetos').select('id,nome,clientes(nome)').order('nome');
        if (result.error) throw result.error;
        if (live) { setStatus(next); setProjects(result.data as Project[]); }
      } catch (cause) { if (live) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o teste.'); }
    })();
    return () => { live = false; };
  }, []);

  useEffect(() => {
    let live = true;
    setFiles([]); setOriginals([]); setError('');
    if (!projectId || !status?.connected) return;
    setBusy('Carregando arquivos…');
    void (async () => {
      try {
        const result: Original[] = [];
        for (let offset = 0; ; offset += 100) {
          const page = await supabase.storage.from('projetos_arquivos').list(projectId, { limit: 100, offset, sortBy: { column: 'name', order: 'asc' } });
          if (page.error) throw page.error;
          result.push(...page.data);
          if (page.data.length < 100) break;
        }
        const next = await pilotRequest<{ files: DriveFile[] }>('list', { projectId });
        if (live) { setOriginals(result.filter(item => item.id)); setFiles(next.files); }
      } catch (cause) { if (live) setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os arquivos.'); }
      finally { if (live) setBusy(''); }
    })();
    return () => { live = false; };
  }, [projectId, status?.connected]);

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label); setProgress(0); setError('');
    try { await task(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível concluir.'); }
    finally { setBusy(''); }
  }
  async function refresh() {
    const next = await pilotRequest<{ files: DriveFile[] }>('list', { projectId });
    setFiles(next.files);
  }
  const mb = (size: number) => `${(size / 1024 / 1024).toFixed(2)} MB`;

  return <div className="mx-auto w-full max-w-4xl space-y-5 p-4 md:p-8">
    <div><h1 className="text-2xl font-semibold">Google Drive — teste privado</h1><p className="mt-2 text-sm text-slate-600">Exclusivo para Rangel Maker. Seus dados e arquivos existentes continuam preservados no Supabase.</p></div>
    {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">{error}</p>}
    <Card><CardHeader><CardTitle>Conexão com seu Drive</CardTitle></CardHeader><CardContent className="space-y-3">
      {!status && !error && <p>Verificando configuração…</p>}
      {status && !status.configured && <p className="text-sm text-amber-800">A integração precisa ser configurada na Vercel antes do teste. Variáveis pendentes: {status.missing?.join(', ')}.</p>}
      {status?.connected && <><p>Conectado a {status.email}.</p><a className="text-sm underline" href={`https://drive.google.com/drive/folders/${encodeURIComponent(status.folderId || '')}`} target="_blank" rel="noreferrer">Abrir a pasta do teste no Google Drive</a></>}
      {status?.configured && <Button disabled={!!busy} onClick={() => void run('Conectando…', async () => {
        const result = await pilotRequest<{ url: string }>('connect', {});
        window.location.assign(result.url);
      })}>{status.connected ? 'Reconectar Google Drive' : 'Conectar Google Drive'}</Button>}
      <p className="text-xs text-slate-500">O teste cria uma pasta dedicada no Drive de rangelmaker@gmail.com. Nenhum arquivo é compartilhado publicamente.</p>
    </CardContent></Card>
    {status?.connected && <>
      <Card><CardHeader><CardTitle>Escolha o projeto</CardTitle></CardHeader><CardContent>
        <label htmlFor="drive-project" className="mb-2 block text-sm">Cliente e projeto</label>
        <select id="drive-project" value={projectId} disabled={!!busy} onChange={event => setProjectId(event.target.value)} className="w-full rounded-md border bg-white p-3">
          <option value="">Selecione um projeto</option>
          {projects.map(project => <option key={project.id} value={project.id}>{project.clientes?.nome || 'Cliente'} — {project.nome} ({project.id.slice(0, 8)})</option>)}
        </select>
      </CardContent></Card>
      {projectId && <>
        <Card><CardHeader><CardTitle>Enviar um arquivo novo</CardTitle></CardHeader><CardContent className="space-y-3">
          <p className="text-sm text-slate-600">O original deste novo arquivo será salvo no Drive. Ele aparecerá nesta área privada de teste. Limite: 100 MB por arquivo.</p>
          <input aria-label="Arquivo para enviar ao Drive" type="file" disabled={!!busy} onChange={event => {
            const file = event.target.files?.[0]; event.target.value = '';
            if (!file) return;
            void run(`Enviando ${file.name}…`, async () => {
              await uploadPilot(projectId, file, file.name, setProgress);
              await refresh(); toast.success('Arquivo salvo e verificado no Drive.');
            });
          }} />
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Arquivos atuais no Supabase</CardTitle></CardHeader><CardContent className="space-y-3">
          <p className="text-sm text-slate-600">Copie um arquivo para testar. O original permanece no Supabase e continua funcionando nas telas atuais.</p>
          {!originals.length && !busy && <p className="text-sm">Nenhum arquivo neste projeto.</p>}
          {originals.map(file => {
            const path = `${projectId}/${file.name}`;
            const copied = files.some(item => item.source_path === path && item.state === 'ready');
            return <div key={file.name} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"><span className="break-all text-sm">{file.name}</span><Button variant="outline" disabled={!!busy || copied} onClick={() => void run(`Copiando ${file.name}…`, async () => {
              const original = await supabase.storage.from('projetos_arquivos').download(path);
              if (original.error || !original.data) throw new Error('Não foi possível ler o original no Supabase.');
              await uploadPilot(projectId, original.data, file.name, setProgress, path);
              await refresh(); toast.success('Cópia conferida. O original foi preservado.');
            })}>{copied ? 'Copiado' : 'Copiar para o Drive'}</Button></div>;
          })}
        </CardContent></Card>
        <Card><CardHeader><CardTitle>Arquivos no Google Drive</CardTitle></CardHeader><CardContent className="space-y-3">
          {!files.length && !busy && <p className="text-sm">Nenhum arquivo enviado ao Drive neste projeto.</p>}
          {files.map(file => <div key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3">
            <div><p className="break-all text-sm font-medium">{file.name}</p><p className="text-xs text-slate-500">{mb(Number(file.size_bytes))} · {file.state === 'ready' ? 'Verificado' : 'Envio ou verificação pendente'} · {file.source_path ? 'Cópia do Supabase' : 'Original no Drive'}</p></div>
            <Button variant="outline" disabled={!!busy} onClick={() => void run(file.state === 'ready' ? `Baixando ${file.name}…` : 'Conferindo envio…', async () => {
              if (file.state === 'ready') await downloadPilot(file.id, file.name);
              else { await pilotRequest('finish', { recordId: file.id }); await refresh(); }
            })}>{file.state === 'ready' ? 'Baixar arquivo' : 'Verificar envio'}</Button>
          </div>)}
        </CardContent></Card>
      </>}
    </>}
    {busy && <div role="status" aria-live="polite" className="rounded-md bg-slate-100 p-4"><p>{busy}</p>{progress > 0 && <><progress className="mt-2 w-full" value={progress} max={100} /><p className="text-xs">{progress}% enviado. Aguarde a confirmação do Drive.</p></>}</div>}
  </div>;
}
