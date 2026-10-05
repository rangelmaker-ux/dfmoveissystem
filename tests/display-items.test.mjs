import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const source = ['default-materials', 'chapas-catalog', 'calculator', 'display-items'].map(name => stripTypeScriptTypes(fs.readFileSync(`src/lib/orcamento/${name}.ts`, 'utf8'))).join('\n').replace(/^import .*;$/mg, '');
const m = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const base = { id: 'a', code: 'PUDINC.365.5.500', description: 'Puxador Udine', itemCategory: 'ACCESSORY', category: 'Acessórios', quantity: 1, unit: 'UN', unit_cost: 85, unit_price: 85, total_cost: 85, total_price: 85, rep: 1, unit_quantity: 1, dimensions: '365.5 x 16 x 34', price_origin: 'manual' };
test('two identical handles become one row with quantity 2 and cost 170 without altering originals', () => {
  const items = [base, { ...base, id: 'b', parentId: 'other-parent' }];
  const rows = m.consolidateDisplayItems(items);
  assert.equal(rows.length, 1); assert.equal(rows[0].quantity, 2); assert.equal(rows[0].total_cost, 170); assert.equal(rows[0].total_price, 170);
  assert.equal(items.length, 2); assert.equal(items[0].quantity, 1);
  assert.deepEqual([...m.displaySourceIds(items, 'a')], ['a', 'b']);
});
test('fractional consumption is summed and different finish, dimension or price stays separate', () => {
  const items = [{ ...base, quantity: .226, total_cost: 19.21, total_price: 19.21 }, { ...base, id: 'b', quantity: .226, total_cost: 19.21, total_price: 19.21 }];
  const row = m.consolidateDisplayItems(items)[0];
  assert.equal(row.quantity, .452); assert.equal(row.total_cost, 38.42);
  assert.equal(m.consolidateDisplayItems([base, { ...base, id: 'b', external_model: 'Preto' }, { ...base, id: 'c', dimensions: '225 x 16 x 34' }, { ...base, id: 'd', unit_cost: 90 }]).length, 4);
});
test('empty furniture grouping is hidden but zero-priced accessories and real pieces remain', () => {
  const rows = m.consolidateDisplayItems([{ ...base, id: 'module', itemCategory: 'MODULE', is_parent_module: true, total_cost: 0, total_price: 0 }, { ...base, id: 'zero', unit_cost: 0, unit_price: 0, total_cost: 0, total_price: 0, quantity: 2 }, { ...base, id: 'part', itemCategory: 'CUT_PART', total_cost: 0, total_price: 0 }]);
  assert.deepEqual(rows.map(item => item.id), ['zero', 'part']);
  assert.equal(rows[0].quantity, 2);
});
test('quantity edit changes the aggregate once and preserves source IDs and parent relationships', () => {
  const items = [base, { ...base, id: 'b', parentId: 'parent' }];
  const updated = m.redistributeDisplayQuantity(items, m.displaySourceIds(items, 'a'), 3);
  assert.equal(updated.reduce((sum, item) => sum + item.quantity, 0), 3);
  assert.equal(updated[1].parentId, 'parent'); assert.equal(updated[1].id, 'b');
  const settings = { margin: 200, frete: 0, montagem: 0, comissao_vendas: 0, comissao_executivo: 0, outros: [], chapa_mode: 'm2', chapa_rounding: 'up', fita_mode: 'metros' };
  assert.equal(m.recalculateBudget(updated, [], settings, {}).totals.total_price, 255);
  const reduced = m.redistributeDisplayQuantity(items, m.displaySourceIds(items, 'a'), 1);
  assert.equal(m.recalculateBudget(reduced, [], settings, {}).totals.total_price, 85);
});
