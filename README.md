<div align="center">

<h1>DSH 工坊 · 一切皆为插件，即刻装备你的DSH</h1>

<p>围绕 <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness (dsh)</a> 的中文社区角落</p>

<p><b>简体中文</b> · <a href="README.en.md">English</a></p>

<p>
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/dsh-Agent%20Framework-6799fe" alt="dsh" /></a>
  <img src="https://img.shields.io/badge/Vite-8-646cff" alt="Vite" />
  <img src="https://img.shields.io/badge/React-19-61dafb" alt="React" />
  <img src="https://img.shields.io/badge/Tailwind-4-38bdf8" alt="Tailwind" />
  <img src="https://img.shields.io/badge/License-MIT-22c55e" alt="License" />
</p>

<p>
  <a href="#快速开始">快速开始</a> · 
  <a href="#ds手册">DSH手册</a> · 
  <a href="#插件聚合">插件聚合</a> · 
  <a href="#部署">部署</a>
</p>

</div>

---

两个栏目，一个站点，外加一个可安装的 dsh 插件：

- **插件库** — 从 DeepSeek Harness 生态里挑出值得尝试的项目，按用途分类陈列（左侧分类侧边栏），每件标注安装方式；英文简介配中文说明。
- **DSH手册** — 按上手路径编排的中文教程：先跑通任务，再把重复劳动沉淀成自己的 AI 工作流。章节可折叠、含可复制的对话示例。
- **dsh-plugin-hub 插件** — [`plugin/`](plugin/) 目录是一个完整的 dsh 组合包（bundle）：装进任意 dsh 后，agent 获得 `plugin_search` / `plugin_info` / `plugin_install` 三个工具（发现 → 核验 → 审批安装闭环），Web UI 会话视图新增「插件」tab 目录浏览页。详见 [`plugin/README.md`](plugin/README.md)。

## ✨ 特性

- **纯静态、零后端** — Vite 构建的 SPA，`dist/` 丢到任意静态托管即可上线
- **自动更新** — GitHub Actions 定时聚合 + push 触发 → 构建 → 自动部署到服务器，全程无人干预
- **插件优先布局** — 插件区在首屏后，左侧粘性分类侧边栏 + 右侧卡片流，双栏架构
- **安全加固** — 全局 ErrorBoundary、数据 schema 校验、密钥零硬编码、限流重试、部署用户降权
- **SEO 就绪** — canonical、JSON-LD 结构化数据、og:image 分享图、`robots.txt`、`sitemap.xml`、noscript 降级
- **无额外依赖** — 聚合脚本仅用 Node 18+ 内置 `fetch`；测试用 Node 内置 test runner
- **中英双语** — UI 与教程内容均支持中英切换，语言偏好本地持久化
- **对齐官方设计** — `#0a0a0a` 黑底 + 白色透明度体系 + DM Sans，视觉与 deepseek.com/harness 一致

---

## dsh-plugin-hub 插件

[`plugin/`](plugin/) 把本站的插件聚合能力做成了任何 dsh 用户都能安装的组合包（纯 JavaScript ESM、无构建步骤、无需 pnpm 构建授权）：

```bash
dsh plugin --profile myhub add "github:qomob/dsh#path:/plugin"
dsh --profile myhub
# 然后对 agent 说：「用 plugin_search 找一个 dsh 桌面通知插件」
```

- **`plugin_search`** — 关键词 / 分类检索 dsh 社区插件（离线内嵌快照 328+ 插件 + 每日运行时自动刷新，可选 live GitHub 搜索），返回安装命令
- **`plugin_info`** — 单个插件仓库详情 + 安装核验（manifest 事实、构建脚本风险、monorepo 子目录提示）
- **`plugin_install`** — 代理安装：核验目标 → 经 Web UI 交互审批（无审批服务时需显式 confirm）→ 执行 `dsh plugin add`，pnpm 授权失败给 allowBuilds 修复提示
- **「插件」tab** — 会话视图环（对话 / 轨迹 / 插件）：目录浏览、搜索、分类、复制安装命令；离线可用、在线自动刷新、主题跟随

### 📸 界面预览

「插件」tab（会话视图环：对话 / 轨迹 / **插件**）：

| 目录浏览（浅色） | VS Code 风格详情（浅色） | 目录浏览（深色） |
|---|---|---|
| ![目录浏览](plugin/docs/screenshots/tab-light-collapsed.png) | ![详情面板](plugin/docs/screenshots/tab-light-detail.png) | ![深色主题](plugin/docs/screenshots/tab-dark-collapsed.png) |

数据每日自动更新：CI 每天 08:00（北京时间）采集新插件并刷新 `plugin/data/registry.json` 与 `plugin/client.js`；已安装的插件每 24 小时后台拉取最新快照（失败静默保留现快照），无需重装。配置项（GitHub Token、镜像、条数、超时、刷新/安装开关等）与开发说明见 [`plugin/README.md`](plugin/README.md)。

---

## 快速开始

### 环境要求

- Node.js 18 LTS 或更高
- npm 9+

### 本地开发

```bash
git clone https://github.com/qomob/dsh.git
cd dsh
npm install
npm run dev      # → http://localhost:5173
```

### 可用命令

| 命令 | 说明 |
|---|---|
| `npm run dev` | 启动开发服务器（HMR 热更新） |
| `npm run build` | 生产构建到 `dist/` |
| `npm run preview` | 本地预览构建产物 |
| `npm test` | 纯函数单测（Node 内置 test runner，零依赖） |
| `npm run lint` | oxlint 静态检查 |
| `npm run aggregate` | 手动运行数据聚合管道 |

---

## DSH手册

中文入门手册，按认知递进分四段（可折叠，默认全部收拢）：

| PART | 主题 | 适合谁 | 标识色 |
|---|---|---|---|
| **01** 从 0 到 1 | 安装启动、认识界面、发第一个任务 | 完全新手 | 🔵 蓝 |
| **02** 真实案例 | 代码、文档、视觉、自动化、调试 | 跑通后想用得更多 | 🟢 绿 |
| **03** 进阶系统 | 写插件、CLI/SDK、多 Agent、自动化 | 开发者 | 🟣 紫 |
| **04** 落地生产 | 岗位路线、行业应用、社区参与 | 想落地到工作 | 🟡 金 |

阅读体验优化：

- **PART 级折叠** — 四个 PART 默认全部收拢为紧凑单行，点击展开
- **可复制对话示例** — 案例章附完整 prompt，照着粘贴即可上手
- **进阶内容折叠** — `——` 分隔符自动把进阶要点收进灰底小字区块
- **顶部进度条** — 长文阅读时实时反馈"读到哪了"

手册数据位于 [`src/data/blueprint.js`](src/data/blueprint.js)，中英双语结构化定义。

---

## 插件聚合

聚合脚本位于 [`scripts/aggregate/`](scripts/aggregate/)，零额外依赖（仅用 Node 18+ 内置 `fetch`）。

### 流程

```
GitHub Search API（三个限定 topic）
    ↓
融合 awesome 精选列表（README 提取 + topic 白名单过滤）
    ↓
去重（fullName 去重）
    ↓
相关度评分（官方加成 + topics + 星标 + 活跃度）
    ↓
相关性过滤（描述必须提到 dsh / DeepSeek Harness）
    ↓
自动分类（16 类正则推断）
    ↓
LLM 翻译（兼容 OpenAI 协议，可选）
    ↓
schema 校验 → 写入 src/data/repos.json
```

### 手动运行

```bash
# 配置环境变量
export GH_TOKEN=ghp_xxx                    # GitHub Token（推荐，提升配额到 5000/小时）
export LLM_API_KEY=sk-xxx                  # 可选，用于翻译（兼容 OpenAI 协议）
export LLM_API_BASE=https://api.deepseek.com  # 可选，默认 DeepSeek
export LLM_MODEL=deepseek-chat             # 可选，默认 deepseek-chat

npm run aggregate
```

### 环境变量

| 变量 | 必需 | 默认 | 说明 |
|---|---|---|---|
| `GH_TOKEN` | 推荐 | 匿名 60 次/小时 | GitHub Token，提升配额到 5000 次/小时 |
| `LLM_API_KEY` | 可选 | 跳过翻译 | 任意 OpenAI 兼容 API 的 Key |
| `LLM_API_BASE` | 可选 | `https://api.deepseek.com` | OpenAI 兼容接口地址 |
| `LLM_MODEL` | 可选 | `deepseek-chat` | 翻译用模型名 |

### 数据可靠性保障

- **限流等待重试** — 搜索/补全遇到限流时等待 reset 后重试，不中断流程
- **topic 白名单** — 只收录命中 `dsh-plugin` / `dsh` / `deepseek-harness` 三个 topic 的仓库
- **相关性过滤** — 描述必须真正提到 dsh / DeepSeek Harness，剔除蹭流量项目
- **schema 校验** — 写入前断言 `repos` 非空、必填字段齐全、URL 合法，不合法则中止（保护上次好数据）
- **翻译降级** — 无 LLM key 时优雅保留原文，不阻塞流程
- **单元测试** — 分类/评分/提取/格式化等纯函数均有测试覆盖（36 个用例）

---

## GitHub Actions

[`.github/workflows/daily-aggregate.yml`](.github/workflows/daily-aggregate.yml) 自动运行：

```
聚合数据 → 提交（有变化时）→ 构建 → rsync 部署到服务器 → 上传产物
```

触发方式：

- **定时** — 每天北京时间 08:00
- **push** — 推送 main（排除 repos.json 数据提交，避免递归）
- **手动** — 仓库 Actions 页 → Run workflow（可勾选"强制部署"）

### 配置 Secrets

仓库 **Settings → Secrets and variables → Actions**：

| Secret | 说明 |
|---|---|
| `GH_TOKEN` | PAT（classic，勾选 `public_repo` 只读），提升配额 |
| `LLM_API_KEY` | 翻译用 API Key（兼容 OpenAI 协议） |
| `LLM_API_BASE` | 翻译接口地址（默认 DeepSeek） |
| `LLM_MODEL` | 翻译模型名（默认 deepseek-chat） |
| `SSH_HOST` / `SSH_USER` / `SSH_PRIVATE_KEY` / `DEPLOY_PATH` | 自动部署到服务器的 SSH 配置 |

---

## 部署

构建产物为纯静态文件（`dist/`），可部署到任意静态托管。

### 方式一：宝塔面板（阿里云等，当前生产环境）

当前线上：**https://dsh.qomob.ai**（宝塔 + Nginx + HTTPS）。

详见 [`DEPLOY-BAOTA.md`](DEPLOY-BAOTA.md) — 包含完整的 Nginx 配置、HTTPS 申请、安全加固清单和自动化部署方案。

核心 Nginx 配置：

```nginx
root /www/wwwroot/dsh.qomob.ai;
index index.html;

location / {
    try_files $uri $uri/ /index.html;   # SPA 回退
}

location ~* \.(js|css|svg|png)$ {       # 静态资源长期缓存
    expires 30d;
    add_header Cache-Control "public, immutable";
}

location = /index.html {                # 入口不缓存
    add_header Cache-Control "no-cache";
}
```

### 方式二：Vercel / Netlify / Cloudflare Pages

| 项 | 值 |
|---|---|
| 框架预设 | Vite |
| 构建命令 | `npm run build` |
| 输出目录 | `dist` |
| Node 版本 | 18 或更高 |

### 方式三：GitHub Pages

把 `dist/` 推到 `gh-pages` 分支，或在仓库 Settings → Pages 选择 GitHub Actions 部署。

### 部署检查清单

- [ ] `npm run build` 通过
- [ ] `npm test` 全绿（36 个测试）
- [ ] `src/data/repos.json` 非空且 `generatedAt` 是近期时间戳
- [ ] 部署后确认 `https://你的域名/robots.txt` 和 `/sitemap.xml` 正常返回
- [ ] 静态托管层已配置 SPA fallback
- [ ] HTTPS 已启用（社交分享预览的必要条件）
- [ ] 部署后用 [opengraph.xyz](https://www.opengraph.xyz/) 验证 OG meta

---

## 目录结构

```
.
├── src/
│   ├── components/           # React 组件
│   │   ├── ErrorBoundary.jsx     # 全局错误边界（防白屏）
│   │   ├── Navbar.jsx           # 导航栏 + 语言切换
│   │   ├── Hero.jsx             # 首屏 + 代码示例 + CTA
│   │   ├── StatsBar.jsx         # 统计数据条
│   │   ├── HubSection.jsx       # 插件区（左侧分类侧边栏 + 右侧卡片流 + 热榜 Top10）
│   │   ├── BlueprintSection.jsx # DSH手册（可折叠 PART + 进度条）
│   │   ├── RepoCard.jsx         # 插件卡片
│   │   └── Footer.jsx
│   ├── data/
│   │   ├── blueprint.js         # 手册教程数据（中英双语 30 章）
│   │   └── repos.json           # 聚合产物（每日自动更新）
│   ├── i18n/
│   │   ├── LanguageContext.jsx  # 语言上下文 + 持久化
│   │   └── ui.js                # UI 文案中英对照
│   ├── lib/
│   │   ├── categories.js        # 16 类分类定义 + 自动推断
│   │   └── format.js            # 数字/日期/语言色卡格式化
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css               # Tailwind v4 主题（对齐官方设计 token）
├── scripts/aggregate/         # 每日聚合管道（零额外依赖）
│   ├── config.mjs             # 搜索关键词 + awesome 源 + 输出路径
│   ├── github.mjs             # GitHub API 封装（限流等待重试）
│   ├── awesome.mjs            # awesome 列表 README 提取
│   ├── translate.mjs          # LLM 翻译（OpenAI 兼容，可降级）
│   └── aggregate.mjs          # 主流程（含去重/过滤/schema 校验）
├── plugin/                    # dsh-plugin-hub：可安装的 dsh 组合包
│   ├── index.js               # 插件入口（Config + 两个 defineTool 工具）
│   ├── cordis.patch.yml       # bundle 层（package.json 的 dsh.bundle 指向它）
│   ├── src/                   # categories / registry / live / refresh / format
│   ├── data/registry.json     # 内嵌插件快照（CI 每日刷新 + 运行时每日自动拉取）
│   ├── tests/                 # 44 个单元测试（node:test，无网络）
│   └── smoke/                 # 端到端冒烟（真实 cordis + dsh-tools 管线）
├── tests/unit.test.mjs        # 纯函数单测（36 个用例）
├── public/                    # 静态资源
│   ├── favicon.svg
│   ├── icons.svg
│   ├── og-image.png           # 社交分享图 1200×630
│   ├── robots.txt             # SEO
│   └── sitemap.xml            # SEO
├── .github/workflows/         # CI 定时任务 + 自动部署
│   └── daily-aggregate.yml
├── DEPLOY-BAOTA.md            # 宝塔面板部署指南
└── LICENSE                    # MIT
```

---

## 技术栈

| 层 | 技术 | 说明 |
|---|---|---|
| 框架 | React 19 + Vite 8 | SPA，构建时内联数据 |
| 样式 | Tailwind CSS v4 | 对齐 DeepSeek 官网设计 token |
| 数据 | GitHub Search API + awesome 列表 | 定时聚合 → `repos.json` |
| 翻译 | LLM API（OpenAI 兼容） | 可选，无 key 降级保留原文 |
| CI | GitHub Actions | 定时 + push 触发，rsync 自动部署 |
| 检查 | oxlint + node:test | 零额外依赖的 lint + 单测 |

---

## 贡献

欢迎提交 Issue 和 PR：

- 内容纠错 / 手册补充 → 编辑 `src/data/blueprint.js`
- 聚合源增加 → 编辑 `scripts/aggregate/config.mjs` 的 `SEARCH_QUERIES` 和 `AWESOME_SOURCES`
- 分类规则调整 → 编辑 `src/lib/categories.js`（有测试覆盖，改完跑 `npm test` 确认）
- Bug 修复 → 附复现步骤，优先修复有测试覆盖的纯函数问题

开发前先跑：

```bash
npm install
npm test && npm run lint && npm run build   # 确保全绿再提交
```

---

## 💬 加入社群

扫码加入 DSH 工坊微信社群——交流 dsh 用法、插件开发与最佳实践：

<div align="center">

<img src="wechat.jpg" width="180" alt="DSH 工坊微信群二维码" />

</div>

> 微信群二维码有时效；若扫码失效，请到 [Issues](https://github.com/qomob/dsh/issues) 留言，我们会更新二维码。

---

## 声明

本站为社区驱动的非官方项目，与 DeepSeek AI 官方无隶属关系。"DeepSeek"、"dsh"、"DeepSeek Harness" 等名称与商标版权归原作者所有。

---

<div align="center">

**MIT License · © 2026 Qomob.AI**

 Build in public · 一切皆为插件，即刻装备你的DSH

</div>