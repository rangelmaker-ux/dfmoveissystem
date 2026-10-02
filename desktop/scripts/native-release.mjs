import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import yaml from 'js-yaml';
const endpoint = 'https://rcwilkmovlrdxhfviemo.supabase.co/functions/v1/desktop-updates';
const audience = 'df-moveis-desktop-publisher';
const chunkSize = 32 * 1024 * 1024;
const compare = (a,b) => { const x=a.split('.').map(Number),y=b.split('.').map(Number); return x[0]-y[0]||x[1]-y[1]||x[2]-y[2]; };
async function latest() {
  const r = await fetch(`${endpoint}?asset=release.json&check=${Date.now()}`, {signal:AbortSignal.timeout(20000)});
  if(r.status===404)return null;
  if(!r.ok)throw new Error(`Release channel unavailable (${r.status})`);
  return r.json();
}
async function token() {
  const url = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
  url.searchParams.set('audience', audience);
  const r = await fetch(url, {headers:{Authorization:`Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`},signal:AbortSignal.timeout(20000)});
  if(!r.ok)throw new Error(`CI identity unavailable (${r.status})`);
  return (await r.json()).value;
}
async function request(body) {
  const r = await fetch(endpoint,{method:'POST',headers:{Authorization:`Bearer ${await token()}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});
  if(!r.ok)throw new Error(`Release publication failed (${r.status})`);
  return r.json();
}
if(process.argv[2]==='version') {
  const pkg=JSON.parse(await fs.readFile('package.json','utf8'));
  const current=await latest();
  if(current && compare(pkg.version,current.version)<=0){const v=current.version.split('.').map(Number);pkg.version=`${v[0]}.${v[1]}.${v[2]+1}`;}
  await fs.writeFile('package.json',JSON.stringify(pkg,null,2)+'\n');
  const lock=JSON.parse(await fs.readFile('package-lock.json','utf8'));lock.version=pkg.version;lock.packages[''].version=pkg.version;
  await fs.writeFile('package-lock.json',JSON.stringify(lock,null,2)+'\n');
  console.log(`Compilando versão ${pkg.version}`);
} else if(process.argv[2]==='publish') {
  const pkg=JSON.parse(await fs.readFile('package.json','utf8'));
  const file=`DF-Moveis-Instalador-${pkg.version}-x64.exe`;
  const names=[file,`${file}.blockmap`];
  const buffers=await Promise.all(names.map(n=>fs.readFile(path.join('release',n))));
  const files=names.map((name,i)=>({name,size:buffers[i].length,sha512:createHash('sha512').update(buffers[i]).digest('base64')}));
  const meta=yaml.load(await fs.readFile('release/latest.yml','utf8'));
  if(meta.version!==pkg.version||meta.sha512!==files[0].sha512)throw new Error('Installer integrity mismatch');
  const body={version:pkg.version,revision:process.env.GITHUB_SHA,files};
  const {uploads,publicKey}=await request({...body,action:'prepare'});
  for(const upload of uploads) {
    const idx=names.indexOf(upload.file),part=Number(upload.path.match(/part(\d+)$/)[1]);
    const bytes=buffers[idx].subarray(part*chunkSize,part*chunkSize+upload.size);
    if(bytes.length!==upload.size)throw new Error('Invalid upload size');
    let success=false;
    for(let attempt=0;attempt<3;attempt++){
      const r=await fetch(upload.signedUrl,{method:'PUT',headers:{'Content-Type':'application/octet-stream','Cache-Control':'max-age=31536000',apikey:publicKey,Authorization:`Bearer ${publicKey}`,'x-upsert':'true'},body:bytes,signal:AbortSignal.timeout(120000)});
      if(r.ok){success=true;break;}
    }
    if(!success)throw new Error('Installer upload failed');
  }
  await request({...body,action:'finalize'});
  const published=await latest();
  if(published.version!==pkg.version||published.files[0].sha512!==files[0].sha512)throw new Error('Release verification failed');
  console.log(`Atualização ${pkg.version} publicada e verificada.`);
} else throw new Error('Expected version or publish');
