import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
const source=['default-materials','chapas-catalog','calculator'].map(name=>stripTypeScriptTypes(fs.readFileSync(`src/lib/orcamento/${name}.ts`,'utf8'))).join('\n').replace(/^import .*;$/mg,'');
const m=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const line={id:'uni',name:'Unicolores - Micro',colors:['Cinza Cobalto (TX)','Cinza Cobalto (VEL)','Cinza Argila (TX)','Azul (TX)'],aliases:['Combine Fácil > Unicolores'],width:2.75,height:1.85,prices:{'6mm':324.36,'15mm':461.49,'18mm':521.43,'25mm':null}};
const catalog={Berneck:{type:'brand',brandName:'Berneck',authoritative:true,lines:[line,{...line,id:'other',name:'Outra linha',colors:['Cinza Argila (VEL)'],aliases:[],prices:{...line.prices,'15mm':999}}]}};
test('XML dots, parentheses and finish punctuation match registered full colour pattern',()=>{
  for(const finish of ['Berneck.Cinza Cobalto TX','Berneck.Cinza Cobalto (TX)','Berneck>Cinza Cobalto_TX']){
    const match=m.smartMatchPromobChapa('',`MDF ${finish} espessura 15mm`,catalog,'255 x 15 x 70');
    assert.equal(match.matched,true);assert.equal(match.line,line.name);assert.equal(match.boardPrice,461.49);
  }
  const item={code:'1210.25.1.7.Cinza Cobalto (TX)',description:'Moldura Engrossamento',external_model:'Berneck.Cinza Cobalto TX',dimensions:'255 x 15 x 70',unit:'M2',promob_xml:true};
  assert.equal(m.resolveItemPrice(item,catalog,[]).line,line.name);
});
test('short finish tokens remain significant and missing prices are never substituted',()=>{
  assert.equal(m.smartMatchPromobChapa('','MDF Berneck Cinza Argila VEL espessura 15mm',catalog).boardPrice,999);
  assert.equal(m.smartMatchPromobChapa('','MDF Berneck Cinza Cobalto TX espessura 25mm',catalog).matched,false);
  assert.equal(m.smartMatchPromobChapa('','MDF Berneck Cinza TX espessura 15mm',catalog).matched,false);
});
test('complete colour beats an unpriced generic line named after its finish',()=>{
  const db={Berneck:{type:'brand',brandName:'Berneck',authoritative:true,lines:[{...line,id:'design',name:'Design',colors:[],aliases:[],prices:{}},{...line,colors:['Branco (Design)']}]}};
  assert.equal(m.smartMatchPromobChapa('','MDF Berneck Branco Design espessura 15mm',db).boardPrice,461.49);
});
