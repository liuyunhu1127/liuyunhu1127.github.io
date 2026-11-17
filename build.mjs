import { readFile, writeFile, mkdir, copyFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
const site = JSON.parse(await readFile(path.join(root, 'content/site.json'), 'utf8'));
const out = path.join(root, 'dist');
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const json = value => JSON.stringify(value).replace(/</g, '\\u003c');
// Deployment may supply its canonical origin without rewriting personal content.
const configuredUrl = process.env.SITE_URL || site.url;
const origin = configuredUrl ? new URL(configuredUrl).origin : '';
if (site.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(site.email)) throw new Error('请在 content/site.json 填写有效邮箱');
for (const link of site.social) if (!/^https:\/\//.test(link.url)) throw new Error('社交链接必须使用 https://');
for (const collection of [site.projects, site.articles]) for (const [slug, item] of Object.entries(collection)) {
  if (!/^[a-z0-9-]+$/.test(slug) || !item.title || !Array.isArray(item.sections)) throw new Error('内容条目格式无效');
  if (item.isExample !== undefined && typeof item.isExample !== 'boolean') throw new Error('isExample 必须是 true 或 false');
}
// Only remove the generated dist directory immediately beneath this checkout.
if (path.dirname(path.resolve(out)) !== root || path.basename(out) !== 'dist') throw new Error('输出目录不安全');
await rm(out, { recursive: true, force: true });
await mkdir(out, { recursive: true });
const emit = async (file, body) => { const dest = path.join(out, file); await mkdir(path.dirname(dest), { recursive:true }); await writeFile(dest, body); };
const stylesheet = (await readFile(path.join(root, 'styles.css'), 'utf8')).replace(/^@import[^\r\n]*(?:\r?\n|$)/, '');
await emit('styles.css', stylesheet + '\n' + await readFile(path.join(root, 'extended.css'), 'utf8'));
await copyFile(path.join(root, 'site.js'), path.join(out, 'app.js'));
for (const asset of ['favicon.svg','social-card.svg']) await copyFile(path.join(root,asset),path.join(out,asset));
const description = esc(site.description);
const titleBase = `${site.author} · ${site.role} | ${site.name}`;
const themeIcon = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="1.4" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4.2 4.2l2.1 2.1m11.4 11.4 2.1 2.1M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></svg>';
const nav = active => `<header class="header wrap"><a class="brand" href="/" aria-label="${esc(site.name)}首页"><span class="brand-symbol">自</span><span>${esc(site.name)}<span class="brand-en">${esc(site.englishName)}</span></span></a><nav aria-label="主导航" id="navigation">${[['/', '首页'],['/work/', '作品'],['/#about', '关于'],['/journal/', '手记']].map(([href,label])=>`<a href="${href}"${active===label?' class="active" aria-current="page"':''}>${label}</a>`).join('')}</nav><div class="header-actions"><button class="theme-button" aria-label="切换深色主题" aria-pressed="false" title="切换主题">${themeIcon}</button><a class="contact-link" href="/contact/">聊一聊 <span>↗</span></a><button class="menu-toggle" aria-label="打开导航菜单" aria-controls="navigation" aria-expanded="false">☰</button></div></header>`;
const footer = `<footer class="footer wrap"><a class="footer-brand" href="/">${esc(site.name)} <span>${esc(site.englishName)}</span></a><span>© <span id="year">${new Date().getUTCFullYear()}</span> ${esc(site.author)} · 保持好奇，持续创造</span><div class="footer-links"><a href="/feed.xml">RSS</a><a href="/privacy/">隐私说明</a><span id="local-time">CHINA · UTC+8</span><a href="#top" aria-label="返回顶部">↑</a></div></footer>`;
const utility = '<p class="toast" role="status" aria-live="polite" id="toast"></p>';
function head(title, summary, route, article=false) {
  const canonical = origin ? origin + route : '';
  return `<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="description" content="${esc(summary)}"><meta name="theme-color" content="#f5f4ef"><title>${esc(title)}</title><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/styles.css"><link rel="alternate" type="application/rss+xml" title="${esc(site.name)}手记" href="/feed.xml">${canonical?`<link rel="canonical" href="${esc(canonical)}"><meta property="og:url" content="${esc(canonical)}">`:''}<meta property="og:type" content="${article?'article':'website'}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(summary)}"><meta property="og:site_name" content="${esc(site.name)}"><meta name="color-scheme" content="light dark"><script src="/app.js" defer></script></head><body id="top"><a class="skip" href="#main">跳至正文</a>`;
}
function page(title, summary, route, active, body, article=false) { return head(title + ' | ' + titleBase,summary,route,article) + nav(active) + `<main id="main">${body}</main>` + footer + utility + '</body></html>'; }
const routeFor = (kind,slug) => `/${kind}/${slug}/`;
const isExample = item => item.isExample === true;
const projectNotice = items => {
  const count = items.filter(isExample).length;
  if (!count) return '';
  return `<p class="demo-note">${count === items.length ? '以下均为概念作品，非真实客户项目。' : '标注“概念作品”的条目为示例，其余为项目作品。'}</p>`;
};
const emptyProjects = '<p class="page-intro">作品正在整理，敬请期待。</p>';
const emptyArticles = '<p class="page-intro">手记正在整理，敬请期待。</p>';
const articleTime = data => Math.max(1, Math.ceil((data.intro + data.sections.map(s=>s.join('')).join('')).length / 300));
const articleList = items => items.map(([slug,data],i)=>`<a class="journal-item" href="/journal/${slug}/" data-search="${esc([data.title,data.intro,...data.sections.flat()].join(' '))}" data-topic="${esc(data.topic || '随笔')}"><span class="journal-no">${String(i+1).padStart(2,'0')}</span><span class="journal-title">${esc(data.title)}<span>${esc(data.topic || '随笔')} · ${esc(isExample(data)?'示例手记':'原创手记')}</span></span><span class="journal-meta">${articleTime(data)} MIN READ</span><span class="journal-arrow">↗</span></a>`).join('');
let home = await readFile(path.join(root, 'home.template.html'), 'utf8');
const homeHeader = home.match(/<header[\s\S]*?<\/header>/)[0];
home = home.replace(/^[\s\S]*?<body>/,()=>head(titleBase,site.description,'/'))
  .replace(/\s*<a class="skip"[^>]*>[\s\S]*?<\/a>/,'')
  .replace(homeHeader,()=>nav('首页'))
  .replace(/<footer[\s\S]*?<\/footer>/,()=>footer)
  .replace(/<dialog[\s\S]*?<\/dialog>/,utility)
  .replace('A PERSONAL SPACE FOR IDEAS &amp; CREATION',()=>esc(site.nickname) + ' / SOFTWARE ENGINEER')
  .replace('A PERSONAL SPACE FOR IDEAS & CREATION',()=>esc(site.nickname) + ' / SOFTWARE ENGINEER')
  .replace(/<p class="hero-description">[\s\S]*?<\/p>/,()=>`<p class="hero-description">你好，我是${esc(site.author)}，${esc(site.role)}。<br>${esc(site.tagline)}</p>`)
  .replace('31° N · 121° E','IDEAS → REALITY')
  .replace(/<p class="demo-note">[\s\S]*?<\/p>/,() => projectNotice(Object.values(site.projects).slice(0,3)))
  .replace(/<div class="about-copy">[\s\S]*?<\/div><\/div><\/section>/,()=>`<div class="about-copy"><p class="eyebrow muted">${esc(site.nickname)}</p><h2>你好，我是${esc(site.author)}。<br>一名${esc(site.role)}。</h2>${site.about.map(p=>`<p>${esc(p)}</p>`).join('')}<div class="interest-tags">${site.interests.map(t=>`<span>${esc(t)}</span>`).join('')}</div><a class="inline-link" href="/contact/">联系我 <span>↗</span></a><a class="inline-link" href="/contact.vcf" download>保存联系名片 ↓</a></div></div></section>`)
  .replace(/<div class="journal-list">[\s\S]*?<\/div><\/section>/,()=>`<div class="journal-list">${articleList(Object.entries(site.articles).slice(0,3)) || emptyArticles}</div><a class="archive-link" href="/journal/">浏览全部手记 <span>↗</span></a></section>`)
  .replace(/<button class="contact-orbit"[^>]*>/,'<a class="contact-orbit" href="/contact/" aria-label="查看联系信息">')
  .replace('期待与你连接</span></button>','期待与你连接</span></a>');
const visualTemplates = Object.fromEntries([...home.matchAll(/<button class="project[^"]*" data-category="[^"]*" data-project="([^"]+)">([\s\S]*?)<\/button>/g)].map(match=>[match[1],match[2].match(/<div class="project-image[\s\S]*?<div class="project-caption">/)[0].replace(/<div class="project-caption">$/,'')]));
for (const [slug,data] of Object.entries(site.projects)) {
  const preset = data.visualPreset || slug;
  const visual = Object.hasOwn(visualTemplates,preset) ? visualTemplates[preset] : visualTemplates.mono;
  data.visual = visual;
  data.card = `<a class="project${(data.visualPreset || slug)==='slow'?' project-wide':''}" data-category="${esc(data.category || 'design')}" href="/work/${slug}/" data-search="${esc(data.title + ' ' + data.intro)}">${visual}<div class="project-caption"><div><h3>${esc(data.title)}</h3><p>${esc(data.summary || data.intro)}</p></div><span>${esc(data.tags || '项目展示')}<span class="project-kind" data-example="${isExample(data)}">${isExample(data)?'概念作品':'项目作品'}</span></span></div></a>`;
}
home = home.replace(/(<div class="projects">)[\s\S]*?(<\/div>\s*<\/section>\s*<section class="about-section")/, (_match,open,close) => open + (Object.values(site.projects).slice(0,3).map(data=>data.card).join('') || emptyProjects) + close);
home = home.replace(/<span class="count">\(03\)<\/span>/,()=>`<span class="count">(${String(Math.min(3,Object.keys(site.projects).length)).padStart(2,'0')})</span>`);
home = home.replace('</div>\n    </section>\n    <section class="about-section"','</div><a class="archive-link" href="/work/">浏览全部作品 <span>↗</span></a>\n    </section>\n    <section class="about-section"');
home = home.replace('</head>',()=>`<script type="application/ld+json">${json({'@context':'https://schema.org','@type':'Person',name:site.author,alternateName:site.nickname,jobTitle:site.role,url:origin || undefined,sameAs:site.social.map(x=>x.url)})}</script></head>`);
await emit('index.html',home);
const filters = `<div class="filters" role="group" aria-label="筛选作品">${[['all','全部'],['design','设计'],['code','开发'],['life','生活']].map(([key,name])=>`<button data-filter="${key}" aria-pressed="${key==='all'}"${key==='all'?' class="selected"':''}>${name}</button>`).join('')}</div>`;
await emit('work/index.html',page('作品集','关于设计、技术与生活的实践与探索。','/work/','作品',`<section class="wrap section archive"><p class="eyebrow muted">SELECTED WORK / COLLECTION</p><h1>把想法，变成作品。</h1><p class="page-intro">在设计和技术之间，寻找清晰、有趣的表达。</p><div class="archive-toolbar">${projectNotice(Object.values(site.projects))}${filters}</div><div class="projects">${Object.values(site.projects).map(x=>x.card).join('') || emptyProjects}</div></section>`));
const topicOptions = [...new Set(Object.values(site.articles).map(x=>x.topic || '随笔'))];
await emit('journal/index.html',page('手记','设计思考、技术实践与日常观察。','/journal/','手记',`<section class="wrap section archive"><p class="eyebrow muted">NOTES & THOUGHTS / JOURNAL</p><h1>写在途中。</h1><p class="page-intro">把正在发生的思考，留在这里。</p><div class="journal-tools"><label class="search-field"><span>搜索手记</span><input id="journal-search" type="search" placeholder="输入标题、内容或关键词…" autocomplete="off"></label><label class="topic-field"><span>分类</span><select id="journal-topic"><option value="all">全部分类</option>${topicOptions.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label><button class="save-button" id="saved-filter" aria-pressed="false">只看收藏</button></div><p class="result-count" role="status" aria-live="polite" id="result-count">共 ${Object.keys(site.articles).length} 篇手记</p><div class="journal-list" id="journal-results">${articleList(Object.entries(site.articles))}</div><div id="search-empty" hidden><h2>暂时没有找到匹配的手记。</h2><p>试试其他关键词，或清除筛选后继续浏览。</p><button class="button primary" id="search-reset">清除筛选 ↗</button></div><div class="journal-subscribe"><span>以自己的节奏阅读。</span><a href="/feed.xml">通过 RSS 订阅 ↗</a><button id="copy-feed" class="text-link">复制订阅地址</button></div></section>`));
for (const [kind,items] of [['work',site.projects],['journal',site.articles]]) {
  const entries = Object.entries(items);
  for (const [i,[slug,data]] of entries.entries()) {
    const next = entries.length > 1 ? entries[(i+1)%entries.length] : null;
    const isArticle = kind === 'journal';
    const route = routeFor(kind,slug);
    const toc = `<aside class="detail-toc"><p class="eyebrow muted">ON THIS PAGE</p>${data.sections.map(([title],index)=>`<a href="#section-${index+1}">${String(index+1).padStart(2,'0')} &nbsp; ${esc(title)}</a>`).join('')}<a href="#detail-end">继续探索 ↓</a></aside>`;
    const body = `<div class="reading-progress" aria-hidden="true"><span></span></div><article class="wrap detail"><a class="back-link" href="/${kind}/">← 返回${isArticle?'手记':'作品集'}</a><header class="detail-header"><p class="eyebrow muted">${esc(data.label || (isArticle?'JOURNAL':isExample(data)?'CONCEPT PROJECT':'PROJECT'))}</p><h1>${esc(data.title)}</h1><div class="detail-meta"><span>${isArticle?esc(data.topic || '随笔'):isExample(data)?'概念作品':'项目作品'}</span><span>${esc(site.author)} / ${esc(site.nickname)}</span>${isArticle?`<span>${articleTime(data)} 分钟阅读</span>`:''}</div><p class="detail-lead">${esc(data.intro)}</p><div class="detail-actions"><button class="text-link" id="share-link">复制页面链接 ↗</button>${isArticle?'<button class="text-link" id="save-article" aria-pressed="false">收藏这篇手记 ☆</button>':''}<button class="text-link" id="print-page">打印 / 保存 PDF ↓</button></div><div id="share-fallback" hidden><label>复制下方地址<input type="text" readonly aria-label="页面分享地址"></label></div></header>${!isArticle?`<div class="detail-visual">${data.visual}</div>`:''}<div class="detail-layout">${toc}<div class="prose">${data.sections.map(([title,paragraph],index)=>`<section id="section-${index+1}"><h2>${esc(title)}</h2>${paragraph.split('\n\n').map(p=>`<p>${esc(p)}</p>`).join('')}</section>`).join('')}${data.note?`<p class="content-note">${esc(data.note)}</p>`:''}<div class="author-box"><span class="author-avatar">刘</span><div><strong>${esc(site.author)} <small>${esc(site.nickname)}</small></strong><p>${esc(site.role)} · 保持好奇，持续创造</p><a href="/contact/">交流想法 ↗</a></div></div></div><a class="next-content" id="detail-end" href="/${kind}/${next?next[0]+'/':''}"><span>${next?'继续探索 / '+(isArticle?'下一篇手记':'下一个作品'):'继续探索'}</span><strong>${next?esc(next[1].title):isArticle?'返回全部手记':'返回作品集'}</strong><b>↗</b></a></article>`;
    let html = page(data.title,data.intro,route,isArticle?'手记':'作品',body,isArticle);
    if(isArticle) html=html.replace('</head>',()=>`<script type="application/ld+json">${json({'@context':'https://schema.org','@type':'BlogPosting',headline:data.title,description:data.intro,author:{'@type':'Person',name:site.author},inLanguage:'zh-CN',url:origin?origin+route:undefined})}</script></head>`);
    await emit(`${kind}/${slug}/index.html`,html);
  }
}
const contactLinks = site.social.map(x=>`<a class="social-link" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.name)} ↗</a>`).join('');
await emit('contact/index.html',page('联系我',`联系${site.author}，交流想法与项目。`,'/contact/','',`<section class="wrap section contact-page"><p class="eyebrow muted">LET’S MAKE SOMETHING / SAY HELLO</p><h1>好的故事，<br>从一次<span>交流</span>开始。</h1><p class="page-intro">你好，我是${esc(site.author)}。关于软件开发、设计想法，或只是打个招呼，都欢迎来信。</p><div class="contact-grid"><div><p class="eyebrow muted">EMAIL / 联系邮箱</p>${site.email?`<a class="email-address" href="mailto:${esc(site.email)}">${esc(site.email)} ↗</a><div class="contact-options"><button class="text-link" data-copy="${esc(site.email)}">复制邮箱</button><a href="/contact.vcf" download>保存联系名片 ↓</a></div>`:'<p>暂未开放邮箱联系。</p>'}${site.wechat?`<p>微信：${esc(site.wechat)}</p><button class="text-link" data-copy="${esc(site.wechat)}">复制微信号</button>`:''}<div class="social-links">${contactLinks}</div><p class="contact-hint">邮件会由你设备上的邮件应用发送。本站不收集或保存你的留言。</p></div><form id="contact-form" data-email="${esc(site.email)}"><label>如何称呼你<input name="name" autocomplete="name" maxlength="80" required placeholder="你的名字"></label><label>联系邮箱<input name="email" type="email" autocomplete="email" maxlength="254" required placeholder="you@example.com"></label><label>想聊些什么<textarea name="message" rows="4" minlength="5" maxlength="3000" required placeholder="说说你的想法或项目…"></textarea></label><button class="button primary" type="submit"${site.email?'':' disabled'}>在邮件应用中撰写 <span>↗</span></button><p class="form-note" id="form-status" role="status">填写后打开邮件应用，确认内容后自行发送。</p></form></div></section>`));
await emit('privacy/index.html',page('隐私说明','本网站的数据使用与本地存储说明。','/privacy/','',`<section class="wrap section legal"><p class="eyebrow muted">PRIVACY / 简单透明</p><h1>你的浏览，属于你。</h1><div class="prose"><h2>浏览与本地存储</h2><p>网站不使用广告追踪、第三方分析脚本或访客账户。主题偏好和手记收藏保存在当前浏览器的本地存储中，不会提交给网站作者。不同浏览器和设备之间不会自动同步。</p><h2>联系与外部链接</h2><p>联系表单只在本机整理邮件内容，交由你的邮件应用发送，本站没有留言数据库。点击外部社交链接后，适用对应平台的隐私政策。托管服务商可能为提供服务记录必要的请求日志，具体以其政策为准。</p><h2>清除本机记录</h2><p>你可以随时清除本网站保存的主题偏好和文章收藏。此操作只影响当前浏览器。</p><button class="button primary" id="clear-local-data">清除本站本机记录</button><h2>有问题？</h2><p>${site.email?`请联系 <a href="mailto:${esc(site.email)}">${esc(site.email)}</a>。`:'请通过联系页了解可用的联系方式。'}</p></div></section>`));
await emit('404.html',page('页面未找到','这个地址暂时没有内容。','/404.html','',`<section class="wrap section not-found"><p class="eyebrow muted">404 / A LITTLE DETOUR</p><h1>偶尔迷路，<br>也有新的发现。</h1><p class="page-intro">这个页面可能已移动，或地址有些小差错。</p><a class="button primary" href="/">回到首页 ↗</a><a class="inline-link" href="/journal/">随便读一篇 ↗</a></section>`));
await emit('contact.vcf',`BEGIN:VCARD\r\nVERSION:3.0\r\nFN:${site.author}\r\nN:;${site.author};;;\r\nNICKNAME:${site.nickname}\r\nTITLE:${site.role}\r\n${site.email?'EMAIL;TYPE=INTERNET:'+site.email+'\r\n':''}${origin?'URL:'+origin+'\r\n':''}END:VCARD\r\n`);
await emit('robots.txt',`User-agent: *\nAllow: /\n${origin?'Sitemap: '+origin+'/sitemap.xml\n':''}`);
const routes=['/','/work/','/journal/','/contact/','/privacy/',...Object.keys(site.projects).map(x=>routeFor('work',x)),...Object.keys(site.articles).map(x=>routeFor('journal',x))];
await emit('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${origin?routes.map(route=>`<url><loc>${esc(origin+route)}</loc></url>`).join(''):''}</urlset>`);
await emit('feed.xml',`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${esc(site.name)} · ${esc(site.author)}的手记</title><link>${esc(origin || 'http://127.0.0.1:4317')}</link><description>${description}</description><language>zh-CN</language>${Object.entries(site.articles).map(([slug,data])=>`<item><title>${esc(data.title)}</title><link>${esc((origin || 'http://127.0.0.1:4317')+routeFor('journal',slug))}</link><guid isPermaLink="true">${esc((origin || 'http://127.0.0.1:4317')+routeFor('journal',slug))}</guid><description>${esc(data.intro+(isExample(data)?'（示例手记）':''))}</description></item>`).join('')}</channel></rss>`);
console.log(`Built ${routes.length} pages + 404, RSS, sitemap and contact card → dist/`);
