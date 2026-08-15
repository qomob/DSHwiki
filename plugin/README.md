# dsh-plugin-hub

> **简体中文** · [English](README.en.md)

在 dsh（DeepSeek Harness）里直接发现、评估并**安装**社区插件：

- **`plugin_search`** — 按关键词 / 分类检索 dsh 社区插件生态，返回简介、星标、分类、仓库链接与**安装命令**。
- **`plugin_info`** — 查询单个插件仓库的详情，并做**安装核验**（目标仓库是否有 `dsh.bundle`/`dsh.client` 声明、是否带安装期脚本、是否 monorepo 子目录包）。
- **`plugin_install`** — 代理安装：核验目标 manifest → 生成真实安装命令与风险提示 → **经用户审批**后执行 `dsh plugin --profile <name> add <spec>`，装后做**结构核验**（确认实际安装的包名与 bundle 层是否落盘）。
- **`plugin_remove`** — 代理卸载：对称于安装，审批门 + dryRun + 结构核验（bundle 层是否移除）。
- **供应链信任分级** — 每日审计作业为目录内每个插件计算 `Verified / Community / Unverified` 分级（manifest 干净度、安装期脚本、归档、活跃度、许可证），卡片徽章 + 侧栏「已验证」过滤 + `plugin_install` 可设 `trustPolicy: 'verified-only'` 直接拒绝未验证来源。
- **Web UI「插件」tab（插件市场）** — 会话视图环（对话 / 轨迹之后）的目录浏览页，布局镜像 dsh.qomob.ai：左侧粘性分类侧边栏（色点 + 标签 + mono 计数 + 已安装过滤行），右上搜索 / 排序 / 刷新，下方卡片流；窄容器经容器查询自动折叠为单列横滚分类条：
  - 搜索（中英文 + topics）、16 分类、相关度 / 星标 / 最近更新 / **新上架**排序
  - **已安装状态**：经官方 `pluginInventory` remote 读取当前 profile 的加载器清单——卡片绿色「已安装」徽章（含运行状态点）、侧栏「已安装」过滤行，以及「已安装·不在目录」健康列表（社区组合包 + 运行/失败状态）
  - **信任信号**：新上架徽章（收录 14 天内，`firstSeenAt` 跨同步保留）、「久未更新」警示（一年未动）、official 徽章、语言色点
  - **VS Code 风格详情面板**：标识符（安装规格）/ 版本 / 上次更新 / 发布 / 大小（仓库体积）/ 许可证 / 扩展资源（仓库·主页·许可证）/ 自动更新说明；已安装时一键复制卸载命令；信任核验信号逐条展示
  - 离线内嵌快照 + 打开时在线刷新（jsDelivr → raw 双镜像）+ 手动刷新

数据来自三层：

1. **内嵌注册表快照**（默认，离线可用）—— 由 [DSH 工坊](https://dsh.qomob.ai) 的聚合管线每日生成（GitHub topic 白名单 + awesome 精选 + 相关性过滤 + 16 类自动分类 + 中文简介），随包分发（宿主工具与 Web UI「插件」tab 各内嵌一份），无需任何网络与 Token。
2. **运行时自动刷新**（默认开启）—— 插件启动时及此后每 24 小时，后台从仓库下载最新快照（CI 每日提交的 `plugin/data/registry.json`），**已安装的插件无需重装即可持续拿到每日新采集**。下载失败（离线 / 被墙 / 源不可达）时静默保留当前快照，绝不影响可用性。「插件」tab 打开时也会尝试 jsDelivr → raw 双镜像在线刷新。
3. **Live GitHub 搜索**（可选 `source: "live"`）—— 实时按 `topic:dsh-plugin → topic:dsh → topic:deepseek-harness` 链式检索 GitHub，套用与聚合管线一致的相关性门槛，适合找快照尚未收录的新插件。

装好之后，对你的 agent 说：「帮我找一个 dsh 的桌面通知插件」即可。

---

## 安装

要求：`dsh` ≥ `0.1.0-rc.6`（Node ≥ 18.17）。本包为**纯 JavaScript ESM，无构建步骤**——从 git 安载不需要 `prepare` 脚本，也就**不需要 pnpm 构建授权**（`allowBuilds`）。

### 从 GitHub 安装（本仓库的 plugin 子目录）

```bash
# 创建/使用一个 profile（首次会自动初始化）
dsh plugin --profile myhub add "github:qomob/dsh#path:/plugin"

# 验证层组合（应看到 "# == dsh-plugin-hub" 分层与 plugin-hub 行）
dsh --profile myhub --dump-config

# 启动
dsh --profile myhub
```

> pnpm 子目录语法为 `#path:/plugin`（pnpm ≥ 9）。要锁定某个 commit：
> `dsh plugin --profile myhub add "github:qomob/dsh#<sha>&path:/plugin"`
> （git 安装本质是拉源码，锁定 commit 更安全。）

### 从本地目录 / tarball / npm 安装

```bash
# 本地 checkout
dsh plugin --profile myhub add ./plugin

# tarball（无需任何构建权限，适合离线分发）
cd plugin && pnpm pack
dsh plugin --profile myhub add ./dsh-plugin-hub-0.1.1.tgz

# 若已发布到 npm
dsh plugin --profile myhub add dsh-plugin-hub
```

### 卸载 / 更新

```bash
dsh plugin --profile myhub remove dsh-plugin-hub   # 移除依赖与对应层
dsh plugin --profile myhub add "github:qomob/dsh#path:/plugin"  # 重新 add 即更新
```

### 在 Web UI 中使用

启动后打开 `http://127.0.0.1:3080`：

- **「插件」tab**：会话页顶部视图环（对话 / 轨迹 / **插件**）——目录浏览、搜索、分类过滤、复制安装命令；离线内嵌快照 + 打开时在线刷新。
- **对话方式**：「帮我找一个 dsh 的桌面通知插件」→ agent 用 `plugin_search` 找、「确认后装上」→ agent 走 `plugin_install`（会弹审批确认）。

插件注册了 Web 风格的结果卡片（可引用来源列表），工具卡片在会话流中直接可点。

### 安装闭环与安全设计

`plugin_install` 的执行门：

1. **核验先行** — 拉取目标仓库根 `package.json`：确认 `dsh.bundle` 声明、检测安装期脚本（`prepare`/`preinstall`…）、识别 monorepo 子目录包（提示需要 `#path:` 规格）。核验失败会把风险写进计划，而不是盲目给命令。
2. **审批门** — 组合里有 `approval` 服务（`dsh-base` 内置）时，执行前在 Web UI 弹出交互审批，**只有 `allowed-once` 才继续**；无审批服务（如 headless）时要求显式 `confirm: true` 参数，否则只返回命令。
3. **受控执行** — 只 spawn `dsh plugin --profile <name> add <spec>`（无 shell、带超时、输出封顶），pnpm 构建授权失败时给出 `allowBuilds` 修复提示；成功后提示重启 profile 与 `--dump-config` 验证。

安全提醒（与官方 publish 文档一致）：git 安装允许目标仓库的代码在你机器上执行 prepare 脚本。本插件的核验会在**事前**标出这一风险；请只安装信任来源，必要时锁定 commit（`github:owner/repo#<sha>`）。

---

## 配置

所有可调参数都是配置字段（加载时经 Schemastery 校验，非法值会让插件**响亮地**加载失败）。默认值开箱即用；如需覆盖，在你 profile 的 `cordis.patch.yml` 里覆盖该行（注意：patch 会**整体替换**该行 config，未写的键回落到 schema 默认值）：

```yaml
- id: plugin-hub
  name: dsh-plugin-hub
  config:
    githubToken: ghp_xxx
    maxResults: 12
```

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `githubToken` | string | `''` | GitHub API Token，提升 live 搜索配额；未设置时回落读环境变量 `DSH_PLUGIN_HUB_TOKEN` |
| `apiBaseUrl` | string | `https://api.github.com` | GitHub API 地址，可指向代理镜像 |
| `maxResults` | number | `8` | `plugin_search` 默认返回条数（1–20） |
| `liveTimeoutMs` | number | `15000` | live 请求超时（毫秒），同时作为工具的协作超时预算 |
| `systemPromptGuidance` | boolean | `true` | 是否注册系统提示词引导（教模型何时用 plugin_search） |
| `autoRefresh` | boolean | `true` | 是否启用运行时快照自动刷新（启动时 + 每 `refreshIntervalHours` 小时一次） |
| `registryUrl` | string | `…raw.githubusercontent.com/qomob/dsh/main/plugin/data/registry.json` | 快照下载地址；raw.githubusercontent.com 不可达时可换 `cdn.jsdelivr.net/gh/qomob/dsh@main/plugin/data/registry.json` 等镜像 |
| `refreshIntervalHours` | number | `24` | 刷新间隔（小时，1–720） |
| `refreshTimeoutMs` | number | `10000` | 每次快照下载的超时（毫秒） |
| `installEnabled` | boolean | `true` | 是否注册 `plugin_install` 工具（代理执行安装；不想给 agent 安装能力就关掉） |
| `dshBin` | string | `''` | `plugin_install` 用的 dsh CLI 路径；空 = 自动检测（`DSH_PLUGIN_HUB_DSH_BIN` 环境变量 → 当前进程 → PATH） |
| `installTimeoutMs` | number | `300000` | 一次安装执行的超时（毫秒，pnpm 可能较慢） |
| `trustPolicy` | string | `ask` | 安装信任门：`ask`（默认，分级只作提示，仍走审批门）/ `verified-only`（拒绝非 Verified 分级，直接返回 blocked） |

---

## 工具参考

### `plugin_search`

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `query` | string | 否 | 关键词，匹配名称 / 简介（中英）/ topics，多词 AND |
| `category` | string | 否 | 分类过滤：`core` `orchestration` `interface` `terminal` `skin` `vision` `memory` `workflow` `communication` `engineering` `toolset` `skill` `awesome` `extension` `other` / `all` |
| `sort` | string | 否 | `relevance`（默认）/ `stars` / `updated` |
| `limit` | integer | 否 | 1–20 |
| `source` | string | 否 | `registry`（仅离线快照）/ `live`（仅 GitHub）/ `auto`（默认：快照优先，无命中时自动补一次 live） |

返回规范值：`{ source, total, returned, truncated, plugins: [{ fullName, description, descriptionZh?, stars, category, categoryLabel, official, installCmd, url, ... }], note? }`，渲染为带安装命令的 Markdown 列表。

### `plugin_info`

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `repo` | string | 是 | 仓库全名，如 `NanmiCoder/dsh-agent-teams` |
| `live` | boolean | 否 | `true` 时强制从 GitHub 拉取最新数据；默认优先快照，快照未收录时自动尝试 live。live 结果附**安装核验**（manifest 事实与风险） |

### `plugin_install`

| 参数 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `repo` | string | 是 | 目标仓库全名 |
| `profile` | string | 否 | 目标 profile（默认：当前运行中的 profile） |
| `dryRun` | boolean | 否 | 只核验并返回确切命令与风险，不执行 |
| `confirm` | boolean | 否 | 审批服务不可用时执行所需的显式确认（务必先征得用户同意） |

---

## 数据来源与每日更新链路

```
GitHub Actions（每日 08:00 北京时间 / 每次 push）
  聚合采集新插件 → src/data/repos.json
  同步 → plugin/data/registry.json → 自动提交
                ↓ （每日一次，运行时后台下载）
  已安装插件：启动时 + 每 24h 拉取最新快照（校验通过才替换，失败保留现快照）
```

- 内嵌快照：`data/registry.json`（328+ 插件），由本仓库 CI 在每日聚合后运行 `node plugin/scripts/sync-registry.mjs` 自动刷新并提交。
- 运行时刷新：默认每 24 小时从 `registryUrl` 下载最新快照并原子替换；下载内容经字段校验（不合法整单丢弃），离线 / 超时 / 源不可达一律静默保留当前数据。不想要任何后台请求的用户可设 `autoRefresh: false`。
- 手动刷新：修改 `src/data/repos.json` 后，在 `plugin/` 下执行 `npm run sync-registry`。脚本带 schema 校验——输入不合法时中止且**不覆盖**上一次的好快照。
- Live 搜索无 Token 时受 GitHub 匿名配额限制（约 10 次/分钟）；配额耗尽会返回可操作的错误信息（提示配置 `githubToken`），不会卡死会话。

## 开发

```bash
cd plugin
pnpm install
npm test              # 44 个单元测试（node:test，无网络）
npm run build-client  # 重建 Web UI「插件」tab 产物（client.js，需提交）
npm run smoke         # 端到端：真实 cordis loader + 真实 dsh-tools 管线执行工具
```

目录结构：

```
plugin/
├── index.js              # 插件入口：Config + apply + 三个 defineTool 工具
├── client.js             # Web UI「插件」tab 的预构建浏览器产物（提交入库，安装零构建）
├── client-src/           # tab 的源码（esbuild 打包 → client.js）
├── cordis.patch.yml      # bundle 层：插入 plugin-hub 插件行
├── src/
│   ├── categories.js     # 16 类分类推断 + 相关性门槛 + 评分（移植自聚合管线）
│   ├── registry.js       # 内嵌快照加载与纯函数检索
│   ├── live.js           # GitHub 客户端（topic 链回退、限流/超时错误面、manifest 拉取）
│   ├── install.js        # 安装核验（manifest 分析/风险）+ 命令构建 + 受控执行
│   ├── refresh.js        # 运行时快照自动刷新（校验 + 原子替换 + 静默降级）
│   └── format.js         # 模型向 Markdown 渲染 + Web 结果卡片投影
├── data/registry.json    # 内嵌快照（CI 每日刷新）
├── scripts/              # sync-registry / build-client
├── tests/                # 单元测试（fetch/spawn 打桩，无网络）
└── smoke/                # 端到端冒烟（cordis.yml + driver）
```

实现要点：

- **bundle + client 双面**：`package.json` 的 `dsh.bundle.patch` 指向 `cordis.patch.yml`（宿主面）；`dsh.client.platform: "web"` + `exports["./client"]` 声明浏览器面——宿主的 client-modules 服务自动扫描、挂 `/plugins/<id>/client.js` 并注入 `window.__DSH_BOOT__` 启动图。
- **客户端产物格式**：`window.__ModuleLoader__.load({ id, factory })` 的惰性 CJS 工厂；React 与 `@deepseek-ai/*` 保持 external，由 shell 模块表在运行时供给。「插件」tab 经 `conversation.view` Slot 注册（`order: 20`，排在对话/轨迹之后），主题跟随 `--dsw-alias-*` token 明暗双主题。
- **`inject: ['tools']`**：硬依赖工具注册表（dsh-base 必然提供）；注册本身是 effect，卸载/热替换时自动撤销。
- **系统提示词引导**是可选能力：以 `inject: ['systemPrompt']` 的**子插件**形态挂载——没有该服务的组合里它安静 PENDING，出现了就自动挂上（依赖跟踪是持续的）。
- **审批门**：`plugin_install` 优先走组合里的 `approval` 服务（`request()` 交互审批，仅 `allowed-once` 放行）；无审批服务时要求显式 `confirm: true`。执行只 spawn 受控命令（无 shell、超时、输出封顶）。
- **无损 JSON 纪律**：工具返回值不得包含 `undefined`（会整单被判为非法输出）——所有可选字段都是条件写入。

## 💬 加入社群

扫码加入微信社群，交流 dsh 插件用法与开发：

<div align="center">

<img src="https://github.com/qomob/dsh/raw/main/wechat.jpg" width="180" alt="微信群二维码" />

</div>

> 二维码失效？到 [Issues](https://github.com/qomob/dsh/issues) 留言更新。

## License

MIT
