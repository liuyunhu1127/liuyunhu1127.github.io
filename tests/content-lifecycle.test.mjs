import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('content can be added, renamed, deleted, made real, or emptied without editing tests',async t=>{
  const fixture=await mkdtemp(path.join(tmpdir(),'zixu-content-'));
  // Only this mkdtemp-owned directory can be removed by the final cleanup.
  assert.equal(path.dirname(fixture),path.resolve(tmpdir()));
  assert.ok(path.basename(fixture).startsWith('zixu-content-'));
  try {
    const files=['build.mjs','home.template.html','styles.css','extended.css','site.js','server.mjs','favicon.svg','social-card.svg','tests/site.test.mjs'];
    for(const file of files){await mkdir(path.dirname(path.join(fixture,file)),{recursive:true});await copyFile(path.join(root,file),path.join(fixture,file));}
    await mkdir(path.join(fixture,'content'));
    const original=JSON.parse(await readFile(path.join(root,'content/site.json'),'utf8'));
    let data=structuredClone(original);
    const childEnv={...process.env};
    delete childEnv.NODE_TEST_CONTEXT;
    const run=(args)=>{
      const result=spawnSync(process.execPath,args,{cwd:fixture,encoding:'utf8',timeout:20000,env:childEnv});
      assert.equal(result.status,0,`${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
    };
    const verify=async()=>{await writeFile(path.join(fixture,'content/site.json'),JSON.stringify(data));run(['build.mjs']);run(['--test','tests/site.test.mjs']);};
    await t.test('current content',verify);
    await t.test('replace slugs and add real and sample entries',async()=>{
      // Keep synthetic cases independent of real content and its alias history.
      const entry=index=>({title:`测试内容 ${index}`,intro:'用于维护场景的测试内容。',isExample:index%2===0,sections:[]});
      data.projects=Object.fromEntries([0,1,2].map(index=>[`renamed-project-${index}`,{...entry(index),category:'design'}]));
      data.articles=Object.fromEntries([0,1,2].map(index=>[`renamed-article-${index}`,entry(index)]));
      data.projects.constructor={title:'新的实际项目 $& <成果>',intro:'新增项目介绍。',category:'code',isExample:false,sections:[['实现过程','项目正文。']]};
      data.articles['release-notes']={title:'版本记录 $& <更新>',intro:'新增文章摘要。',topic:'技术实践',isExample:false,sections:[['过程','文章正文。']]};
      data.projects['sample-project']={title:'示例项目',intro:'概念探索。',category:'design',isExample:true,sections:[]};
      data.articles['sample-article']={title:'示例手记',intro:'示例摘要。',isExample:true,sections:[]};
      await verify();
      const home=await readFile(path.join(fixture,'dist/index.html'),'utf8');
      assert.ok(home.includes('标注“概念作品”') || home.includes('以下均为概念作品'));
    });
    await t.test('delete content, rename remaining entries, and remove all sample flags',async()=>{
      data.projects={'my-real-project':{...data.projects.constructor}};
      data.articles={'my-new-article':{...data.articles['release-notes']}};
      delete data.projects['my-real-project'].isExample;
      delete data.articles['my-new-article'].isExample;
      data.author='测试作者 $& <姓名>';
      data.email='editor@example.com';
      await verify();
      const home=await readFile(path.join(fixture,'dist/index.html'),'utf8');
      const archive=await readFile(path.join(fixture,'dist/work/index.html'),'utf8');
      assert.ok(!home.includes('概念作品'));
      assert.ok(!archive.includes('概念作品'));
      const detail=await readFile(path.join(fixture,'dist/work/my-real-project/index.html'),'utf8');
      assert.ok(detail.includes('返回作品集'));
      assert.ok(!detail.includes('下一个作品'));
    });
    await t.test('empty collections remove all old pages and keep navigation valid',async()=>{
      data.projects={};data.articles={};data.email='';
      await verify();
      const home=await readFile(path.join(fixture,'dist/index.html'),'utf8');
      assert.ok(home.includes('作品正在整理'));
      assert.ok(home.includes('手记正在整理'));
      assert.ok(home.includes('(00)'));
    });
  } finally {await rm(fixture,{recursive:true,force:true});}
});
