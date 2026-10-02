import test from 'node:test';
import assert from 'node:assert/strict';
import { stripTypeScriptTypes } from 'node:module';
import fs from 'node:fs';
const source = stripTypeScriptTypes(fs.readFileSync('src/lib/agenda-time.ts', 'utf8'));
const agenda = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('dia 2 e horário da agenda são iguais no computador do admin e do projetista', () => {
  const original = process.env.TZ;
  try {
    for (const tz of ['America/Sao_Paulo', 'America/Cuiaba', 'UTC', 'America/Los_Angeles']) {
      process.env.TZ = tz;
      const instant = agenda.agendaTimestamp('2026-10-02', '00:00');
      assert.equal(instant, '2026-10-02T03:00:00.000Z');
      assert.equal(agenda.agendaDayKey(instant), '2026-10-02');
      const displayed = agenda.agendaDisplayDate(instant);
      assert.equal(displayed.getDate(), 2);
      assert.equal(displayed.getHours(), 0);
      assert.equal(agenda.agendaTimestamp('2026-10-02', '14:30'), '2026-10-02T17:30:00.000Z');
    }
  } finally { if (original === undefined) delete process.env.TZ; else process.env.TZ = original; }
});
test('agenda rejeita datas inexistentes e preserva a virada do mês', () => {
  assert.throws(() => agenda.agendaTimestamp('2026-02-30', '10:00'));
  assert.throws(() => agenda.agendaTimestamp('2026-10-02', '24:00'));
  assert.equal(agenda.agendaDayKey('2026-11-01T02:59:59.000Z'), '2026-10-31');
  assert.equal(agenda.agendaDayKey('2026-11-01T03:00:00.000Z'), '2026-11-01');
});
