import { indicatorState, useServerStatus } from '@/lib/server-status';

export function ServerStatusDot() {
  const color = useServerStatus(indicatorState);
  const label = color === 'green' ? 'Conectado ao servidor' : color === 'yellow' ? 'Conectando ou enviando alterações' : 'Falha de conexão ou envio';
  return <span role="status" aria-label={label} title={label} className="inline-flex h-9 w-7 shrink-0 items-center justify-center">
    <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ring-2 ring-white ${color === 'green' ? 'bg-emerald-500' : color === 'yellow' ? 'bg-amber-400' : 'bg-red-500 animate-pulse motion-reduce:animate-none'}`} />
    <span className="sr-only">{label}</span>
  </span>;
}
