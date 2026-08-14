<div align="center">

<h1>DSH 工坊 · 装点你的 Agent</h1>

<p>围绕 <a href="https://github.com/deepseek-ai/deepseek-harness">DeepSeek Harness (dsh)</a> 的中文社区角落</p>

<p>
  <a href="https://github.com/deepseek-ai/deepseek-harness"><img src="https://img.shields.io/badge/dsh-Agent%20Framework-6799fe" alt="dsh" /></a>
  <img src="https://img.shields.io/badge/Vite-8-646cff" alt="Vite" />
  <img src="https://img.shields.io/badge/React-19-61dafb" alt="React" />
  <img src="https://img.shields.io/badge/Tailwind-4-38bdf8" alt="Tailwind" />
  <img src="https://img.shields.io/badge/License-MIT-22c55e" alt="License" />
</p>

<p>
  <a href="#快速开始">快速开始</a> · 
  <a href="#wiki-教程">Wiki 教程</a> · 
  <a href="#插件聚合">插件聚合</a> · 
  <a href="#部署">部署</a>
</p>

</div>

---

两个栏目，一个站点：

- **入门手册（Wiki）** — 按上手路径编排的中文教程：先跑通任务，再把重复劳动沉淀成自己的 AI 工作流。章节可折叠、含可复制的对话示例。
- **插件收录库** — 从 DeepSeek Harness 生态里挑出值得尝试的项目，按用途分类陈列，每件标注安装方式；英文简介配中文说明。

## ✨ 特性

- **纯静态、零后端** — Vite 构建的 SPA，`dist/` 丢到任意静态托管即可上线
- **每日自动更新** — GitHub Actions 定时聚合 → 构建验证 → 数据提交，全程无人干预
- **安全加固** — 全局 ErrorBoundary、数据 schema 校验、密钥零硬编码、限流重试上限
- **SEO 就绪** — Open Graph / Twitter Card meta、`robots.txt`、`sitemap.xml` 开箱即用
- **无额外依赖** — 聚合脚本仅用 Node 18+ 内置 `fetch`；测试用 Node 内置 test runner
- **中英双语** — UI 与教程内容均支持中英切换，语言偏好本地持久化
- **对齐官方设计** — `#0a0a0a` 黑底 + 白色透明度体系 + DM Sans，视觉与 deepseek.com/harness 一致

---

## 快速开始

### 环境要求

- Node.js 18 LTS 或更高
- npm 9+

### 本地开发

```bash
git clone https://github.com/你的用户名/dsh-wiki.git
cd dsh-wiki
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

## Wiki 教程

30 章原创内容，按认知递进分四段：

| PART | 主题 | 适合谁 | 标识色 |
|---|---|---|---|
| **01** 从 0 到 1 | 安装启动、认识界面、发第一个任务 | 完全新手 | 🔵 蓝 |
| **02** 真实案例 | 代码、文档、视觉、自动化、调试 | 跑通后想用得更多 | 🟢 绿 |
| **03** 进阶系统 | 写插件、CLI/SDK、多 Agent、自动化 | 开发者 | 🟣 紫 |
| **04** 落地生产 | 岗位路线、行业应用、社区参与 | 想落地到工作 | 🟡 金 |

阅读体验优化：

- **PART 级折叠** — 默认仅展开 PART 1，避免 30 章一屏导致认知过载
- **可复制对话示例** — 案例章附完整 prompt，照着粘贴即可上手
- **进阶内容折叠** — `——` 分隔符自动把进阶要点收进灰底小字区块
- **顶部进度条** — 长文阅读时实时反馈"读到哪了"
- **结尾 CTA** — 读完教程自然引导到插件目录

教程数据位于 [`src/data/blueprint.js`](src/data/blueprint.js)，中英双语结构化定义。

---

## 插件聚合

聚合脚本位于 [`scripts/aggregate/`](scripts/aggregate/)，零额外依赖（仅用 Node 18+ 内置 `fetch`）。

### 流程

```
GitHub Search API（多关键词）
    ↓
融合 awesome 精选列表（README 提取）
    ↓
去重（fullName 去重）
    ↓
相关度评分（官方加成 + topics + 星标 + 活跃度）
    ↓
自动分类（16 类正则推断）
    ↓
DeepSeek 翻译（可选，无 key 降级保留原文）
    ↓
schema 校验 → 写入 src/data/repos.json
```

### 手动运行

```bash
# 配置环境变量（GH_TOKEN 推荐配置以提升限额）
export GH_TOKEN=ghp_xxx           # GitHub Token，60→5000 次/小时
export DEEPSEEK_API_KEY=sk-xxx    # 可选，用于翻译外文简介

npm run aggregate
```

### 环境变量

| 变量 | 必需 | 默认 | 说明 |
|---|---|---|---|
| `GH_TOKEN` | 推荐 | 匿名 60 次/小时 | GitHub Token，提升搜索限额到 5000 次/小时 |
| `DEEPSEEK_API_KEY` | 可选 | 跳过翻译 | 把外文简介翻译为中文；未配置则保留原文 |

### 数据可靠性保障

- **限流重试上限** — 最多 3 次指数退避，`reset` 头非法时不重试，杜绝无限递归
- **schema 校验** — 写入前断言 `repos` 非空、必填字段齐全、URL 合法，不合法则中止（保护上次好数据）
- **翻译降级** — 无 API key 时优雅保留原文，不阻塞流程
- **单元测试** — 分类/评分/提取/格式化等纯函数均有测试覆盖（27 个用例）

---

## GitHub Actions

[`.github/workflows/daily-aggregate.yml`](.github/workflows/daily-aggregate.yml) 每天北京时间 08:00（UTC 00:00）自动运行：

```
聚合数据 → 提交到仓库 → 构建验证 → 上传产物
```

也支持手动触发（仓库 Actions 页 → Run workflow）。

### 配置 Secrets

仓库 **Settings → Secrets and variables → Actions**：

| Secret | 说明 |
|---|---|
| `GH_TOKEN` | PAT（经典 Token，勾选 `public_repo` 只读即可），提升搜索限额 |
| `DEEPSEEK_API_KEY` | DeepSeek 平台获取，用于翻译。未配置则跳过 |

---

## 部署

构建产物为纯静态文件（`dist/`），可部署到任意静态托管。

### 方式一：宝塔面板（阿里云等）

详见 [`DEPLOY-BAOTA.md`](DEPLOY-BAOTA.md) — 包含完整的 Nginx 配置、HTTPS 申请、安全加固清单和自动化部署方案。

核心 Nginx 配置：

```nginx
root /www/wwwroot/dsh-wiki;
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
- [ ] `npm test` 全绿（27 个测试）
- [ ] `src/data/repos.json` 非空且 `generatedAt` 是近期时间戳
- [ ] `public/robots.txt` 和 `public/sitemap.xml` 中占位域名已替换为实际域名
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
│   │   ├── Hero.jsx             # 首屏 + 代码示例
│   │   ├── StatsBar.jsx         # 统计数据条
│   │   ├── BlueprintSection.jsx # Wiki 教程（可折叠 PART + 进度条 + CTA）
│   │   ├── HubSection.jsx       # 插件目录（筛选 + 排序 + 搜索）
│   │   ├── RepoCard.jsx         # 插件卡片
│   │   └── Footer.jsx
│   ├── data/
│   │   ├── blueprint.js         # Wiki 教程数据（中英双语 30 章）
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
│   ├── github.mjs             # GitHub API 封装（限流重试上限 3）
│   ├── awesome.mjs            # awesome 列表 README 提取
│   ├── translate.mjs          # DeepSeek 翻译（可降级）
│   └── aggregate.mjs          # 主流程（含 schema 校验）
├── tests/unit.test.mjs        # 纯函数单测（27 个用例）
├── public/                    # 静态资源
│   ├── favicon.svg
│   ├── icons.svg
│   ├── robots.txt             # SEO
│   └── sitemap.xml            # SEO
├── .github/workflows/         # CI 定时任务
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
| 数据 | GitHub Search API + awesome 列表 | 每日聚合 → `repos.json` |
| 翻译 | DeepSeek API | 可选，无 key 降级保留原文 |
| CI | GitHub Actions | 每日定时聚合 + 构建验证 |
| 检查 | oxlint + node:test | 零额外依赖的 lint + 单测 |

---

## 贡献

欢迎提交 Issue 和 PR：

- 内容纠错 / 教程补充 → 编辑 `src/data/blueprint.js`
- 聚合源增加 → 编辑 `scripts/aggregate/config.mjs` 的 `SEARCH_QUERIES` 和 `AWESOME_SOURCES`
- 分类规则调整 → 编辑 `src/lib/categories.js`（有测试覆盖，改完跑 `npm test` 确认）
- Bug 修复 → 附复现步骤，优先修复有测试覆盖的纯函数问题

开发前先跑：

```bash
npm install
npm test && npm run lint && npm run build   # 确保全绿再提交
```

---

## 声明

本站为社区驱动的非官方项目，与 DeepSeek AI 官方无隶属关系。"DeepSeek"、"dsh"、"DeepSeek Harness" 等名称与商标版权归原作者所有。

---

<div align="center">

**MIT License · © 2026 Qomob.AI**

 Build in public · 装点你的 Agent

</div>