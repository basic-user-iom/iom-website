/** LOCAL-ONLY static deployment packaging. No uploads, deploys, pushes or credential-file loading. */
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parse as parseHtml } from 'parse5';
import { assertReleaseManifestSecrets, knownValuesFromEnvironment, safeRelative, credentialPath, scanReleaseFile } from './deploy-secret-scan.mjs';

const toolRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const gitBlob = bytes => createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const fail = code => { throw new Error(code); };
const inside = (parent, child) => child === parent || child.startsWith(parent + path.sep);
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const securityHeaders = {
  'Content-Security-Policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'self'; form-action 'self' https://api.web3forms.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://cdn.jsdelivr.net https://fonts.gstatic.com; media-src 'self' blob: https:; worker-src 'self' blob: https://cdn.jsdelivr.net; connect-src 'self' https: wss: blob:; frame-src 'self' https://vercel.live https://3dbviewer.com https://streets.gl https://www.procedural.eu https://www.youtube.com https://www.youtube-nocookie.com",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'SAMEORIGIN',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'payment=(), usb=(), interest-cohort=()',
  'Cache-Control': 'public, max-age=0, must-revalidate',
};

export function assertPlainPath(file) {
  let current = file;
  while (true) {
    if (fs.lstatSync(current).isSymbolicLink()) fail('SYMLINK_REFUSED');
    if (current === path.dirname(current)) break;
    current = path.dirname(current);
  }
}
export function listFiles(root, relative = '') {
  assertPlainPath(root);
  return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).sort((a,b) => a.name.localeCompare(b.name)).flatMap(item => {
    const name = relative ? `${relative}/${item.name}` : item.name;
    if (!safeRelative(name) || credentialPath(name)) fail('UNSAFE_INPUT_PATH');
    const absolute = path.join(root, name), stat = fs.lstatSync(absolute);
    if (stat.isSymbolicLink()) fail('SYMLINK_REFUSED');
    if (stat.isDirectory()) return listFiles(root, name);
    if (!stat.isFile() || stat.nlink !== 1) fail('NON_REGULAR_INPUT_REFUSED');
    return [{ path: name, size: stat.size }];
  });
}
export function validateProject(config, id) {
  if (config?.version !== 1 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) fail('INVALID_PROJECT');
  const project = Object.hasOwn(config.projects ?? {}, id) && config.projects[id];
  if (!project || !['candidate', 'verified-static'].includes(project.status)) fail('PROJECT_NOT_ENABLED');
  if (project.input !== `public/demos/${id}` && project.input !== `public/demo/${id}`) fail('INPUT_BOUNDARY_REFUSED');
  if (project.basePath !== '/' + project.input.slice(7) + '/') fail('URL_BOUNDARY_REFUSED');
  if (!['noindex', 'preserve'].includes(project.indexing)) fail('INDEXING_POLICY_REQUIRED');
  if (!Array.isArray(project.requiredFiles) || !project.requiredFiles.includes('index.html') || project.requiredFiles.some(p => !safeRelative(p))) fail('REQUIRED_FILES_INVALID');
  return project;
}
export function outputConfig(project) {
  const base = project.basePath.slice(0, -1);
  return { version: 3, routes: [
    { src: '^/(.*)$', headers: { ...securityHeaders, ...(project.indexing === 'noindex' ? { 'X-Robots-Tag': 'noindex, nofollow, noarchive' } : {}) }, continue: true },
    { src: `^${escape(base)}/?$`, dest: `${base}/index.html` },
    { handle: 'filesystem' },
    { src: '^/(.*)$', status: 404 },
  ] };
}
export function normalizeEntryHtml(html, project) {
  const document=parseHtml(html,{sourceCodeLocationInfo:true});
  const queue=[document], bases=[]; let head;
  while(queue.length){const node=queue.shift();if(node.tagName==='base')bases.push(node);if(node.tagName==='head')head=node;queue.push(...(node.childNodes??[]));}
  if(bases.length>1)fail('AMBIGUOUS_HTML_BASE');
  const base=bases[0], href=base?.attrs?.find(a=>a.name==='href')?.value;
  if(project.normalizeEntryBase===true){
    if(base && !['.','./',project.basePath].includes(href))fail('UNEXPECTED_HTML_BASE');
    if(base?.attrs?.some(a=>a.name!=='href'))fail('UNEXPECTED_HTML_BASE');
    const tag=`<base href="${project.basePath}">`;
    if(base){const loc=base.sourceCodeLocation;if(!loc)fail('UNEXPECTED_HTML_BASE');return html.slice(0,loc.startOffset)+tag+html.slice(loc.endOffset);}
    const offset=head?.sourceCodeLocation?.startTag?.endOffset;
    if(!Number.isInteger(offset))fail('EXPLICIT_HEAD_REQUIRED');
    return html.slice(0,offset)+'\n  '+tag+html.slice(offset);
  }
  if(href!==project.basePath)fail('EXPLICIT_BASE_PATH_REQUIRED');
  return html;
}
export function prepareProject({ sourceRoot, output, projectId, configPath = path.join(toolRoot,'config/independent-projects.json'), snapshotPath = path.join(toolRoot,'config/project-source-snapshot.json'), knownValues = knownValuesFromEnvironment(process.env) }) {
  sourceRoot = path.resolve(sourceRoot); output = path.resolve(output);
  const config = JSON.parse(fs.readFileSync(configPath,'utf8'));
  const project = validateProject(config, projectId);
  if (inside(sourceRoot, output) || inside(output, sourceRoot) || output === path.parse(output).root) fail('OUTPUT_MUST_BE_SEPARATE');
  if (fs.existsSync(output)) fail('OUTPUT_ALREADY_EXISTS');
  // Resolve the real parent before any write: a lexical outside path can point back into source.
  assertPlainPath(path.dirname(output));
  const actualParent=fs.realpathSync(path.dirname(output)), actualSource=fs.realpathSync(sourceRoot);
  if (inside(actualSource,path.join(actualParent,path.basename(output))) || inside(path.join(actualParent,path.basename(output)),actualSource)) fail('OUTPUT_MUST_BE_SEPARATE');
  const input = path.join(sourceRoot, project.input);
  assertPlainPath(input);
  const files = listFiles(input), fileSet = new Set(files.map(f=>f.path));
  if (!files.length) fail('EMPTY_PROJECT');
  for (const required of project.requiredFiles) if (!fileSet.has(required)) fail(`MISSING_REQUIRED_FILE: ${required}`);
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath,'utf8'));
  const expected = snapshot.projects?.[projectId];
  if (snapshot.version !== 1 || !/^[a-f0-9]{40}$/.test(snapshot.commit ?? '') || !Array.isArray(expected) || expected.length !== files.length) fail('SOURCE_SNAPSHOT_MISMATCH');
  const expectedByPath = new Map(expected.map(f=>[f.path,f]));
  if (expectedByPath.size !== expected.length) fail('SOURCE_SNAPSHOT_DUPLICATE');
  for(const file of files) {
    const ref=expectedByPath.get(file.path), bytes=fs.readFileSync(path.join(input,file.path));
    if(!ref || ref.size!==bytes.length || ref.gitBlob!==gitBlob(bytes)) fail(`SOURCE_SNAPSHOT_MISMATCH: ${file.path}`);
  }
  const htmlBytes=fs.readFileSync(path.join(input,'index.html'));
  if(gitBlob(htmlBytes)!==expectedByPath.get('index.html').gitBlob)fail('HTML_SOURCE_CHANGED');
  const html=htmlBytes.toString('utf8');
  if (project.indexing === 'noindex' && !/noindex/i.test(html)) fail('HTML_NOINDEX_MISSING');
  // Bare and slash entries are 200. A base element is required for relative runtime URLs.
  const entryHtml = normalizeEntryHtml(html, project);
  const sourceManifest = { files: files.map(f=>({path:`${project.input}/${f.path}`,size:f.size})), fileCount:files.length, totalSize:files.reduce((n,f)=>n+f.size,0) };
  const before = assertReleaseManifestSecrets(sourceRoot, sourceManifest, {knownValues});
  const configObject = outputConfig(project), configBytes = Buffer.from(JSON.stringify(configObject,null,2)+'\n');
  const configScan = scanReleaseFile('config.json',configBytes,knownValues);
  if (!configScan.complete || configScan.rules.length || configScan.errors.length) fail('CONFIG_SCAN_REFUSED');
  // Nothing is created until every input passes the unchanged repository scanner.
  fs.mkdirSync(output, {recursive:false});
  try {
    const staticRoot = path.join(output,'.vercel/output/static');
    const targetRoot = path.join(staticRoot, project.basePath.slice(1));
    const records=[];
    for (const file of files) {
      const sourceData=fs.readFileSync(path.join(input,file.path));
      if(sourceData.length!==file.size) fail('INPUT_CHANGED_DURING_COPY');
      // Pin the copied bytes, not merely a prior read, to the reviewed Git blob.
      if(gitBlob(sourceData)!==expectedByPath.get(file.path).gitBlob) fail('SOURCE_CHANGED_DURING_COPY');
      const data=file.path==='index.html'?Buffer.from(entryHtml):sourceData;
      const target=path.join(targetRoot,file.path); fs.mkdirSync(path.dirname(target),{recursive:true}); fs.writeFileSync(target,data,{flag:'wx'});
      records.push({path:project.basePath.slice(1)+file.path,bytes:data.length,sha256:sha256(data)});
    }
    // Verify source has not changed during copying, and scan EVERY emitted byte again.
    assertReleaseManifestSecrets(sourceRoot, sourceManifest, {knownValues,expectedIdentity:before.identity});
    const emitted = listFiles(staticRoot);
    const expectedOutput=new Map(records.map(r=>[r.path,r]));
    if(emitted.length!==records.length || emitted.some(f=>!expectedOutput.has(f.path)||expectedOutput.get(f.path).bytes!==f.size))fail('OUTPUT_MANIFEST_MISMATCH');
    const emittedManifest = {files:emitted,fileCount:emitted.length,totalSize:emitted.reduce((n,f)=>n+f.size,0)};
    assertReleaseManifestSecrets(staticRoot,emittedManifest,{knownValues});
    for (const record of records) if(sha256(fs.readFileSync(path.join(staticRoot,record.path)))!==record.sha256) fail('OUTPUT_CHANGED_DURING_SCAN');
    const buildRoot=path.join(output,'.vercel/output');
    const expectedBuildFiles=new Set(records.map(r=>'static/'+r.path));
    const buildFiles=listFiles(buildRoot);
    if(buildFiles.length!==records.length||buildFiles.some(f=>!expectedBuildFiles.has(f.path))||JSON.stringify(fs.readdirSync(path.join(output,'.vercel')).sort())!==JSON.stringify(['output'])||JSON.stringify(fs.readdirSync(output).sort())!==JSON.stringify(['.vercel']))fail('UNEXPECTED_BUILD_OUTPUT');
    fs.writeFileSync(path.join(output,'.vercel/output/config.json'),configBytes,{flag:'wx'});
    const receipt = {version:1,project:projectId,basePath:project.basePath,mode:'local-only-not-deployed',files:records,fileCount:records.length,totalBytes:records.reduce((n,f)=>n+f.bytes,0),entryBaseNormalized:entryHtml!==html,configSHA256:sha256(configBytes),security:'Unmodified deploy-secret-scan.mjs; every source and emitted file scanned. No inherited receipt reuse.',runtime:{functions:0,crons:0},sourceCommit:snapshot.commit,sourceRepository:snapshot.repository??null};
    // Receipt stays OUTSIDE .vercel/output so it is never part of the website.
    fs.writeFileSync(path.join(output,'verification.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
    return receipt;
  } catch(error) {
    // Keep failed output for diagnosis and prevent accidental use as a valid artifact.
    const cfg=path.join(output,'.vercel/output/config.json'); if(fs.existsSync(cfg))fs.unlinkSync(cfg);
    fs.writeFileSync(path.join(output,'PACKAGING-FAILED.txt'),'No deployable config was produced. Re-run with a fresh output directory.\n');
    throw error;
  }
}
function cli(argv) {
  const allowed = new Set(['--project','--source-root','--output','--config','--snapshot']), args={};
  for(let i=0;i<argv.length;i+=2) { if(!allowed.has(argv[i]) || !argv[i+1] || argv[i+1].startsWith('--') || Object.hasOwn(args,argv[i])) fail('INVALID_ARGUMENT'); args[argv[i]]=argv[i+1]; }
  if(!args['--project']||!args['--source-root']||!args['--output'])fail('Usage: --project ID --source-root PATH --output FRESH_PATH [--config FILE]');
  const result=prepareProject({projectId:args['--project'],sourceRoot:args['--source-root'],output:args['--output'],...(args['--config']?{configPath:args['--config']}:{}),...(args['--snapshot']?{snapshotPath:args['--snapshot']}:{})});
  console.log(JSON.stringify({project:result.project,files:result.fileCount,bytes:result.totalBytes,basePath:result.basePath,status:'prepared-locally-not-deployed'}));
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {cli(process.argv.slice(2));} catch(error) {console.error(error.code??error.message);process.exitCode=1;}
}
