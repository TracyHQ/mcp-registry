#!/usr/bin/env node
/**
 * Fail the build if Tracy-authored text in this public repo is not in English.
 *
 *   node scripts/check-language.mjs
 *
 * WHY THIS EXISTS
 *
 * On 2026-08-03 this repo shipped with a Vietnamese README, Vietnamese comments,
 * and — the part that actually mattered — a Vietnamese `note` string inside
 * `findings/index.json`, which is served to every consumer of the public API.
 * The prose was reviewed several times and nobody caught it, because a reviewer
 * fluent in the language does not perceive it as the wrong language.
 *
 * That is exactly the class of mistake to hand to a machine: mechanical,
 * invisible to the person best placed to notice it, and only embarrassing once
 * an outside reader hits it.
 *
 * WHAT IS AND IS NOT CHECKED
 *
 * Checked: everything Tracy writes — prose, comments, and any string this repo
 * GENERATES into the served surface.
 *
 * Not checked: `data/` and the `.ndjson` files derived from it. Those carry
 * third-party extension titles recorded verbatim, in whatever language their
 * authors used. "Translate the data" is a data-corruption bug, not a language
 * fix.
 *
 * WHY CODE POINTS INSTEAD OF LITERAL CHARACTERS
 *
 * The first version of this file wrote the alphabet out literally and therefore
 * failed its own check. Adding a self-exemption would have left a hole big
 * enough to hide a real violation in, so the pattern is built from escapes and
 * the comments name characters instead of showing them. This file is scanned by
 * the same rule as every other.
 */

import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')

/**
 * Letters unique to Vietnamese:
 *   U+0102/0103  A-breve
 *   U+0110/0111  D-stroke
 *   U+01A0/01A1  O-horn
 *   U+01AF/01B0  U-horn
 *   U+1EA0-1EF9  the Vietnamese tone-mark block (hook-above and dot-below)
 *
 * Deliberately EXCLUDES the acute, grave and circumflex forms in Latin-1
 * Supplement that Vietnamese shares with Portuguese, French, Spanish and
 * Hungarian — real vendor names in this dataset use those, and flagging them
 * would train everyone to ignore this check.
 *
 * It cannot catch Vietnamese typed without diacritics. The written rule in
 * ADR 0016 covers what a regex cannot.
 */
const VIETNAMESE = /[\u0102\u0103\u0110\u0111\u01A0\u01A1\u01AF\u01B0\u1EA0-\u1EF9]/u

/** Tracy-authored source. Anything added here must be prose we control. */
const SOURCE = ['README.md', 'registry/README.md', 'LICENSE', 'LICENSE-DATA', 'scripts', '.github']

/**
 * Generated files carrying Tracy-authored strings.
 *
 * `dist/*​/index.json` is where the real incident happened. `data/export-manifest.json`
 * was added on 2026-08-03 after the exporter grew prose fields describing what
 * each value means: it lives under `data/`, which is exempt wholesale because it
 * holds third-party titles — but the manifest is ours, not theirs, so the blanket
 * exemption was hiding it. Exempt the data, not the directory.
 */
const GENERATED = [
  'dist/mcp/servers/index.json',
  'dist/mcp/findings/index.json',
  'data/export-manifest.json',
]

function walk(rel) {
  const abs = path.join(ROOT, rel)
  if (!fs.existsSync(abs)) return []
  if (fs.statSync(abs).isFile()) return [rel]
  return fs
    .readdirSync(abs)
    .sort()
    .flatMap((entry) => walk(path.join(rel, entry)))
}

const targets = [...SOURCE.flatMap(walk), ...GENERATED.flatMap(walk)]
const offenders = []

for (const rel of targets) {
  const text = fs.readFileSync(path.join(ROOT, rel), 'utf8')
  text.split('\n').forEach((line, i) => {
    if (VIETNAMESE.test(line)) {
      offenders.push({ rel, line: i + 1, text: line.trim().slice(0, 110) })
    }
  })
}

if (offenders.length) {
  console.error('Non-English text in a public repo. Everything Tracy writes here must be English.')
  console.error('Rule: ADR 0016 in TracyHQ/tracy-docs.\n')
  for (const o of offenders) console.error(`  ${o.rel}:${o.line}\n    ${o.text}`)
  console.error(`\n${offenders.length} line(s). Third-party names under data/ are exempt and not scanned.`)
  process.exit(1)
}

console.log(`OK English — scanned ${targets.length} files`)
