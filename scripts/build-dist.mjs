#!/usr/bin/env node
/**
 * Build the served surface (`dist/`) from the raw data (`data/`).
 *
 *   node scripts/build-dist.mjs
 *   node scripts/build-dist.mjs --check    (build twice in-process and compare; writes nothing)
 *
 * WHY THIS STEP EXISTS INSTEAD OF SERVING `data/` DIRECTLY
 *
 * `data/` is what the exporter produces, and the only thing it produces. `dist/`
 * is what consumers read. They differ in three ways, and all three are
 * publishing decisions rather than extraction decisions:
 *
 *   1. `index.json` — so clients never have to guess a path.
 *   2. `findings/*.ndjson.gz` — 2,429 NDJSON lines compress to 9%.
 *   3. The root of `dist/` is EMPTY. Not an oversight, a contract:
 *      `registry.tracy.ai` also serves `skills/` from a different repo, and the
 *      root name is deliberately left unclaimed so that "index" at the root can
 *      never become ambiguous.
 *
 * EVERYTHING HERE MUST BE DETERMINISTIC. No timestamps, no filesystem-dependent
 * ordering, no mtime in the gzip header. `--check` is what proves it, and CI
 * runs it on every build.
 */

import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const DATA = path.join(ROOT, 'data')
const DIST = path.join(ROOT, 'dist')

/** Read every server record, sorted deterministically by path. */
function readServers() {
  const base = path.join(DATA, 'servers')
  const out = []
  for (const platform of fs.readdirSync(base).sort()) {
    const dir = path.join(base, platform)
    if (!fs.statSync(dir).isDirectory()) continue
    for (const file of fs.readdirSync(dir).sort()) {
      if (!file.endsWith('.json')) continue
      const rel = `mcp/${platform}/${file}`
      out.push({ rel, raw: fs.readFileSync(path.join(dir, file), 'utf8') })
    }
  }
  return out
}

/**
 * A record's `name` MUST map to its file path.
 *
 * This stands in for a redundant `path` field on every record. The requirement
 * was twofold — clients must not have to guess a path, and we must not invent a
 * third schema — so the path rule is an invariant instead: `servers/{name}.json`.
 * A rule that CI enforces is not guesswork; a rule that only lives in a README
 * is.
 */
function assertPathInvariant(records) {
  const broken = []
  for (const { rel, raw } of records) {
    const name = JSON.parse(raw).name
    if (`mcp/${name}.json` !== rel) broken.push(`${rel} declares name="${name}"`)
  }
  if (broken.length) {
    console.error('Path invariant violated — servers/{name}.json does not match the real file:')
    for (const b of broken) console.error(`  ${b}`)
    process.exit(1)
  }
}

/**
 * Vendor submissions from `registry/<namespace>/<server>.json`.
 *
 * Two sources feed one index, and they are NOT interchangeable:
 *
 *   data/servers/  Tracy went and measured. Namespaced by platform
 *                  (`wordpress/…`), carries `_meta` evidence, and has no
 *                  `description` because the only one available belongs to the
 *                  vendor.
 *   registry/      A vendor submitted. Namespaced by something they proved they
 *                  own (`io.github.acme/…`), carries a `description` they wrote,
 *                  and carries no evidence until the prober reaches it.
 *
 * A reader tells them apart by the SHAPE OF THE NAMESPACE, not by a trust flag
 * they might forget to check — which is also why `src/validate.ts` refuses a
 * submission into a platform namespace.
 */
function readSubmissions() {
  const base = path.join(ROOT, 'registry')
  if (!fs.existsSync(base)) return []
  const out = []
  for (const namespace of fs.readdirSync(base).sort()) {
    const dir = path.join(base, namespace)
    if (!fs.statSync(dir).isDirectory()) continue
    for (const file of fs.readdirSync(dir).sort()) {
      if (!file.endsWith('.json')) continue
      const raw = fs.readFileSync(path.join(dir, file), 'utf8')
      out.push({ rel: `mcp/${namespace}/${file}`, raw: JSON.stringify(JSON.parse(raw), null, 2) + '\n' })
    }
  }
  return out
}

function buildTree() {
  const files = new Map()
  const servers = [...readServers(), ...readSubmissions()].sort((a, b) => (a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0))
  assertPathInvariant(servers)

  // Each record, byte-for-byte as it appears in `data/`. The index may only be a
  // collection of these, never a variant — if the two drifted, a client reading
  // the index would see a different reality than one reading individual files.
  for (const { rel, raw } of servers) files.set(rel, Buffer.from(raw))

  // An array, not a wrapper object: consumers call `jq 'length'` and expect the
  // record count back.
  const index = servers.map(({ raw }) => JSON.parse(raw))
  files.set('mcp/index.json', Buffer.from(JSON.stringify(index, null, 2) + '\n'))

  // findings: BOTH forms are kept, and that is deliberate.
  //
  // Splitting per platform solves "don't make me download what I don't need";
  // compression solves "1.3 MB and growing". Two different problems, so two
  // solutions coexist. The `.gz` copy is the one to fetch; the plain copy stays
  // so a bare curl still works without knowing anything else.
  const findingsDir = path.join(DATA, 'findings')
  const platforms = []
  for (const file of fs.readdirSync(findingsDir).sort()) {
    if (!file.endsWith('.ndjson')) continue
    const buf = fs.readFileSync(path.join(findingsDir, file))
    const gz = gzipSync(buf, { level: 9 })
    files.set(`mcp/findings/${file}`, buf)
    files.set(`mcp/findings/${file}.gz`, gz)
    platforms.push({
      platform: path.basename(file, '.ndjson'),
      records: buf.toString('utf8').trimEnd().split('\n').filter(Boolean).length,
      bytes: buf.length,
      gzipBytes: gz.length,
      files: { ndjson: `mcp/findings/${file}`, gzip: `mcp/findings/${file}.gz` },
    })
  }

  // The submitter-facing schema, served at registry.tracy.ai/mcp/schema/… —
  // the same URL its own `$id` declares, so an editor pointed there loads
  // exactly this file.
  const schemaFile = path.join(ROOT, 'schema', 'mcp-record.schema.json')
  if (fs.existsSync(schemaFile)) {
    files.set('mcp/schema/mcp-record.schema.json', fs.readFileSync(schemaFile))
  }

  files.set(
    'mcp/findings/index.json',
    Buffer.from(
      JSON.stringify(
        {
          format: 'ndjson',
          note:
            'One line per checked candidate, INCLUDING the ones where no MCP server was found. ' +
            'Most records are of that kind, and they are the point of this dataset rather than leftovers.',
          read: {
            gzip: 'curl -s https://registry.tracy.ai/mcp/findings/<platform>.ndjson.gz | gunzip | jq -c .',
            plain: 'curl -s https://registry.tracy.ai/mcp/findings/<platform>.ndjson | jq -c .',
          },
          totalRecords: platforms.reduce((n, p) => n + p.records, 0),
          platforms,
        },
        null,
        2,
      ) + '\n',
    ),
  )

  return files
}

function digest(files) {
  const h = createHash('sha256')
  for (const key of [...files.keys()].sort()) {
    h.update(key)
    h.update(files.get(key))
  }
  return h.digest('hex')
}

const files = buildTree()

if (process.argv.includes('--check')) {
  // Build a second time and compare hashes: proves no timestamp or ordering
  // effect leaked in.
  const again = digest(buildTree())
  const first = digest(files)
  if (first !== again) {
    console.error(`NOT DETERMINISTIC: ${first} !== ${again}`)
    process.exit(1)
  }
  console.log(`OK deterministic — sha256 ${first}`)
  console.log(`  ${files.size} files`)
  process.exit(0)
}

fs.rmSync(DIST, { recursive: true, force: true })
for (const [rel, buf] of files) {
  const dest = path.join(DIST, rel)
  fs.mkdirSync(path.dirname(dest), { recursive: true })
  fs.writeFileSync(dest, buf)
}

// The root of dist/ must stay empty — see the docblock. Checked here rather than
// trusted to care, because this mistake only surfaces after a name on the shared
// domain has already been claimed.
const rootFiles = fs.readdirSync(DIST).filter((f) => fs.statSync(path.join(DIST, f)).isFile())
if (rootFiles.length) {
  console.error(`The root of dist/ must be empty, but contains: ${rootFiles.join(', ')}`)
  process.exit(1)
}

const served = [...files.keys()].filter((k) => k.startsWith('mcp/') && k !== 'mcp/index.json' && !k.startsWith('mcp/findings/') && !k.startsWith('mcp/schema/'))
const submitted = readSubmissions().length
console.log(`servers   ${served.length} records + index.json (${served.length - submitted} scanned, ${submitted} submitted)`)
console.log(`findings  ${JSON.parse(files.get('mcp/findings/index.json')).totalRecords} lines`)
console.log(`sha256    ${digest(files)}`)
