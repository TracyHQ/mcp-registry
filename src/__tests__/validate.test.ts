import { describe, expect, it } from 'vitest'

import { githubOwnerOf, RESERVED_NAMESPACES } from '../record'
import { validateRecordFile } from '../validate'

const valid = {
  $schema: 'https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json',
  name: 'io.github.acme/orders',
  description: 'Read and refund Acme orders.',
  version: '1.2.0',
  remotes: [{ type: 'streamable-http', url: 'https://mcp.acme.com/mcp' }]
}

const at = (record: unknown, path = 'registry/io.github.acme/orders.json') => validateRecordFile(path, record)
const codes = (record: unknown, path?: string) => at(record, path).map((e) => e.code)

describe('a well-formed submission', () => {
  it('passes', () => {
    expect(at(valid)).toEqual([])
  })

  it('passes with packages instead of remotes', () => {
    const { remotes, ...rest } = valid
    expect(at({ ...rest, packages: [{ registryType: 'npm', identifier: '@acme/mcp', version: '1.2.0' }] })).toEqual([])
  })
})

describe('reserved namespaces — the rule that protects the measurements', () => {
  // A vendor writing into `wordpress/…` would replace something Tracy measured
  // with something a vendor asserted. That is the whole dataset's value gone.
  for (const namespace of RESERVED_NAMESPACES) {
    it(`refuses a submission into "${namespace}"`, () => {
      const record = { ...valid, name: `${namespace}/woocommerce` }
      expect(codes(record, `registry/${namespace}/woocommerce.json`)).toContain('namespace_reserved')
    })
  }
})

describe('namespace ownership — round one is GitHub only', () => {
  it('accepts io.github.{owner}', () => {
    expect(githubOwnerOf('io.github.acme')).toBe('acme')
  })

  it('refuses a namespace nobody can prove, rather than waving it through', () => {
    // Accepting an unverifiable namespace silently is how a squatter gets a
    // permanent name, so an unknown form is an error, not a shrug.
    const record = { ...valid, name: 'com.acme/orders' }
    expect(codes(record, 'registry/com.acme/orders.json')).toContain('namespace_unprovable')
  })

  it('refuses a bare word namespace', () => {
    const record = { ...valid, name: 'acme/orders' }
    expect(codes(record, 'registry/acme/orders.json')).toContain('namespace_unprovable')
  })

  it('rejects an io.github namespace whose owner part is not a legal GitHub login', () => {
    expect(githubOwnerOf('io.github.not_a_login')).toBeNull()
    expect(githubOwnerOf('io.github.')).toBeNull()
  })
})

describe('path and content must agree', () => {
  // git mv-ing a record without editing it would otherwise change its identity
  // in silence.
  it('catches a directory that does not match the namespace', () => {
    expect(codes(valid, 'registry/io.github.other/orders.json')).toContain('path_namespace_mismatch')
  })

  it('catches a file name that does not match the server', () => {
    expect(codes(valid, 'registry/io.github.acme/refunds.json')).toContain('path_server_mismatch')
  })

  it('refuses a record outside registry/', () => {
    expect(codes(valid, 'data/io.github.acme/orders.json')).toContain('path_outside_registry')
  })
})

describe('reachability is required', () => {
  it('refuses a record with neither remotes nor packages', () => {
    const { remotes, ...rest } = valid
    expect(codes(rest)).toContain('schema')
  })

  it('refuses a non-https endpoint — this URL receives live customer credentials', () => {
    expect(codes({ ...valid, remotes: [{ type: 'streamable-http', url: 'http://mcp.acme.com/mcp' }] })).toContain(
      'schema'
    )
  })

  it('refuses userinfo in the endpoint URL', () => {
    expect(
      codes({ ...valid, remotes: [{ type: 'streamable-http', url: 'https://user:pw@mcp.acme.com/mcp' }] })
    ).toContain('schema')
  })
})

describe('description', () => {
  // Required here and absent 98/98 on the scanned side. A vendor describing
  // their own server is authoring, not republishing, so submitted records
  // validate against the official schema where scanned ones cannot.
  it('is required', () => {
    const { description, ...rest } = valid
    expect(codes(rest)).toContain('schema')
  })

  it('is capped at the official schema 100 characters', () => {
    expect(codes({ ...valid, description: 'x'.repeat(101) })).toContain('schema')
  })
})

describe('unknown fields', () => {
  it('are refused, so a typo is not silently ignored', () => {
    expect(codes({ ...valid, endpoint: 'https://mcp.acme.com/mcp' })).toContain('schema')
  })
})
