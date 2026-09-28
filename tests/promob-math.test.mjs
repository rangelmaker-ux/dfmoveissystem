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

  // O total do orçamento deve considerar apenas as peças (sem duplicar o módulo pai)
  // piece1 (131.58) + piece2 (66.12) = 197.70
  assert.equal(budget.totals.total_price, 197.70);
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


