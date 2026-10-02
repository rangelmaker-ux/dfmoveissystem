import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptsPublisher, AUDIENCE, REPOSITORY, WORKFLOW, makeRelease, byteRange, readParts } from '../supabase/functions/desktop-updates/protocol.mjs';
const now=1000000;
const claims={iss:'https://token.actions.githubusercontent.com',aud:AUDIENCE,repository:REPOSITORY,repository_id:'1239121209',ref:'refs/heads/main',workflow_ref:WORKFLOW,event_name:'push',sha:'a'.repeat(40),exp:now+300,nbf:now-10,iat:now-10};
test('only the intended main workflow may publish',()=>{
  assert.equal(acceptsPublisher(claims,now),true);
  for(const [key,value] of Object.entries({iss:'wrong',aud:'wrong',repository:'wrong',repository_id:'1',ref:'refs/heads/fork',workflow_ref:'wrong',event_name:'pull_request',sha:'bad',exp:now-1,iat:now-1000})) assert.equal(acceptsPublisher({...claims,[key]:value},now),false,key);
});
test('release chunk sizes preserve all installer bytes',()=>{
  const release=makeRelease({version:'1.0.3',revision:'a'.repeat(40),files:[{name:'DF-Moveis-Instalador-1.0.3-x64.exe',size:100000000,sha512:'A'.repeat(86)+'=='},{name:'DF-Moveis-Instalador-1.0.3-x64.exe.blockmap',size:40000,sha512:'A'.repeat(86)+'=='}]});
  assert.equal(release.files[0].parts.reduce((n,p)=>n+p.size,0),100000000);
  assert.equal(release.files[0].parts.length,3);
});
test('range downloads cross storage parts without truncation or duplication',async()=>{
  const parts=[{path:'one',size:4},{path:'two',size:4}];
  const get=async(path)=>new Response(path==='one'?'abcd':'efgh');
  const bytes=[];for await(const chunk of readParts(parts,byteRange('bytes=2-5',8),get))bytes.push(Buffer.from(chunk));
  assert.equal(Buffer.concat(bytes).toString(),'cdef');
  assert.deepEqual(byteRange('bytes=-3',8),{start:5,end:7,partial:true});
  assert.throws(()=>byteRange('bytes=9-',8));
});
test('incomplete installer streams fail integrity instead of pretending success',async()=>{
  await assert.rejects(async()=>{for await(const chunk of readParts([{path:'x',size:8}],byteRange(null,8),async()=>new Response('abc')))void chunk;},/Incomplete/);
});
