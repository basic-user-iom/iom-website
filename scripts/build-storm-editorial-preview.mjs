/** Local editorial verification only; production must use the guarded release flow. */
import { resolve } from 'node:path'
import { build, loadConfigFromFile } from 'vite'
const root=process.cwd()
const loaded=await loadConfigFromFile({command:'build',mode:'production'},resolve(root,'vite.config.ts'))
if(!loaded)throw new Error('Vite configuration not found')
const config=loaded.config
config.configFile=false
config.cacheDir=resolve(root,'.qa-out/vite-cache')
config.build.rollupOptions.input={main:resolve(root,'index.html')}
await build(config)
