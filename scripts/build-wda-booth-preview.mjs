import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
execFileSync(process.execPath,[fileURLToPath(new URL('../wda-booth-preview/tools/build.mjs',import.meta.url)),'../public/demos/wda-booth-preview'],{stdio:'inherit'});
