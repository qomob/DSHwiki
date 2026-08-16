# dsh-plugin-hub

> **English** · [简体中文](README.md)

Discover, evaluate, and **install** community plugins right inside dsh (DeepSeek Harness):

- **`plugin_search`** — Keyword / category search over the dsh community ecosystem, returning description, stars, category, repo link, and the **install command**.
- **`plugin_info`** — Details for one plugin repo plus **install verification** (does the target declare `dsh.bundle`/`dsh.client`, does it ship install-time scripts, is it a monorepo subdirectory package).
- **`plugin_install`** — Agent-driven install: verify the target manifest → produce the real install command and risk notes → execute `dsh plugin --profile <name> add <spec>` **behind user approval**, then run a **structural verification** (the actual installed package name and whether its bundle layer landed).
- **`plugin_remove`** — Agent-driven uninstall: symmetric to install (approval gate + dryRun + structural verification of the removed layer).
- **Supply-chain trust tiers** — a nightly audit computes `Verified / Community / Unverified` for every catalog entry (manifest cleanliness, install-time scripts, archived, activity, license): card badges, a "Verified" sidebar filter, and `plugin_install` supports `trustPolicy: 'verified-only'` to refuse non-verified sources outright.
- **Web UI "Plugins" tab (plugin marketplace)** — A directory page in the session view ring (after Chat / Trajectory), mirroring dsh.qomob.ai: sticky left category sidebar (color dot + label + mono count + installed filter row), search / sort / refresh at the top right, card flow below; collapses into a single-column horizontal strip on narrow containers via container queries:
  - Search (Chinese/English + topics), 16 categories, relevance / stars / recently-updated / **new listings** sorting
  - **Installed state** — reads the current profile's loader inventory via the official `pluginInventory` remote: green "Installed" badges on cards (with a runtime-status dot), an "Installed" sidebar filter row, and an "Installed · not in catalog" health list (community bundles + running/failed status)
  - **Trust signals** — "New" badge (listed within 14 days; `firstSeenAt` preserved across syncs), "Stale" warning (untouched for a year), official badge, language color dots
  - **VS Code-style detail panel**: identifier (install spec) / version / last updated / published / size (repo size) / license / extension resources (repo·homepage·license) / auto-update note; one-click copy of the uninstall command when installed; trust signals listed individually
  - Offline embedded snapshot + on-open online refresh (jsDelivr → raw mirrors) + manual refresh

### 📸 UI Preview

Real rendering of the "Plugins" tab (registered via `conversation.view`, light & dark themes):

| Catalog (light) | VS Code-style detail (light) | Catalog (dark) |
|---|---|---|
| ![Catalog](https://github.com/qomob/dsh/raw/main/docs/screenshots/tab-light-collapsed.png) | ![Detail panel](https://github.com/qomob/dsh/raw/main/docs/screenshots/tab-light-detail.png) | ![Dark theme](https://github.com/qomob/dsh/raw/main/docs/screenshots/tab-dark-collapsed.png) |

Data comes from three layers:

1. **Embedded registry snapshot** (default, works offline) — generated daily by the [DSH Workshop](https://dsh.qomob.ai) aggregation pipeline (GitHub topic whitelist + awesome curation + relevance filtering + 16-category auto-classification + Chinese descriptions), shipped with the package (one copy each for the host tools and the Web UI tab); no network or token needed.
2. **Runtime auto-refresh** (on by default) — at startup and then every 24 hours, the plugin downloads the latest snapshot in the background (the CI-committed `plugin/data/registry.json`), so **installed plugins keep receiving daily updates without a reinstall**. Download failures (offline / blocked / unreachable) silently keep the current snapshot — availability is never affected. The "Plugins" tab also refreshes online on open via the jsDelivr → raw mirrors.
3. **Live GitHub search** (optional, `source: "live"`) — searches GitHub in real time over the `topic:dsh-plugin → topic:dsh → topic:deepseek-harness` chain, applying the same relevance gate as the aggregation pipeline; ideal for plugins the snapshot hasn't collected yet.

Once installed, just tell your agent: "Find me a dsh desktop-notification plugin."

---

## Installation

Requirements: `dsh` ≥ `0.1.0-rc.6` (Node ≥ 18.17). This package is **plain JavaScript ESM with no build step** — git installs need no `prepare` script and therefore **no pnpm build authorization** (`allowBuilds`).

### From GitHub (the `plugin` subdirectory of this repo)

```bash
# Create/use a profile (initialized automatically on first use)
dsh plugin --profile myhub add "github:qomob/dsh#path:/plugin"

# Verify the layer composition (you should see a "# == dsh-plugin-hub" layer and the plugin-hub row)
dsh --profile myhub --dump-config

# Launch
dsh --profile myhub
```

> The pnpm subdirectory syntax is `#path:/plugin` (pnpm ≥ 9). To pin a commit:
> `dsh plugin --profile myhub add "github:qomob/dsh#<sha>&path:/plugin"`
> (git installs pull source; pinning a commit is safer.)

### From a local directory / tarball / npm

```bash
# Local checkout
dsh plugin --profile myhub add ./plugin

# Tarball (no build permissions needed; good for offline distribution)
cd plugin && pnpm pack
dsh plugin --profile myhub add ./dsh-plugin-hub-0.1.1.tgz

# If published to npm
dsh plugin --profile myhub add dsh-plugin-hub
```

### Uninstall / Update

```bash
dsh plugin --profile myhub remove dsh-plugin-hub   # Removes the dependency and its layer
dsh plugin --profile myhub add "github:qomob/dsh#path:/plugin"  # Re-add to update
```

### Using the Web UI

After launching, open `http://127.0.0.1:3080`:

- **"Plugins" tab**: the view ring at the top of a session (Chat / Trajectory / **Plugins**) — browse, search, filter by category, copy install commands; offline embedded snapshot + online refresh on open.
- **Conversational**: "Find me a dsh desktop-notification plugin" → the agent uses `plugin_search`; "install it after I confirm" → the agent calls `plugin_install` (an approval prompt appears).

The plugin registers web-style result cards (citeable source lists); tool cards are clickable in the conversation flow.

### The Install Loop and Security Design

The gates `plugin_install` passes through:

1. **Verify first** — Fetch the target repo's root `package.json`: confirm the `dsh.bundle` declaration, detect install-time scripts (`prepare`/`preinstall`…), and recognize monorepo subdirectory packages (hinting at a `#path:` spec). Verification failures are written into the plan as risks instead of blindly producing a command.
2. **Approval gate** — When the composition provides the `approval` service (built into `dsh-base`), an interactive approval pops in the Web UI before execution; **only `allowed-once` proceeds**. Without an approval service (e.g. headless), an explicit `confirm: true` argument is required — otherwise only the command is returned.
3. **Controlled execution** — Spawns exactly `dsh plugin --profile <name> add <spec>` (no shell, with timeout and capped output); pnpm build-authorization failures get an `allowBuilds` fix hint; success prompts a profile restart and `--dump-config` verification.

Security note (consistent with the official publish docs): a git install allows the target repo's code to run `prepare` scripts on your machine. This plugin's verification flags that risk **up front**; only install from trusted sources, and pin a commit when in doubt (`github:owner/repo#<sha>`).

---

## Configuration

Every tunable is a config field (validated by Schemastery at load; invalid values fail the plugin **loudly**). Defaults work out of the box; to override, patch the row in your profile's `cordis.patch.yml` (note: a patch **replaces** the row's whole config — omitted keys fall back to schema defaults):

```yaml
- id: plugin-hub
  name: dsh-plugin-hub
  config:
    githubToken: ghp_xxx
    maxResults: 12
```

| Field | Type | Default | Description |
|---|---|---|---|
| `githubToken` | string | `''` | GitHub API token to raise live-search quota; falls back to the `DSH_PLUGIN_HUB_TOKEN` env var |
| `apiBaseUrl` | string | `https://api.github.com` | GitHub API base URL; point at a proxy mirror if needed |
| `maxResults` | number | `8` | Default number of results from `plugin_search` (1–20) |
| `liveTimeoutMs` | number | `15000` | Live-request timeout (ms); also the tool's cooperative timeout budget |
| `systemPromptGuidance` | boolean | `true` | Register system-prompt guidance (teaches the model when to use plugin_search) |
| `autoRefresh` | boolean | `true` | Enable runtime snapshot auto-refresh (at startup + every `refreshIntervalHours`) |
| `registryUrl` | string | `…raw.githubusercontent.com/qomob/dsh/main/plugin/data/registry.json` | Snapshot download URL; switch to a mirror like `cdn.jsdelivr.net/gh/qomob/dsh@main/plugin/data/registry.json` when raw.githubusercontent.com is unreachable |
| `refreshIntervalHours` | number | `24` | Refresh interval (hours, 1–720) |
| `refreshTimeoutMs` | number | `10000` | Per-download timeout (ms) |
| `installEnabled` | boolean | `true` | Register the `plugin_install` tool (agent-driven installs; turn off to deny install capability) |
| `dshBin` | string | `''` | Path to the dsh CLI used by `plugin_install`; empty = auto-detect (`DSH_PLUGIN_HUB_DSH_BIN` env → current process → PATH) |
| `installTimeoutMs` | number | `300000` | Timeout for one install execution (ms; pnpm can be slow) |
| `trustPolicy` | string | `ask` | Install trust gate: `ask` (default, tier is advisory, approval gate still decides) / `verified-only` (refuses non-verified tiers, returns blocked) |

---

## Tool Reference

### `plugin_search`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `query` | string | no | Keywords matched against name / description (Chinese & English) / topics; multiple words AND |
| `category` | string | no | Category filter: `core` `orchestration` `interface` `terminal` `skin` `vision` `memory` `workflow` `communication` `engineering` `toolset` `skill` `awesome` `extension` `other` / `all` |
| `sort` | string | no | `relevance` (default) / `stars` / `updated` |
| `limit` | integer | no | 1–20 |
| `source` | string | no | `registry` (offline snapshot only) / `live` (GitHub only) / `auto` (default: snapshot first, one live attempt when it has no match) |

Canonical return value: `{ source, total, returned, truncated, plugins: [{ fullName, description, descriptionZh?, stars, category, categoryLabel, official, installCmd, url, ... }], note? }`, rendered as a Markdown list with install commands.

### `plugin_info`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `repo` | string | yes | Repository full name, e.g. `NanmiCoder/dsh-agent-teams` |
| `live` | boolean | no | `true` forces fresh GitHub data; defaults to the snapshot, falling back to live when the repo isn't collected. Live results include **install verification** (manifest facts and risks) |

### `plugin_install`

| Parameter | Type | Required | Description |
|---|---|---|---|
| `repo` | string | yes | Target repository full name |
| `profile` | string | no | Target profile (default: the profile this dsh is running) |
| `dryRun` | boolean | no | Verify and return the exact command + risks without executing |
| `confirm` | boolean | no | Explicit confirmation required to execute when no approval service is available (always ask the user first) |

---

## Data Sources and the Daily Update Chain

```
GitHub Actions (daily 08:00 Beijing / every push)
  Aggregate new plugins → src/data/repos.json
  Sync → plugin/data/registry.json → auto-commit
                 ↓ (once a day, background download at runtime)
  Installed plugin: at startup + every 24h pulls the latest snapshot
  (replaced only after validation; failures keep the current one)
```

- Embedded snapshot: `data/registry.json` (328+ plugins), refreshed and committed by this repo's CI after each daily aggregation via `node plugin/scripts/sync-registry.mjs`.
- Runtime refresh: every 24 hours by default, downloads the latest snapshot from `registryUrl` and swaps atomically; downloads are field-validated (invalid payloads are dropped wholesale); offline / timeout / unreachable all silently keep the current data. Set `autoRefresh: false` for zero background requests.
- Manual refresh: after editing `src/data/repos.json`, run `npm run sync-registry` inside `plugin/`. The script schema-validates — invalid input aborts and **never overwrites** the last good snapshot.
- Live search without a token is subject to GitHub's anonymous quota (~10 requests/min); when exhausted, it returns an actionable error (suggesting `githubToken`) instead of hanging the session.

## Development

```bash
cd plugin
pnpm install
npm test              # 44 unit tests (node:test, no network)
npm run build-client  # Rebuild the Web UI tab artifact (client.js; commit it)
npm run smoke         # End-to-end: real cordis loader + real dsh-tools pipeline
```

Directory layout:

```
plugin/
├── index.js              # Plugin entry: Config + apply + three defineTool tools
├── client.js             # Prebuilt browser artifact of the tab (committed; installs stay build-free)
├── client-src/           # Tab source (esbuild → client.js)
├── cordis.patch.yml      # Bundle layer: inserts the plugin-hub row
├── src/
│   ├── categories.js     # 16-category inference + relevance gate + scoring (ported from the pipeline)
│   ├── registry.js       # Embedded snapshot loading and pure-function search
│   ├── live.js           # GitHub client (topic-chain fallback, rate-limit/timeout errors, manifest fetch)
│   ├── install.js        # Install verification (manifest analysis/risks) + command building + controlled execution
│   ├── refresh.js        # Runtime snapshot auto-refresh (validation + atomic swap + silent degradation)
│   └── format.js         # Model-facing Markdown rendering + web result-card projection
├── data/registry.json    # Embedded snapshot (CI refreshes daily)
├── scripts/              # sync-registry / build-client
├── tests/                # Unit tests (fetch/spawn stubbed, no network)
└── smoke/                # End-to-end smoke (cordis.yml + driver)
```

Implementation notes:

- **Bundle + client dual face**: `package.json`'s `dsh.bundle.patch` points to `cordis.patch.yml` (host face); `dsh.client.platform: "web"` + `exports["./client"]` declare the browser face — the host's client-modules service scans, serves `/plugins/<id>/client.js`, and injects the `window.__DSH_BOOT__` graph automatically.
- **Client artifact format**: a lazy CJS factory via `window.__ModuleLoader__.load({ id, factory })`; React and `@deepseek-ai/*` stay external, provided by the shell's module table at runtime. The tab registers through the `conversation.view` slot (`order: 20`, after Chat/Trajectory), following `--dsw-alias-*` tokens for both light and dark themes.
- **`inject: ['tools']`**: a hard dependency on the tool registry (always provided by dsh-base); registration is an effect and is undone automatically on unload or hot-replace.
- **System-prompt guidance is optional**: mounted as a child plugin with `inject: ['systemPrompt']` — it stays PENDING quietly in compositions without the service and mounts automatically wherever it appears (dependency tracking is continuous).
- **Approval gate**: `plugin_install` prefers the composition's `approval` service (interactive `request()`; only `allowed-once` proceeds); without it, an explicit `confirm: true` is required. Execution spawns only a controlled command (no shell, timeout, capped output).
- **Lossless-JSON discipline**: tool return values must never contain `undefined` (the whole output would be rejected) — all optional fields are written conditionally.

## 💬 Join the Community

Scan the QR code to join the WeChat group to discuss dsh plugin usage and development:

<div align="center">

<img src="https://github.com/qomob/dsh/raw/main/wechat.jpg" width="180" alt="WeChat group QR code" />

</div>

> QR expired? Leave a note in [Issues](https://github.com/qomob/dsh/issues) for a refresh.

## License

MIT
