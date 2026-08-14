# 宝塔面板部署指南（阿里云）

本站是**纯静态站点**（`dist/` 目录），无需 Node.js 运行时。部署核心 = 把构建产物交给 Nginx 托管。

---

## 一、前置准备

| 项 | 说明 |
|---|---|
| 阿里云 ECS | 推荐最低 1 核 1G（静态站点资源占用极低） |
| 操作系统 | CentOS 7.9+ / Ubuntu 20.04+ / Debian 11+ |
| 宝塔面板 | 7.x 或 8.x |
| 域名 | 可选；有域名才能配 HTTPS 和 OG 分享预览 |
| 安全组 | 阿里云控制台 → ECS → 安全组 → 放行 80 和 443 端口 |

### 安装宝塔面板（如未安装）

SSH 登录服务器后，按系统执行：

```bash
# CentOS / AlmaLinux
curl -sSO https://download.bt.cn/install/install_panel.sh && bash install_panel.sh

# Ubuntu / Debian
wget -O install.sh https://download.bt.cn/install/install-ubuntu_6.0.sh && bash install.sh
```

安装完成后记下面板地址、账号、密码，浏览器打开面板。

---

## 二、本地构建产物

在本地项目根目录：

```bash
npm install
npm run build    # 产物在 dist/ 目录
npm test         # 确认 27 个测试全过
```

构建成功后，`dist/` 目录包含：

```
dist/
├── index.html          # 入口 HTML（含 OG / Twitter meta）
├── assets/
│   ├── index-xxxx.css  # 样式
│   └── index-xxxx.js   # 脚本
├── favicon.svg
├── icons.svg
├── robots.txt
└── sitemap.xml
```

把整个 `dist/` 目录打包为 zip：

```bash
cd dist && zip -r ../dist.zip . && cd ..
```

---

## 三、宝塔面板配置站点

### 3.1 安装 Nginx

面板 → 软件商店 → 搜索 Nginx → 安装（选稳定版 1.24+）。

### 3.2 创建站点

面板 → 网站 → 添加站点：

| 字段 | 填写 |
|---|---|
| 域名 | 你的域名（如 dsh.example.com）；无域名填服务器 IP |
| 根目录 | /www/wwwroot/dsh-wiki（记住这个路径，下文称 $ROOT） |
| PHP版本 | 纯静态（不需要 PHP） |
| 数据库 | 不创建 |
| FTP | 不创建 |

### 3.3 上传构建产物

方式 A（推荐，面板上传）：

1. 面板 → 文件 → 进入 $ROOT
2. 删除宝塔自动生成的默认 index.html
3. 右上角 上传 → 选择本地的 dist.zip
4. 右键 dist.zip → 解压 → 解压到当前目录
5. 确认 $ROOT 下直接能看到 index.html、assets/、robots.txt

方式 B（SSH 上传）：

```bash
# 本地执行（替换 IP 和路径）
scp -r dist/* root@你的服务器IP:/www/wwwroot/dsh-wiki/
```

### 3.4 验证

浏览器访问 http://你的域名或IP，应看到 DSH 工坊首页。

---

## 四、Nginx 配置优化（重要）

面板 → 网站 → 点击站点名 → 配置文件，在 server 块内确认/补充：

```nginx
# 1. 站点根目录
root /www/wwwroot/dsh-wiki;
index index.html;

# 2. SPA 回退（单页锚点导航的保险）
location / {
    try_files $uri $uri/ /index.html;
}

# 3. 静态资源长期缓存（文件名带 hash）
location ~* \.(js|css|svg|woff2?|png|jpg|jpeg|gif|webp|ico)$ {
    expires 30d;
    add_header Cache-Control "public, immutable";
}

# 4. index.html 不缓存（确保最新入口）
location = /index.html {
    add_header Cache-Control "no-cache, no-store, must-revalidate";
}

# 5. 安全头
add_header X-Content-Type-Options "nosniff" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;

# 6. gzip 压缩（宝塔通常默认开启，确认即可）
gzip on;
gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
gzip_min_length 1024;
gzip_comp_level 5;
```

保存后面板自动重载 Nginx。

---

## 五、配置 HTTPS（有域名时强烈建议）

HTTPS 是社交分享预览（OG meta）和 SEO 的必要条件——HTTP 站点的 OG 链接在多数平台无法生成预览。

### 5.1 申请免费 SSL 证书

面板 → 网站 → 点击站点 → SSL → Let's Encrypt：

1. 选择你的域名 → 点击申请
2. 验证方式选文件验证（宝塔自动处理）
3. 申请成功后，开启强制 HTTPS（自动 80 跳转 443）

### 5.2 更新 sitemap / robots 域名

SSL 配置完成后，用实际域名替换占位符：

```bash
# SSH 里执行（替换 YOUR_DOMAIN）
sed -i 's|https://dsh-wiki.example.com|https://YOUR_DOMAIN|g' /www/wwwroot/dsh-wiki/sitemap.xml
```

然后编辑 robots.txt，取消 Sitemap 行注释并替换域名。

---

## 六、每日数据聚合

站点数据来自 src/data/repos.json，由 GitHub Actions 每日聚合。两种保持更新的方式：

### 方式 A（推荐）：GitHub Actions 自动部署

1. GitHub 仓库 → Settings → Secrets → 添加：
   - BTPANEL_HOST：服务器 IP
   - BTPANEL_USER：宝塔面板用户名
   - BTPANEL_PWD：宝塔面板密码
   - GH_TOKEN：GitHub PAT（提升搜索限额）
   - DEEPSEEK_API_KEY：翻译用（可选）

2. 在 .github/workflows/daily-aggregate.yml 的构建步骤后追加：

```yaml
      - name: 部署到宝塔
        uses: zkqiang/bt-panel-action@v1
        with:
          host: ${{ secrets.BTPANEL_HOST }}
          username: ${{ secrets.BTPANEL_USER }}
          password: ${{ secrets.BTPANEL_PWD }}
          paths: |
            dist => /www/wwwroot/dsh-wiki
```

这样每天 08:00 自动聚合 → 构建 → 部署，全程无人干预。

### 方式 B：手动部署

本地构建后手动上传 dist.zip（重复第三步）。

---

## 七、安全加固检查清单

- [ ] 阿里云安全组：仅放行 22（SSH）、80、443；宝塔面板端口改为非默认
- [ ] 宝塔面板 → 安全 → SSH 端口改非 22，禁密码登录只留密钥
- [ ] Nginx 安全头已配（第四步第 5 项）
- [ ] HTTPS 强制跳转已开启
- [ ] /www/wwwroot/dsh-wiki 目录权限 www:www 755
- [ ] 服务器上不存在 .env 文件（本站不需要任何服务器密钥）
- [ ] 访问 https://你的域名/robots.txt 和 /sitemap.xml 正常返回

---

## 八、常见问题

**Q: 访问首页空白？**
A: 检查 $ROOT 下是否有 index.html（不是宝塔默认页）。F12 看 Console 有无 404。

**Q: 刷新子路径 404？**
A: Nginx 没配 try_files 回退（第四步第 2 项）。

**Q: 样式丢了 / 字体不加载？**
A: 检查 assets/ 是否完整上传；Nginx location 规则是否匹配 CSS/JS。

**Q: OG 分享无预览？**
A: 必须 HTTPS；用 opengraph.xyz 输入 URL 验证 meta。

**Q: 每日数据不更新？**
A: GitHub Actions 里检查 GH_TOKEN 是否有效；Actions 页面看运行日志。

**Q: 宝塔面板无法访问？**
A: 阿里云安全组没放行宝塔面板端口（默认 8888，建议改掉）。