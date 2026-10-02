import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
const source = ['default-materials', 'chapas-catalog', 'calculator', 'parsers'].map(name =>
  stripTypeScriptTypes(fs.readFileSync(`src/lib/orcamento/${name}.ts`, 'utf8'))).join('\n').replace(/^import .*;$/mg, '');
const m = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('nested Start items never inherit child fields, prices or finish', () => {
  const xml = `<LISTING><ITEM REFERENCE="cabinet" DESCRIPTION="Armário p/ Microondas" QUANTITY="1" UNIT="UN"><REFERENCES><MODEL REFERENCE="Branco Tx"/></REFERENCES><ITEMS><ITEM REFERENCE="mdf" DESCRIPTION="Chapa Branco Tx 15mm" QUANTITY="0.1398" UNIT="M2" TABLE_PRICE="80"><REFERENCES><MODEL REFERENCE="White child"/></REFERENCES></ITEM><ITEM REFERENCE="tape" DESCRIPTION="Fita PVC" UNIT="M" QUANTITY="0.628"/></ITEMS></ITEM></LISTING>`;
  const { items } = m.parsePromobXML(xml);
  assert.equal(items.length, 3);
  assert.equal(items[0].table_price, 0);
  assert.equal(items[0].external_model, 'Branco Tx');
  assert.equal(items[0].has_children, true);
  assert.equal(items[0].is_parent_module, true);
  assert.equal(items[1].external_model, 'White child');
  assert.equal(items[1].quantity, .1398);
  assert.equal(items[2].unit, 'M');
  assert.equal(items[2].quantity, .628);
  assert.equal(m.isEletrodomestico('cabinet', 'Armário p/ Microondas'), false);
  assert.equal(m.isEletrodomestico('appliance', 'Microondas Electrolux'), true);
});
test('White TX never selects White Supremo or an unrelated colored line', () => {
  const catalog = { Arauco: { type: 'brand', lines: [
    { name: 'Chess Lisos', colors: ['Branco Supremo'], prices: { '15mm': 660 }, width: 2.75, height: 1.85 },
    { name: 'Branco TX', colors: ['Branco TX'], prices: { '15mm': 300 }, width: 2.75, height: 1.85 },
  ] } };
  assert.equal(m.smartMatchPromobChapa('MDF.COR.15.100', 'Chapa Branco Tx Espessura 15mm', catalog).boardPrice, 300);
  catalog.Arauco.lines.pop();
  assert.equal(m.smartMatchPromobChapa('MDF.COR.15.100', 'Chapa Branco Tx Espessura 15mm', catalog).matched, false);
  assert.equal(m.resolveItemPrice({code:'MDF.COR.15.100', description:'Chapa Branco Tx 15mm', unit:'M2'},catalog,m.DEFAULT_MATERIALS).unit_cost, 36.50);
});
test('explicit M2 consumption is preserved independently of dimensions', () => {
  const {items} = m.parsePromobXML('<ITEM REFERENCE="board" DESCRIPTION="Chapa" UNIT="M2" QUANTITY="0.1234" WIDTH="1000" HEIGHT="15" DEPTH="500"/>');
  assert.equal(items[0].quantity,.1234);
});
test('unclosed nested XML rejects rather than silently importing a partial budget', () => {
  assert.throws(() => m.parsePromobXML('<ITEM REFERENCE="a"><ITEM REFERENCE="b"/>'), /fechamento/);
});
test('missing prices exclude structural containers, not hardware leaves', () => {
  assert.deepEqual(m.missingPriceItems([
    {code:'container',description:'Base',has_children:true,unit_cost:0},
    {code:'CDOBT',description:'Conjunto Dobradiça',unit_cost:0},
  ]).map(i=>i.code),['CDOBT']);
});
test('tape catalog roll price converts to metres without changing its unit', () => {
  const catalog = { 'Acessórios': {type:'acessorios', items:[{id:'tape',name:'Fita de borda PVC 1x22mm Branco Tx Rolo 20m',size:'1x22mm',price:84}] } };
  const r=m.resolveItemPrice({code:'FTPVC.1.22.100',description:'Fita de Borda PVC Espessura 1x22mm Branco Tx',unit:'M'},catalog,[]);
  assert.equal(r.matched,true);
  assert.equal(r.unit,'M');
  assert.equal(r.unit_cost,4.20);
});

test('Carmel tape does not fall back to a white tape',()=>{
  const materials=[{code:'FITA-BRANCA-22',description:'Fita de borda Branca 22mm Rolo 20m',category:'FITA',unit:'ROLO',unit_price:84}];
  assert.equal(m.smartMatchAccessory('FTPVC.1.22.Carmel','Fita PVC 1x22mm Carmel','',{},materials).matched,false);
});
test('the actual XML hierarchy aggregates modules once and preserves repeated furniture', () => {
  const xml=`<ITEM GUID="a" REFERENCE="cabinet" DESCRIPTION="Armário" UNIT="UN" QUANTITY="1"><ITEMS><ITEM GUID="b" REFERENCE="panel" DESCRIPTION="Base 15" UNIT="UN" QUANTITY="1"><ITEMS><ITEM GUID="c" REFERENCE="MDF.COR.15.100" DESCRIPTION="Chapa Branco Tx Espessura 15mm" UNIT="M2" QUANTITY="2"/></ITEMS></ITEM></ITEMS></ITEM>`;
  const raw=m.parsePromobXML(xml).items;
  assert.equal(raw[1].parentId,'a'); assert.equal(raw[2].parentId,'b');
  const settings={margin:0,frete:0,montagem:0,comissao_vendas:0,comissao_executivo:0,outros:[],chapa_mode:'m2',fita_mode:'metros'};
  const items=raw.map(row=>m.calculateItemPrice({...row,promob_description:row.description,price_origin:'calculated'},m.DEFAULT_MATERIALS,settings));
  const calculated=m.recalculateBudget(items,m.DEFAULT_MATERIALS,settings);
  assert.equal(calculated.totals.total_cost,73);assert.equal(calculated.totals.total_price,73);
  assert.equal(calculated.items[0].total_price,73);assert.equal(calculated.items[1].total_price,73);
  assert.equal(m.budgetPresentationItems(calculated.items).length,1);
  assert.equal(m.budgetPresentationItems(calculated.items)[0].quantity,1);
  assert.equal(m.missingPriceItems(calculated.items).length,0);
  const repriced=m.recalculateBudget(calculated.items,m.DEFAULT_MATERIALS.map(p=>p.code==='MDF-BRANCO-15'?{...p,unit_price:40}:p),settings);
  assert.equal(repriced.totals.total_price,80);
});
test('exact shop aliases outrank the generic board catalogue',()=>{
 const material={id:'own',code:'OWN',subcodes:['..15.Carmel'],description:'Greenplac Carmel 15mm',unit:'M2',unit_price:99};
 assert.equal(m.resolveItemPrice({code:'..15.Carmel',description:'Chapa Greenplac Carmel 15mm',unit:'M2'},m.INITIAL_CHAPAS_CATALOG,[material]).unit_cost,99);
 assert.equal(m.resolveItemPrice({code:'..15.Carmel',description:'Chapa Greenplac Carmel 15mm',unit:'M2'},m.INITIAL_CHAPAS_CATALOG,[material,{...material,id:'two',code:'TWO'}]).matched,false);
});
test('unsupported 18.5mm board is not silently priced as 18mm',()=>{
 assert.equal(m.resolveItemPrice({code:'MDF.COR.18.5.100',description:'Chapa Branco Tx Espessura 18.5mm',unit:'M2'},m.INITIAL_CHAPAS_CATALOG,m.DEFAULT_MATERIALS).matched,false);
});
test('saved missing thickness and custom brands survive catalogue loading',()=>{
 const saved={Arauco:{lines:[{id:'arauco-1',prices:{'15mm':null}}]},MinhaMarca:{type:'brand',lines:[{id:'custom',name:'Linha',colors:['Carmel'],prices:{'15mm':123}}]}};
 const c=m.sanitizeAndMergeCatalog(saved);
 assert.equal(c.Arauco.lines[0].prices['15mm'],null);
 assert.equal(c.MinhaMarca.lines[0].prices['15mm'],123);
 assert.ok(saved.MinhaMarca);
});
test('an exact unpriced material never falls back to another tape thickness',()=>{
 const r=m.resolveItemPrice({code:'FTPVC.1.22.100',description:'Fita Branco TX 1x22mm',unit:'M'},m.INITIAL_CHAPAS_CATALOG,m.DEFAULT_MATERIALS);
 assert.equal(r.matched,false);assert.equal(r.unit_cost,0);
});
test('equal color matches with different line prices require an explicit finish',()=>{
 const catalogue={Greenplac:{type:'brand',lines:[{name:'Linha A',colors:['Carmel'],prices:{'15mm':300}},{name:'Linha B',colors:['Carmel'],prices:{'15mm':600}}]}};
 assert.equal(m.smartMatchPromobChapa('Greenplac Carmel 15mm','MDF',catalogue).matched,false);
});
