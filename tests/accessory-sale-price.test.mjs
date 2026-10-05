import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

const source = ['default-materials', 'chapas-catalog', 'calculator', 'parsers']
  .map(name => stripTypeScriptTypes(fs.readFileSync(`src/lib/orcamento/${name}.ts`, 'utf8')))
  .join('\n').replace(/^import .*;$/mg, '');
const m = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const settings = { margin: 200, frete: 10, montagem: 10, comissao_vendas: 5,
  comissao_executivo: 5, outros: [], chapa_mode: 'm2', chapa_rounding: 'up', fita_mode: 'metros' };

test('puxador salvo como módulo pai perde o acréscimo antigo de 520,20', () => {
  const item = { id: 'udine', code: 'PUDINC.365.5.500', description: 'Puxador Udine p/ Porta 365.5x16x34 Aluminio',
    category: 'Acessórios', quantity: 2, unit: 'UN', unit_cost: 85, table_price: 85,
    total_cost: 170, total_price: 520.20, final_price: 520.20, unit_price: 260.10,
    price_origin: 'imported', is_parent_module: true, promob_xml: true };
  const result = m.recalculateBudget([item], [], settings);
  assert.equal(result.items[0].itemCategory, 'ACCESSORY');
  assert.equal(result.items[0].total_cost, 170);
  assert.equal(result.items[0].total_price, 170);
  assert.equal(result.totals.total_price, 170);
  assert.equal(m.groupItemsByModule(result.items)[0].subtotal_price, 170);
  assert.equal(m.recalculateBudget(result.items, [], settings).totals.total_price, 170);
});

test('acessório com venda manual antiga usa custo e quantidade atuais', () => {
  const result = m.recalculateBudget([{ id: 'handle', code: 'ACC', description: 'Puxador',
    itemCategory: 'ACCESSORY', category: 'Ferragens', unit: 'UN', quantity: 3,
    unit_cost: 85, unit_price: 260.10, total_cost: 170, total_price: 520.20,
    price_unlinked: true, price_origin: 'manual' }], [], settings);
  assert.equal(result.items[0].total_cost, 255);
  assert.equal(result.items[0].total_price, 255);
});

for (const description of ['Puxador', 'Dobradiça', 'Corrediça', 'Pistão', 'Ferragem']) {
  test(`${description}: XML usa preço final 30 x 3 = 90, sem margem nem acréscimos`, () => {
    const { items } = m.parsePromobXML(`<LISTING><AMBIENTS><AMBIENT><ITEMS>
      <ITEM GUID="accessory" REFERENCE="ACC" DESCRIPTION="${description}" CATEGORY="Ferragens" UNIT="UN" QUANTITY="1" REPETITION="3">
      <PRICE TABLE="30" TOTAL="270"><MARGINS><BUDGET TOTAL="270"/></MARGINS></PRICE>
      </ITEM></ITEMS></AMBIENT></AMBIENTS></LISTING>`);
    const database = [{ id: 'accessory', code: 'ACC', description, category: 'Ferragens', unit: 'UN', unit_price: 30 }];
    const priced = m.recalculateBudget(items, database, settings);
    assert.equal(priced.items[0].unit_price, 30);
    assert.equal(priced.items[0].margin, 0);
    assert.equal(priced.totals.total_price, 90);
    assert.equal(m.recalculateBudget(priced.items, database, settings).totals.total_price, 90);
  });
}

test('preço do catálogo compartilhado prevalece e quantidade editada recalcula sem margem', () => {
  const database = [{ id: 'handle', code: 'ACC', description: 'Puxador Teste', category: 'Ferragens', unit: 'UN', unit_price: 30 }];
  const item = m.calculateItemPrice({ code: 'ACC', description: 'Puxador Teste', quantity: 3,
    unit: 'UN', promob_xml: true, price_origin: 'calculated' }, database, settings);
  assert.equal(item.total_price, 90);
  const changed = m.recalculateBudget([{ ...item, quantity: 4, original_quantity: 4 }], database, settings);
  assert.equal(changed.totals.total_price, 120);
});

test('materiais continuam recebendo a margem configurada', () => {
  const item = m.calculateItemPrice({ code: 'MATERIAL', description: 'Material avulso', quantity: 3,
    unit: 'UN', table_price: 30 }, [], { ...settings, frete: 0, montagem: 0, comissao_vendas: 0, comissao_executivo: 0 });
  assert.equal(item.margin, 200);
  assert.equal(item.total_price, 270);
});
