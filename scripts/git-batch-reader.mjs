// One long-lived git cat-file --batch process. The caller stays synchronous.
import { spawn } from 'node:child_process'
import { Worker, workerData } from 'node:worker_threads'

const MAX_FILE = 128 * 1024 * 1024
const STATE = 0
const PID = 1
const EXPECTED = 2
const LENGTH = 3
const ERROR_LEN = 4
const ERROR_AT = 32
const ERROR_MAX = 240
const OID_AT = 320
const PAYLOAD = 384

if (workerData?.batchReader) {
  const view = new Int32Array(workerData.sab)
  const bytes = new Uint8Array(workerData.sab)
  const child = spawn(workerData.command, workerData.args, {
    stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true,
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' },
  })
  const chunks = []
  let buffered = 0
  const push = (chunk) => { chunks.push(chunk); buffered += chunk.length }
  const take = (count) => {
    const out = Buffer.allocUnsafe(count)
    let offset = 0
    while (offset < count) {
      const chunk = chunks[0]
      const need = count - offset
      if (chunk.length <= need) { chunk.copy(out, offset); offset += chunk.length; chunks.shift() }
      else { chunk.copy(out, offset, 0, need); chunks[0] = chunk.subarray(need); offset += need }
    }
    buffered -= count
    return out
  }
  const findNewline = () => {
    let seen = 0
    for (const chunk of chunks) {
      const at = chunk.indexOf(10)
      if (at >= 0) return seen + at
      seen += chunk.length
    }
    return -1
  }
  const fill = async (count) => {
    while (buffered < count) {
      const chunk = child.stdout.read()
      if (chunk) { push(chunk); continue }
      if (child.exitCode !== null) throw new Error('Git reader exited before the object was complete')
      await new Promise((resolve) => {
        const done = () => { child.stdout.off('readable', done); child.off('exit', done); resolve() }
        child.stdout.once('readable', done)
        child.once('exit', done)
      })
    }
  }
  const fail = (message) => {
    const encoded = Buffer.from(String(message).slice(0, ERROR_MAX))
    bytes.set(encoded, ERROR_AT)
    Atomics.store(view, ERROR_LEN, encoded.length)
    Atomics.store(view, STATE, 3)
    Atomics.notify(view, STATE)
    try { child.kill() } catch { /* already gone */ }
  }
  child.stdin.on('error', () => {})
  child.once('error', (error) => {
    Atomics.store(view, PID, -1)
    fail(error.message)
  })
  Atomics.store(view, PID, child.pid || 0)
  Atomics.store(view, STATE, 0)
  Atomics.notify(view, STATE)
  try {
    for (;;) {
      let state = Atomics.load(view, STATE)
      while (state !== 1 && state !== 4) {
        Atomics.wait(view, STATE, state)
        state = Atomics.load(view, STATE)
      }
      if (state === 4) break
      const oid = Buffer.from(bytes.subarray(OID_AT, OID_AT + 40)).toString('ascii')
      const expected = Atomics.load(view, EXPECTED)
      child.stdin.write(`${oid}\n`)
      let newline = findNewline()
      while (newline < 0) {
        if (buffered > 128) throw new Error('Invalid Git batch framing')
        await fill(buffered + 1)
        newline = findNewline()
      }
      const header = take(newline).toString('ascii')
      take(1)
      if (header === `${oid} missing`) throw new Error('Git batch object identity mismatch')
      const match = /^([a-f0-9]{40}) blob (\d+)$/.exec(header)
      const size = match ? Number(match[2]) : NaN
      if (!match || match[1] !== oid || size !== expected || size > MAX_FILE) throw new Error('Git batch object identity mismatch')
      await fill(size + 1)
      const payload = take(size)
      if (take(1)[0] !== 10) throw new Error('Invalid Git batch payload length')
      bytes.set(payload, PAYLOAD)
      Atomics.store(view, LENGTH, payload.length)
      Atomics.store(view, STATE, 2)
      Atomics.notify(view, STATE)
    }
  } catch (error) {
    if (Atomics.load(view, STATE) !== 4) fail(error.message)
  } finally {
    try { child.kill() } catch { /* already gone */ }
  }
}

export function createGitBatchReader(root, options = {}) {
  const sab = new SharedArrayBuffer(PAYLOAD + MAX_FILE)
  const view = new Int32Array(sab)
  const bytes = new Uint8Array(sab)
  const worker = new Worker(new URL(import.meta.url), {
    workerData: {
      batchReader: true,
      sab,
      command: options.command ?? 'git',
      args: options.args ?? ['--no-optional-locks', '--no-lazy-fetch', '--no-replace-objects', '-C', root, 'cat-file', '--batch'],
    },
  })
  worker.once('error', () => {
    if (Atomics.load(view, PID) === 0) {
      Atomics.store(view, PID, -1)
      Atomics.notify(view, STATE)
    }
  })
  const started = Date.now()
  while (Atomics.load(view, PID) === 0 && Date.now() - started < 10000) Atomics.wait(view, STATE, Atomics.load(view, STATE), 500)
  if (Atomics.load(view, PID) <= 0) {
    worker.terminate()
    const length = Atomics.load(view, ERROR_LEN)
    const message = length ? Buffer.from(bytes.subarray(ERROR_AT, ERROR_AT + length)).toString('utf8') : 'Git reader did not start'
    throw new Error(message)
  }
  let dead = false
  const stop = () => {
    if (dead) return
    dead = true
    Atomics.store(view, STATE, 4)
    Atomics.notify(view, STATE)
    try { process.kill(Atomics.load(view, PID)) } catch { /* already gone */ }
    worker.terminate()
  }
  return {
    pid: Atomics.load(view, PID),
    read(file, deadline) {
      if (dead || Atomics.load(view, STATE) !== 0) throw new Error('Git reader is not usable')
      if (!/^[a-f0-9]{40}$/.test(file.oid)) throw new Error('Invalid committed media source')
      bytes.set(Buffer.from(file.oid), OID_AT)
      Atomics.store(view, EXPECTED, file.bytes)
      Atomics.store(view, STATE, 1)
      Atomics.notify(view, STATE)
      const remaining = Math.max(1, deadline - Date.now())
      const waited = Atomics.wait(view, STATE, 1, remaining)
      if (waited === 'timed-out' && Atomics.load(view, STATE) === 1) {
        stop()
        throw new Error('Fresh media scan time budget exceeded')
      }
      const state = Atomics.load(view, STATE)
      if (state === 3) {
        const length = Atomics.load(view, ERROR_LEN)
        const message = Buffer.from(bytes.subarray(ERROR_AT, ERROR_AT + length)).toString('utf8')
        stop()
        throw new Error(message || 'Git batch object identity mismatch')
      }
      const length = Atomics.load(view, LENGTH)
      const copy = Buffer.from(bytes.subarray(PAYLOAD, PAYLOAD + length))
      Atomics.store(view, STATE, 0)
      Atomics.notify(view, STATE)
      return copy
    },
    destroy: stop,
  }
}
