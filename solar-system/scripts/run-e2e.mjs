import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const appDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const port = Number.parseInt(process.env.SOLAR_SYSTEM_E2E_PORT ?? '5196', 10)

if (!Number.isInteger(port) || port < 1 || port > 65_535) {
  throw new Error('SOLAR_SYSTEM_E2E_PORT must be a valid TCP port.')
}

const baseUrl = `http://127.0.0.1:${port}/demos/solar-system/`
const viteCli = resolve(appDirectory, 'node_modules/vite/bin/vite.js')
const playwrightCli = resolve(appDirectory, 'node_modules/@playwright/test/cli.js')
const playwrightArgs = process.argv.slice(2)
let ownedServer = null
let ownedServerExit = null

function spawnNode(args, options = {}) {
  return spawn(process.execPath, args, {
    cwd: appDirectory,
    env: process.env,
    stdio: 'inherit',
    windowsHide: true,
    ...options,
  })
}

function waitForChild(child) {
  return new Promise((resolvePromise, reject) => {
    child.once('error', reject)
    child.once('exit', (code, signal) => resolvePromise({ code, signal }))
  })
}

async function endpointIsReady() {
  try {
    const response = await fetch(baseUrl, { signal: AbortSignal.timeout(1_000) })
    return response.ok
  } catch {
    return false
  }
}

async function waitForServer() {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    if (ownedServer?.exitCode !== null) {
      throw new Error(`Vite exited before the smoke server was ready (code ${ownedServer?.exitCode}).`)
    }
    if (await endpointIsReady()) return
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100))
  }
  throw new Error(`Timed out waiting for ${baseUrl}`)
}

async function stopOwnedServer() {
  if (ownedServer === null || ownedServer.exitCode !== null) return
  ownedServer.kill('SIGTERM')

  await Promise.race([
    ownedServerExit,
    new Promise((resolvePromise) => setTimeout(resolvePromise, 2_000)),
  ])

  if (ownedServer.exitCode === null) {
    ownedServer.kill('SIGKILL')
    await ownedServerExit
  }
}

async function main() {
  if (!(await endpointIsReady())) {
    ownedServer = spawnNode([
      viteCli,
      '--host',
      '127.0.0.1',
      '--port',
      String(port),
      '--strictPort',
    ])
    ownedServerExit = waitForChild(ownedServer)
    await waitForServer()
  }

  const testProcess = spawnNode([playwrightCli, 'test', ...playwrightArgs], {
    env: { ...process.env, SOLAR_SYSTEM_E2E_PORT: String(port) },
  })
  const result = await waitForChild(testProcess)
  if (result.signal !== null) {
    throw new Error(`Playwright was terminated by ${result.signal}.`)
  }
  process.exitCode = result.code ?? 1
}

for (const [signal, exitCode] of [
  ['SIGINT', 130],
  ['SIGTERM', 143],
]) {
  process.once(signal, () => {
    ownedServer?.kill('SIGTERM')
    process.exit(exitCode)
  })
}

try {
  await main()
} finally {
  await stopOwnedServer()
}
