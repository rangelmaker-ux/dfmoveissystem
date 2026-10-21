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

test('line path disambiguates the same colour across every brand catalogue',()=>{
  const db={Duratex:{type:'brand',authoritative:true,lines:[
    {id:'shine',name:'Alto Brilho',aliases:[],colors:['Titanio'],width:2.75,height:1.85,prices:{'6mm':630.67,'15mm':843.26,'18mm':949.14,'25mm':null,'30mm':null}},
    {id:'cristallo',name:'Cristalo-Liso',aliases:['Alto Brilho > Cristallo'],colors:['Titânio'],width:2.75,height:1.85,prices:{'6mm':568.23,'15mm':762.56,'18mm':865.4,'25mm':null,'30mm':null}},
    {id:'trama',name:'Unicores -Trama',aliases:['Unicolores > Trama'],colors:['Titânio'],width:2.75,height:1.85,prices:{'6mm':429,'15mm':567.24,'18mm':640.22,'25mm':null,'30mm':null}},
  ]}};
  const cristallo=m.smartMatchPromobChapa('1.0155.15.Duratex.Cristallo.Titanio.MDF BP 2L Revest','Tamponamento Inferior',db,'770 x 15 x 600');
  assert.equal(cristallo.matched,true);
  assert.equal(cristallo.line,'Cristalo-Liso');
  assert.equal(cristallo.boardPrice,762.56);
  const manualLine=m.smartMatchPromobChapa('1.0155.15.Duratex.Alto Brilho.Cristallo.Titanio.MDF BP 2L Revest','Painel Titânio alto brilho',db,'770 x 15 x 600');
  assert.equal(manualLine.matched,true);
  assert.equal(manualLine.line,'Alto Brilho');
  assert.equal(manualLine.boardPrice,843.26);
  const unaccented=m.smartMatchPromobChapa('Duratex.Alto Brilho.Titanio.18','MDF Titanio Alto Brilho Espessura 18mm',db);
  assert.equal(unaccented.line,'Alto Brilho');
  assert.equal(unaccented.boardPrice,949.14);
  assert.equal(m.smartMatchPromobChapa('Duratex.Titanio.15','MDF Titânio 15mm',db).matched,false);
});
