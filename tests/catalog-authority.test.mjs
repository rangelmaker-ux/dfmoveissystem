import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
const source = ['default-materials','chapas-catalog','calculator'].map(name=>stripTypeScriptTypes(fs.readFileSync(`src/lib/orcamento/${name}.ts`,'utf8'))).join('\n').replace(/^import .*;$/mg,'');
const m=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const settings={margin:200,frete:0,montagem:0,comissao_vendas:0,comissao_executivo:0,outros:[],chapa_mode:'m2',chapa_rounding:'up',fita_mode:'metros'};
const hinge={id:'hinge',code:'DOB-RETA',description:'Dobradiça Reta',unit:'UN',category:'FERRAGEM',unit_price:12,subcodes:['CDOBT']};
const row={id:'a',code:'CDOBT',description:'Dobradiça Reta',unit:'UN',quantity:24,rep:24,unit_quantity:1,category:'Ferragens',promob_xml:true,price_origin:'imported',table_price:3,unit_cost:3,final_price:999};

test('screws never appear or contribute to XML and old budget totals; hinges remain',()=>{
  const screws=[{...row,id:'s1',code:'PAR.DOB.0440',description:'Parafuso para Dobradiça'}, {...row,id:'s2',code:'custom',description:'Parafusos Chipboard',price_unlinked:true,price_origin:'manual',unit_cost:100}];
  for (const xml of [true,false]) {
    const priced=m.recalculateBudget([...screws,row].map(item=>({...item,promob_xml:xml,final_price:undefined})),[hinge],settings,{});
    assert.deepEqual(priced.items.map(item=>item.id),['a']);
    assert.equal(priced.totals.total_cost,288);
    assert.equal(priced.totals.total_price,288);
    assert.equal(priced.totals.items_count,1);
  }
  assert.equal(m.isScrew({description:'Puxador Udine'}),false);
  assert.equal(m.isScrew({description:'Dobradiça Reta'}),false);
});

test('accessory catalogue removes screws while preserving handles and labour',()=>{
  const catalog={accessories:{type:'acessorios',brandName:'Acessórios',items:[{id:'1',name:'Parafuso 4x40',size:'',price:2},{id:'2',name:'Puxador',size:'',price:85}]},labour:{type:'maodeobra',brandName:'Mão de Obra Fixa',items:[{id:'3',name:'Montagem com parafusos',unit:'UN',price:70}]}};
  const cleaned=m.excludeScrewsFromCatalog(catalog);
  assert.deepEqual(cleaned.accessories.items.map(item=>item.id),['2']);
  assert.equal(cleaned.labour,catalog.labour);
  assert.equal(catalog.accessories.items.length,2);
});
test('saved code and alias override imported price, survive reopen, and follow updated/zero catalog values',()=>{
  let priced=m.recalculateBudget([row],[hinge],settings,{});
  assert.equal(priced.items[0].unit_cost,12);assert.equal(priced.totals.total_price,288);
  priced=m.recalculateBudget(priced.items,[{...hinge,unit_price:15}],settings,{});
  assert.equal(priced.totals.total_price,360);
  priced=m.recalculateBudget(priced.items,[{...hinge,unit_price:0}],settings,{});
  assert.equal(priced.totals.total_price,0);assert.equal(priced.items[0].found,false);
});
test('exact normalized name recognizes saved hardware without an export code',()=>{
  assert.equal(m.calculateItemPrice({...row,code:'unknown',description:'  DOBRADICA RETA  '},[hinge],settings,{}).unit_cost,12);
});
test('manual unlinked budget edits remain manual',()=>{
  assert.equal(m.calculateItemPrice({...row,price_unlinked:true,price_origin:'manual',unit_cost:7},[hinge],settings,{}).total_price,168);
});
test('primary code beats overlapping aliases; unknown ambiguous alias cannot select first product',()=>{
  const curved={...hinge,id:'curved',code:'DOB-CURVA',description:'Dobradiça Curva',unit_price:18};
  assert.equal(m.resolveItemPrice({...row,code:'DOB-RETA'}, {},[hinge,curved]).unit_cost,12);
  assert.equal(m.resolveItemPrice({...row,description:'Dobradiça'}, {},[hinge,curved]).matched,false);
});
test('real CDOBT placeholder follows one configured alias with matching straight/curved variant',()=>{
  const placeholder={...hinge,id:'promob-start:CDOBT',code:'CDOBT',description:'Conjunto Dobradica Padrao Reta',unit_price:0,subcodes:[]};
  assert.equal(m.resolveItemPrice({...row,description:placeholder.description},{},[placeholder,hinge,{...hinge,id:'curved',code:'CURVA',description:'Dobradiça Curva',unit_price:18}]).unit_cost,12);
});
test('13 Porta Reta and 4 Frente Reta both use saved manufacturing cost and quantities',()=>{
  const catalog={'Mão de Obra Fixa':{type:'maodeobra',items:[{id:'mo-1',name:'Porta Reta',unit:'UN',price:70},{id:'mo-2',name:'Porta Cava Horizontal',unit:'UN',price:71},{id:'mo-4',name:'Porta Cava 45°',unit:'UN',price:85}]}};
  const rows=['Porta Reta','Frente Reta'].map((code,index)=>({...row,id:String(index),code,description:'Processo de Fabricação',category:'Cozinhas',quantity:index?4:13,rep:index?4:13,table_price:0,unit_cost:0,final_price:undefined}));
  const db=[{id:'front',code:'Frente Reta',description:'Processo de Fabricação - Frente Reta',category:'MAO_DE_OBRA',unit:'UN',unit_price:90}];
  const priced=m.recalculateBudget(rows,db,settings,catalog);
  assert.deepEqual(priced.items.map(item=>item.quantity),[13,4]);assert.deepEqual(priced.items.map(item=>item.total_cost),[910,360]);
  assert.equal(priced.totals.total_price,3810);
  catalog['Mão de Obra Fixa'].items[0].price=80;
  assert.deepEqual(m.recalculateBudget(priced.items,db,settings,catalog).items.map(item=>item.total_cost),[1040,360]);
  assert.equal(m.recalculateBudget(priced.items,[{...db[0],unit_price:0}],settings,catalog).items[1].total_cost,0);
  assert.equal(m.smartMatchMaoDeObra('Porta Cava 45','Processo de Fabricação',catalog,[]).price,85);
});
