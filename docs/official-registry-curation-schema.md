# Curation schema — `_meta["ai.tracy.registry/curation"]`

**Status:** the four-group structure below (`identity`/`measurement`/`classification`/`curation`)
is what `wordpress`/`joomla`/`shopify` ship with today (98 records, migrated 2026-08-05). Not the
same document as
[`tracy-desk/docs/superpowers/specs/2026-08-01-tracy-registry-schema.md`](https://github.com/TracyHQ/tracy-desk/blob/main/docs/superpowers/specs/2026-08-01-tracy-registry-schema.md)
§2.2 — that spec is the aspirational cross-namespace proposal, still "pending final decision". This
document is the schema actually converged on and shipped, drawing from that proposal plus what the
live `wordpress`/`joomla`/`shopify` records already depended on before this migration.

**A note on `official-registry` throughout this document.** The worked example, and most of the
value-range tables below, were built and measured against an `official-registry` namespace (827
records, sourced from `registry.modelcontextprotocol.io`) during the same design pass that produced
this schema — that data is not part of the current drop (held back, not shipped), but the schema
shape itself was validated against those 827 real records before `wordpress`/`joomla`/`shopify` were
migrated to match it, and the numbers are left in place as a real worked example rather than
replaced with placeholders. Where a field is specific to the plugin namespaces instead, see
[Extended fields for `wordpress`/`joomla`/`shopify`](#extended-fields-for-wordpressjoomlashopify-namespace),
which is measured against the 98 records actually shipping.

---

## Why a `_meta` wrapper at all

`server.json` (the official MCP registry schema, tầng 1) is deliberately minimal — its own
roadmap excludes quality ranking, curation, tags, and search entirely, and offers exactly one
sanctioned extension point: `_meta`, keyed by a reverse-DNS string so multiple registries can
annotate the same record without colliding. `TracyHQ/mcp` owns and serves every file in this
namespace outright, so the collision this mechanism guards against isn't live today — the reason
to keep it is that it's the convention the official registry itself uses for its own extension
(`io.modelcontextprotocol.registry/official`), and following it costs nothing once written.

```json
"_meta": {
  "io.modelcontextprotocol.registry/official": { "...": "written by the upstream registry" },
  "ai.tracy.registry/curation": { "...": "everything documented below" }
}
```

## Full example

One real record, in full — `official-registry/ai-analyticslegends-sap-analytics`:

```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "official-registry/ai-analyticslegends-sap-analytics",
  "title": "Analytics Legends — SAP Analytics Intelligence",
  "description": "AI agent for SAP analytics: firms, day rates, contract radar, news, concepts, studies",
  "version": "1.0.0",
  "remotes": [{ "type": "streamable-http", "url": "https://analyticslegends.ai/mcp" }],
  "websiteUrl": "https://analyticslegends.ai",
  "_meta": {
    "ai.tracy.registry/curation": {
      "conformance": "valid",
      "title": "Analytics Legends — SAP Analytics Intelligence",
      "listingUrl": "https://analyticslegends.ai",

      "identity": {
        "operator": { "name": "analyticslegends" },
        "provenance": "official",
        "provenanceConfidence": "stated"
      },

      "measurement": {
        "verification": {
          "endpoint": "tools_listed",
          "checkedAt": "2026-08-04T11:15:19+00:00",
          "checkedUrl": "https://analyticslegends.ai/mcp",
          "httpStatus": "200",
          "confidence": "high"
        },
        "tools": [
          {
            "name": "search_firms",
            "description": "Search the published Analytics Legends directory of SAP analytics service providers by country, kind and free text. Returns name, HQ country/city, website, careers URL and a one-line editorial claim.",
            "annotations": { "readOnlyHint": true },
            "annotationSource": "self-declared"
          }
        ],
        "toolSummary": { "total": 15, "read": 15, "write": 0, "unknown": 0 },
        "authOptions": [{ "type": "open" }],
        "upstreamStatus": "active",
        "upstreamPublishedAt": "2026-07-30T11:41:55.972984Z",
        "upstreamUpdatedAt": "2026-07-30T11:41:55.972984Z"
      },

      "classification": {
        "capability": ["Analytics"],
        "ecosystem": [],
        "pricing": ["unknown"],
        "businessModel": ["unknown"],
        "hosting": "remote-capable"
      },

      "curation": { "tier": "listed" },

      "digest": "sha256:02364c9df1675bed811ebaffa62b33c2e6b4666cb9a0964ca545bb3989d24a99",
      "updatedAt": "2026-08-05T11:53:50+00:00"
    }
  }
}
```

## Structural principle: grouped by kind of claim, not by topic

An earlier draft grouped `status` (the upstream registry's own fact) together with `tier` (Tracy's
editorial judgment) under one `lifecycle` object, because both are loosely about "is this thing
still alive". That's a topic grouping, and it hid a real distinction: one of those two fields is
something Tracy *observed*, the other is something Tracy *decided*. The four top-level groups
below are organized by that distinction instead, and each has a one-line test for where a new
field belongs:

| Group | One-line test |
|---|---|
| `identity` | Who is accountable for this record, and how sure are we? |
| `measurement` | Did we get this by asking the thing directly — no interpretation? |
| `classification` | Did Tracy derive/label this from measurement, for browsing and filtering? |
| `curation` | Has an actual human reviewed this record? |

---

## Field reference

### Top-level (outside the four groups)

| Field | Type | Range (measured) | Meaning |
|---|---|---|---|
| `conformance` | string | `"valid"` (827/827) | Whether this record satisfies the official `server.json` schema's own required fields (`name`, `description`, `version`, at least one of `remotes`/`packages`). Every record here is `"valid"` — unlike `wordpress`/`joomla`/`shopify`, which are `"shaped-not-valid"` because they omit vendor-authored `description` for licensing reasons. This namespace's `description` comes from a vendor's own submission to the official registry, not scraped text, so that constraint doesn't apply. |
| `title` | string \| absent | present on 525/827 | Mirror of the top-level `title`, kept inside curation for tooling that only reads `_meta`. Absent when the vendor's own registry submission never set one — not a bug, `title` isn't required by the official schema. |
| `listingUrl` | string (URL) \| absent | `websiteUrl`, falling back to `repository.url` | Where a human can read more about this specific server. No dedicated "listing page" exists on the official registry itself the way `wordpress.org/plugins/{slug}` does for wporg — this is the closest equivalent. |
| `digest` | string | `"sha256:" + 64 hex chars` | SHA-256 of the record's own canonical (deep-sorted-keys) JSON, excluding `digest` and `updatedAt` themselves. Same mechanism `TracyHQ/skills` already uses to pin a `curated` tier to a specific content hash rather than a record's name — reused, not reinvented. Answers "did the content actually change"; `updatedAt` answers "when did that last happen" — the two are not substitutes for each other. |
| `updatedAt` | string (ISO 8601) | e.g. `"2026-08-05T11:53:50+00:00"` | When this specific file was last (re)generated by the build script. Not present anywhere else in this repo before this namespace — none of `servers/`, `findings/`, or the pending cross-namespace spec track it. |

### `identity` — who is accountable, how sure are we

| Field | Type | Range (measured) | Meaning |
|---|---|---|---|
| `operator.name` | string \| absent | e.g. `"analyticslegends"` | Display name for whoever operates this server. Preferred source: the owner segment of `repository.url` (`github.com/{owner}/...`); falls back to the registry namespace's own owner segment (`io.github.{owner}/...` → `{owner}`) when no repository is declared. Absent (not fabricated) when neither source parses. |
| `provenance` | string | `official` 369 · `community` 458 | **Official**: the namespace owner plausibly *is* the thing this record is about — either they operate their own product under their own name (self-operation: the owner's name appears in their own declared `websiteUrl`'s domain), or the owner matches one of the ~10 CMS/commerce platform brands this dataset tracks by keyword (e.g. `shopify` submitting a Shopify server). **Community**: everything else, including "we don't have enough signal to tell" — overclaiming official status is the more dangerous direction to be wrong in, so it's the default. There is no `platform-level` or `tracy` value in this namespace yet (both exist in the cross-namespace proposal but nothing here has matched that shape so far). |
| `provenanceConfidence` | string | `stated` 364 · `inferred` 463 | **Stated**: the record's own declared `websiteUrl` domain corroborates the match — the closest this dataset gets to a vendor-asserted fact, since nothing in the source registry declares provenance directly. **Inferred**: a string-matching heuristic with no corroborating domain, flagged for a human to double-check before treating as fact. |

### `measurement` — asked the thing directly, no interpretation

| Field | Type | Range (measured) | Meaning |
|---|---|---|---|
| `verification.endpoint` | string | `tools_listed` 493 · `auth_required` 334 | Outcome of a live MCP protocol handshake (`initialize` → capture session id → `notifications/initialized` → `tools/list`) against the server's own declared `remotes[]` URL. Only these two values ever reach this namespace — `unreachable`, `endpoint_found` (partial handshake), and `not_probed_*` (local-install-only, or no endpoint declared at all) are excluded before a record gets here at all; see [What's excluded](#whats-deliberately-excluded-from-this-namespace). |
| `verification.checkedAt` | string (ISO 8601) | e.g. `"2026-08-04T11:15:19+00:00"` | When the handshake above was run. |
| `verification.checkedUrl` | string (URL) | the exact `remotes[].url` that answered | Which declared remote actually completed the handshake, when more than one was listed (7/225 records in the original batch declared the same URL twice, once per transport). |
| `verification.httpStatus` | string | e.g. `"200"`, `"401"` | Raw HTTP status of the `initialize` call. String, not int — matches how `wordpress`/`joomla`/`shopify` already encode this field. |
| `verification.confidence` | string | `high` (`tools_listed`, 493) · `medium` (`auth_required`, 334) | High: a real tool list was observed. Medium: the endpoint is confirmed real (it answered the MCP handshake) but gated behind credentials Tracy doesn't hold — real evidence, just weaker than an actual tool list. |
| `tools[].name` | string | — | Verbatim from the server's own `tools/list` response. |
| `tools[].description` | string \| absent | present on 7406/7489 tool entries (99%) | Verbatim from `tools/list`, re-probed specifically to capture this — the first probe pass only persisted tool names. Absent on 8 servers whose endpoint didn't answer on re-probe (transient — a re-run days later may recover them; not treated as a negative). |
| `tools[].annotations.readOnlyHint` | boolean \| absent | — | `true` for tools classified `read`, `false` for `write`. Absent entirely (not `null`) when neither the server declared an annotation nor Tracy's verb heuristic reached a confident verdict — see `annotationSource: "absent"` below. |
| `tools[].annotationSource` | string | `self-declared` 3474 · `tracy-inferred` 2025 · `absent` 1990 | **Self-declared**: the server itself returned `annotations.readOnlyHint`/`destructiveHint` in `tools/list` — a claim from an untrusted source per the MCP spec's own warning, but recorded as what it is. **Tracy-inferred**: no such declaration existed, so Tracy classified by a verb-prefix heuristic on the tool's name (`get_`/`list_`/`search_` → read; `create_`/`update_`/`delete_` → write) — a fourth value the pending cross-namespace spec's three-value enum has no slot for, added because roughly a third of all tools hit this path in practice, not a rare edge case. **Absent**: neither signal resolved confidently — left unclassified rather than guessed. |
| `toolSummary.{total,read,write,unknown}` | integers | e.g. `{15, 15, 0, 0}` | Rollup of `tools[]` above, materialized so a UI doesn't have to recompute the "X tools · Y read · Z write" headline number from the array every time. Only present when `verification.endpoint == "tools_listed"` — absent (not zeroed) for `auth_required` records, since no tool list was ever observed for them. |
| `authOptions[].type` | string | `open` 493 · `unknown` 224 · `other_credential` 73 · `api_key` 26 · `oauth` 15 | What credential, if any, the endpoint expects. `open`: no credential needed (mirrors every `tools_listed` record 1:1). For `auth_required` records: derived from the server's own declared `remotes[].headers[]` and/or the literal text of its 401/403 JSON-RPC error message where one was recoverable; `unknown` when neither source said anything specific (224/334 auth_required records — the majority; this is the field's honest current limitation, not a bug). |
| `authOptions[].detail.sources[]` | array \| absent | present only for `type: "api_key"` | The declared header name(s) (e.g. `X-API-Key`), when the server named one. |
| `upstreamStatus` | string | `active` (827/827 so far) | The official registry's own `status` for this server (`active`/`deprecated`/`removed`) — an observed fact from upstream, which is why it lives in `measurement` and not `classification` (an earlier draft nested it under a `lifecycle.status` alongside Tracy's own curation tier; caught in review as mixing two different kinds of claim in one object). |
| `upstreamPublishedAt` / `upstreamUpdatedAt` | string (ISO 8601) | — | Timestamps the official registry itself reports for this record's version history. |
| `github.stars` | integer \| absent | present on 422/827 records | `stargazers_count` via `gh api repos/{owner}/{repo}`, only when `repository.url` points at github.com and the repo still resolves (404/private/renamed → absent, not zero). |
| `github.pushed_at` | string (ISO 8601) \| absent | — | Last push time to the repository, same source and same absence rule as `stars`. |

### `classification` — Tracy's derived labels, for browsing and filtering

Both `capability` and `ecosystem` are **closed vocabularies** — a deliberate choice made during
schema review over an earlier draft that let free-text brand names (e.g. `"sap"`) into `ecosystem`
alongside the platforms this dataset actually tracks by keyword. Closed vocabularies keep a filter
sidebar meaningful; an open one turns into a long tail of one-record tags.

| Field | Type | Range (measured) | Meaning |
|---|---|---|---|
| `capability[]` | array of string, closed set of 5 | `Store Management` 209 · `Billing & Payments` 315 · `Analytics` 190 · `Infrastructure` 142 · `Site Management` 28 | What the server *does*, for the primary browse filter. A record can land in more than one bucket. Derived from `tracy_discovery.matched_keywords` via a fixed keyword→category table (e.g. `stripe`/`invoice`/`checkout` → `Billing & Payments`); see `mcp-crawler/probe/enrich-registry-records.py:CATEGORY_KEYWORDS` in `tracy-scripts` (private) for the exact mapping. |
| `ecosystem[]` | array of string, closed set of 14 | `shopify` 27 · `wordpress` 9 · `wix` 3 · `webflow` 2 · `ecwid` 1 · `magento` 1 · `prestashop` 1 · (`joomla`/`drupal`/`ghost`/`bigcommerce`/`squarespace`/`contentful`/`strapi`: 0 so far) | Which named CMS/storefront platform(s) this integrates with — separate from `capability` on purpose: a "Store Management" record might be Shopify-specific, WooCommerce-specific, or tied to no named platform at all (788/827 records — most of this namespace is standalone SaaS tools, not CMS extensions). Values are lowercase, matching the `wordpress`/`joomla`/`shopify` namespace names elsewhere in this repo. A server can list more than one (e.g. a gateway MCP wrapping both Shopify and PrestaShop). |
| `pricing[]` | array of string | `unknown` (827/827) | Intended range: `free` \| `freemium` \| `paid` \| `unknown`, matching the `wordpress`/`joomla`/`shopify` convention exactly. Currently always `unknown` for this namespace — the official MCP registry publishes no pricing signal for any server, so there is nothing to derive this from yet. Kept as a field (not dropped) because it's a real per-record axis with no measurement method today, not a structural constant — contrast with `directory` below, which *was* dropped for being one. |
| `businessModel[]` | array of string | `unknown` (827/827) | Intended range: `commercial` \| `community` \| `unknown`. Same status as `pricing` — a genuinely different axis (is the *operator* commercial vs. is *this listing's* pricing free — the `wordpress` namespace shows these can diverge, e.g. a commercial company shipping a freemium plugin), currently unpopulated for the same reason. |
| `hosting` | string | `remote-capable` (827/827) | Intended range: `local-only` \| `remote-capable` \| `hybrid`. Always `remote-capable` in this drop because `official-registry-verified.json` was already filtered down to remote-probeable servers before this field was ever computed — packages-only (local-install) candidates were excluded upstream of this step, not because none exist (692 of the original 1,636 full-crawl candidates were exactly that). This field will start varying once/if a local-install-inclusive batch is published under a shape that says so honestly rather than guessing at what an unprobed local server can do. |

**Deliberately removed from an earlier draft:** `directory: ["official-mcp-registry"]` and
`upstream.registry: "https://registry.modelcontextprotocol.io"` — both were identical on
827/827 records, i.e. namespace-level facts, not record-level data. Documented once, here,
instead of repeated 827 times: **every record in `data/servers/official-registry/` is sourced
from `registry.modelcontextprotocol.io`.**

### `curation` — has a human actually reviewed this

| Field | Type | Range (measured) | Meaning |
|---|---|---|---|
| `tier` | string | `listed` (827/827) | `listed` \| `curated` \| `quarantined`, same three values and same meaning `TracyHQ/skills` already uses. `listed` is the default: the record is well-formed and verified by the pipeline, but no human at Tracy has reviewed it yet. Every record here is `listed` because no review pass has happened — this is an honest starting state, not a gap. |

**Deliberately removed from an earlier draft:** `reviewedAt`/`reviewedBy`. Both would be `null` on
827/827 records today — "no reviewer, no review date" carries exactly as much information as the
two keys being absent entirely, so they were cut rather than published as dead weight. Add them
back the day a human first reviews a record in this namespace, not before.

**Also considered and cut:** `operator.verified` (a boolean under `identity`). It was found during
this review to be a 100%-redundant mirror of `provenance == "official"` on every one of 827
records — the same fact encoded under two names. `provenance`/`provenanceConfidence` stay the
single source of truth. A real independent verification signal exists upstream and isn't yet
captured by this pipeline: some vendors publish `_meta["io.modelcontextprotocol.registry/publisher-provided"].namespace_proof`
on their own registry submission — a checkable `.well-known` + public-key proof of namespace
ownership (seen on `ai.analyticslegends/sap-analytics` itself). That's real grounds to bring a
`verified` field back, once a discover pass actually captures it — not before.

---

## Extended fields for `wordpress`/`joomla`/`shopify` namespace

The `ai.tracy.registry/curation` structure supports additional sub-objects under `measurement` in the
`wordpress`/`joomla`/`shopify` namespaces that are not present in `official-registry/`. These fields
capture information unique to plugin/extension/app listings that have public source code or vendor
announcements: **source scanning** (Tracy reading a plugin's own code to find MCP evidence) and
**vendor announcements** (vendors stating MCP support in their own documentation, separate from
endpoint verification).

### `measurement.sourceScan` (migration-specific, plugin namespace only)

| Field | Type | Range (measured) | Meaning |
|---|---|---|---|
| `scannedAt` | string (ISO 8601) | e.g. `"2026-08-02T08:58:08+00:00"` | When the plugin's source code was scanned. |
| `status` | string | `scanned_ok` (only value so far) | Whether the scan completed without errors. |
| `restRoutes` | string | e.g. `"26"` | Count of REST routes extracted from the plugin. |
| `abilitiesExtracted` | string | e.g. `"18"` | Count of potential MCP-relevant abilities detected. |
| `cliCommands` | string | e.g. `"5"` | Count of command-line interfaces the plugin registers. |
| `scanZipVersion` | string | e.g. `"3.1.3"` | Plugin version at scan time. |
| `writeHints` | string | e.g. `"16"` | Count of write/mutation operations found. |

This is sourced entirely from local analysis of the plugin's own repository, answering "does the vendor's own code show MCP integration" — completely independent of whether a live endpoint is discoverable, and distinct from `vendorAnnouncement`.

### `measurement.vendorAnnouncement` (migration-specific, available across namespaces)

| Field | Type | Range (measured) | Meaning |
|---|---|---|---|
| `status` | string | e.g. `official-ga`, `third-party-wrapper`, `community` | What vendor message, if any, Tracy found about MCP support. |
| `surveyedAt` | string (ISO 8601) | e.g. `"2026-08-02"` | When the vendor's documentation was last checked. |
| `evidenceUrl` | string (URL) | e.g. `"https://github.com/..."` | Where that message lives (vendor docs, third-party PR, announcement). |

This answers "did the vendor publish a statement about MCP somewhere," which is a distinct question from `verification.endpoint` ("did Tracy find a live, working endpoint"). A vendor can have announced support without maintaining a live endpoint, or vice versa.

### `classification.installs` (migration-specific, plugin namespace only)

| Field | Type | Range (measured) | Meaning |
|---|---|---|---|
| `count` | integer | e.g. `200000` | Reported active installations, when available. |
| `source` | string | e.g. `"directory-reported"`, `"third-party-measured"` | How the count was obtained (from official directory, from third-party crawler, etc). |

This field does not exist in `official-registry/` because the official MCP registry publishes no install metrics for any server. It is specific to plugin/extension namespaces that can query their hosting platforms' directories.

### Namespace-level constants for `directory` field

The `classification.directory` field (a closed vocabulary across this repository) is identical within each namespace but was deliberately removed from individual records to avoid repetition:

| Namespace | Directory value |
|---|---|
| `data/servers/official-registry/` | `"official-mcp-registry"` |
| `data/servers/wordpress/` | `"wporg-directory"` |
| `data/servers/joomla/` | `"jed"` |
| `data/servers/shopify/` | `"shopify-app-store"` |

Rather than repeating these per record (they would be identical on 827/827, 23/23, 1/1, and 74/74 records respectively), they are documented once here. UI code reading these namespaces should inject the appropriate constant per namespace when displaying or filtering.

---

## What's deliberately excluded from this namespace

`data/servers/official-registry/` only contains records that passed a live verification handshake
as `tools_listed` or `auth_required`. From the 1,972-candidate full crawl of the official registry
(commerce/site-management relevance filtered), everything else was excluded and is not silently
missing — it's accounted for in `tracy-scripts` (private) run metadata:

- **Unreachable** — declared an endpoint that didn't answer on the day it was checked. Not
  published as "this server doesn't exist" (a network failure is not a negative), just not
  included in this namespace's `listed` tier.
- **Local-install-only** (`packages[]`, no `remotes[]`) — verifying these means executing
  arbitrary third-party code unattended, which this pipeline refuses to do. 692 of the 1,636
  candidates in the last full crawl were exactly this.
- **Endpoint found, handshake incomplete** — answered `initialize` but never returned a usable
  tool list.
- **Below the relevance filter** — didn't match the commerce/site-management keyword sweep at all.

## Appendix: how these numbers were produced

Every distribution table above was generated by iterating the real files on disk, not sampled or
estimated:

```bash
cd TracyHQ/mcp
python3 -c "
import json, pathlib
from collections import Counter
c = Counter()
for f in pathlib.Path('data/servers/official-registry').glob('*.json'):
    r = json.load(open(f))
    curation = r['_meta']['ai.tracy.registry/curation']
    c[curation['identity']['provenance']] += 1
print(dict(c))
"
```

Swap the field path inside the loop to recompute any other row in this document against a newer
data drop.
