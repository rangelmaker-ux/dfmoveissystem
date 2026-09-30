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
  isSimilarPromobItem,
  smartMatchMaoDeObra,
  groupItemsByModule,
  isEletrodomestico,
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

  // Pistão a gás (preço real verificado do catálogo: R$ 14,50)
  const pistao = smartMatchAccessory('PIST-01', 'Pistão a gás para porta basculante', '', INITIAL_CHAPAS_CATALOG, DEFAULT_MATERIALS);
  assert.equal(pistao.matched, true);
  assert.equal(pistao.price, 14.50);
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

test('isSimilarPromobItem detecta peças com mesmo material e ferragens semelhantes', () => {
  const base15Branco = {
    code: '1.2006.15.Branco.MDF BP 2L Revest',
    description: 'Base 15',
    unit: 'M2',
    is_chapa: true,
  };

  const lateral15Branco = {
    code: '1.2007.15.Branco.MDF BP 2L Revest',
    description: 'Lateral 15',
    unit: 'M2',
    is_chapa: true,
  };

  const fundo6Branco = {
    code: '1.2014.6.Branco.Aglom',
    description: 'Fundo 6mm',
    unit: 'M2',
    is_chapa: true,
  };

  const lateral18Carmel = {
    code: '1.0309.18.Greenplac.Carmel.MDF BP 2L Revest',
    description: 'Lateral 18',
    unit: 'M2',
    is_chapa: true,
  };

  // Base 15 Branco e Lateral 15 Branco são similares (mesmo material e espessura 15mm)
  assert.equal(isSimilarPromobItem(base15Branco, lateral15Branco, false), true);

  // Fundo 6mm NÃO é similar a Base 15mm (espessuras diferentes: 6mm vs 15mm)
  assert.equal(isSimilarPromobItem(base15Branco, fundo6Branco, false), false);

  // Lateral 18 Carmel NÃO é similar a Base 15 Branco (material e espessuras diferentes)
  assert.equal(isSimilarPromobItem(base15Branco, lateral18Carmel, false), false);

  // Teste de Acessórios
  const dobradicaReta = {
    code: '1.1086.000',
    description: 'Dobradiça Aço s/ Amort. Reta / Baixa',
    unit: 'UN',
  };

  const dobradicaCurva = {
    code: '1.1087.000',
    description: 'Dobradiça Curva Canto L',
    unit: 'UN',
  };

  const corredica = {
    code: '0684371004',
    description: 'Corrediça Telescópica 450mm',
    unit: 'PAR',
  };

  // Dobradiças são da mesma família de ferragens
  assert.equal(isSimilarPromobItem(dobradicaReta, dobradicaCurva, true), true);

  // Corrediça NÃO é similar a Dobradiça
  assert.equal(isSimilarPromobItem(dobradicaReta, corredica, true), false);
});

test('smartMatchMaoDeObra reconhece processos fixos de fabricação Promob (Porta Reta, Porta Cava, Frente Cava)', () => {
  // Item 95 do Promob: Porta Reta
  const portaReta = smartMatchMaoDeObra('POR-RETA', 'Processo de Fabricação Porta Reta', INITIAL_CHAPAS_CATALOG, DEFAULT_MATERIALS);
  assert.equal(portaReta.matched, true);
  assert.equal(portaReta.price, 70.00);
  assert.equal(portaReta.unit, 'UN');

  // Item 96 do Promob: Porta Cava
  const portaCava = smartMatchMaoDeObra('POR-CAVA', 'Porta Cava Horizontal', INITIAL_CHAPAS_CATALOG, DEFAULT_MATERIALS);
  assert.equal(portaCava.matched, true);
  assert.equal(portaCava.price, 70.00);

  // Item 94 do Promob: Frente Cava
  const frenteCava = smartMatchMaoDeObra('FRE-CAVA', 'Frente Cava Horizontal', INITIAL_CHAPAS_CATALOG, DEFAULT_MATERIALS);
  assert.equal(frenteCava.matched, true);
  assert.equal(frenteCava.price, 70.00);

  // Montagem de Módulo
  const montagem = smartMatchMaoDeObra('MONT-MOD', 'Montagem de Módulo no Cliente', INITIAL_CHAPAS_CATALOG, DEFAULT_MATERIALS);
  assert.equal(montagem.matched, true);
  assert.equal(montagem.price, 60.00);
});

test('groupItemsByModule agrupa módulos pais com suas respectivas peças de corte, acessórios e processos', () => {
  const sampleItems = [
    // Acessórios
    { id: '1', code: 'DOBR-RETA', description: 'Dobradiça Reta', quantity: 26, rep: 26, unit: 'UN', unit_cost: 10, unit_price: 20, total_cost: 260, total_price: 520, category: 'Acessórios' },
    // Módulo Torre e peças
    { id: '2', code: 'MOD-TORRE', description: 'Torre 2 Portas', quantity: 1, rep: 1, unit: 'UN', unit_cost: 0, unit_price: 0, total_cost: 0, total_price: 0, is_parent_module: true, category: 'Cozinhas' },
    { id: '3', code: 'BASE-15', description: 'Base Inferior', quantity: 0.8, rep: 1, unit: 'M2', unit_cost: 100, unit_price: 200, total_cost: 80, total_price: 160, module_name: 'Torre 2 Portas', category: 'Cozinhas' },
    { id: '4', code: 'LAT-15', description: 'Lateral Direita', quantity: 1.2, rep: 1, unit: 'M2', unit_cost: 100, unit_price: 200, total_cost: 120, total_price: 240, module_name: 'Torre 2 Portas', category: 'Cozinhas' },
    // Processos
    { id: '5', code: 'POR-RETA', description: 'Porta Reta', quantity: 10, rep: 10, unit: 'UN', unit_cost: 70, unit_price: 140, total_cost: 700, total_price: 1400, category: 'Processo de Fabricação', is_processo: true },
  ];

  const groups = groupItemsByModule(sampleItems);
  assert.equal(groups.length, 3);

  // Grupo 1: Acessórios
  const accGroup = groups.find(g => g.is_hardware_only);
  assert.ok(accGroup);
  assert.equal(accGroup.items.length, 1);
  assert.equal(accGroup.subtotal_cost, 260);

  // Grupo 2: Módulo Torre
  const torreGroup = groups.find(g => g.name.includes('Torre'));
  assert.ok(torreGroup);
  assert.equal(torreGroup.items.length, 2); // Base + Lateral
  assert.equal(torreGroup.subtotal_cost, 200); // 80 + 120
  assert.equal(torreGroup.subtotal_price, 400); // 160 + 240

  // Grupo 3: Processos
  const procGroup = groups.find(g => g.is_process_only);
  assert.ok(procGroup);
  assert.equal(procGroup.items.length, 1);
  assert.equal(procGroup.subtotal_cost, 700);
});

test('Caixa Armário e Caixa Gaveta mantêm seus preços de tabela Promob e vinculam corretamente', () => {
  const caixaArmario = {
    id: 'c1',
    code: '1.0245.990.Branco',
    description: 'Caixa Armário',
    quantity: 1,
    unit: 'UN',
    table_price: 122.12,
    final_price: 366.36,
  };

  const resolved = resolveItemPrice(caixaArmario, INITIAL_CHAPAS_CATALOG, DEFAULT_MATERIALS);
  assert.equal(resolved.matched, true);
  assert.equal(resolved.unit_cost, 122.12);
  assert.equal(resolved.source, 'promob_table');

  const calculated = calculateItemPrice(caixaArmario, DEFAULT_MATERIALS, settings, INITIAL_CHAPAS_CATALOG);
  assert.equal(calculated.found, true);
  assert.equal(calculated.unit_cost, 122.12);
  assert.equal(calculated.total_cost, 122.12);
  assert.equal(calculated.total_price, 366.36);

  // Caixa Gaveta
  const caixaGaveta = {
    id: 'c2',
    code: '1.0252.414.9998.Branco',
    description: 'Caixa Gaveta c/ Contra Frente',
    quantity: 1,
    unit: 'UN',
    table_price: 20.90,
    final_price: 62.70,
  };
  const resolvedGav = resolveItemPrice(caixaGaveta, INITIAL_CHAPAS_CATALOG, DEFAULT_MATERIALS);
  assert.equal(resolvedGav.matched, true);
  assert.equal(resolvedGav.unit_cost, 20.90);
});

test('Eletrodomésticos são identificados, têm custo zero e ficam agrupados no final sem afetar total', () => {
  const forno = { id: 'e1', code: 'FORNO-ELET', description: 'Forno Elétrico Embutir 84L Electrolux', quantity: 1, rep: 1, unit: 'UN', unit_cost: 3500, table_price: 3500, final_price: 3500 };
  const cooktop = { id: 'e2', code: 'COOK-5BOCAS', description: 'Fogão Cooktop 5 Bocas a Gás Brastemp', quantity: 1, rep: 1, unit: 'UN', unit_cost: 1200, table_price: 1200, final_price: 1200 };
  const geladeira = { id: 'e3', code: 'GELAD-FROST', description: 'Geladeira Frost Free Inverse Consul', quantity: 1, rep: 1, unit: 'UN' };
  const base = { id: 'm1', code: 'BASE-15', description: 'Base 15mm Branco', quantity: 1, rep: 1, unit: 'M2', unit_cost: 80, unit_price: 160, total_cost: 80, total_price: 160 };

  assert.equal(isEletrodomestico(forno.code, forno.description), true);
  assert.equal(isEletrodomestico(cooktop.code, cooktop.description), true);
  assert.equal(isEletrodomestico(geladeira.code, geladeira.description), true);
  assert.equal(isEletrodomestico(base.code, base.description), false);

  // calculateItemPrice must zero out prices for appliances
  const calcForno = calculateItemPrice(forno, DEFAULT_MATERIALS, settings, INITIAL_CHAPAS_CATALOG);
  assert.equal(calcForno.unit_cost, 0);
  assert.equal(calcForno.unit_price, 0);
  assert.equal(calcForno.total_cost, 0);
  assert.equal(calcForno.total_price, 0);
  assert.equal(calcForno.category, 'Eletrodomésticos');

  // recalculateBudget must not add appliance prices to total_cost or total_price
  const budget = recalculateBudget([base, forno, cooktop], DEFAULT_MATERIALS, settings, INITIAL_CHAPAS_CATALOG);
  assert.equal(budget.totals.total_cost, 80);
  assert.equal(budget.totals.total_price, 120);

  // groupItemsByModule must group all appliances at the bottom in group-eletros with 0 subtotals
  const groups = groupItemsByModule([calcForno, base, calculateItemPrice(cooktop, DEFAULT_MATERIALS, settings, INITIAL_CHAPAS_CATALOG)]);
  const lastGroup = groups[groups.length - 1];
  assert.equal(lastGroup.id, 'group-eletros');
  assert.equal(lastGroup.items.length, 2);
  assert.equal(lastGroup.subtotal_cost, 0);
  assert.equal(lastGroup.subtotal_price, 0);
});

test('isSimilarPromobItem filtra estritamente por espessura e não mistura caixas, fundos e portas', () => {
  const caixa15Branco = {
    code: '1.0245.990.Branco',
    description: 'Caixa Armário',
    targetThickness: '15mm',
    unit: 'UN',
  };

  const outraCaixa15 = {
    code: '1.0246.990.Branco',
    description: 'Caixa Balcão',
    targetThickness: '15mm',
    unit: 'UN',
    unit_cost: 0,
  };

  const fundo6Branco = {
    code: '1.2014.6.Branco.Aglom',
    description: 'Fundo 6mm Branco',
    unit: 'M2',
    unit_cost: 0,
  };

  const porta18Branco = {
    code: '1.3005.18.Branco.MDF',
    description: 'Porta 18mm Branco',
    unit: 'M2',
    unit_cost: 0,
  };

  const caixaJaPrecificada = {
    code: '1.0247.990.Branco',
    description: 'Caixa Armário 2',
    targetThickness: '15mm',
    unit: 'UN',
    unit_cost: 150,
  };

  // Caixa 15mm combina com Caixa Balcão 15mm sem preço
  assert.equal(isSimilarPromobItem(caixa15Branco, outraCaixa15, false, true), true);

  // Caixa 15mm NÃO combina com Fundo 6mm mesmo ambos tendo 'Branco'
  assert.equal(isSimilarPromobItem(caixa15Branco, fundo6Branco, false, true), false);

  // Caixa 15mm NÃO combina com Porta 18mm mesmo ambos tendo 'Branco'
  assert.equal(isSimilarPromobItem(caixa15Branco, porta18Branco, false, true), false);

  // Com onlyUnpriced = true, caixa que já possui preço não é contada
  assert.equal(isSimilarPromobItem(caixa15Branco, caixaJaPrecificada, false, true), false);
});

test('calculateItemPrice preserva código Promob original, dimensões, rep e is_parent_module', () => {
  const item = {
    id: 'item-promob-1',
    item_number: 7,
    code: '1.0245.990.Branco',
    description: 'Caixa Armário 2 Portas',
    quantity: 1,
    unit: 'UN',
    rep: 2,
    unit_quantity: 1,
    dimensions: '800 x 600 x 350',
    unit_cost: 122.12,
    table_price: 122.12,
    final_price: 366.36,
    is_parent_module: false,
  };

  const calculated = calculateItemPrice(item, DEFAULT_MATERIALS, settings, INITIAL_CHAPAS_CATALOG);
  assert.equal(calculated.code, '1.0245.990.Branco');
  assert.equal(calculated.item_number, 7);
  assert.equal(calculated.dimensions, '800 x 600 x 350');
  assert.equal(calculated.rep, 2);
  assert.equal(calculated.is_parent_module, false);
  assert.equal(calculated.unit_cost, 122.12);
  assert.equal(calculated.total_cost, 244.24);
});



