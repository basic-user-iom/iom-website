import assert from 'node:assert/strict'
import { test } from 'node:test'
import { deflateSync, gzipSync } from 'node:zlib'
import childProcess from 'node:child_process'
import { syncBuiltinESMExports } from 'node:module'
import JSZip from 'jszip'
import { scanReleaseFile } from './deploy-secret-scan.mjs'

// Synthetic bytes only. No private config, existing assets, build, network or
// release commands. PDFs are in-memory parser fixtures, not authored artifacts.
const fake = 'synthetic-container-value-123456789'
const fingerprint = '0123456789abcdef'.repeat(4)
const pem = '-----BEGIN PRIVATE KEY-----'
const scan = (name, bytes, known = []) => {
  const result = scanReleaseFile(name, Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes), known)
  assert.ok(!JSON.stringify(result).includes(fake), 'reports must be redacted')
  return result
}
const pass = (name, bytes, known) => assert.deepEqual(scan(name, bytes, known), { complete: true, rules: [], errors: [] })
const deny = (name, bytes, rule, known) => {
  const r = scan(name, bytes, known)
  assert.equal(r.complete, true, JSON.stringify(r))
  assert.ok(r.rules.includes(rule), JSON.stringify(r))
}
const incomplete = (name, bytes) => assert.equal(scan(name, bytes).complete, false)
async function zip(files, options = {}) {
  const z = new JSZip()
  for (const [name, bytes] of files) z.file(name, bytes, { createFolders: false })
  return z.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', ...options })
}
const central = b => b.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]))

function pdf(text = 'Public manual', { extraCatalog = '', extras = [], info = '' } = {}) {
  const stream = deflateSync(Buffer.from(`BT /F1 12 Tf 20 100 Td (${text.replace(/[\\()]/g, '\\$&')}) Tj ET`))
  const objects = [
    `<< /Type /Catalog /Pages 2 0 R ${extraCatalog} >>`,
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 200] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    Buffer.concat([Buffer.from(`<< /Length ${stream.length} /Filter /FlateDecode >>\nstream\n`), stream, Buffer.from('\nendstream')]),
    ...extras,
  ]
  const chunks = [Buffer.from('%PDF-1.7\n')], offsets = [0]; let offset = chunks[0].length
  for (let i = 0; i < objects.length; i++) {
    offsets.push(offset)
    const b = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`), Buffer.from(objects[i]), Buffer.from('\nendobj\n')])
    chunks.push(b); offset += b.length
  }
  chunks.push(Buffer.from(`xref\n0 ${offsets.length}\n0000000000 65535 f \n` + offsets.slice(1).map(n => `${String(n).padStart(10, '0')} 00000 n \n`).join('') +
    `trailer\n<< /Size ${offsets.length} /Root 1 0 R ${info} >>\nstartxref\n${offset}\n%%EOF\n`))
  return Buffer.concat(chunks)
}
function attachedPdf(name, value) {
  const bytes = deflateSync(Buffer.from(value))
  return pdf('Attachment test', { extraCatalog: '/Names << /EmbeddedFiles << /Names [(entry) 6 0 R] >> >>', extras: [
    `<< /Type /Filespec /F (${name}) /EF << /F 7 0 R >> >>`,
    Buffer.concat([Buffer.from(`<< /Type /EmbeddedFile /Length ${bytes.length} /Filter /FlateDecode >>\nstream\n`), bytes, Buffer.from('\nendstream')]),
  ] })
}

test('XML sitemap and entity-decoded hash pass; sensitive elements/attributes fail', () => {
  pass('sitemap.xml', '<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://example.invalid/a?x=1&amp;y=2</loc></url></urlset>')
  pass('data.xml', `<data><sha256>${fingerprint}</sha256></data>`)
  deny('data.xml', `<data password="${fake}"/>`, 'credential_xml_value')
  deny('data.xml', `<data><token><![CDATA[${fake}]]></token></data>`, 'credential_xml_value')
  deny('data.xml', `<data>${fake.replace('s', '&#115;')}</data>`, 'configured_secret_value', [fake])
  deny('data.xml', `<data>synthetic-container-<part/>value-123456789</data>`, 'configured_secret_value', [fake])
})
test('XML external entities, malformed documents, active content and depth fail closed', () => {
  for (const value of ['<!DOCTYPE x SYSTEM "https://example.invalid/private"><x/>', '<x>', '<script/>', '<x onclick="doThings()"/>', '<?work load="external"?><x/>', '<x>'.repeat(130) + '</x>'.repeat(130)]) incomplete('data.xml', value)
})
test('ZIP stored/deflated members and descriptors are parsed without extraction', async () => {
  const files = [['release-manifest.json', JSON.stringify({ sha256: fingerprint })], ['app.js', 'const field = "password" === item.type;']]
  for (const opts of [{ compression: 'STORE' }, {}, { streamFiles: true }]) pass('data.zip', await zip(files, opts))
  pass('empty.zip', await zip([]))
})

test('Windows ZIP paths normalize only separators, retaining traversal and alias checks', async () => {
  pass('x.zip', await zip([['demo\\index.html', '<p>public</p>'], ['demo\\main.js', 'const enabled=true;']]))
  incomplete('x.zip', await zip([['..\\outside.txt', 'public']]))
  incomplete('x.zip', await zip([['demo/a.txt', 'public'], ['demo\\a.txt', 'public']]))
  deny('x.zip', await zip([['demo\\.env', '']]), 'credential_file')
})

test('HTML base64 download ZIP is fully inspected, never executed or ignored', async () => {
  const html = bytes => '<script type="application/octet-stream">' + bytes.toString('base64') + '</script>'
  pass('download.html', html(await zip([['readme.txt', 'public download']])) )
  deny('download.html', html(await zip([['app.js', `const password="${fake}";`]])), 'credential_literal_assignment')
  deny('download.html', html(await zip([['readme.txt', fake]])), 'configured_secret_value', [fake])
  incomplete('download.html', '<script type="application/octet-stream">YWJj=def</script>')
  incomplete('download.html', html(Buffer.from('not an archive')))
  incomplete('x.zip', await zip([['download.html', html(await zip([['readme.txt', 'public']]))]]))
})

test('larger model members retain text limits, full-tail checks and expansion caps', async () => {
  const bytes = Buffer.alloc(9 * 1024 * 1024)
  pass('scene.iomcar', await zip([['model.glb', bytes]]))
  Buffer.from(fake).copy(bytes, bytes.length - fake.length)
  deny('scene.iomcar', await zip([['model.glb', bytes]]), 'configured_secret_value', [fake])
  incomplete('scene.iomcar', await zip([['large.txt', bytes]]))
  const oversized = await zip([['model.glb', 'x']])
  oversized.writeUInt32LE(64 * 1024 * 1024 + 1, central(oversized) + 24)
  incomplete('scene.iomcar', oversized)
  const overTotal = await zip([['one.glb', 'a'], ['two.glb', 'b'], ['three.glb', 'c']])
  let offset = central(overTotal)
  for (let i = 0; i < 3; i++) {
    overTotal.writeUInt32LE(50 * 1024 * 1024, offset + 24)
    offset += 46 + overTotal.readUInt16LE(offset + 28) + overTotal.readUInt16LE(offset + 30) + overTotal.readUInt16LE(offset + 32)
  }
  incomplete('scene.iomcar', overTotal)
})
test('ZIP compressed credentials, PEM, JWT and known values remain denied', async () => {
  for (const [name, value, rule, known] of [
    ['app.js', `const password="${fake}";`, 'credential_literal_assignment', []],
    ['manual.txt', pem, 'private_key_pem', []],
    ['data.txt', 'eyJhbGciOiJub25lIn0.eyJ4IjoxfQ.synthetic', 'jwt_shape', []],
    ['public.txt', fake, 'configured_secret_value', [fake]],
    ['.env.example', '', 'credential_file', []],
  ]) deny('data.zip', await zip([[name, value]]), rule, known)
})
test('ZIP traversal, duplicate aliases, symlinks, encryption and corruption are refused', async () => {
  incomplete('x.zip', await zip([['../outside.txt', 'public']]))
  incomplete('x.zip', await zip([['a.txt', 'public'], ['A.txt', 'public']]))
  const good = await zip([['a.txt', 'public']])
  for (const mutate of [
    b => { b.writeUInt16LE(1, 6); b.writeUInt16LE(1, central(b) + 8) },
    b => { b.writeUInt32LE(0xa1ff0000, central(b) + 38) },
    b => { b.writeUInt32LE(8 * 1024 * 1024 + 1, central(b) + 24) },
    b => { b[35] ^= 0xff },
    b => { b.writeUInt32LE(123, 14); b.writeUInt32LE(123, central(b) + 16) },
  ]) { const b = Buffer.from(good); mutate(b); incomplete('x.zip', b) }
  incomplete('x.zip', good.subarray(0, good.length - 1))
  incomplete('x.zip', Buffer.concat([Buffer.from('hidden'), good]))
})
test('ZIP recursion, expansion and unsupported-member limits fail closed', async () => {
  let nested = await zip([['public.txt', 'safe']])
  for (let i = 0; i < 4; i++) nested = await zip([['nested.zip', nested]])
  incomplete('x.zip', nested)
  const bomb = await zip([['data.txt', Buffer.alloc(8 * 1024 * 1024 + 1, 65)]])
  // Lie about decoded size too: decompressor's own limit must still refuse.
  bomb.writeUInt32LE(1, 22); bomb.writeUInt32LE(1, central(bomb) + 24)
  incomplete('x.zip', bomb)
  incomplete('x.zip', await zip([['data.unknown', 'safe']]))
})
test('PDF compressed public text/hash pass and compressed secret fixtures fail', () => {
  pass('manual.pdf', pdf())
  pass('hash.pdf', pdf(fingerprint))
  const bytes = pdf(fake)
  assert.equal(bytes.includes(Buffer.from(fake)), false, 'fixture must actually be compressed')
  deny('known.pdf', bytes, 'configured_secret_value', [fake])
  deny('pem.pdf', pdf(pem), 'private_key_pem')
  deny('assignment.pdf', pdf(`password = ${fake}`), 'credential_text_assignment')
  incomplete('broken.pdf', Buffer.from('%PDF-broken'))
})
test('PDF metadata/forms checked and JavaScript actions refused, never executed', () => {
  deny('metadata.pdf', pdf('public', { extras: [`<< /Title (${fake}) >>`], info: '/Info 6 0 R' }), 'configured_secret_value', [fake])
  deny('form.pdf', pdf('public', { extraCatalog: '/AcroForm << /Fields [6 0 R] >>', extras: [`<< /FT /Tx /T (password) /V (${fake}) /Subtype /Widget /Rect [0 0 10 10] >>`] }), 'credential_pdf_field')
  incomplete('action.pdf', pdf('public', { extraCatalog: '/OpenAction 6 0 R', extras: ['<< /S /JavaScript /JS (throw new Error("never execute")) >>'] }))
})
test('PDF.js iterable XMP metadata is inspected without the removed getAll API', () => {
  const withXmp = title => {
    const xml = Buffer.from(`<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title><rdf:Alt><rdf:li xml:lang="x-default">${title}</rdf:li></rdf:Alt></dc:title></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`)
    const stream = deflateSync(xml)
    return pdf('Public text', { extraCatalog: '/Metadata 6 0 R', extras: [
      Buffer.concat([Buffer.from(`<< /Type /Metadata /Subtype /XML /Filter /FlateDecode /Length ${stream.length} >>\nstream\n`), stream, Buffer.from('\nendstream')]),
    ] })
  }
  pass('xmp.pdf', withXmp('Public title'))
  deny('xmp.pdf', withXmp(fake), 'configured_secret_value', [fake])
  incomplete('metadata.xmp', '<?xml-stylesheet href="https://example.invalid/external"?><x/>')
  incomplete('metadata.xmp', '<?xpacket end="w" extra="unreviewed"?><x/>')
  deny('metadata.xmp', `<x><password>${fake}</password></x>`, 'credential_xml_value')
})
test('PDF attachments are recursively scanned, including private paths and invalid names', () => {
  pass('manual.pdf', attachedPdf('readme.txt', 'Public attachment'))
  deny('manual.pdf', attachedPdf('readme.txt', fake), 'configured_secret_value', [fake])
  deny('manual.pdf', attachedPdf('settings.json', JSON.stringify({ password: fake })), 'credential_literal_assignment')
  deny('manual.pdf', attachedPdf('.env', ''), 'credential_file')
  incomplete('manual.pdf', attachedPdf('../readme.txt', 'public'))
})
test('custom project JSON and ZIP payloads are checked rather than extension-allowed', async () => {
  for (const name of ['scene.iomcar', 'scene.360project']) {
    pass(name, JSON.stringify({ version: 1, sha256: fingerprint }))
    pass(name, await zip([['scene.json', '{"version":1}']]))
    deny(name, JSON.stringify({ password: fake }), 'credential_literal_assignment')
    incomplete(name, 'unknown')
  }
})
test('DAT numeric tables/float32 and model/shader text receive bounded checks', () => {
  pass('table.dat', '1.25 2.5\n3.75 4.5')
  const binary = Buffer.alloc(8); binary.writeFloatLE(0.1); binary.writeFloatLE(1.5, 4)
  pass('table.dat', binary)
  binary.writeFloatLE(NaN); incomplete('table.dat', binary)
  incomplete('unknown.dat', 'ordinary printable data')
  incomplete('unknown.dat', 'eeee')
  for (const name of ['shader.glsl', 'shader.vert', 'shader.frag', 'mesh.obj', 'material.mtl', 'LICENSE']) {
    pass(name, '# public asset\n0.5 1.0')
    deny(name, 'password = ' + fake, 'credential_text_assignment')
  }
})
test('TGA raw and RLE pixel streams are scanned; truncation and format mismatch refuse', () => {
  const header = Buffer.alloc(18); header[2] = 3; header.writeUInt16LE(2, 12); header.writeUInt16LE(1, 14); header[16] = 8
  pass('image.tga', Buffer.concat([header, Buffer.from([0, 255])]))
  incomplete('image.tga', header)
  header[2] = 11; header.writeUInt16LE(fake.length, 12)
  // Break the secret between two raw RLE packets: only decoded bytes contain it.
  const part = Math.floor(fake.length / 2)
  const rle = Buffer.concat([header, Buffer.from([part - 1]), Buffer.from(fake.slice(0, part)), Buffer.from([fake.length - part - 1]), Buffer.from(fake.slice(part))])
  assert.equal(rle.includes(Buffer.from(fake)), false)
  deny('image.tga', rle, 'configured_secret_value', [fake])
  header[2] = 2; incomplete('image.tga', Buffer.concat([header, Buffer.alloc(fake.length)]))
})
test('worker failure/timeout/truncated reports refuse without exposing diagnostics (mock transport)', () => {
  const original = childProcess.spawnSync
  try {
    for (const output of [
      { error: { code: 'ETIMEDOUT', message: fake }, stderr: fake },
      { status: 1, stdout: fake, stderr: fake },
      { status: 0, stdout: '{' },
      { status: 0, stdout: JSON.stringify({ complete: true, rules: [], errors: ['FAILED'] }) },
      { status: 0, stdout: JSON.stringify({ complete: true, rules: [fake], errors: [] }) },
    ]) {
      childProcess.spawnSync = (executable, args, options) => {
        assert.equal(executable, process.execPath)
        assert.equal(options.shell, false); assert.equal(options.windowsHide, true)
        assert.equal(options.timeout, 20000); assert.equal(options.maxBuffer, 65536)
        assert.ok(!args.join(' ').includes(fake))
        return output
      }
      syncBuiltinESMExports()
      assert.equal(scan('manual.pdf', pdf(), [fake]).complete, false)
    }
  } finally { childProcess.spawnSync = original; syncBuiltinESMExports() }
})

test('Gzip inspects decoded binary tails and text credentials with bounded expansion', () => {
  const bytes = Buffer.alloc(9 * 1024 * 1024)
  pass('terrain.bin.gz', gzipSync(bytes))
  Buffer.from(fake).copy(bytes, bytes.length - fake.length)
  deny('terrain.bin.gz', gzipSync(bytes), 'configured_secret_value', [fake])
  deny('config.json.gz', gzipSync(Buffer.from(JSON.stringify({ password: fake }))), 'credential_literal_assignment')
  deny('key.txt.gz', gzipSync(Buffer.from(pem)), 'private_key_pem')
  incomplete('large.txt.gz', gzipSync(Buffer.alloc(8 * 1024 * 1024 + 1)))
  incomplete('bomb.bin.gz', gzipSync(Buffer.alloc(64 * 1024 * 1024 + 1)))
  incomplete('broken.bin.gz', gzipSync(bytes).subarray(0, 15))
  const corrupt = gzipSync(Buffer.from('data')); corrupt[corrupt.length - 8] ^= 1
  incomplete('crc.bin.gz', corrupt)
  let nested = gzipSync(Buffer.from('safe'))
  for (let i = 0; i < 4; i++) nested = gzipSync(nested)
  incomplete('data.txt.gz.gz.gz.gz.gz', nested)
})
