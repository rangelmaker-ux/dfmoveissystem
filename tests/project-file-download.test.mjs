import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import test from 'node:test';
const source=stripTypeScriptTypes(fs.readFileSync('src/lib/project-files.ts','utf8')).replace(/^import .*;$/mg,'');
test('XML downloads preserve names and never open preview tabs; other previews still open',async()=>{
  const calls=[];let failure=false;const popup={location:{href:''},close(){calls.push('close');}};
  globalThis.window={open(){calls.push('popup');return popup;},location:{assign(){calls.push('navigate');}}};
  globalThis.document={createElement(){return {click(){calls.push({clicked:this.href,filename:this.download});},remove(){calls.push('remove');}}},body:{appendChild(){calls.push('append');}}};
  globalThis.supabase={storage:{from(bucket){assert.equal(bucket,'projetos_arquivos');return {async createSignedUrl(path,expiry,options){calls.push({path,expiry,options});return failure?{error:new Error('denied')}:{data:{signedUrl:'https://storage.example/signed?download=file'}};}};}}};
  globalThis.toast={error(message){calls.push({error:message});}};
  try {
    const m=await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
    for(const filename of ['orçamento.xml','Projeto.XML']){
      calls.length=0;await m.openProjectFile('project',filename);
      assert.equal(calls.includes('popup'),false);assert.equal(calls.includes('navigate'),false);
      assert.deepEqual(calls[0],{path:`project/${filename}`,expiry:300,options:{download:filename}});
      assert.equal(calls.find(c=>c?.clicked)?.filename,filename);
    }
    calls.length=0;await m.openProjectFile('project','preview.pdf');assert.equal(calls[0],'popup');assert.equal(popup.location.href,'https://storage.example/signed?download=file');
    calls.length=0;failure=true;await m.openProjectFile('project','project.xml');assert.equal(calls.some(c=>c?.clicked),false);assert.match(calls.at(-1).error,/baixar/);
  } finally { for(const key of ['window','document','supabase','toast'])delete globalThis[key]; }
});
