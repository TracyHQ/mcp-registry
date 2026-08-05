import { z } from 'zod'

/**
 * What a vendor submits: a minimal, real `server.json`.
 *
 * This is the first of the three places ADR 0018 allows the two marketplaces to
 * differ. A skill record answers "where is the text" — `gitUrl` + `ref` +
 * `skillPath`. There is no text here. An MCP server is a running program, so the
 * question is "where do I reach it", and the official `server.json` schema
 * already has that vocabulary: `remotes[]` for an endpoint, `packages[]` for
 * something you install and launch.
 *
 * Nothing below is a Tracy invention. Every field name comes from
 * https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json
 * so a submitted record is publishable to the official registry unchanged, and a
 * client that already parses `server.json` needs no special case.
 */

/**
 * Reverse-DNS-ish, exactly as the official schema defines `name`:
 * `{namespace}/{server}`. The namespace half is what ownership is proven over.
 */
const NameSchema = z
  .string()
  .min(3)
  .max(200)
  .regex(/^[a-zA-Z0-9.-]+\/[a-zA-Z0-9._-]+$/, 'name must be {namespace}/{server}')

/**
 * Namespaces reserved for Tracy's own measurements. Submissions are refused here.
 *
 * THIS IS THE MOST IMPORTANT RULE IN THIS FILE.
 *
 * The 98 scanned records are named `wordpress/goaffpro`, `joomla/…`,
 * `shopify/…` — a namespace Tracy assigns when it discovers something, not one
 * anybody claimed. If a submission could write into it, a vendor could overwrite
 * a measurement with an assertion, and the dataset would lose the one property
 * that makes it worth publishing.
 *
 * Scanned and submitted records therefore live in namespaces of different
 * SHAPES, and a reader can tell them apart without consulting a trust flag they
 * might forget to read.
 */
export const RESERVED_NAMESPACES = [
  // Platform namespaces: Tracy assigns these when it discovers something.
  'wordpress',
  'joomla',
  'shopify',
  // Tracy's own curated mirror of entries already published, under proven
  // ownership, to the official registry (registry.modelcontextprotocol.io) —
  // filtered for commerce/website-management relevance. The ownership proof
  // already happened once, upstream, at the official registry; a submission
  // here would let a second party override Tracy's curation of that same
  // upstream record, which is the same failure mode RESERVED_NAMESPACES exists
  // to prevent for wordpress/joomla/shopify.
  'official-registry',
  // Path collision, not provenance. Server records are served at
  // `/mcp/{namespace}/{server}.json`, and `/mcp/findings/` is the second
  // dataset. A namespace literally called `findings` would publish files into
  // that directory and shadow it.
  'findings'
] as const

/** Remote endpoint. Transport values are the official schema's. */
const RemoteSchema = z.object({
  type: z.enum(['streamable-http', 'sse']),
  url: z
    .string()
    .url()
    .refine((value) => {
      try {
        const url = new URL(value)
        // https only: an MCP endpoint carries the customer's live credentials,
        // and this URL is handed to a client that will connect with them.
        if (url.protocol !== 'https:') return false
        if (url.username || url.password) return false
        return true
      } catch {
        return false
      }
    }, 'url must be https with no userinfo')
})

/** Installable package. */
const PackageSchema = z.object({
  registryType: z.enum(['npm', 'pypi', 'oci', 'nuget']),
  identifier: z.string().min(1).max(200),
  version: z.string().min(1).max(255)
})

export const McpRecordSchema = z
  .object({
    $schema: z.string().url().optional(),
    name: NameSchema,
    // Required here, unlike the scanned side where it is absent 98/98. A vendor
    // describing their own server is authoring, not republishing, so the
    // licensing problem that keeps `description` out of scanned records does not
    // arise. Submitted records therefore validate against the official schema
    // where scanned ones cannot.
    description: z.string().min(1).max(100),
    version: z.string().min(1).max(255),
    websiteUrl: z.string().url().optional(),
    repository: z
      .object({
        url: z.string().url(),
        source: z.enum(['github', 'gitlab', 'bitbucket'])
      })
      .optional(),
    remotes: z.array(RemoteSchema).min(1).optional(),
    packages: z.array(PackageSchema).min(1).optional()
  })
  .strict()
  .refine(
    (record) => Boolean(record.remotes?.length || record.packages?.length),
    'a record must declare at least one of remotes[] or packages[] — otherwise nothing can reach the server'
  )

export type McpRecord = z.infer<typeof McpRecordSchema>

/** The namespace half of `name`. */
export function namespaceOf(name: string): string {
  return name.split('/')[0] ?? ''
}

/** The server half of `name`, which must match the file name. */
export function serverOf(name: string): string {
  return name.split('/')[1] ?? ''
}

/**
 * GitHub owner a namespace claims, or null if the namespace is not a GitHub one.
 *
 * Round one supports exactly this form (ADR 0018 §2, amended 2026-08-03): a
 * namespace `io.github.acme` claims GitHub owner `acme`, and ownership is proven
 * the same way the skills registry proves it. Domain-verified namespaces
 * (`com.acme`) are a later branch in this function, not a rewrite of anything
 * around it.
 */
export function githubOwnerOf(namespace: string): string | null {
  const prefix = 'io.github.'
  if (!namespace.startsWith(prefix)) return null
  const owner = namespace.slice(prefix.length)
  return /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(owner) ? owner : null
}

/**
 * Trust label. Same three values as the skills registry, same meaning.
 */
export const TierSchema = z.enum(['listed', 'curated', 'quarantined'])
export type Tier = z.infer<typeof TierSchema>

/**
 * The byte string a `curated` label is pinned to.
 *
 * Skills pin the label to the sha256 of `SKILL.md`, because that is the thing a
 * reviewer read. There is no file to read here — so the analogue is the
 * submitted record itself: a vendor who changes the endpoint URL after review
 * has changed the thing that was approved, and the label must fall.
 *
 * Canonical JSON, keys sorted: two byte-identical records must hash the same
 * regardless of key order or whitespace, or the label demotes on a reformat.
 */
export function canonicalRecordJson(record: McpRecord): string {
  const sortDeep = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(sortDeep)
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
          .map(([k, v]) => [k, sortDeep(v)])
      )
    }
    return value
  }
  return JSON.stringify(sortDeep(record))
}
