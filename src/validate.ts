import { githubOwnerOf, McpRecordSchema, namespaceOf, RESERVED_NAMESPACES, serverOf } from './record'

export type ValidationError = { code: string; message: string }

/**
 * Pure rules, no network access — runs on every PR even when the GitHub API is
 * out of quota. Anything that needs to reach the server itself (does the
 * endpoint answer? what tools does it list?) is deliberately NOT here: that is
 * the second of the three differences ADR 0018 allows, and it belongs to the
 * prober, which runs on its own schedule against its own sandbox.
 *
 * The file path and the file content deliberately mirror each other, exactly as
 * the skills registry does it: `git mv`-ing a record to a different directory
 * without editing its content would silently change the record's identity, so it
 * has to be an error rather than a surprise.
 */
export function validateRecordFile(filePath: string, raw: unknown): ValidationError[] {
  const errors: ValidationError[] = []
  const segments = filePath.split('/').filter(Boolean)

  if (segments.length !== 3 || segments[0] !== 'registry') {
    errors.push({
      code: 'path_outside_registry',
      message: `record must live at registry/{namespace}/{server}.json: ${filePath}`
    })
    return errors
  }

  const parsed = McpRecordSchema.safeParse(raw)
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      errors.push({ code: 'schema', message: `${issue.path.join('.') || '(root)'}: ${issue.message}` })
    }
    return errors
  }

  const record = parsed.data
  const pathNamespace = segments[1]!
  const fileSegment = segments[2]!
  const pathServer = fileSegment.endsWith('.json') ? fileSegment.slice(0, -'.json'.length) : fileSegment

  const namespace = namespaceOf(record.name)
  const server = serverOf(record.name)

  if (pathNamespace !== namespace) {
    errors.push({
      code: 'path_namespace_mismatch',
      message: `directory "${pathNamespace}" does not match the namespace in name "${record.name}"`
    })
  }

  if (pathServer !== server) {
    errors.push({
      code: 'path_server_mismatch',
      message: `file name "${pathServer}" does not match the server in name "${record.name}"`
    })
  }

  // Tracy's measurements are not claimable. See RESERVED_NAMESPACES for why this
  // outranks every other rule here.
  if ((RESERVED_NAMESPACES as readonly string[]).includes(namespace)) {
    errors.push({
      code: 'namespace_reserved',
      message:
        `"${namespace}" is reserved for records Tracy discovers by scanning, and cannot be submitted. ` +
        `Use a namespace you can prove you own, e.g. io.github.{your-org}.`
    })
  }

  // Round one proves ownership exactly one way: GitHub. A namespace nobody can
  // prove is a namespace anybody can take, so an unrecognised form is refused
  // rather than waved through — silently accepting it is how a squatter gets a
  // permanent name.
  if (!(RESERVED_NAMESPACES as readonly string[]).includes(namespace) && githubOwnerOf(namespace) === null) {
    errors.push({
      code: 'namespace_unprovable',
      message:
        `namespace "${namespace}" cannot be verified. Round one supports io.github.{owner} only; ` +
        `domain-verified namespaces are not implemented yet (ADR 0018 §2).`
    })
  }

  return errors
}
