const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { NsisUpdater } = require('electron-updater');
const { NodeHttpExecutor } = require('builder-util/out/nodeHttpExecutor');
const { ElectronHttpExecutor } = require('electron-updater/out/electronHttpExecutor');
(async () => {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'df-native-update-'));
  try {
    const config=path.join(dir,'app-update.yml');
    await fs.writeFile(config,'provider: generic\nurl: https://dfmoveis-system.vercel.app/desktop-native/\nupdaterCacheDirName: df-update-verification\n');
    const app={version:'1.0.1',name:'DF Móveis',isPackaged:true,appUpdateConfigPath:config,userDataPath:dir,baseCachePath:dir,whenReady:async()=>{},onQuit(){},quit(){},relaunch(){}};
    const updater=new NsisUpdater(undefined,app);
    updater._testOnlyOptions={platform:'win32'};
    updater.httpExecutor=new NodeHttpExecutor();
    updater.httpExecutor.download=ElectronHttpExecutor.prototype.download;
    updater.autoDownload=false;updater.autoInstallOnAppQuit=false;updater.disableDifferentialDownload=true;updater.disableWebInstaller=true;updater.logger=null;
    let result;
    for(let attempt=0;attempt<12;attempt++){
      try {result=await updater.checkForUpdates();break;}catch(error){if(attempt===11)throw error;await new Promise(resolve=>setTimeout(resolve,15000));}
    }
    assert.equal(result.isUpdateAvailable,true);
    const [download]=await updater.downloadUpdate();
    const bytes=await fs.readFile(download);
    assert.equal(bytes.subarray(0,2).toString(),'MZ');
    assert.equal(createHash('sha512').update(bytes).digest('base64'),result.updateInfo.sha512);
    let invocation;
    updater.spawnLog=async (executable,args)=>{invocation={executable,args};};
    assert.equal(updater.doInstall({isSilent:true,isForceRunAfter:true,isAdminRightsRequired:false}),true);
    assert.deepEqual(invocation.args,['--updated','/S','--force-run']);
    console.log(`Versão 1.0.1 encontrou ${result.updateInfo.version}, baixou ${bytes.length} bytes íntegros e preparou instalação silenciosa com reinício.`);
  } finally {await fs.rm(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
