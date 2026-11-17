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

作品字段：`title`、`intro`、`sections` 为主要内容；可选 `label`、`summary`、`tags`、`category`、`note`、`isExample`。分类可选 `design`、`code`、`life`，`visualPreset` 可选 `mono`、`field`、`slow`。首页显示内容文件顺序中的前三个作品。`visualPreset` 是独立的封面选择，不需要与作品的 URL slug 一致；现有作品已显式配置，改名后可保持原封面。

手记字段：`title`、`intro`、`sections` 为主要内容；可选 `label`、`topic`、`note`、`isExample`。`sections` 为 `[["小标题","正文"],["小标题","正文"]]`；两个换行可分段。`sections: []` 也可以，页面仍显示标题和摘要。

### 新增、删除、重命名

- **新增**：在 `projects` 或 `articles` 中复制一条内容，更换唯一的英文 slug 和正文；无需修改测试、构建脚本或页面数量。slug 只使用小写字母、数字和连字符，例如 `my-first-project`。
- **删除**：从字典中移除对应条目。构建会重新生成 `dist/`，自动清理旧页面；列表、详情导航、RSS 和站点地图随内容更新。
- **重命名**：只改 `title` 会保留网址。修改字典的 slug 时，把旧值放进同一条内容的 `aliases` 数组，构建会自动生成旧地址跳转页；无需修改测试或维护单独的跳转文件。
- **暂时清空**：可以设置 `projects: {}` 或 `articles: {}`。页面会显示整理中的提示；只有一条内容时，详情页提供返回列表入口，不再链接到自身。

### 保留已分享的旧链接

例如，将作品的 slug 从 `mono` 改成 `mono-studio`，同时在原条目中加入：

```json
"mono-studio": {
  "aliases": ["mono"],
  "title": "MONO · 少即是多",
  "intro": "作品介绍。",
  "visualPreset": "mono",
  "sections": []
}
```

发布后，`/work/mono/` 会自动前往 `/work/mono-studio/`。文章使用相同写法，地址位于 `/journal/` 下。这里只需填写旧 slug，不要填写完整网址或带斜杠的路径。

多次改名时保留全部历史值。例如再次改成 `mono-v3`，设置 `"aliases": ["mono", "mono-studio"]`，两个旧地址都会直接跳到 `/work/mono-v3/`，不会先经过中间地址。仅修改 slug 而不记录旧值，系统无法判断它是改名还是删除；该旧地址仍会返回 404。

旧 slug 不能等于任何当前内容的 slug，也不能在同一集合中被重复占用。冲突、重复、非法格式会使构建失败，并保留已发布的线上版本。作品与文章分属不同路径，可各自使用相同的旧 slug。

GitHub Pages 使用静态托管，跳转由页面中的 `location.replace` 完成，保留查询参数和 `#` 锚点，并避免返回按钮反复回到旧页；这不是服务器端 HTTP 301。禁用 JavaScript 时提供 meta refresh 和可点击的新地址链接。旧页标注 `noindex`，canonical 指向新地址；站点地图、RSS 和列表只使用新地址。删除 `aliases` 中的旧值或删除整条内容后，对应旧地址会被清理。

### 概念作品和示例手记标识

仅当 `isExample` 为布尔值 `true` 时，作品的卡片和详情显示“概念作品”，文章显示“示例手记”，RSS 也会加示例提示。设为 `false` 或省略该字段时，作品显示“项目作品”，文章显示“原创手记”。不要填写字符串 `"false"` 或 `"true"`，构建会拒绝非布尔值。

首页与作品列表的整体说明同样自动变化：全部为概念作品时显示整体声明，混合内容时只说明带概念标识的条目，全部为实际项目时不显示概念声明。

`label`、`note`、标题和正文是你自行填写的文字，系统不会根据标识删改它们。把现有示例替换成实际内容时，除了修改 `isExample`，也请改掉自行填写的“示例”“概念”等文案。省略 `label` 时会生成通用标题，省略 `note` 则不显示备注。

当前作品和三篇手记为标注清楚的概念/示例内容，不代表真实项目经历或本人原创文章。姓名、昵称、职业和邮箱由本人提供。

## 已实现功能

独立作品页与分类筛选；文章全文搜索、分类、本机收藏；阅读目录、进度条、复制链接和打印/PDF；移动导航、主题记忆；RSS、sitemap、robots、结构化数据和 404；邮箱联系与 vCard 名片下载。

联系表单通过访客本机的邮件应用撰写，由访客确认后发送，不包含后台收件服务。主题和收藏仅保存在当前浏览器。网站不使用第三方分析脚本。

## 自动部署配置

工作流位于 `.github/workflows/pages.yml`：

1. 推送到 `main` 或手动触发。
2. 使用 Node.js 24 构建网站，正式地址来自 GitHub Pages 配置。
3. 根据当前内容验证页面内部链接、锚点、资源、元数据、RSS、名片及 HTTP 路由，并在隔离目录验证增删、改名、混合标识与空列表等完整构建场景。
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
- `tests/content-lifecycle.test.mjs`：新增、删除、重命名、标识与空集合回归；不会修改你的实际内容文件。
- `tests/redirects.test.mjs`：历史地址、多次改名、参数与锚点保留、冲突和非法配置回归。
- `.github/workflows/pages.yml`：自动构建和部署。

原 Sites 网站保留为旧地址，不会随 GitHub 代码更新而自动同步。
