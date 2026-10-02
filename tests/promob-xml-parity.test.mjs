import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
const source = ['default-materials', 'chapas-catalog', 'calculator', 'parsers'].map(name =>
  stripTypeScriptTypes(fs.readFileSync(`src/lib/orcamento/${name}.ts`, 'utf8'))).join('\n').replace(/^import .*;$/mg, '');
const m = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);

test('technical cost metadata never shadows the physical panel finish or price',()=>{
 const xml='<ITEM REFERENCE="1.0484.18.Greenplac.Carmel.MDF" DESCRIPTION="Painel Porta Reta" UNIT="M2" QUANTITY=".26" WIDTH="344" HEIGHT="18" DEPTH="736.5"><COSTCOMPONENTS><COMPONENT TABLE_PRICE="999"><REFERENCES><MODEL REFERENCE="Wrong child color"/></REFERENCES></COMPONENT></COSTCOMPONENTS><REFERENCES><MODEL REFERENCE="Greenplac.Carmel"/></REFERENCES></ITEM>';
 const {items}=m.parsePromobXML(xml);
 assert.equal(items.length,1);assert.equal(items[0].external_model,'Greenplac.Carmel');assert.equal(items[0].table_price,0);
});

test('native Plus prices and totals are read without importing diagnostic copies', () => {
 const xml = `<LISTING><TOTALPRICES TABLE="3559.46"><MARGINS><BUDGET VALUE="9854.38"/></MARGINS></TOTALPRICES>
 <AMBIENTS><AMBIENT><CATEGORIES><ITEMS><ITEM GUID="hinge" REFERENCE="HINGE" DESCRIPTION="Dobradiça" UNIT="UN" REPETITION="26" QUANTITY="1">
 <PRICE TABLE="10" UNIT="10" TOTAL="260"><MARGINS><BUDGET UNIT="10" TOTAL="260"/></MARGINS></PRICE></ITEM>
 <ITEM GUID="board" REFERENCE="1.2006.15.Branco.MDF" DESCRIPTION="Base 15" UNIT="M2" REPETITION="2" QUANTITY="0.39">
 <REFERENCES><PRICE REFERENCE="15.Branco.MDF"/></REFERENCES><PRICE TABLE="56.22" TOTAL="43.86"><MARGINS><BUDGET TOTAL="131.58"/></MARGINS></PRICE></ITEM>
 </ITEMS></CATEGORIES></AMBIENT></AMBIENTS><ITEMSWITHOUTPRICE><ITEM GUID="hinge" REFERENCE="HINGE"/></ITEMSWITHOUTPRICE></LISTING>`;
 const {items,metadata} = m.parsePromobXML(xml);
 assert.equal(items.length,2);assert.equal(items[0].quantity,26);assert.equal(items[0].table_price,10);assert.equal(items[0].final_price,260);
 assert.equal(items[1].quantity,.78);assert.equal(items[1].table_price,56.22);assert.equal(items[1].final_price,131.58);
 assert.equal(metadata.total_tabela,3559.46);assert.equal(metadata.total_final,9854.38);
});

const wrapper='<ITEM GUID="wrapper" ID="COZ_POR_INF" REFERENCE="7001.18.100" DESCRIPTION="Porta Inferior Reta" UNIT="UN" QUANTITY="3" WIDTH="396" HEIGHT="694" DEPTH="18"><REFERENCES><ACAB REFERENCE="100"/></REFERENCES></ITEM>';
const panel='<ITEM GUID="panel" ID="POR_PAI_PORTA" REFERENCE="1601.100" DESCRIPTION="Painel Porta Reta" UNIT="UN" QUANTITY="3" WIDTH="694" HEIGHT="18" DEPTH="396"><REFERENCES><ACAB REFERENCE="100"/></REFERENCES></ITEM>';
test('old flat Start door wrappers do not duplicate their physical panels',()=>{
 const xml=`<LISTING ID="LISTING_STRUCTURED_W_OP"><AMBIENT>${wrapper}${panel}</AMBIENT></LISTING>`;
 assert.deepEqual(m.parsePromobXML(xml).items.map(x=>x.code),['1601.100']);
 assert.equal(m.parsePromobXML(`<LISTING ID="Listagem_explosao">${wrapper}${panel}</LISTING>`).items.length,2);
 assert.equal(m.parsePromobXML(`<LISTING ID="LISTING_STRUCTURED_W_OP">${wrapper}</LISTING>`).items.length,1);
 assert.equal(m.parsePromobXML(xml.replace('QUANTITY="3" WIDTH="694"','QUANTITY="2" WIDTH="694"')).items.length,2);
 assert.equal(m.parsePromobXML(xml.replace('REFERENCE="7001.18.100"','TABLE_PRICE="50" REFERENCE="7001.18.100"')).items.length,2);
 assert.equal(m.parsePromobXML(`<LISTING ID="LISTING_STRUCTURED_W_OP"><AMBIENT>${wrapper}</AMBIENT><AMBIENT>${panel}</AMBIENT></LISTING>`).items.length,2);
});
test('flat phantom slider and actual slider represent one purchasable set',()=>{
 const xml=`<LISTING ID="LISTING_STRUCTURED_W_OP"><AMBIENT>
 <ITEM ID="ace_cor_simples" REFERENCE="AGCCTT500" DESCRIPTION="Conjunto Corrediça" UNIT="UN" QUANTITY="4" WIDTH="13.5" HEIGHT="37" DEPTH="500"/>
 <ITEM ID="ace_ocu_div_cor_gen_c" REFERENCE="CCTT500" DESCRIPTION="Conjunto Corrediça" UNIT="UN" QUANTITY="4" WIDTH="13.5" HEIGHT="37" DEPTH="500"/>
 </AMBIENT></LISTING>`;
 assert.deepEqual(m.parsePromobXML(xml).items.map(x=>x.code),['CCTT500']);
 assert.equal(m.parsePromobXML(xml.replace('REFERENCE="CCTT500"','REFERENCE="CCTT450"')).items.length,2);
});
test('unknown manufacturing services never inherit a generic Porta Reta alias',()=>{
 const service={code:'Frente Reta',description:'Processo de Fabricação',unit:'UN',category:'Processo de Fabricação'};
 assert.equal(m.resolveItemPrice(service,{},m.DEFAULT_MATERIALS).matched,false);
 const db=[...m.DEFAULT_MATERIALS,{code:'Frente Reta',description:'Processo de Fabricação - Frente Reta',unit:'UN',unit_price:45,category:'MAO_DE_OBRA'}];
 assert.equal(m.resolveItemPrice(service,{},db).unit_cost,45);
 assert.equal(m.resolveItemPrice({...service,code:'Porta Reta'}, {},m.DEFAULT_MATERIALS).unit_cost,70);
});
