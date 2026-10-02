// A single calendar clock for the whole store, independent of each computer's timezone.
// Existing bookings were recorded using Brasília time (UTC-03).
export const AGENDA_TIME_ZONE = 'America/Sao_Paulo';
const clock = new Intl.DateTimeFormat('en-CA', {
  timeZone: AGENDA_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
});
function parts(timestamp: string | Date) {
  const values = Object.fromEntries(clock.formatToParts(new Date(timestamp)).map(p => [p.type, p.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day), hour: Number(values.hour), minute: Number(values.minute), second: Number(values.second) };
}
export function agendaDisplayDate(timestamp: string | Date): Date {
  const p = parts(timestamp);
  return new Date(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}
export function agendaDayKey(timestamp: string | Date): string {
  const p = parts(timestamp);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}
export function agendaTimestamp(day: string, time: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !/^\d{2}:\d{2}$/.test(time)) throw new Error('Data ou hora inválida.');
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const target = Date.UTC(year, month - 1, date, hour, minute);
  const check = new Date(target);
  if (check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== date || hour > 23 || minute > 59) throw new Error('Data ou hora inválida.');
  let instant = target;
  for (let i = 0; i < 3; i++) {
    const p = parts(new Date(instant));
    const shown = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    instant += target - shown;
  }
  const result = new Date(instant).toISOString();
  if (agendaDayKey(result) !== day) throw new Error('Data ou hora inválida.');
  return result;
}
