/** Local re-verification only. Does not authenticate or deploy. */
import fs from 'node:fs';import path from 'node:path';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';
import {assertReleaseManifestSecrets,knownValuesFromEnvironment,safeRelative} from './deploy-secret-scan.mjs';
import {listFiles,assertPlainPath} from './prepare-independent-project.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
export function verifyArtifact(output,{knownValues=knownValuesFromEnvironment(process.env)}={}){
 output=path.resolve(output);assertPlainPath(output);
 const receipt=JSON.parse(fs.readFileSync(path.join(output,'verification.json'),'utf8'));
 if(receipt.version!==1||receipt.mode!=='local-only-not-deployed'||!/^\/(?:demos|demo)\/[a-z0-9-]+\/$/.test(receipt.basePath)||!Array.isArray(receipt.files))throw Error('INVALID_RECEIPT');
 const bo=path.join(output,'.vercel/output'),staticRoot=path.join(bo,'static');
 if(JSON.stringify(fs.readdirSync(path.join(output,'.vercel')).sort())!==JSON.stringify(['output']))throw Error('UNEXPECTED_VERCEL_METADATA');
 const top=fs.readdirSync(bo).sort();if(JSON.stringify(top)!==JSON.stringify(['config.json','static']))throw Error('UNEXPECTED_BUILD_OUTPUT');
 const config=fs.readFileSync(path.join(bo,'config.json'));if(digest(config)!==receipt.configSHA256)throw Error('CONFIG_CHANGED');
 const parsed=JSON.parse(config);if(parsed.version!==3||parsed.crons||parsed.functions||parsed.builds)throw Error('RUNTIME_SERVICES_REFUSED');
 const actual=listFiles(staticRoot),expected=new Map(receipt.files.map(f=>[f.path,f]));
 if(expected.size!==receipt.files.length||actual.length!==expected.size||actual.length!==receipt.fileCount)throw Error('ARTIFACT_MANIFEST_CHANGED');
 for(const f of actual){const ref=expected.get(f.path);if(!safeRelative(f.path)||!f.path.startsWith(receipt.basePath.slice(1))||!ref||f.size!==ref.bytes||digest(fs.readFileSync(path.join(staticRoot,f.path)))!==ref.sha256)throw Error('ARTIFACT_BYTES_CHANGED');}
 const manifest={files:actual,fileCount:actual.length,totalSize:actual.reduce((n,f)=>n+f.size,0)};
 if(manifest.totalSize!==receipt.totalBytes)throw Error('ARTIFACT_SIZE_CHANGED');
 assertReleaseManifestSecrets(staticRoot,manifest,{knownValues});
 return{project:receipt.project,basePath:receipt.basePath,files:actual.length,bytes:manifest.totalSize,status:'verified-locally-not-deployed',sourceCommit:receipt.sourceCommit};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){try{if(process.argv.length!==3)throw Error('Usage: node verify-independent-artifact.mjs RELEASE_DIRECTORY');console.log(JSON.stringify(verifyArtifact(process.argv[2])));}catch(error){console.error(error.code??error.message);process.exitCode=1;}}
