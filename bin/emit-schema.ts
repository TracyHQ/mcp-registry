import fs from 'node:fs/promises'
import path from 'node:path'

import { z } from 'zod'

import { McpRecordSchema, RESERVED_NAMESPACES } from '../src/record'

/**
 * Generate the JSON Schema a submitter's editor can validate against.
 *
 * The point is that a contributor finds out their record is wrong while typing
 * it, not after opening a pull request and waiting for CI. `registry/README.md`
 * describes the format in prose; this is the same thing in a form an editor can
 * read.
 *
 * GENERATED FROM src/record.ts, NEVER HAND-WRITTEN. That file is what CI
 * actually enforces, so a hand-maintained copy would be a second description of
 * one contract — and the two would drift, which is the failure this repo has
 * already paid for more than once. Anything not expressible in JSON Schema
 * (namespace ownership, the reserved list, path matching the record) stays in
 * `src/validate.ts` and is noted below so a submitter is not surprised that a
 * green editor can still fail CI.
 */
const jsonSchema = z.toJSONSchema(McpRecordSchema, { io: 'input' })

const output = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  $id: 'https://registry.tracy.ai/mcp/schema/mcp-record.schema.json',
  title: 'Tracy MCP registry submission',
  description:
    'A record submitted to registry/{namespace}/{server}.json. Generated from src/record.ts — ' +
    'do not edit by hand. Three rules cannot be expressed here and are enforced by CI instead: ' +
    'the file path must match the name inside the record; the namespace must be a GitHub owner ' +
    `you control (io.github.{owner}); and these namespaces are reserved: ${RESERVED_NAMESPACES.join(', ')}.`,
  ...jsonSchema
}

const target = path.join(process.cwd(), 'schema', 'mcp-record.schema.json')
await fs.mkdir(path.dirname(target), { recursive: true })
await fs.writeFile(target, JSON.stringify(output, null, 2) + '\n')

console.log(`wrote ${path.relative(process.cwd(), target)}`)
