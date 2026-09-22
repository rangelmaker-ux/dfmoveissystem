import type { ProjectStatus } from '@/types/database';

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  PRONTO: 'Aguardando distribuição',
  EM_EXECUCAO: 'Em desenvolvimento',
  PAUSADO: 'Pausado',
  ATRASADO: 'Prazo vencido',
  FINALIZADO: 'Finalizado',
  EM_ACOMPANHAMENTO: 'Em acompanhamento',
};

export const PROJECT_STATUS_STYLES: Record<ProjectStatus, string> = {
  PRONTO: 'border-amber-200 bg-amber-50 text-amber-800',
  EM_EXECUCAO: 'border-sky-200 bg-sky-50 text-sky-800',
  PAUSADO: 'border-slate-200 bg-slate-100 text-slate-700',
  ATRASADO: 'border-rose-200 bg-rose-50 text-rose-800',
  FINALIZADO: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  EM_ACOMPANHAMENTO: 'border-violet-200 bg-violet-50 text-violet-800',
};

export const SOURCE_LABELS: Record<string, string> = {
  ARQUITETO: 'Acompanhado por arquiteto',
  INDICACAO: 'Indicação',
  VENDA_DIRETA: 'Atendimento direto',
  REFORMA: 'Reforma / cliente da casa',
};

export const INDETERMINATE_DEADLINE = '9999-12-31';

export function isIndeterminateDeadline(value?: string | null): boolean {
  if (!value) return true;
  return value === INDETERMINATE_DEADLINE || value.startsWith('9999') || value.toLowerCase() === 'indeterminado';
}

export function calculateThirtyDaysDeadline(from?: Date): string {
  const d = new Date(from ?? new Date());
  d.setDate(d.getDate() + 30);
  return d.toISOString().slice(0, 10);
}

export function formatDate(value?: string | null) {
  if (!value || isIndeterminateDeadline(value)) return 'Indeterminado';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return 'Sem prazo';
  return new Intl.DateTimeFormat('pt-BR').format(new Date(year, month - 1, day));
}

export function deadlineState(value?: string | null) {
  if (!value || isIndeterminateDeadline(value)) {
    return { label: 'Indeterminado', tone: 'neutral' as const, days: null };
  }

  const target = new Date(`${value.slice(0, 10)}T12:00:00`);
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const days = Math.ceil((target.getTime() - today.getTime()) / 86_400_000);

  if (days < 0) return { label: `${Math.abs(days)}d em atraso`, tone: 'danger' as const, days };
  if (days === 0) return { label: 'Vence hoje', tone: 'danger' as const, days };
  if (days <= 2) return { label: `${days}d restantes`, tone: 'warning' as const, days };
  return { label: `${days}d restantes`, tone: 'success' as const, days };
}

export function initials(name?: string | null) {
  if (!name) return 'DF';
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}
