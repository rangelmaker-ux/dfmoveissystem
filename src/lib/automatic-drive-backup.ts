import { supabase } from '@/integrations/supabase/client';
import { useAuthStore } from '@/hooks/use-auth';
import { DRIVE_PILOT_AUTH_ID, DRIVE_PILOT_EMAIL, pilotRequest, uploadPilot } from '@/lib/drive-pilot';
import { toast } from 'sonner';

interface BackupJob { projectId: string; sourcePath: string; name: string }
const QUEUE_KEY = `df-drive-backup-queue:${DRIVE_PILOT_AUTH_ID}`;
const sourceFiles = new Map<string, File>();
let running: Promise<void> | null = null;

function pilotSession() {
  const { user, role } = useAuthStore.getState();
  return role === 'ADMIN' && user?.id === DRIVE_PILOT_AUTH_ID && user.email.toLowerCase() === DRIVE_PILOT_EMAIL;
}
function readJobs(): BackupJob[] {
  const saved: unknown = JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  if (!Array.isArray(saved)) throw new Error('Fila de cópias inválida.');
  return saved.filter((job): job is BackupJob => typeof job?.projectId === 'string' && typeof job?.sourcePath === 'string' && typeof job?.name === 'string' && job.sourcePath.startsWith(`${job.projectId}/`));
}
function writeJobs(jobs: BackupJob[]) { localStorage.setItem(QUEUE_KEY, JSON.stringify(jobs)); }

// Called only AFTER Supabase confirms the original upload. No original is deleted.
export async function copyUploadedFileAutomatically(projectId: string, sourcePath: string, file: File) {
  if (!pilotSession()) return;
  const job = { projectId, sourcePath, name: sourcePath.split('/').at(-1)! };
  try {
    const jobs = readJobs();
    if (!jobs.some(item => item.sourcePath === sourcePath)) writeJobs([...jobs, job]);
    sourceFiles.set(sourcePath, file);
    toast.info('Arquivo salvo no sistema. Criando a cópia no Google Drive…');
    await retryAutomaticDriveCopies(true);
  } catch {
    toast.warning('Arquivo salvo no sistema. Não foi possível agendar a cópia no Drive neste navegador. Confira a área Drive — teste privado.');
  }
}

export function retryAutomaticDriveCopies(notify = false): Promise<void> {
  if (running) return running;
  if (!pilotSession()) return Promise.resolve();
  running = (async () => {
    try {
      if (!readJobs().length) return;
      // Fresh identity validation; the API also checks active hidden ADMIN on every action.
      const identity = await supabase.auth.getUser();
      if (identity.data.user?.id !== DRIVE_PILOT_AUTH_ID) return;
      const status = await pilotRequest<{ connected: boolean }>('status');
      if (!status.connected) throw new Error('Conecte o Google Drive na área de teste.');
      // Re-read after each job so uploads enqueued while another transfer runs are also copied.
      for (let count = 0; count < 100; count++) {
        if (!pilotSession()) break;
        const job = readJobs()[0];
        if (!job) break;
        let file: Blob | undefined = sourceFiles.get(job.sourcePath);
        if (!file) {
          const original = await supabase.storage.from('projetos_arquivos').download(job.sourcePath);
          if (original.error || !original.data) throw new Error('Não foi possível ler o original para repetir a cópia.');
          file = original.data;
        }
        await uploadPilot(job.projectId, file, job.name, () => {}, job.sourcePath);
        // Keep failed or interrupted copies queued; remove only after server verification.
        writeJobs(readJobs().filter(item => item.sourcePath !== job.sourcePath));
        sourceFiles.delete(job.sourcePath);
        if (notify) toast.success('Cópia automática salva e verificada no Google Drive.');
      }
    } catch (error) {
      if (notify) toast.warning(`Arquivo salvo no sistema. A cópia no Drive ficou pendente e será tentada novamente. ${error instanceof Error ? error.message : ''}`);
    }
  })().finally(() => { running = null; });
  return running;
}
