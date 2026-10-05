import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';

const source = stripTypeScriptTypes(fs.readFileSync('src/lib/orcamento/pdf-generator.ts', 'utf8')).replace(/^import .*;$/mg, '');
const captures = { texts: [], rows: [] };
class PdfMock {
  internal = { pageSize: { getWidth: () => 210 } };
  lastAutoTable = { finalY: 100 };
  setFillColor() {} rect() {} setTextColor() {} setFontSize() {} setFont() {}
  roundedRect() {} addPage() {} save() {}
  text(value) { captures.texts.push(value); }
  splitTextToSize(value) { return value; }
}
globalThis.__pdfMock = PdfMock;
globalThis.__pdfCaptures = captures;
const module = await import(`data:text/javascript;base64,${Buffer.from(`
const jsPDF = globalThis.__pdfMock;
const autoTable = (_doc, options) => globalThis.__pdfCaptures.rows = options.body;
const missingPriceItems = items => items.filter(item => item.pending);
const budgetPresentationItems = items => items;
${source}`).toString('base64')}`);

test('PDF hides zero lines for saved and current budgets without losing repeated MDF or changing totals and pending warning', () => {
  const panel = { code: 'MDF18', description: 'MDF Branco 18 mm', quantity: 1, unit: 'M2', unit_price: 100, total_price: 100 };
  const items = [{ ...panel, total_price: 0, unit_price: 0, pending: true }, { ...panel, item_number: 9 }, { ...panel, item_number: 15 }];
  const before = structuredClone(items);
  module.generateBudgetPdf({ clientName: 'Teste', projectName: 'Cozinha', items,
    settings: { pdf_show_unit_price: true, pdf_show_item_total: true },
    totals: { total_price: 200, total_cost: 100, gross_profit: 100 } });
  assert.equal(captures.rows.length, 2);
  assert.deepEqual(captures.rows.map(row => row[0]), ['1', '2']);
  assert.equal(captures.rows[0][1], 'MDF18');
  assert.equal(captures.rows[1][1], 'MDF18');
  assert.ok(captures.texts.includes('ORÇAMENTO INCOMPLETO — 1 MATERIAIS SEM PREÇO'));
  assert.ok(captures.texts.includes((200).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })));
  assert.ok(captures.texts.includes('Qtd de Itens: 2'));
  assert.deepEqual(items, before);
});
