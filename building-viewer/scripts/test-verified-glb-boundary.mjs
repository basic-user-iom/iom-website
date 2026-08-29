import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { Group } from 'three'

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url))
const VIEWER_ROOT = resolve(SCRIPT_DIR, '..')
const SITE_ROOT = resolve(VIEWER_ROOT, '..')
const JSON_CHUNK = 0x4e4f534a
const BIN_CHUNK = 0x004e4942

function paddedJsonBytes(value) {
  const source = typeof value === 'string' ? value : JSON.stringify(value)
  const encoded = new TextEncoder().encode(source)
  const padded = new Uint8Array(Math.ceil(encoded.byteLength / 4) * 4)
  padded.fill(0x20)
  padded.set(encoded)
  return padded
}

function makeContainer(chunks, { magic = 0x46546c67, version = 2 } = {}) {
  const total = 12 + chunks.reduce((sum, chunk) => sum + 8 + chunk.data.byteLength, 0)
  const buffer = new ArrayBuffer(total)
  const view = new DataView(buffer)
  const out = new Uint8Array(buffer)
  view.setUint32(0, magic, true)
  view.setUint32(4, version, true)
  view.setUint32(8, total, true)
  let offset = 12
  for (const chunk of chunks) {
    view.setUint32(offset, chunk.data.byteLength, true)
    view.setUint32(offset + 4, chunk.type, true)
    out.set(chunk.data, offset + 8)
    offset += 8 + chunk.data.byteLength
  }
  return buffer
}

function makeGlb(json = { asset: { version: '2.0' }, scenes: [{ nodes: [] }], scene: 0 }, bin) {
  const chunks = [{ type: JSON_CHUNK, data: paddedJsonBytes(json) }]
  if (bin) chunks.push({ type: BIN_CHUNK, data: bin })
  return makeContainer(chunks)
}

function copyBuffer(buffer) {
  return buffer.slice(0)
}

function pin(buffer) {
  return {
    sha256: createHash('sha256').update(new Uint8Array(buffer)).digest('hex'),
    bytes: buffer.byteLength,
  }
}

async function expectReject(promise, pattern) {
  await assert.rejects(promise, pattern)
}

const vite = await createServer({
  root: VIEWER_ROOT,
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'silent',
})

const originalFetch = globalThis.fetch
const locationDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'location')
const originalRaf = globalThis.requestAnimationFrame
const originalWindow = globalThis.window

try {
  const {
    MAX_VERIFIED_GLB_BYTES,
    ModelLoader,
    validateSelfContainedGlbV2,
  } = await vite.ssrLoadModule('/src/scene/ModelLoader.ts')

  const valid = makeGlb()
  const validWithBin = makeGlb(
    {
      asset: { version: '2.0' },
      buffers: [{ byteLength: 4 }],
      images: [{ uri: 'data:image/png;base64,iVBORw0KGgo=' }],
    },
    new Uint8Array([1, 2, 3, 4]),
  )
  assert.deepEqual(validateSelfContainedGlbV2(valid, 'valid.glb'), {
    jsonChunkBytes: new DataView(valid).getUint32(12, true),
    binaryChunkBytes: null,
    chunkCount: 1,
  })
  assert.equal(validateSelfContainedGlbV2(validWithBin).binaryChunkBytes, 4)

  const tooShort = new ArrayBuffer(19)
  assert.throws(() => validateSelfContainedGlbV2(tooShort), /too short/)

  const badMagic = copyBuffer(valid)
  new DataView(badMagic).setUint32(0, 0, true)
  assert.throws(() => validateSelfContainedGlbV2(badMagic), /invalid magic/)

  const badVersion = copyBuffer(valid)
  new DataView(badVersion).setUint32(4, 1, true)
  assert.throws(() => validateSelfContainedGlbV2(badVersion), /version must be 2/)

  const badDeclaredLength = copyBuffer(valid)
  new DataView(badDeclaredLength).setUint32(8, valid.byteLength - 4, true)
  assert.throws(() => validateSelfContainedGlbV2(badDeclaredLength), /declared length/)

  const unalignedChunk = makeContainer([
    { type: JSON_CHUNK, data: new TextEncoder().encode('{} ') },
  ])
  assert.throws(() => validateSelfContainedGlbV2(unalignedChunk), /not 4-byte aligned/)

  const chunkOverrun = copyBuffer(valid)
  new DataView(chunkOverrun).setUint32(12, valid.byteLength, true)
  assert.throws(() => validateSelfContainedGlbV2(chunkOverrun), /exceeds declared/)

  const trailingHeader = new Uint8Array(valid.byteLength + 4)
  trailingHeader.set(new Uint8Array(valid))
  new DataView(trailingHeader.buffer).setUint32(8, trailingHeader.byteLength, true)
  assert.throws(() => validateSelfContainedGlbV2(trailingHeader.buffer), /truncated chunk header/)

  const binFirst = makeContainer([
    { type: BIN_CHUNK, data: new Uint8Array(4) },
    { type: JSON_CHUNK, data: paddedJsonBytes({ asset: { version: '2.0' } }) },
  ])
  assert.throws(() => validateSelfContainedGlbV2(binFirst), /BIN chunk precedes JSON/)

  const duplicateJson = makeContainer([
    { type: JSON_CHUNK, data: paddedJsonBytes({ asset: { version: '2.0' } }) },
    { type: JSON_CHUNK, data: paddedJsonBytes({ asset: { version: '2.0' } }) },
  ])
  assert.throws(() => validateSelfContainedGlbV2(duplicateJson), /JSON must be the first|duplicate JSON/)

  const duplicateBin = makeContainer([
    { type: JSON_CHUNK, data: paddedJsonBytes({ asset: { version: '2.0' } }) },
    { type: BIN_CHUNK, data: new Uint8Array(4) },
    { type: BIN_CHUNK, data: new Uint8Array(4) },
  ])
  assert.throws(() => validateSelfContainedGlbV2(duplicateBin), /duplicate BIN/)

  const unknownChunk = makeContainer([
    { type: JSON_CHUNK, data: paddedJsonBytes({ asset: { version: '2.0' } }) },
    { type: 0x12345678, data: new Uint8Array(4) },
  ])
  assert.throws(() => validateSelfContainedGlbV2(unknownChunk), /unknown chunk type/)

  const invalidUtf8 = makeContainer([
    { type: JSON_CHUNK, data: new Uint8Array([0xc3, 0x28, 0x20, 0x20]) },
  ])
  assert.throws(() => validateSelfContainedGlbV2(invalidUtf8), /not valid UTF-8/)
  assert.throws(() => validateSelfContainedGlbV2(makeGlb('{bad')), /cannot be parsed/)
  assert.throws(() => validateSelfContainedGlbV2(makeGlb('[]')), /root must be an object/)
  assert.throws(
    () => validateSelfContainedGlbV2(makeGlb({ asset: { version: '1.0' } })),
    /asset\.version must be "2\.0"/,
  )

  for (const uri of [
    'texture.png',
    '../texture.png',
    '/texture.png',
    'https://example.test/texture.png',
    '//example.test/texture.png',
    'blob:https://example.test/id',
  ]) {
    const external = makeGlb({
      asset: { version: '2.0' },
      extensions: { TEST_nested: { resources: [{ uri }] } },
    })
    assert.throws(() => validateSelfContainedGlbV2(external), /External URI is not allowed/)
  }
  assert.throws(
    () => validateSelfContainedGlbV2(makeGlb({ asset: { version: '2.0' }, images: [{ uri: 4 }] })),
    /External URI is not allowed/,
  )

  const compatibilityAssets = [
    'icm-ext/model-web.glb',
    'icm-ext/model-quest.glb',
    'icm-ext/collision.glb',
    'icm-anim-2025/model-web.glb',
    'icm-anim-2025/model-quest.glb',
    'icm-anim-2025/collision.glb',
    'icm-anim-2025/animations.glb',
  ]
  for (const relative of compatibilityAssets) {
    const bytes = await readFile(join(SITE_ROOT, 'public', 'models', relative))
    const exact = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
    validateSelfContainedGlbV2(exact, relative)
  }

  Object.defineProperty(globalThis, 'location', {
    value: { search: '' },
    configurable: true,
  })
  globalThis.requestAnimationFrame = (callback) => {
    callback(performance.now())
    return 1
  }
  globalThis.window = {
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
  }

  const loader = new ModelLoader(() => null)
  let parseCalls = 0
  loader.gltf.parseAsync = async () => {
    parseCalls += 1
    return { scene: new Group(), animations: [] }
  }

  function streamResponse(chunks, headers = {}, { stayOpen = false } = {}) {
    let index = 0
    let cancelled = false
    const body = new ReadableStream({
      pull(controller) {
        if (index < chunks.length) controller.enqueue(chunks[index++])
        else if (!stayOpen) controller.close()
      },
      cancel() {
        cancelled = true
      },
    })
    return {
      response: new Response(body, { status: 200, headers }),
      wasCancelled: () => cancelled,
    }
  }

  let fetchCalls = 0
  globalThis.fetch = async () => {
    fetchCalls += 1
    throw new Error('fetch should not run')
  }
  await expectReject(
    loader.loadUrlVerified('/too-large.glb', {
      sha256: '0'.repeat(64),
      bytes: MAX_VERIFIED_GLB_BYTES + 1,
    }),
    /exceeds .* byte limit/,
  )
  await expectReject(
    loader.loadUrlVerified('/too-small.glb', { sha256: '0'.repeat(64), bytes: 19 }),
    /byte pin is too small/,
  )
  assert.equal(fetchCalls, 0, 'invalid verified GLB pins must fail before network I/O')

  const validBytes = new Uint8Array(valid)
  const lengthMismatch = streamResponse([validBytes], {
    'content-length': String(valid.byteLength + 4),
  })
  globalThis.fetch = async () => lengthMismatch.response
  await expectReject(
    loader.loadUrlVerified('/header-mismatch.glb', pin(valid)),
    /Content-Length mismatch/,
  )
  assert.equal(lengthMismatch.wasCancelled(), true, 'mismatched response body must be cancelled')

  const overflow = streamResponse([validBytes, new Uint8Array(4)], {}, { stayOpen: true })
  globalThis.fetch = async () => overflow.response
  await expectReject(loader.loadUrlVerified('/overflow.glb', pin(valid)), /exceeded byte pin/)
  assert.equal(overflow.wasCancelled(), true, 'over-limit stream must be cancelled immediately')

  const short = streamResponse([validBytes.subarray(0, validBytes.byteLength - 4)])
  globalThis.fetch = async () => short.response
  await expectReject(loader.loadUrlVerified('/short.glb', pin(valid)), /byte-length mismatch/)

  const malformed = copyBuffer(valid)
  new DataView(malformed).setUint32(0, 0, true)
  globalThis.fetch = async () =>
    new Response(malformed, {
      status: 200,
      headers: { 'content-length': String(malformed.byteLength) },
    })
  await expectReject(loader.loadUrlVerified('/malformed.glb', pin(malformed)), /invalid magic/)
  assert.equal(parseCalls, 0, 'malformed GLB must not reach GLTFLoader')

  globalThis.fetch = async () =>
    new Response(valid, {
      status: 200,
      headers: { 'content-length': String(valid.byteLength) },
    })
  const loaded = await loader.loadUrlVerified('/valid.glb', pin(valid))
  assert.equal(parseCalls, 1)
  assert.equal(loaded.transferredBytes, valid.byteLength)
  loaded.root.clear()
  loader.dispose()

  console.log(
    `Verified GLB boundary tests passed: strict container/URI cases, ${compatibilityAssets.length} production assets, bounded streaming, and parse gating.`,
  )
} finally {
  globalThis.fetch = originalFetch
  if (locationDescriptor) Object.defineProperty(globalThis, 'location', locationDescriptor)
  else delete globalThis.location
  globalThis.requestAnimationFrame = originalRaf
  globalThis.window = originalWindow
  await vite.close()
}
