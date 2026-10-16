import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
const source=['default-materials','chapas-catalog','calculator','parsers','shared-pricing'].map(name=>stripTypeScriptTypes(fs.readFileSync(`src/lib/orcamento/${name}.ts`,'utf8'))).join('\n').replace(/^import .*;$/mg,'');
const m=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const reference={margin:200,frete:0,montagem:0,comissao_vendas:0,comissao_executivo:0,outros:[],chapa_mode:'m2',chapa_rounding:'up',fita_mode:'metros',pdf_show_unit_price:true,pdf_show_item_total:true};
const policy=m.readSharedPricing(reference);
const different={...reference,frete:5,montagem:10,comissao_vendas:4,comissao_executivo:2};
const xml='<LISTING><ITEM REFERENCE="TEST-MDF" DESCRIPTION="Chapa teste" UNIT="M2" QUANTITY="10" WIDTH="1000" HEIGHT="18" DEPTH="1000" /></LISTING>';
const db=[{id:'panel',code:'TEST-MDF',description:'Chapa teste',unit:'M2',unit_price:1000,category:'MDF',subcodes:[]}];
const imported=m.parsePromobXML(xml).items;
test('same XML shows the 21% account difference before normalization and identical totals for every account after',()=>{
  const jaque=m.recalculateBudget(imported,db,reference,{}).totals;
  const other=m.recalculateBudget(imported,db,different,{}).totals;
  assert.ok(jaque.total_price>0);assert.equal(other.total_price,m.round2(jaque.total_price*1.21));
  for(const settings of [reference,different,{...different,company:{nome_fantasia:'Outro PDF'}},{...different,chapa_mode:'chapa',chapa_rounding:'down'}])
    assert.deepEqual(m.recalculateBudget(imported,db,m.applySharedPricing(settings,policy),{}).totals,jaque);
});
test('reopening and merging old proposals cannot restore private pricing; personal PDF preferences survive',()=>{
  const old={...different,company:{nome_fantasia:'Minha empresa'},pdf_show_unit_price:false};
  const normalized=m.applySharedPricing(old,policy);
  for(const key of m.PRICING_KEYS)assert.deepEqual(normalized[key],reference[key]);
  assert.equal(normalized.company,old.company);assert.equal(normalized.pdf_show_unit_price,false);
  assert.deepEqual(m.readSharedPricing(normalized),policy);
  assert.throws(()=>m.readSharedPricing({margin:200}));assert.throws(()=>m.readSharedPricing(null));
});
