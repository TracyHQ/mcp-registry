# Submit your MCP server

This folder is the submission queue. Add one JSON file, open a pull request, and once it merges your
server appears in the public index at `https://registry.tracy.ai/mcp/servers/index.json`.

You do not need to ask permission first, and you do not need a Tracy account.

## The file

One file per server, at `registry/<namespace>/<server>.json`:

```
registry/io.github.acme/orders.json
```

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.acme/orders",
  "description": "Read and refund Acme orders.",
  "version": "1.2.0",
  "websiteUrl": "https://acme.com/mcp",
  "repository": { "url": "https://github.com/acme/mcp-orders", "source": "github" },
  "remotes": [{ "type": "streamable-http", "url": "https://mcp.acme.com/mcp" }]
}
```

Every field is from the official [`server.json`](https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json)
schema. Nothing here is a Tracy invention, so the same file is publishable to the official MCP
registry unchanged.

| Field | |
|---|---|
| `name` | `{namespace}/{server}`, and it must match the file path |
| `description` | 1–100 characters, what the server does |
| `version` | your server's version |
| `remotes` or `packages` | at least one — otherwise nothing can reach the server |
| `websiteUrl`, `repository` | optional |

If people install your server rather than call it over the network, use `packages` instead of
`remotes`:

```json
"packages": [{ "registryType": "npm", "identifier": "@acme/mcp-orders", "version": "1.2.0" }]
```

## Namespaces are proven, not claimed

Today one form is supported:

```
io.github.{your-github-org-or-user}
```

The namespace must be a GitHub owner you control — `io.github.acme` means the `acme` GitHub account.
Nobody can take a name that is not theirs.

Domain-verified namespaces such as `com.acme` are not implemented yet. If you need one, open an
issue and say so; that is the signal we are waiting for.

**`wordpress`, `joomla` and `shopify` are reserved.** Records under those namespaces are produced by
Tracy scanning the public directories, and a submission there would replace a measurement with a
claim. Use your own namespace instead — your server will sit in the same index either way.

## What CI checks, and what it does not

A pull request is checked against pure rules only:

- the file parses, and matches the schema above
- the path matches the `name` inside the file
- the namespace is one you can prove you own
- no unknown fields, so a typo is caught rather than ignored

**CI never contacts your server.** Nothing here connects to your endpoint, sends traffic, or needs a
credential. Whether your server answers, and what tools it exposes, is established separately by
Tracy's prober on its own schedule.

That means a freshly merged record carries no evidence yet. That is normal, and it is the same state
a scanned record sits in before it has been probed.

Run the same checks locally before opening the PR:

```bash
pnpm install
pnpm validate
```

## After it merges

The index rebuilds and publishes automatically. Your record appears at:

```
https://registry.tracy.ai/mcp/servers/index.json
https://registry.tracy.ai/mcp/servers/io.github.acme/orders.json
```

To change or remove your record later, open another pull request against the same file. It is yours.

## Two kinds of record share this index

Browsing the index you will see two shapes of `name`, and the shape tells you where a record came
from:

| `name` looks like | Where it came from |
|---|---|
| `io.github.acme/orders` | someone submitted it here |
| `wordpress/woocommerce` | Tracy found it by scanning a public directory |

There is no trust flag to read — the namespace is the signal.

## Questions

Open an issue. If something in this page was unclear enough that you had to guess, that is worth an
issue too.
