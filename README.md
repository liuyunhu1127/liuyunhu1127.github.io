# 自序 ZIXU · 刘云虎的个人网站

刘云虎 / liuyefengfly · 软件开发工程师。

- 网站：https://liuyunhu1127.github.io
- 源码：https://github.com/liuyunhu1127/liuyunhu1127.github.io

暖白、墨黑与朱红的杂志式个人网站。使用纯 HTML、CSS、JavaScript 和 Node.js 静态生成器，无第三方运行依赖，无需安装 npm 包。

## 日常更新与自动发布

所有更新推送到 `main` 后，GitHub Actions 自动执行构建、页面/路由检查并部署 GitHub Pages。只有检查通过的版本会发布；失败时保留原来的线上版本。

```sh
git clone https://github.com/liuyunhu1127/liuyunhu1127.github.io.git
cd liuyunhu1127.github.io
# 修改内容或代码
npm run build
npm test
git add .
git commit -m "Update website"
git push origin main
```

也可以直接在 GitHub 网页中编辑 `content/site.json`，提交到 main 后自动部署。

在仓库 **Actions → Build and deploy GitHub Pages** 查看每次部署记录，也可点击 **Run workflow** 手动发布。在 **Settings → Pages** 中保持 Source 为 **GitHub Actions**。

## 本地运行

使用 Node.js 24。执行 `npm run dev`，打开 http://127.0.0.1:4317 。编辑后重新运行 `npm run build` 并刷新页面即可；无热更新功能。

```sh
npm run build
npm test
npm start
```

`dist/` 为构建产物，由 Actions 生成并发布，不提交进仓库。页面需要通过 HTTP 服务访问，不能直接双击 HTML 文件。

## 修改个人资料和内容

编辑 `content/site.json`：

| 字段 | 用途 |
| --- | --- |
| `author`、`nickname`、`role` | 姓名、昵称、职业 |
| `tagline`、`about`、`interests` | 首屏文案、简介段落和兴趣 |
| `email`、`wechat`、`social` | 联系方式；未填写的可选项不会展示 |
| `url` | 正式网站根地址 |
| `projects` | 作品字典，键为英文 URL slug |
| `articles` | 手记字典，键为英文 URL slug |

作品字段：`title`、`label`、`intro`、`summary`、`tags`、`category`、`sections`、`note`。分类可选 `design`、`code`、`life`，`visualPreset` 可选 `mono`、`field`、`slow`。首页显示前三个作品。

手记字段：`title`、`label`、`intro`、`topic`、`sections`、`note`、`isExample`。`sections` 为 `[["小标题","正文"],["小标题","正文"]]`；两个换行可分段。确认是你的原创内容后，将 `isExample` 设为 `false`，并更新 `label` 和 `note`。

当前作品和三篇手记为标注清楚的概念/示例内容，不代表真实项目经历或本人原创文章。姓名、昵称、职业和邮箱由本人提供。

## 已实现功能

独立作品页与分类筛选；文章全文搜索、分类、本机收藏；阅读目录、进度条、复制链接和打印/PDF；移动导航、主题记忆；RSS、sitemap、robots、结构化数据和 404；邮箱联系与 vCard 名片下载。

联系表单通过访客本机的邮件应用撰写，由访客确认后发送，不包含后台收件服务。主题和收藏仅保存在当前浏览器。网站不使用第三方分析脚本。

## 自动部署配置

工作流位于 `.github/workflows/pages.yml`：

1. 推送到 `main` 或手动触发。
2. 使用 Node.js 24 构建网站，正式地址来自 GitHub Pages 配置。
3. 验证页面内部链接、锚点、资源、元数据、RSS、名片及 HTTP 路由。
4. 上传 `dist/`，使用 GitHub 官方 Pages Action 发布。

部署使用仓库自动提供的 `GITHUB_TOKEN` 和 OIDC，不需要手动保存个人访问令牌。仓库仅给部署任务配置 `pages: write` 和 `id-token: write` 权限。

网站默认部署在域名根目录。若以后改成项目子目录，需要调整路径构建逻辑。配置自定义域名后，Actions 会在构建时使用 Pages 提供的域名；同步更新 `content/site.json` 中的 `url`，保证本地构建地址一致。

## 文件说明

- `content/site.json`：集中维护内容。
- `home.template.html`：首页和概念封面模板。
- `build.mjs`：生成完整静态页面、RSS、SEO 等文件。
- `styles.css`、`extended.css`：视觉系统与响应式布局。
- `site.js`：浏览器交互。
- `server.mjs`：本机预览服务。
- `tests/site.test.mjs`：构建产物与 HTTP 验证。
- `.github/workflows/pages.yml`：自动构建和部署。

原 Sites 网站保留为旧地址，不会随 GitHub 代码更新而自动同步。
