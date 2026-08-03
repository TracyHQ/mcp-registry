# Tracy MCP registry — server records and findings

A public dataset of **MCP servers across CMS ecosystems**: which ones exist, and — more usefully —
which candidates were checked and turned up **nothing**.

```
https://registry.tracy.ai/mcp/index.json
https://registry.tracy.ai/mcp/{platform}/{slug}.json
https://registry.tracy.ai/mcp/findings/index.json
https://registry.tracy.ai/mcp/findings/{platform}.ndjson.gz
```

Latest export: **2,429** candidates checked · **162** showing MCP signals · **16** vendor-built
servers confirmed by survey.

## Two outputs, because they are two different claims

`servers/` holds only the records where an MCP server **was found**. Those carry the shape of
`server.json`.

`findings/` holds **every** candidate that was checked, with the date and the result, including
when the result was nothing at all. 2,267 of the 2,429 records are of that kind.

Publishing all 2,429 as `server.json` would assert that 2,429 MCP servers exist. Today that number
is 162, and the number surveyed first-hand is 16.

## `servers/` is `server.json`-SHAPED, not `server.json`-VALID

Read this before writing a client. It is stated up front rather than left for you to discover.

Every record declares `$schema` pointing at the official `2025-12-11` schema and uses that schema's
field names, so an existing parser will read it. But **no record passes a validator**, because two
required fields are missing:

| Field | Missing | Why, and why it cannot be patched |
|---|---|---|
| `description` | 162/162 | The only description available is the vendor's own prose. Tracy does not republish other people's text — that is a fixed rule, not a setting. A Tracy-written description does not exist yet. |
| `version` | 149/162 | All Shopify. The Shopify app directory does not publish a version, so this is data that **does not exist at the source**, not data we have not fetched. |

Every record carries `_meta["ai.tracy.registry/curation"].conformance = "shaped-not-valid"` so an
automated client can read this too, not only a human reading the README.

Machine-generating a description to fill the hole would make every record "valid" and the dataset
worse: it would trade an honest gap for a sentence nobody can verify.

## Paths derive from `name`, and CI guarantees it

`index.json` is an **array** of records whose contents are byte-identical to the individual
files. A record's path is `mcp/{name}.json` — an invariant that `scripts/build-dist.mjs` checks
on every build, failing the build if it breaks. That is why records carry no redundant `path` field.

```bash
curl -s https://registry.tracy.ai/mcp/index.json | jq -r '.[].name' | head
curl -s https://registry.tracy.ai/mcp/joomla/mcp-server-for-joomla.json | jq .
```

## Reading `findings/`

NDJSON, one record per line, split per platform. Both compressed and plain copies are served —
compressed to fetch, plain so a bare curl still works.

```bash
curl -s https://registry.tracy.ai/mcp/findings/wordpress.ndjson.gz | gunzip | jq -c 'select(.findings.probeStatus == "endpoint_found")'
curl -s https://registry.tracy.ai/mcp/findings/index.json | jq '.platforms'
```

Compression lands around 9%: 1.3 MB to 129 KB.

## `provenance` and `businessModel` are different fields

Both take the value `community`, with two entirely different meanings. Do not merge them.

| Field | Where | Answers |
|---|---|---|
| `provenance` | `_meta` in `servers/` | **Who built** this MCP server — `official` · `community` · `platform-level` |
| `businessModel` | `_meta` in `servers/`, `classification` in `findings/` | **The vendor's business model** — `commercial` · `community` · `unknown` |

A free GPL extension built by a company is `community` by the second column and `official` by the
first. Both are correct, and merging them makes the error invisible.

## What is deliberately absent

- **Vendor prose**, for a licensing reason rather than a policy one. This dataset is published
  under CC BY 4.0, and `LICENSE-DATA` states that the licence covers Tracy's compilation and
  measurements, not the things measured. Including a vendor's own description would purport to
  license text Tracy does not own. Resolving that means narrowing the licence scope for such a
  field, not flipping a switch.
- **Install counts and metrics purchased from a commercial data supplier.** That is a question of
  contract terms, not copyright, and it has no written answer yet — so the default is no.
- **Placeholder numbers from design mock-ups.** Three records carry a few hand-entered tool counts
  used to build a UI; those fields are stripped while the records are kept.
- **The pattern list used to scrub supplier names.** It lives in the private repo that generates
  this dataset and deliberately not here — copying it into a public repo is exactly the leak it
  exists to prevent. The gate runs before anything is pushed, not here.

## Submitting a server

Vendors add their own server by pull request. One file:

```
registry/<namespace>/<server>.json
```

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.acme/orders",
  "description": "Read and refund Acme orders.",
  "version": "1.2.0",
  "remotes": [{ "type": "streamable-http", "url": "https://mcp.acme.com/mcp" }]
}
```

Every field comes from the official `server.json` schema — nothing here is a Tracy invention, and the
same file is publishable to the official registry unchanged.

**Namespaces are proven, not claimed.** Round one supports `io.github.{owner}`, verified the same way
the [skills registry](https://github.com/TracyHQ/skills) verifies it: the namespace must be a GitHub
owner. Domain-verified namespaces are not implemented yet.

**`wordpress`, `joomla` and `shopify` are reserved** and submissions into them are refused. Those
namespaces hold records Tracy produced by scanning; letting a submission write there would replace a
measurement with an assertion, which is the one thing this dataset must not allow. The two sources
are told apart by the shape of the namespace, not by a flag a reader might skip.

**CI never contacts your server.** A pull request is checked against pure rules only — schema, the
path matching the record, namespace ownership. Whether the endpoint answers, and what tools it
lists, is established later by Tracy's prober on its own schedule. A freshly merged record therefore
carries no evidence, which is the same state a scanned record sits in before it has been probed.

```bash
pnpm install && pnpm test && pnpm validate
```

## How this repo is produced

`data/` is the raw output of `scripts/export-registry.php` in the private repo `TracyHQ/tracy.ai`,
pushed across by `scripts/publish-registry.sh`. This repo **does not generate data**; it builds the
served surface and keeps the history.

`dist/` is built by CI and served by Pages; it is not committed. The root of `dist/` is
intentionally empty: `registry.tracy.ai` also serves `skills/` from a different repo, and the root
name is kept unclaimed so it can never become ambiguous.

Routing and cache headers are handled by a Cloudflare Worker configured in
`TracyHQ/tracy.ai:infra/registry-router`. The Pages origin stays at `*.github.io`; the CNAME points
at the Worker.

```bash
node scripts/build-dist.mjs --check   # prove determinism
node scripts/build-dist.mjs           # build dist/
```

## Licensing — dual, and here is the boundary

This repo is dual-licensed. The split is **data** versus **the code that produces it**, which does
not fall neatly along directory lines — so the table names each part explicitly instead of leaving
you to infer it.

| Part | License | File |
|---|---|---|
| `data/servers/**`, `data/findings/**`, `data/export-manifest.json` | **CC BY 4.0** | [`LICENSE-DATA`](./LICENSE-DATA) |
| Everything served at `registry.tracy.ai/mcp/**` | **CC BY 4.0** | [`LICENSE-DATA`](./LICENSE-DATA) |
| Every `.json` / `.ndjson` derived from the above, compressed or not | **CC BY 4.0** | [`LICENSE-DATA`](./LICENSE-DATA) |
| `scripts/build-dist.mjs`, `.github/**` | **MIT** | [`LICENSE`](./LICENSE) |
| `TracyHQ/tracy.ai:infra/registry-router/`, `scripts/validate-registry.py`, `scripts/export-registry.php` | **MIT** | [`LICENSE`](./LICENSE) |

In short: **files you download from `registry.tracy.ai` are CC BY. Files you read to understand how
they were built are MIT.**

### Attribution — copy this line

```
Data: Tracy MCP Registry (https://registry.tracy.ai), CC BY 4.0.
```

### Why CC BY rather than CC0 or ODbL

**Not CC0.** The 2,267 *"asked on this date, found nothing"* findings are this dataset's only real
differentiator — no other registry goes and asks, then publishes the empty answers too. CC BY turns
every reuse into a citation of Tracy; CC0 gives away the credit as well, and credit is the only
thing coming back.

**Not ODbL.** Share-alike on data is legally murky enough that many companies ban ODbL datasets
outright. It would strangle the very thing publishing is for: being integrated by someone.

### What this license cannot grant

The records describe third-party extensions and apps. Names, trademarks, and the linked listings
belong to their respective owners. This license covers **Tracy's compilation, classification and
measurements**, not the things measured.
