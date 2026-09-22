import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

async function loadTypeScriptModules(paths) {
  const source = paths.map(path => stripTypeScriptTypes(fs.readFileSync(path, 'utf8')))
    .join('\n').replace(/^import .*;$/mg, '');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

const calculator = await loadTypeScriptModules([
  'src/lib/orcamento/chapas-catalog.ts',
  'src/lib/orcamento/calculator.ts',
]);
const parsers = await loadTypeScriptModules(['src/lib/orcamento/parsers.ts']);

const settings = {
  margin: 0, frete: 0, montagem: 0, comissao_vendas: 0,
  comissao_executivo: 0, outros: [], chapa_mode: 'm2',
  chapa_rounding: 'up', fita_mode: 'metros',
  pdf_show_unit_price: true, pdf_show_item_total: true,
};

test('calcula Ultra 15 mm com 30% de perda', () => {
  assert.equal(calculator.chapaSalePrice(780), 199.31);
  assert.equal(calculator.smartMatchPromobChapa('Duratex ULTRA 15mm', 'MDF').m2Cost, 199.31);
});

test('não usa preço de outra espessura quando a selecionada não existe', () => {
  assert.equal(calculator.smartMatchPromobChapa('Duratex ULTRA 25mm', 'MDF').matched, false);
});

test('desvinculação permanece após recálculo', () => {
  const linked = calculator.calculateItemPrice({ code: 'Duratex ULTRA 15mm', description: 'MDF', quantity: 2, unit: 'M2' }, [], settings);
  const detached = calculator.recalculateBudget([{ ...linked, unit_cost: 0, price_unlinked: true }], [], settings).items[0];
  assert.equal(detached.unit_cost, 0);
  assert.equal(detached.found, false);
});

test('TXT dimensional converte milímetros para metros quadrados', () => {
  const [item] = parsers.parseTXT('2;1000;500;DURATEX.ULTRA.15MM;Lateral');
  assert.equal(item.quantity, 1);
  assert.equal(item.unit, 'M2');
});

test('CSV respeita delimitadores dentro de campos entre aspas', () => {
  const [item] = parsers.parseCSV('codigo;descricao;quantidade;unidade\nABC;"Puxador, dourado";2;UN');
  assert.equal(item.description, 'Puxador, dourado');
  assert.equal(item.quantity, 2);
});

test('JSON rejeita estrutura inválida, normaliza e agrupa itens', () => {
  assert.throws(() => parsers.parseJSON('{"items":{}}'));
  const result = parsers.parseJSON('[{"code":"A","quantity":"1,5"},{"code":"A","quantity":2}]');
  assert.equal(result[0].quantity, 3.5);
});
