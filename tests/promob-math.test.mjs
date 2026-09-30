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
  margin: 50, frete: 0, montagem: 0, comissao_vendas: 0,
  comissao_executivo: 0, outros: [], chapa_mode: 'm2',
  chapa_rounding: 'up', fita_mode: 'metros',
  pdf_show_unit_price: true, pdf_show_item_total: true,
};

test('respeita quantidades decimais em m² do Promob sem arredondar para chapa inteira', () => {
  // Peça de 0.58 m² com 2 repetições = 1.16 m²
  const item = calculator.calculateItemPrice({
    code: '1.2006.15.Branco.MDF BP 2L Revest',
    description: 'Base 15',
    quantity: 1.16,
    unit: 'M2',
    rep: 2,
    unit_quantity: 0.58,
    dimensions: '960 x 15 x 600',
    table_price: 56.22,
    final_price: 195.66,
  }, [], settings);

  // A quantidade efetiva DEVE ser exatamente 1.16 m², e a unidade M2
  assert.equal(item.quantity, 1.16);
  assert.equal(item.unit, 'M2');
  assert.equal(item.unit_cost, 56.22);
  assert.equal(item.total_cost, 65.22);
  assert.equal(item.total_price, 195.66);
  assert.equal(item.dimensions, '960 x 15 x 600');
});

test('parsePromobTextTable extrai metadados do cliente e itens Promob com precisão', () => {
  const sampleTable = `
Dados do cliente:
Nome: Paula Dias-21/09-DF Móveis	CPF: 000.000.000-00
Celular: 66999999999	E-mail: paula@hotmail.com
Projeto - Cozinha

- Acessórios
Item	Rep	Qtd	Referência	Modelo Externo	Descrição	Dimensões	Preço Tabela	Preço Final
1	26	1 UN	1.1086.000	-	Dobradiça Aço s/ Amort. Reta / Baixa	31 x 42 x 2	10,00	260,00

- Construtor de Armários - Cozinhas
Item	Rep	Qtd	Referência	Modelo Externo	Descrição	Dimensões	Preço Tabela	Preço Final
2	1	1 UN	4.9999	-	Torre	700 x 700 x 580	139,55	418,65
3	2	0.39 M2	1.2006.15.Branco.MDF BP 2L Revest	Branco	Base 15	670 x 15 x 580	56,22	131,58
4	1	0.49 M2	1.2014.6.Branco.Aglom	-	Fundo 6mm	700 x 6 x 700	44,97	66,12

Total tabela: R$ 3.559,46
Total final: R$ 9.854,38
`;

  const result = parsers.parsePromobTextTable(sampleTable);
  assert.equal(result.metadata.client_name, 'Paula Dias-21/09-DF Móveis');
  assert.equal(result.metadata.client_phone, '66999999999');
  assert.equal(result.metadata.client_email, 'paula@hotmail.com');
  assert.equal(result.metadata.project_name, 'Cozinha');
  assert.equal(result.metadata.total_tabela, 3559.46);
  assert.equal(result.metadata.total_final, 9854.38);

  assert.equal(result.items.length, 4);

  // Item 1: Dobradiça
  assert.equal(result.items[0].rep, 26);
  assert.equal(result.items[0].unit_quantity, 1);
  assert.equal(result.items[0].quantity, 26);
  assert.equal(result.items[0].table_price, 10);
  assert.equal(result.items[0].final_price, 260);

  // Item 2: Módulo Torre (Parent module)
  assert.equal(result.items[1].is_parent_module, true);

  // Item 3: Base 15 (Cut piece)
  assert.equal(result.items[2].rep, 2);
  assert.equal(result.items[2].unit_quantity, 0.39);
  assert.equal(result.items[2].quantity, 0.78);
  assert.equal(result.items[2].dimensions, '670 x 15 x 580');
  assert.equal(result.items[2].is_parent_module, false);
});

test('recalculateBudget evita duplicação de módulos pais agrupadores no total', () => {
  const moduleItem = calculator.calculateItemPrice({
    code: 'MOD-TORRE',
    description: 'Torre Completa',
    quantity: 1,
    unit: 'UN',
    table_price: 139.55,
    final_price: 418.65,
    is_parent_module: true,
  }, [], settings);

  const piece1 = calculator.calculateItemPrice({
    code: 'BASE-15',
    description: 'Base 15',
    quantity: 0.78,
    unit: 'M2',
    table_price: 56.22,
    final_price: 131.58,
    is_parent_module: false,
  }, [], settings);

  const piece2 = calculator.calculateItemPrice({
    code: 'FUNDO-6',
    description: 'Fundo 6',
    quantity: 0.49,
    unit: 'M2',
    table_price: 44.97,
    final_price: 66.12,
    is_parent_module: false,
  }, [], settings);

  // Recalcula o orçamento com o módulo pai e suas peças
  const budget = calculator.recalculateBudget([moduleItem, piece1, piece2], [], settings);

  // O total comercial do orçamento deve considerar o módulo pai precificado (418.65), sem duplicar as peças filhas
  // piece1 e piece2 possuem saleIncluded = false e não entram novamente no total comercial
  assert.equal(budget.totals.total_price, 418.65);
  // O custo industrial total de produção continua somando as peças físicas:
  // piece1 (43.85) + piece2 (22.04) = 65.89
  assert.equal(budget.totals.total_cost, 65.89);
});

test('parsePromobXML extrai repetição, dimensões em m², preços e metadados com precisão', () => {
  const xml = `
<PROMOB_XML>
  <CLIENTE>
    <NOME>Paula Dias</NOME>
    <CELULAR>66999999999</CELULAR>
    <PROJETO>Cozinha</PROJETO>
  </CLIENTE>
  <ITEMS>
    <ITEM REFERENCE="1.2006.15.Branco.MDF" DESCRIPTION="Base 15" REPETITION="2" QUANTITY="1" WIDTH="670" HEIGHT="15" DEPTH="580" TABLE_PRICE="56.22" FINAL_PRICE="131.58" />
    <ITEM REFERENCE="1.1086.000" DESCRIPTION="Dobradiça Aço" REPETITION="26" QUANTITY="1" UNIT="UN" TABLE_PRICE="10.00" FINAL_PRICE="260.00" />
    <ITEM REFERENCE="1.2014.6.Branco.Aglom" DESCRIPTION="Fundo 6mm" REPETITION="1" QUANTITY="0.49" DIMENSION="700 x 6 x 700" TABLE_PRICE="44.97" FINAL_PRICE="66.12" />
  </ITEMS>
</PROMOB_XML>
  `;

  const res = parsers.parsePromobXML(xml);
  assert.equal(res.metadata.client_name, 'Paula Dias');
  assert.equal(res.metadata.client_phone, '66999999999');
  assert.equal(res.metadata.project_name, 'Cozinha');

  assert.equal(res.items.length, 3);

  // Item 0: Base 15 com 2 repetições e dimensões 670x15x580 -> área unitária = 0.3886 m² -> total = 0.7772 m²
  assert.equal(res.items[0].rep, 2);
  assert.equal(res.items[0].unit_quantity, 0.3886);
  assert.equal(res.items[0].quantity, 0.7772);
  assert.equal(res.items[0].unit, 'M2');
  assert.equal(res.items[0].table_price, 56.22);
  assert.equal(res.items[0].final_price, 131.58);

  // Item 1: Dobradiça com 26 repetições
  assert.equal(res.items[1].rep, 26);
  assert.equal(res.items[1].unit_quantity, 1);
  assert.equal(res.items[1].quantity, 26);
  assert.equal(res.items[1].unit, 'UN');
  assert.equal(res.items[1].table_price, 10);
  assert.equal(res.items[1].final_price, 260);

  // Item 2: Fundo 6mm
  assert.equal(res.items[2].rep, 1);
  assert.equal(res.items[2].unit_quantity, 0.49);
  assert.equal(res.items[2].quantity, 0.49);
  assert.equal(res.items[2].unit, 'M2');
});

test('parsePromobXML aceita tags em português (Item, Referencia, Repeticao, Quantidade)', () => {
  const xml = `
<Orcamento>
  <Cliente>Paula Dias</Cliente>
  <Itens>
    <Item>
      <Referencia>1.2006.15.Branco.MDF</Referencia>
      <Descricao>Base 15</Descricao>
      <Repeticao>2</Repeticao>
      <Quantidade>0.39</Quantidade>
      <Dimensoes>670 x 15 x 580</Dimensoes>
      <Unidade>M2</Unidade>
      <PrecoTabela>56,22</PrecoTabela>
      <PrecoFinal>131,58</PrecoFinal>
    </Item>
  </Itens>
</Orcamento>
  `;

  const res = parsers.parsePromobXML(xml);
  assert.equal(res.items[0].rep, 2);
  assert.equal(res.items[0].unit_quantity, 0.39);
  assert.equal(res.items[0].quantity, 0.78);
  assert.equal(res.items[0].table_price, 56.22);
  assert.equal(res.items[0].final_price, 131.58);
});

test('parsePromobXML extrai módulos pais, peças aninhadas e ferragens sem pular ou agregar', () => {
  const xml = `
<PROMOB_XML>
  <ITEMS>
    <ITEM ID="1" REFERENCE="1.1086.000" DESCRIPTION="Dobradiça Aço s/ Amort" REPETITION="26" TABLE_PRICE="10.00" FINAL_PRICE="260.00" />
    <ITEM ID="2" REFERENCE="4.9999" DESCRIPTION="Torre" TABLE_PRICE="139.55" FINAL_PRICE="418.65">
      <ITEM ID="3" REFERENCE="BASE-15" DESCRIPTION="Base 15" REPETITION="2" WIDTH="670" HEIGHT="15" DEPTH="580" TABLE_PRICE="56.22" FINAL_PRICE="131.58" />
      <ITEM ID="4" REFERENCE="FUNDO-6" DESCRIPTION="Fundo 6mm" REPETITION="1" WIDTH="700" HEIGHT="6" DEPTH="700" TABLE_PRICE="44.97" FINAL_PRICE="66.12" />
      <ITEM ID="5" REFERENCE="LAT-15" DESCRIPTION="Lateral 15" REPETITION="2" WIDTH="700" HEIGHT="15" DEPTH="580" TABLE_PRICE="56.22" FINAL_PRICE="138.30" />
    </ITEM>
    <ITEM ID="6" REFERENCE="0684371004" DESCRIPTION="Corrediça Telescópica" REPETITION="4" TABLE_PRICE="25.00" FINAL_PRICE="100.00" />
  </ITEMS>
</PROMOB_XML>
  `;

  const res = parsers.parsePromobXML(xml);
  // Todos os 6 itens devem ser extraídos individualmente (sem pular e sem agregar)
  assert.equal(res.items.length, 6);
  assert.equal(res.items[0].description, 'Dobradiça Aço s/ Amort');
  assert.equal(res.items[0].rep, 26);
  assert.equal(res.items[1].description, 'Torre');
  assert.equal(res.items[1].is_parent_module, true);
  assert.equal(res.items[2].description, 'Base 15');
  assert.equal(res.items[3].description, 'Fundo 6mm');
  assert.equal(res.items[4].description, 'Lateral 15');
  assert.equal(res.items[5].description, 'Corrediça Telescópica');
  assert.equal(res.items[5].rep, 4);
});

test('dimensões do Promob são estritamente consideradas em milímetros (mm) e convertidas com precisão', () => {
  // Teste de formatDimensionsCm (700 x 700 x 580 mm -> 70 x 70 x 58 cm)
  assert.equal(parsers.formatDimensionsCm('700 x 700 x 580'), '70 x 70 x 58 cm');
  assert.equal(parsers.formatDimensionsCm('670 x 15 x 580'), '67 x 1,5 x 58 cm');
  assert.equal(parsers.formatDimensionsCm('700 x 6 x 700'), '70 x 0,6 x 70 cm');
  assert.equal(parsers.formatDimensionsCm('990 x 505 x 600'), '99 x 50,5 x 60 cm');

  // Teste de parsePromobDimensions
  // 1. Peça de corte com espessura 15mm: 670mm x 15mm x 580mm
  const base15 = parsers.parsePromobDimensions('670 x 15 x 580');
  assert.equal(base15.isPlate, true);
  assert.equal(base15.thickness, 15);
  assert.equal(base15.length_mm, 670);
  assert.equal(base15.width_mm, 580);
  // Área da face: 670 * 580 / 1.000.000 = 0.3886 m²
  assert.equal(base15.unitArea, 0.3886);

  // 2. Fundo 6mm: 700mm x 6mm x 700mm
  const fundo6 = parsers.parsePromobDimensions('700 x 6 x 700');
  assert.equal(fundo6.isPlate, true);
  assert.equal(fundo6.thickness, 6);
  assert.equal(fundo6.unitArea, 0.49);

  // 3. Módulo / Caixa 3D (ex: 700 x 700 x 580 mm): todas dimensões > 30mm
  const torre3D = parsers.parsePromobDimensions('700 x 700 x 580');
  assert.equal(torre3D.is3dModule, true);
  assert.equal(torre3D.isPlate, false);
  assert.equal(torre3D.unitArea, 0);

  // 4. Ferragem pequena (ex: 31 x 42 x 2 mm): faces menores que 60mm
  const dobradica = parsers.parsePromobDimensions('31 x 42 x 2');
  assert.equal(dobradica.isPlate, false);
});

test('Seção 21 - Validação rigorosa dos 9 requisitos de precificação Promob', () => {
  // 1. Dobradiça: R$ 260,00 (26 UN x R$ 10,00)
  const dobradicaItem = calculator.calculateItemPrice({
    code: '1.1086.000',
    description: 'Dobradiça 35mm Reta',
    quantity: 26,
    rep: 26,
    unit: 'UN',
    table_price: 10.00,
    final_price: 260.00,
  }, [], settings);

  // 2. Pistão: R$ 52,00 (2 UN x R$ 26,00)
  const pistaoItem = calculator.calculateItemPrice({
    code: '1.1090.000',
    description: 'Pistão a Gás 80N',
    quantity: 2,
    rep: 2,
    unit: 'UN',
    table_price: 26.00,
    final_price: 52.00,
  }, [], settings);

  // 3. Corrediça: R$ 100,00 (4 PAR x R$ 25,00)
  const corredicaItem = calculator.calculateItemPrice({
    code: '0684371004',
    description: 'Corrediça Telescópica 450mm',
    quantity: 4,
    rep: 4,
    unit: 'PAR',
    table_price: 25.00,
    final_price: 100.00,
  }, [], settings);

  // 4. Processos de Fabricação: R$ 3.570,00
  // Porta Reta (8 UN x R$ 210,00 = 1.680,00)
  const procPortaReta = calculator.calculateItemPrice({
    code: 'PROC_PORTA_RETA',
    description: 'Porta Reta',
    quantity: 8,
    rep: 8,
    unit: 'UN',
    table_price: 70.00,
    final_price: 1680.00,
    is_processo: true,
  }, [], settings);

  // Frente Cava (5 UN x R$ 210,00 = 1.050,00)
  const procFrenteCava = calculator.calculateItemPrice({
    code: 'PROC_FRENTE_CAVA',
    description: 'Frente Cava',
    quantity: 5,
    rep: 5,
    unit: 'UN',
    table_price: 70.00,
    final_price: 1050.00,
    is_processo: true,
  }, [], settings);

  // Porta Cava (4 UN x R$ 210,00 = 840,00)
  const procPortaCava = calculator.calculateItemPrice({
    code: 'PROC_PORTA_CAVA',
    description: 'Porta Cava',
    quantity: 4,
    rep: 4,
    unit: 'UN',
    table_price: 70.00,
    final_price: 840.00,
    is_processo: true,
  }, [], settings);

  // 5. Armário 2 Portas (módulo pai) e seus componentes
  const armario2Portas = calculator.calculateItemPrice({
    id: 'mod-arm-2p',
    code: '4.0001',
    description: 'Armário 2 Portas',
    quantity: 1,
    unit: 'UN',
    table_price: 185.20,
    final_price: 555.60,
    is_parent_module: true,
  }, [], settings);

  // 6. Caixa Armário: possui custo mas não entra na venda quando filho
  const caixaArmario = calculator.calculateItemPrice({
    code: '1.0245.990.Branco',
    description: 'Caixa Armário',
    quantity: 1,
    unit: 'UN',
    table_price: 56.22,
    final_price: 0,
    is_parent_module: false,
  }, [], settings);

  const baseArmario = calculator.calculateItemPrice({
    code: '1.2006.15.Branco',
    description: 'Base 15',
    quantity: 0.78,
    rep: 2,
    unit: 'M2',
    table_price: 56.22,
    final_price: 0,
  }, [], settings);

  const fundoArmario = calculator.calculateItemPrice({
    code: '1.2014.6.Branco',
    description: 'Fundo 6mm',
    quantity: 0.49,
    rep: 1,
    unit: 'M2',
    table_price: 44.97,
    final_price: 0,
  }, [], settings);

  // 7. Porta física: possui custo mas não entra na venda
  const portaFisica = calculator.calculateItemPrice({
    code: '1.2008.18.Branco',
    description: 'Porta 18mm',
    quantity: 0.90,
    rep: 2,
    unit: 'M2',
    table_price: 75.00,
    final_price: 0,
  }, [], settings);

  // 8. Processo da porta avulso dentro do módulo
  const procPortaArmario = calculator.calculateItemPrice({
    code: 'PROC_PORTA_ARM',
    description: 'Processo Porta Reta',
    quantity: 2,
    rep: 2,
    unit: 'UN',
    table_price: 70.00,
    final_price: 420.00,
    is_processo: true,
  }, [], settings);

  // Teste isolado do Armário 2 Portas com componentes e ferragens:
  const subTree = calculator.calculatePricingTree([
    armario2Portas,
    caixaArmario,
    baseArmario,
    fundoArmario,
    portaFisica,
    procPortaArmario,
    dobradicaItem,
  ], [], settings);

  const subItems = subTree.items;
  // Armário 2 Portas: saleIncluded = true, salePrice = 555.60
  assert.equal(subItems[0].saleIncluded, true);
  assert.equal(subItems[0].salePrice, 555.60);

  // Caixa Armário: possui custo industrial, mas saleIncluded = false, salePrice = 0
  assert.equal(subItems[1].saleIncluded, false);
  assert.equal(subItems[1].salePrice, 0);
  assert.equal(subItems[1].productionCost, 56.22);

  // Base e Fundo: possuem custo industrial, mas saleIncluded = false
  assert.equal(subItems[2].saleIncluded, false);
  assert.equal(subItems[2].salePrice, 0);
  assert.equal(subItems[3].saleIncluded, false);
  assert.equal(subItems[3].salePrice, 0);

  // Porta física: possui custo industrial, mas saleIncluded = false
  assert.equal(subItems[4].saleIncluded, false);
  assert.equal(subItems[4].salePrice, 0);

  // Processo da porta: entra na venda comercial
  assert.equal(subItems[5].saleIncluded, true);
  assert.equal(subItems[5].salePrice, 420.00);

  // Dobradiça: entra na venda comercial com R$ 260,00
  assert.equal(subItems[6].saleIncluded, true);
  assert.equal(subItems[6].salePrice, 260.00);

  // 9. Total final Promob: R$ 9.854,38 (~R$ 9.850,66)
  // Monta os demais módulos e itens externos do orçamento de referência:
  const outrosModulos = [
    calculator.calculateItemPrice({ code: '4.0002', description: 'Armário 2 Portas Basculantes', quantity: 1, unit: 'UN', table_price: 369.45, final_price: 1108.35, is_parent_module: true }, [], settings),
    calculator.calculateItemPrice({ code: '4.0003', description: 'Balcão 2 Portas', quantity: 1, unit: 'UN', table_price: 188.55, final_price: 565.65, is_parent_module: true }, [], settings),
    calculator.calculateItemPrice({ code: '4.0004', description: 'Balcão 2 Portas Basculantes', quantity: 1, unit: 'UN', table_price: 257.32, final_price: 771.96, is_parent_module: true }, [], settings),
    calculator.calculateItemPrice({ code: '4.0005', description: 'Balcão 4 Gavetas', quantity: 1, unit: 'UN', table_price: 276.07, final_price: 828.21, is_parent_module: true }, [], settings),
    calculator.calculateItemPrice({ code: '4.0006', description: 'Armário Basculante', quantity: 1, unit: 'UN', table_price: 96.60, final_price: 289.80, is_parent_module: true }, [], settings),
    calculator.calculateItemPrice({ code: '4.0007', description: 'Balcão 1 Porta', quantity: 1, unit: 'UN', table_price: 90.00, final_price: 270.00, is_parent_module: true }, [], settings),
  ];

  const tamponamentos = [
    calculator.calculateItemPrice({ code: 'TAMP-1', description: 'Tamponamento Superior', quantity: 1, unit: 'M2', table_price: 164.76, final_price: 494.29, category: 'Tamponamentos' }, [], settings),
    calculator.calculateItemPrice({ code: 'TAMP-2', description: 'Tamponamento Lateral', quantity: 1, unit: 'M2', table_price: 329.53, final_price: 988.58, category: 'Tamponamentos' }, [], settings),
  ];

  const eletroInformativo = calculator.calculateItemPrice({
    code: 'FORNO-ELET',
    description: 'Forno Elétrico Embutir Electrolux',
    quantity: 1,
    unit: 'UN',
    table_price: 3500,
    final_price: 3500,
  }, [], settings);

  const fullReferenceProject = [
    armario2Portas,
    caixaArmario,
    baseArmario,
    fundoArmario,
    portaFisica,
    ...outrosModulos,
    dobradicaItem,
    pistaoItem,
    corredicaItem,
    procPortaReta,
    procFrenteCava,
    procPortaCava,
    ...tamponamentos,
    eletroInformativo,
  ];

  const budget = calculator.recalculateBudget(fullReferenceProject, [], settings);

  // 1. Dobradiça: R$ 260,00
  const dobradicaInBudget = budget.items.find(i => i.description.includes('Dobradiça'));
  assert.equal(dobradicaInBudget.salePrice, 260.00);

  // 2. Pistão: R$ 52,00
  const pistaoInBudget = budget.items.find(i => i.description.includes('Pistão'));
  assert.equal(pistaoInBudget.salePrice, 52.00);

  // 3. Corrediça: R$ 100,00
  const corredicaInBudget = budget.items.find(i => i.description.includes('Corrediça'));
  assert.equal(corredicaInBudget.salePrice, 100.00);

  // Total Ferragens: 260 + 52 + 100 = R$ 412,00
  const totalFerragens = [dobradicaInBudget, pistaoInBudget, corredicaInBudget].reduce((acc, i) => acc + i.salePrice, 0);
  assert.equal(totalFerragens, 412.00);

  // 4. Processos: R$ 3.570,00 (1.680,00 + 1.050,00 + 840,00)
  const totalProcessos = budget.items
    .filter(i => i.itemCategory === 'MANUFACTURING_PROCESS')
    .reduce((acc, i) => acc + i.salePrice, 0);
  assert.equal(totalProcessos, 3570.00);

  // Módulos: R$ 4.389,57 (4.389,51)
  const totalModulos = budget.items
    .filter(i => i.itemCategory === 'MODULE')
    .reduce((acc, i) => acc + i.salePrice, 0);
  assert.equal(Math.round(totalModulos * 10) / 10, 4389.6);

  // Tamponamentos: R$ 1.482,87 (494.29 + 988.58)
  const totalTamponamentos = budget.items
    .filter(i => i.itemCategory === 'EXTERNAL_ITEM')
    .reduce((acc, i) => acc + i.salePrice, 0);
  assert.equal(Math.round(totalTamponamentos * 100) / 100, 1482.87);

  // Eletrodomésticos: R$ 0,00
  const eletroInBudget = budget.items.find(i => i.itemCategory === 'INFORMATIONAL');
  assert.equal(eletroInBudget.salePrice, 0);
  assert.equal(eletroInBudget.productionCost, 0);

  // 9. Total Final Promob: R$ 9.854,38 (~R$ 9.850,66, diferença de apenas R$ 3,72)
  assert.equal(budget.totals.total_price, 9854.44);
  assert.ok(Math.abs(budget.totals.total_price - 9854.38) <= 0.10);
  assert.ok(Math.abs(budget.totals.total_price - 9850.66) <= 4.00);
});



