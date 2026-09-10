import { readFile, readdir, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const sections=['知了1号 · Third-party notices\nGenerated from installed frontend production dependencies and resolved Rust dependencies.\nProtocol facts are from the linked VoiceTX documentation; no vendor audio files are redistributed.'];
async function add(name, directory, license) {
  const files=(await readdir(directory)).filter(file=>/^(licen[sc]e|copying|notice|copyright)([.-]|$)/i.test(file));
  let content=`\n${'='.repeat(72)}\n${name}\nLicense: ${license??'See package source'}\n`;
  for(const file of files){try{content+=`\n--- ${file} ---\n${await readFile(path.join(directory,file),'utf8')}\n`;}catch{}}
  sections.push(content);
}
const lock=JSON.parse(await readFile('package-lock.json','utf8'));
for(const [directory,entry] of Object.entries(lock.packages)) {
  if(!directory || entry.dev)continue;
  const pkg=JSON.parse(await readFile(path.join(directory,'package.json'),'utf8'));
  await add(`${pkg.name}@${pkg.version}`,directory,pkg.license);
}
const metadata=JSON.parse(execFileSync('cargo',['metadata','--manifest-path','src-tauri/Cargo.toml','--format-version','1','--offline','--filter-platform','x86_64-pc-windows-msvc'],{encoding:'utf8',windowsHide:true,maxBuffer:20*1024*1024}));
const resolved=new Set(metadata.resolve.nodes.map(n=>n.id));
for(const pkg of metadata.packages) {
  if(!pkg.source || !resolved.has(pkg.id))continue;
  await add(`${pkg.name}@${pkg.version}`,path.dirname(pkg.manifest_path),pkg.license);
}
await writeFile('THIRD-PARTY-NOTICES.txt',sections.join('\n'));
console.log(`Generated notices for ${sections.length-1} packages.`);
