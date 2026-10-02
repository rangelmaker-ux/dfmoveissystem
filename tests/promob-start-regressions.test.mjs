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

test('authoritative imported catalogue retains missing prices and never restores seed lines',()=>{
 const saved={Arauco:{type:'brand',brandName:'Arauco',authoritative:true,price_import:{file:'source.xlsx'},lines:[
  {id:'imported',name:'Linha',colors:['Cor'],width:3.08,height:1.25,area:3.85,prices:{'6mm':null,'15mm':175,'18mm':null,'25mm':null,'30mm':400},source:{row:3}}
 ]}};
 const c=m.sanitizeAndMergeCatalog(saved);
 assert.deepEqual(c.Arauco,saved.Arauco);assert.equal(c.Arauco.lines.length,1);
 c.Arauco.lines[0].prices['15mm']=200;assert.equal(saved.Arauco.lines[0].prices['15mm'],175);
});
test('30mm and per-color prices use actual sheet area and only one loss factor',()=>{
 const catalogue={Sudati:{type:'brand',authoritative:true,lines:[{name:'Comoditá > Carvalho Novara',colors:['Carvalho Novara'],prices:{'15mm':200,'30mm':400},width:2.75,height:1.85}]},'Fórmica':{type:'brand',lines:[{name:'Alta Decoração > Bronze',colors:['AD 307 - Bronze'],prices:{'15mm':175},width:3.08,height:1.25}]}};
 const r=m.smartMatchPromobChapa('MDF.COR.30.Sudati','Chapa Sudati Carvalho Novara Espessura 30mm',catalogue);
 assert.equal(r.thickness,'30mm');assert.equal(r.boardPrice,400);assert.equal(r.m2Cost,102.21);
 assert.equal(m.smartMatchPromobChapa('MDF','Chapa Fórmica AD 307 - Bronze 15mm',catalogue).m2Cost,59.09);
 assert.equal(m.smartMatchPromobChapa('MDF','Chapa Sudati Carvalho Castelli 30mm',catalogue).matched,false);
});
test('catalogue-linked XML aliases immediately use edited prices and clearing a price blocks fallback',()=>{
 const catalogue={Arauco:{type:'brand',lines:[{id:'white',name:'Branco TX',colors:['Branco TX'],width:2.75,height:1.85,prices:{'15mm':220}}]}};
 const db=[{code:'MDF-BRANCO-15',subcodes:['MDF.COR.15.100'],description:'MDF Branco TX 15mm',unit:'M2',unit_price:36.50,catalog_brand:'Arauco',catalog_line_id:'white',catalog_thickness:'15mm'}];
 const item={code:'MDF.COR.15.100',description:'Chapa Branco TX 15mm',unit:'M2'};
 assert.equal(m.resolveItemPrice(item,catalogue,db).unit_cost,56.22);
 catalogue.Arauco.lines[0].prices['15mm']=300;
 assert.equal(m.resolveItemPrice(item,catalogue,db).unit_cost,76.66);
 catalogue.Arauco.lines[0].prices['15mm']=null;
 assert.equal(m.resolveItemPrice(item,catalogue,db).matched,false);
});
test('explicit brand with a missing source price cannot inherit another brand white price',()=>{
 const catalogue={Eucatex:{type:'brand',authoritative:true,lines:[{name:'BP Branco',colors:['Branco'],prices:{'15mm':null}}]}};
 assert.equal(m.resolveItemPrice({code:'mdf',description:'Chapa Eucatex BP Branco 15mm',unit:'M2'},catalogue,m.DEFAULT_MATERIALS).matched,false);
});

const txCatalog = () => ({ Arauco: { type: 'brand', brandName: 'Arauco', authoritative: true, lines: [
  { id: 'white', name: 'Horizontal Branco', colors: ['BRANCO', 'Branco TX'], aliases: ['Branco TX'], width: 2.75, height: 1.85, prices: { '6mm': 176, '15mm': 220, '18mm': 270 } },
] } });
const txSettings = { margin: 200, frete: 0, montagem: 0, comissao_vendas: 0, comissao_executivo: 0, outros: [], chapa_mode: 'm2', chapa_rounding: 'up', fita_mode: 'metros' };

test('XML MODEL Branco TX links numeric references, uses the physical thickness and converts UN to m² exactly once', () => {
 const xml = '<ITEM REFERENCE="001.100" DESCRIPTION="Base Inferior" UNIT="UN" QUANTITY="3" DIMENSIONS="958 x 18 x 554"><REFERENCES><MODEL REFERENCE="Branco Tx"/></REFERENCES></ITEM>';
 const parsed = m.parsePromobXML(xml).items;
 const result = m.recalculateBudget(parsed.map(x=>({...x,id:x.id || 'base',price_origin:'calculated'})), [], txSettings, txCatalog());
 const item = result.items[0];
 assert.equal(item.unit, 'M2'); assert.equal(item.unit_cost, 68.99);
 assert.equal(item.quantity, 1.5922); assert.equal(item.catalog_match.brand,'Arauco');
 assert.equal(m.missingPriceItems(result.items).length,0);
 const repeated = m.recalculateBudget(result.items, [], txSettings, txCatalog());
 assert.equal(repeated.items[0].quantity,item.quantity); assert.deepEqual(repeated.totals,result.totals);
 const catalogue=txCatalog();catalogue.Arauco.lines[0].prices['18mm']=300;
 const edited=m.recalculateBudget(result.items,[],txSettings,catalogue);
 assert.equal(edited.items[0].unit_cost,76.66);
 catalogue.Arauco.lines[0].prices['18mm']=null;
 assert.equal(m.recalculateBudget(edited.items,[],txSettings,catalogue).items[0].total_cost,0);
});

test('MDF doors use material price instead of fabrication service; real services stay in UN',()=>{
 const rows=[{id:'door',code:'1601.100',description:'Painel Porta Reta',external_model:'Branco Tx',dimensions:'694 x 18 x 396',unit:'UN',quantity:2,rep:1,unit_quantity:2,promob_xml:true,price_origin:'calculated'},
 {id:'process',code:'Porta Reta',description:'Processo de Fabricação',dimensions:'10 x 10 x 10',unit:'UN',quantity:2,promob_xml:true,price_origin:'calculated'}];
 const r=m.recalculateBudget(rows,m.DEFAULT_MATERIALS,txSettings,txCatalog());
 assert.equal(r.items[0].unit,'M2');assert.equal(r.items[0].unit_cost,68.99);
 assert.equal(r.items[1].unit,'UN');assert.equal(r.items[1].unit_cost,70);
});

test('legacy edited XML metadata is recovered without keeping a generated price as a Promob price',()=>{
 const row={id:'legacy',code:'7201.18.100',original_code:'7201.18.100',description:'Frente de Gaveta Reta (Tabela Promob (R$ 70,00))',external_model:'Branco Tx',dimensions:'464,52 x 171,25 x 18',unit:'UN',original_unit:'UN',quantity:4,rep:1,unit_quantity:4,unit_cost:70,table_price:70,found:true,price_origin:'calculated'};
 const r=m.recalculateBudget([{id:'xml',code:'container',description:'Armário',quantity:1,unit:'UN',promob_xml:true,is_parent_module:true},row],m.DEFAULT_MATERIALS,txSettings,txCatalog());
 assert.equal(r.items[1].promob_xml,true);assert.equal(r.items[1].unit_cost,68.99);
 assert.equal(r.items[1].quantity,.3182);assert.doesNotMatch(r.items[1].description,/Tabela Promob/);
});

test('unknown 18.5mm thickness stays pending and never becomes 15mm; containers are not raw material',()=>{
 const rows=[{id:'unknown',code:'301.100',description:'Travessa',external_model:'Branco Tx',dimensions:'1170 x 18,5 x 70',unit:'UN',quantity:1,promob_xml:true,price_origin:'calculated'},
 {id:'drawer',code:'2700.Branco Tx',description:'Gaveta Telescopica',external_model:'Branco Tx',dimensions:'464,52 x 171,25 x 500',unit:'M2',quantity:4,promob_xml:true,price_origin:'calculated'}];
 const r=m.recalculateBudget(rows,[],txSettings,txCatalog());
 assert.equal(r.items[0].total_cost,0);assert.equal(r.items[1].total_cost,0);
 assert.deepEqual(m.missingPriceItems(r.items).map(x=>x.code),['301.100']);
});

test('explicit per-item catalogue link survives save/reload, follows edits and overrides an unsupported exported thickness',()=>{
 const row={id:'linked',code:'301.100',description:'Travessa',external_model:'Branco Tx',dimensions:'1170 x 18,5 x 70',unit:'UN',quantity:1,promob_xml:true,price_origin:'calculated',catalog_override:{brand:'Arauco',line_id:'white',thickness:'18mm'}};
 const catalogue=txCatalog();
 const r=m.recalculateBudget([row],[],txSettings,catalogue);
 assert.equal(r.items[0].unit_cost,68.99);assert.equal(r.items[0].quantity,.0819);
 assert.deepEqual(r.items[0].catalog_override,row.catalog_override);
 catalogue.Arauco.lines[0].prices['18mm']=300;
 assert.equal(m.recalculateBudget(JSON.parse(JSON.stringify(r.items)),[],txSettings,catalogue).items[0].unit_cost,76.66);
});

test('pull-price buttons preserve original piece units and manual edits keep the displayed m² consumption',()=>{
 const raw={id:'base',code:'001.100',description:'Base',external_model:'Branco Tx',dimensions:'958 x 18 x 554',unit:'M2',original_unit:'UN',quantity:3,rep:1,unit_quantity:3,promob_xml:true,price_origin:'calculated'};
 const result=m.recalculateBudget([raw],[],txSettings,txCatalog());
 assert.equal(result.items[0].quantity,1.5922);
 const manual={...result.items[0],original_unit:'M2',unit_quantity:result.items[0].quantity,unit_cost:100,table_price:100,price_origin:'manual',price_unlinked:true};
 const saved=m.recalculateBudget([manual],[],txSettings,txCatalog());
 assert.equal(saved.items[0].unit_cost,100);assert.equal(saved.items[0].quantity,1.5922);assert.equal(saved.items[0].total_cost,159.22);
});
