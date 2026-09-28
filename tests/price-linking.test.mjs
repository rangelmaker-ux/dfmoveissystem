import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';

async function loadTypeScriptModules(paths) {
  const source = paths.map(path => stripTypeScriptTypes(fs.readFileSync(path, 'utf8')))
    .join('\n').replace(/^import .*;$/mg, '');
  return import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
}

const modules = await loadTypeScriptModules([
  'src/lib/orcamento/default-materials.ts',
  'src/lib/orcamento/chapas-catalog.ts',
  'src/lib/orcamento/calculator.ts',
]);

const {
  INITIAL_CHAPAS_CATALOG,
  DEFAULT_MATERIALS,
  smartMatchAccessory,
  smartMatchPromobChapa,
  resolveItemPrice,
  calculateItemPrice,
  recalculateBudget,
} = modules;

const settings = {
  margin: 50, frete: 0, montagem: 0, comissao_vendas: 0,
  comissao_executivo: 0, outros: [], chapa_mode: 'm2',
  chapa_rounding: 'up', fita_mode: 'metros',
  pdf_show_unit_price: true, pdf_show_item_total: true,
};

test('smartMatchAccessory reconhece dobradiças, corrediças, puxadores e pistões Promob', () => {
  // Dobradiça Promob
  const dobradica = smartMatchAccessory('1.1086.000', 'Dobradiça Aço s/ Amort. Reta / Baixa', '31 x 42 x 2', INITIAL_CHAPAS_CATALOG, DEFAULT_MATERIALS);
  assert.equal(dobradica.matched, true);
  assert.equal(dobradica.price, 8.50);
  assert.equal(dobradica.unit, 'UN');

  // Dobradiça Curva Canto L
  const dobradicaCanto = smartMatchAccessory('1.1087.000', 'Dobradiça Curva Canto L com amortecedor', '', INITIAL_CHAPAS_CATALOG, DEFAULT_MATERIALS);
  assert.equal(dobradicaCanto.matched, true);
  assert.equal(dobradicaCanto.price, 22.52);

  // Corrediça Telescópica 450mm
  const corredica450 = smartMatchAccessory('0684371004', 'Corrediça Telescópica Simples Eco BHS 450mm', '450 x 45 x 12', INITIAL_CHAPAS_CATALOG, DEFAULT_MATERIALS);
  assert.equal(corredica450.matched, true);
  assert.equal(corredica450.price, 24.50);
  assert.equal(corredica450.unit, 'PAR');

  // Corrediça Invisível com freio
  const corredicaInvisivel = smartMatchAccessory('CORR-INV', 'Corrediça invisível com amortecedor 450mm', '', INITIAL_CHAPAS_CATALOG, DEFAULT_MATERIALS);
  assert.equal(corredicaInvisivel.matched, true);
  assert.equal(corredicaInvisivel.price, 65.00);

  // Puxador Gola
  const puxadorGola = smartMatchAccessory('PUX-GOLA', 'Puxador gola barra', '3m', INITIAL_CHAPAS_CATALOG, DEFAULT_MATERIALS);
  assert.equal(puxadorGola.matched, true);
  assert.equal(puxadorGola.price, 130.00);

  // Pistão a gás
  const pistao = smartMatchAccessory('PIST-01', 'Pistão a gás para porta basculante', '', INITIAL_CHAPAS_CATALOG, DEFAULT_MATERIALS);
  assert.equal(pistao.matched, true);
  assert.equal(pistao.price, 13.50);
});

test('smartMatchPromobChapa reconhece MDF Branco da caixaria Promob com preço exato de tabela', () => {
  // Base 15mm Branco (1.2006.15.Branco.MDF BP 2L Revest)
  const base15 = smartMatchPromobChapa('1.2006.15.Branco.MDF BP 2L Revest', 'Base 15', INITIAL_CHAPAS_CATALOG);
  assert.equal(base15.matched, true);
  assert.equal(base15.brand, 'Arauco');
  assert.equal(base15.thickness, '15mm');
  assert.equal(base15.boardPrice, 220);
  assert.equal(base15.m2Cost, 56.22);

  // Fundo 6mm Branco (1.2014.6.Branco.Aglom)
  const fundo6 = smartMatchPromobChapa('1.2014.6.Branco.Aglom', 'Fundo 6mm', INITIAL_CHAPAS_CATALOG);
  assert.equal(fundo6.matched, true);
  assert.equal(fundo6.brand, 'Arauco');
  assert.equal(fundo6.thickness, '6mm');
  assert.equal(fundo6.boardPrice, 176);
  assert.equal(fundo6.m2Cost, 44.97);

  // Chapa Greenplac Carmel 18mm
  const greenplac18 = smartMatchPromobChapa('1.0309.18.Greenplac.Carmel.MDF BP 2L Revest', 'Lateral 18', INITIAL_CHAPAS_CATALOG);
  assert.equal(greenplac18.matched, true);
  assert.equal(greenplac18.brand, 'Greenplac');
  assert.equal(greenplac18.thickness, '18mm');
  assert.equal(greenplac18.m2Cost, 116.94);
});

test('resolveItemPrice e Trazer Preços da Tabela vinculam todos os itens do orçamento', () => {
  const rawItems = [
    {
      code: '4.9999',
      description: 'Torre Dupla',
      quantity: 1,
      unit: 'UN',
      is_parent_module: true,
      unit_cost: 0,
    },
    {
      code: '1.1086.000',
      description: 'Dobradiça Aço s/ Amort. Reta / Baixa',
      quantity: 26,
      unit: 'UN',
      dimensions: '31 x 42 x 2',
      unit_cost: 0,
    },
    {
      code: '1.2006.15.Branco.MDF BP 2L Revest',
      description: 'Base 15',
      quantity: 0.78,
      unit: 'M2',
      rep: 2,
      unit_quantity: 0.39,
      dimensions: '670 x 15 x 580',
      unit_cost: 0,
    },
    {
      code: '1.2014.6.Branco.Aglom',
      description: 'Fundo 6mm',
      quantity: 0.49,
      unit: 'M2',
      rep: 1,
      unit_quantity: 0.49,
      dimensions: '700 x 6 x 700',
      unit_cost: 0,
    },
    {
      code: '0684371004',
      description: 'Corrediça Telescópica 450mm Eco',
      quantity: 4,
      unit: 'PAR',
      unit_cost: 0,
    }
  ];

  // Simula o clique no botão "Trazer Preços da Tabela"
  let matchedCount = 0;
  const updatedItems = rawItems.map(it => {
    if (it.is_parent_module) return calculateItemPrice(it, DEFAULT_MATERIALS, settings, INITIAL_CHAPAS_CATALOG);

    const res = resolveItemPrice(it, INITIAL_CHAPAS_CATALOG, DEFAULT_MATERIALS);
    if (res.matched && res.unit_cost > 0) {
      matchedCount++;
      return calculateItemPrice({
        ...it,
        code: res.code || it.code,
        unit_cost: res.unit_cost,
        unit: res.unit || it.unit,
        table_price: res.unit_cost,
        price_unlinked: false,
      }, DEFAULT_MATERIALS, settings, INITIAL_CHAPAS_CATALOG);
    }
    return calculateItemPrice(it, DEFAULT_MATERIALS, settings, INITIAL_CHAPAS_CATALOG);
  });

  // Todos os 4 itens operacionais devem ter sido reconhecidos e vinculados!
  assert.equal(matchedCount, 4);

  // Item 1 (Dobradiça)
  assert.equal(updatedItems[1].unit_cost, 8.50);
  assert.equal(updatedItems[1].found, true);
  assert.equal(updatedItems[1].price_unlinked, false);
  assert.equal(updatedItems[1].total_cost, 221.00); // 26 * 8.50

  // Item 2 (Base 15mm)
  assert.equal(updatedItems[2].unit_cost, 56.22);
  assert.equal(updatedItems[2].found, true);
  assert.equal(updatedItems[2].total_cost, 43.85); // 0.78 * 56.22 = 43.8516 -> 43.85

  // Item 3 (Fundo 6mm)
  assert.equal(updatedItems[3].unit_cost, 44.97);
  assert.equal(updatedItems[3].found, true);
  assert.equal(updatedItems[3].total_cost, 22.04); // 0.49 * 44.97 = 22.0353 -> 22.04

  // Item 4 (Corrediça 450mm)
  assert.equal(updatedItems[4].unit_cost, 24.50);
  assert.equal(updatedItems[4].found, true);
  assert.equal(updatedItems[4].total_cost, 98.00); // 4 * 24.50

  // Recalcular o orçamento completo
  const budget = recalculateBudget(updatedItems, DEFAULT_MATERIALS, settings, INITIAL_CHAPAS_CATALOG);
  assert.equal(budget.totals.items_count, 5);
  // Total cost: 221 + 43.85 + 22.04 + 98 = 384.89
  assert.equal(budget.totals.total_cost, 384.89);
  assert.ok(budget.totals.total_price > budget.totals.total_cost);
});
