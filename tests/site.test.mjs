import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import http from 'node:http';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
const site=JSON.parse(await readFile(path.join(root,'content/site.json'),'utf8'));
const origin=new URL(process.env.SITE_URL || site.url || 'http://127.0.0.1:4317').origin;
const routes=['/','/work/','/journal/','/contact/','/privacy/',...Object.keys(site.projects).map(slug=>`/work/${slug}/`),...Object.keys(site.articles).map(slug=>`/journal/${slug}/`)];
const xmlEscape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const xmlDecode=value=>value.replace(/&(amp|lt|gt|quot|#39);/g,(_match,name)=>({amp:'&',lt:'<',gt:'>',quot:'"','#39':"'"}[name]));
async function walk(dir) { const files=[]; for(const item of await readdir(dir,{withFileTypes:true})) { const file=path.join(dir,item.name); if(item.isDirectory()) files.push(...await walk(file)); else files.push(file); } return files; }
const htmlFiles=(await walk(dist)).filter(file=>file.endsWith('.html'));
test('every internal link, asset and anchor resolves in the static output',async()=> {
  const expectedFiles=['404.html',...routes.map(route=>route.slice(1)+'index.html')].sort();
  assert.deepEqual(htmlFiles.map(file=>path.relative(dist,file).split(path.sep).join('/')).sort(),expectedFiles,'output must contain exactly the current content pages');
  for(const file of htmlFiles) {
    const html=await readFile(file,'utf8');
    const current='https://test.invalid/'+path.relative(dist,file).split(path.sep).join('/');
    for(const match of html.matchAll(/(?:href|src)="([^"]*)"/g)) {
      const href=match[1].replaceAll('&amp;','&');
      const url=new URL(href,current);
      if(url.origin!=='https://test.invalid') continue;
      let target=path.join(dist,decodeURIComponent(url.pathname));
      if((await stat(target)).isDirectory()) target=path.join(target,'index.html');
      assert.ok((await stat(target)).isFile(),`${file}: missing ${href}`);
      if(url.hash) { const targetHtml=await readFile(target,'utf8'); assert.ok(targetHtml.includes(`id="${decodeURIComponent(url.hash.slice(1))}"`),`${file}: missing anchor ${href}`); }
    }
  }
});
test('all pages have unique IDs, one h1, content, metadata and real identity',async()=> {
  for(const file of htmlFiles) {
    const html=await readFile(file,'utf8'); const ids=[...html.matchAll(/\sid="([^"]+)"/g)].map(x=>x[1]);
    assert.equal(new Set(ids).size,ids.length,`duplicate IDs in ${file}`);
    assert.equal((html.match(/<h1[ >]/g)||[]).length,1,`h1 count in ${file}`);
    assert.match(html,/<main id="main">/);assert.match(html,/<meta name="description" content="[^" ]/);
    assert.ok(html.includes(xmlEscape(site.author)),`author missing in ${file}`);assert.match(html,/lang="zh-CN"/);
    assert.doesNotMatch(html,/联系方式尚未配置|个人简介示例|尚未提供真实邮箱/);
    for(const match of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) assert.doesNotThrow(()=>JSON.parse(match[1]));
  }
});
test('contact card, RSS, sitemap and output are portable and self contained',async()=> {
  const card=await readFile(path.join(dist,'contact.vcf'),'utf8');assert.ok(card.includes(`FN:${site.author}\r\n`));
  if(site.email) assert.ok(card.includes(`EMAIL;TYPE=INTERNET:${site.email}\r\n`)); else assert.doesNotMatch(card,/^EMAIL[;:]/m);
  const feed=await readFile(path.join(dist,'feed.xml'),'utf8');
  const items=[...feed.matchAll(/<item>([\s\S]*?)<\/item>/g)].map(match=>match[1]);
  assert.equal(items.length,Object.keys(site.articles).length);
  for(const [slug,article] of Object.entries(site.articles)) {
    const item=items.find(item=>item.includes(`<link>${xmlEscape(origin+'/journal/'+slug+'/')}</link>`));
    assert.ok(item,`RSS entry missing: ${slug}`);
    assert.ok(item.includes(`<title>${xmlEscape(article.title)}</title>`));
    const summary=xmlDecode(item.match(/<description>([\s\S]*?)<\/description>/)[1]);
    assert.equal(summary,article.intro+(article.isExample===true?'（示例手记）':''));
  }
  const sitemap=await readFile(path.join(dist,'sitemap.xml'),'utf8');
  const locations=[...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match=>xmlDecode(match[1]));
  assert.deepEqual(locations.sort(),routes.map(route=>origin+route).sort());
  const css=await readFile(path.join(dist,'styles.css'),'utf8');assert.doesNotMatch(css,/@import|fonts\.googleapis/);assert.match(css,/^:root\{--bg:#f5f4ef;/);
  const home=await readFile(path.join(dist,'index.html'),'utf8');assert.doesNotMatch(home,/<button class="project|data-article=|data-project=/);
  for(const slug of Object.keys(site.projects).slice(0,3)) assert.ok(home.includes(`href="/work/${slug}/"`));
});
test('project status and archive notices follow isExample',async()=> {
  const archive=await readFile(path.join(dist,'work/index.html'),'utf8');
  const exampleCount=Object.values(site.projects).filter(item=>item.isExample===true).length;
  assert.equal(archive.includes('class="demo-note"'),exampleCount>0);
  for(const [slug,project] of Object.entries(site.projects)) {
    const detail=await readFile(path.join(dist,'work',slug,'index.html'),'utf8');
    const expected=project.isExample===true?'概念作品':'项目作品';
    assert.ok(detail.includes(`<div class="detail-meta"><span>${expected}</span>`),slug);
    const card=archive.match(new RegExp(`<a class="project[^\"]*"[^>]*href="/work/${slug}/"[\\s\\S]*?</a>`))?.[0];
    assert.ok(card?.includes(`data-example="${project.isExample===true}">${expected}</span>`),`status missing from card ${slug}`);
  }
});
test('HTTP server handles deep routes, redirects, HEAD, 404, methods and traversal',async()=> {
  const child=spawn(process.execPath,['server.mjs'],{cwd:root,env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe']});
  try {
    const base=await new Promise((resolve,reject)=> { let output=''; const timer=setTimeout(()=>reject(new Error('Server startup timed out')),5000); child.stdout.on('data',chunk=> { output+=chunk; const address=output.match(/Local: (http:\/\/127\.0\.0\.1:\d+)/); if(address) {clearTimeout(timer);resolve(address[1]);} }); child.once('error',error=>{clearTimeout(timer);reject(error);}); child.once('exit',code=> {clearTimeout(timer);reject(new Error('Server exited before ready: '+code));}); });
    for(const route of [...routes,'/feed.xml','/contact.vcf']) { const response=await fetch(base+route);assert.equal(response.status,200,route);assert.ok((await response.text()).length>20); }
    const redirect=await fetch(base+'/journal',{redirect:'manual'});assert.equal(redirect.status,308);assert.equal(redirect.headers.get('location'),'/journal/');
    const head=await fetch(base+(routes.find(route=>/^\/(work|journal)\/[^/]+\/$/.test(route)) || '/contact/'),{method:'HEAD'});assert.equal(head.status,200);assert.equal(await head.text(),'');
    const missing=await fetch(base+'/missing/');assert.equal(missing.status,404);assert.match(await missing.text(),/偶尔迷路/);
    assert.equal((await fetch(base+'/',{method:'POST'})).status,405);
    const rawStatus=await new Promise((resolve,reject)=> { http.get(base+'/%2e%2e%5ccontent%5csite.json',response=> { response.resume();resolve(response.statusCode); }).on('error',reject); });assert.ok([403,404].includes(rawStatus),'encoded traversal must never expose a source file on Windows or Linux');
  } finally { child.kill(); }
});
