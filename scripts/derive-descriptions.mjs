/**
 * Write a Tracy-authored `description` onto every measured server record.
 *
 *   node scripts/derive-descriptions.mjs          # rewrites data/servers/
 *   node scripts/derive-descriptions.mjs --check  # fails if anything would change
 *
 * WHY DERIVED, AND WHY NOT THE VENDOR'S
 *
 * data/export-manifest.json excludes vendorProse always: the description on a
 * marketplace listing is the author's marketing copy, and this registry does
 * not republish other people's prose. That exclusion is correct and stays.
 * But its side effect was an index where 97 of 98 measured records had no
 * description at all — and a record with no description cannot be chosen, by
 * a human scanning a list or by a model ranking tools.
 *
 * So the description is composed HERE, from fields Tracy measured or
 * classified: what the thing is, who operates it, what the vendor's MCP story
 * is, and what the probe actually found. Every clause traces to a structured
 * field in `_meta`. Nothing is copied from the vendor, so nothing here is
 * anyone else's prose.
 *
 * WHY IT IS WRITTEN INTO data/ RATHER THAN SYNTHESISED AT BUILD TIME
 *
 * build-dist.mjs promises that served records are byte-for-byte the files in
 * data/, and that the index is only a collection of them. Injecting text
 * during the build would break that — a client reading data/ through git and
 * one reading dist/ over HTTP would see different records. Writing the field
 * into the source keeps the invariant and makes every description reviewable
 * in a diff.
 *
 * Idempotent and deterministic: same inputs, same bytes. --check proves it in
 * CI the same way build-dist --check proves the build.
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const SERVERS = path.join(ROOT, 'data', 'servers')

const ECOSYSTEM_LABEL = { wordpress: 'WordPress', joomla: 'Joomla', shopify: 'Shopify' }

/** One sentence per fact, every fact from a measured or classified field. */
function derive(record) {
  const meta = record._meta?.['ai.tracy.registry/curation']
  if (!meta) return null

  // Field homes, after the curation schema was standardised (#2): ecosystem
  // moved under `classification`, operator under `identity`, and the flat
  // `evidence` bag became `measurement.{sourceScan,vendorAnnouncement,verification}`.
  // Reading them from one place each is what lets a schema move be answered by
  // rerunning this script instead of by editing 98 files.
  const parts = []
  const eco = (meta.classification?.ecosystem ?? []).map((e) => ECOSYSTEM_LABEL[e] ?? e).join(', ')
  const operator = meta.identity?.operator?.name
  const capability = new Set(meta.classification?.capability ?? [])

  // What it is. `vendor-mcp` means the vendor ships MCP support themselves;
  // everything else in this dataset is an extension or app Tracy scanned or
  // probed for agent-facing surface.
  if (capability.has('vendor-mcp')) {
    const status = meta.measurement?.vendorAnnouncement?.status
    const flavour =
      status === 'official-ga' ? 'generally available'
      : status === 'official-beta' ? 'in beta'
      : status === 'third-party-wrapper' ? 'via a third-party wrapper'
      : null
    parts.push(
      `MCP support for ${eco}${operator ? ` from ${operator}` : ''}${flavour ? `, ${flavour}` : ''}.`,
    )
  } else {
    parts.push(`${eco} extension${operator ? ` by ${operator}` : ''}, surveyed for MCP and agent-facing surface.`)
  }

  // What Tracy found, most concrete evidence first.
  const scan = meta.measurement?.sourceScan ?? {}
  const abilities = Number(scan.abilitiesExtracted ?? 0)
  const routes = Number(scan.restRoutes ?? 0)
  const cli = Number(scan.cliCommands ?? 0)
  const found = []
  if (abilities > 0) found.push(`${abilities} registered abilit${abilities === 1 ? 'y' : 'ies'}`)
  if (routes > 0) found.push(`${routes} REST route registration${routes === 1 ? '' : 's'}`)
  if (cli > 0) found.push(`${cli} CLI command${cli === 1 ? '' : 's'}`)
  if (found.length) parts.push(`Source scan found ${found.join(', ')}.`)

  // What verification found. `auth_required` is a POSITIVE signal — something
  // answered and asked for credentials — and is phrased as such rather than as
  // a failure. `no_vendor_domain` and `no_vendor_endpoint` are different facts
  // and stay different sentences: one means there was nowhere to look, the
  // other means we looked and found nothing.
  const endpoint = meta.measurement?.verification?.endpoint
  if (endpoint === 'endpoint_found') parts.push('A live MCP endpoint answered Tracy’s probe.')
  else if (endpoint === 'auth_required') parts.push('An endpoint answered Tracy’s probe and requires authentication.')
  else if (endpoint === 'no_vendor_endpoint') parts.push('No vendor MCP endpoint answered on the paths tried.')
  else if (endpoint === 'no_vendor_domain') parts.push('The listing has no vendor domain of its own to probe.')
  else if (endpoint === 'blocked') parts.push('Probing was blocked before an endpoint could answer.')

  return parts.join(' ')
}

let changed = 0
let total = 0
const check = process.argv.includes('--check')

for (const platform of fs.readdirSync(SERVERS).sort()) {
  const dir = path.join(SERVERS, platform)
  if (!fs.statSync(dir).isDirectory()) continue
  for (const file of fs.readdirSync(dir).sort()) {
    if (!file.endsWith('.json')) continue
    total += 1
    const abs = path.join(dir, file)
    const record = JSON.parse(fs.readFileSync(abs, 'utf8'))
    const description = derive(record)
    if (!description || record.description === description) continue
    changed += 1
    if (check) {
      console.error(`stale description: data/servers/${platform}/${file}`)
      continue
    }
    // Rebuild the object so `description` sits where the MCP schema shows it,
    // right after name/title — a diff reader should not find it dangling at
    // the bottom under `_meta`.
    const ordered = {}
    for (const key of Object.keys(record)) {
      ordered[key] = record[key]
      if (key === 'title') ordered.description = description
    }
    if (!('description' in ordered)) ordered.description = description
    fs.writeFileSync(abs, JSON.stringify(ordered, null, 2) + '\n')
  }
}

if (check && changed > 0) {
  console.error(`${changed} of ${total} records have stale or missing descriptions — run: node scripts/derive-descriptions.mjs`)
  process.exit(1)
}
console.log(check ? `OK — ${total} descriptions current` : `wrote ${changed} of ${total} descriptions`)
