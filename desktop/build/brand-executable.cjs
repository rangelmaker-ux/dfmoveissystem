const fs = require('node:fs');
const path = require('node:path');
module.exports = async function brandExecutable(context) {
  if (context.electronPlatformName !== 'win32') return;
  const ResEdit = await import('resedit');
  const PE = await import('pe-library');
  const name = `${context.packager.appInfo.productFilename}.exe`;
  const target = path.join(context.appOutDir, name);
  const exe = PE.NtExecutable.from(fs.readFileSync(target));
  const resources = PE.NtExecutableResource.from(exe);
  const icon = ResEdit.Data.IconFile.from(fs.readFileSync(path.join(__dirname, 'icon.ico')));
  for (const group of ResEdit.Resource.IconGroupEntry.fromEntries(resources.entries)) {
    ResEdit.Resource.IconGroupEntry.replaceIconsForResource(resources.entries, group.id, group.lang, icon.icons.map(item => item.data));
  }
  const version = ResEdit.Resource.VersionInfo.fromEntries(resources.entries)[0];
  const parts = context.packager.appInfo.version.split('.').map(Number);
  version.setFileVersion(...parts, 0, 1033);
  version.setProductVersion(...parts, 0, 1033);
  version.setStringValues({ lang: 1033, codepage: 1200 }, {
    CompanyName: 'DF Móveis Planejados', ProductName: 'DF Móveis Planejados',
    FileDescription: 'DF Móveis Planejados · Sistema interno', OriginalFilename: name,
    InternalName: 'DFMoveis', LegalCopyright: '© 2026 DF Móveis Planejados. Criador: Rangel Marques.',
  });
  version.outputToResourceEntries(resources.entries);
  resources.outputResource(exe);
  fs.writeFileSync(target, Buffer.from(exe.generate()));
};
