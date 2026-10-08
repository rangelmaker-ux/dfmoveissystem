import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
const source=['finance','sale-flow'].map(name=>stripTypeScriptTypes(fs.readFileSync(`src/lib/${name}.ts`,'utf8'))).join('\n').replace(/^import .*;$/mg,'');
const m=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const form={valorVenda:'10.000,00',percentualComissao:'5',rtArquiteto:'2,5',nomeArquiteto:'Parceiro',valorEntrada:'1.000,00',formaPagamentoEntrada:'Pix',numParcelas:'3',waiting:true,deadline:null};
test('waiting keeps financial terms without confirming sale, with no deadline or a chosen date',()=>{
  const saved=m.saleUpdate(form,'2026-10-08');
  assert.equal(saved.status,'PAUSADO');assert.equal(saved.status_venda,'EM_NEGOCIACAO');assert.equal(saved.aguardando_cliente,true);
  assert.equal(saved.valor_venda,10000);assert.equal(saved.percentual_comissao,5);assert.equal(saved.rt_arquiteto,2.5);assert.equal(saved.valor_parcela,3000);assert.equal(saved.prazo_cliente,null);
  assert.equal(m.saleUpdate({...form,deadline:'2027-01-06'},'2026-10-08').prazo_cliente,'2027-01-06');
});
test('confirmation preserves terms and clears pending state; financial errors cannot be saved',()=>{
  const waiting=m.saleUpdate(form,'2026-10-08');const confirmed=m.saleUpdate({...form,waiting:false,deadline:'2026-01-01'},'2026-10-08');
  assert.equal(confirmed.status,'FINALIZADO');assert.equal(confirmed.status_venda,'VENDEU');assert.equal(confirmed.aguardando_cliente,false);assert.equal(confirmed.prazo_cliente,null);
  for(const key of ['valor_venda','percentual_comissao','rt_arquiteto','valor_entrada','numero_parcelas','valor_parcela'])assert.equal(confirmed[key],waiting[key]);
  for(const invalid of [{percentualComissao:'101'},{valorEntrada:'20000'},{numParcelas:'0'},{rtArquiteto:'101'}])assert.throws(()=>m.saleUpdate({...form,...invalid}));
});
test('30/60/90 days cross months and custom dates reject invalid/past dates',()=>{
  const start=new Date(2026,9,8,12);
  assert.equal(m.clientDeadline(30,start),'2026-11-07');assert.equal(m.clientDeadline(60,start),'2026-12-07');assert.equal(m.clientDeadline(90,start),'2027-01-06');
  for(const deadline of ['2026-02-30','2026-10-07','bad'])assert.throws(()=>m.saleUpdate({...form,deadline},'2026-10-08'));
});
