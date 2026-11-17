import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, copyFile, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
test('old URLs survive repeated renames while unsafe or ambiguous aliases fail before output changes',async t=>{
  const fixture=await mkdtemp(path.join(tmpdir(),'zixu-redirects-'));
  assert.equal(path.dirname(fixture),path.resolve(tmpdir()));
  assert.ok(path.basename(fixture).startsWith('zixu-redirects-'));
  try {
    for(const file of ['build.mjs','home.template.html','styles.css','extended.css','site.js','server.mjs','favicon.svg','social-card.svg','tests/site.test.mjs']) {
      await mkdir(path.dirname(path.join(fixture,file)),{recursive:true});
      await copyFile(path.join(root,file),path.join(fixture,file));
    }
    await mkdir(path.join(fixture,'content'));
    const profile=JSON.parse(await readFile(path.join(root,'content/site.json'),'utf8'));
    const project={title:'链接保持可用的项目',intro:'项目介绍。',category:'code',isExample:false,sections:[['介绍','项目正文。']]};
    const article={title:'链接保持可用的文章',intro:'文章摘要。',isExample:false,sections:[['介绍','文章正文。']]};
    let data={...profile,projects:{'old-project':project},articles:{'old-article':article}};
    const save=()=>writeFile(path.join(fixture,'content/site.json'),JSON.stringify(data));
    const childEnv={...process.env};
    delete childEnv.NODE_TEST_CONTEXT;
    const run=(args)=>spawnSync(process.execPath,args,{cwd:fixture,encoding:'utf8',timeout:20000,env:childEnv});
    const verify=async()=>{
      await save();
      for(const args of [['build.mjs'],['--test','tests/site.test.mjs']]) {
        const result=run(args);assert.equal(result.status,0,`${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
      }
    };
    await t.test('original URLs',verify);
    await t.test('old pages become redirects after both collections are renamed',async()=>{
      data.projects={'new-project':{...project,aliases:['old-project','shared-old']}};
      data.articles={'new-article':{...article,aliases:['old-article','shared-old']}};
      await verify();
    });
    await t.test('all historical slugs jump directly to the latest canonical page',async()=>{
      data.projects={'final-project':{...project,aliases:['old-project','shared-old','new-project']}};
      data.articles={'final-article':{...article,aliases:['old-article','shared-old','new-article']}};
      await verify();
      const oldPage=await readFile(path.join(fixture,'dist/work/old-project/index.html'),'utf8');
      assert.ok(oldPage.includes('location.replace("/work/final-project/"'));
    });
    await t.test('removing an alias removes only that redirect',async()=>{
      data.projects['final-project'].aliases=['old-project','new-project'];
      await verify();
    });
    const valid=structuredClone(data);
    const invalidCases=[
      ['string instead of array',value=>{value.projects['final-project'].aliases='old-project';}],
      ['null instead of array',value=>{value.projects['final-project'].aliases=null;}],
      ['external URL',value=>{value.projects['final-project'].aliases=['https://example.com'];}],
      ['path traversal',value=>{value.projects['final-project'].aliases=['../escape'];}],
      ['empty slug',value=>{value.projects['final-project'].aliases=[''];}],
      ['non-string slug',value=>{value.projects['final-project'].aliases=[123];}],
      ['self redirect',value=>{value.projects['final-project'].aliases=['final-project'];}],
      ['duplicate alias',value=>{value.projects['final-project'].aliases=['old-project','old-project'];}],
      ['alias used by two projects',value=>{value.projects.other={...project,aliases:['old-project']};}],
      ['alias shadows another canonical page',value=>{value.projects['old-project']=project;}],
      ['cycle between canonical pages',value=>{value.projects['final-project'].aliases=['other'];value.projects.other={...project,aliases:['final-project']};}],
      ['article collision',value=>{value.articles.other={...article,aliases:['old-article']};}]
    ];
    for(const [name,change] of invalidCases) await t.test('reject '+name,async()=>{
      const before=await readFile(path.join(fixture,'dist/index.html'),'utf8');
      data=structuredClone(valid);change(data);await save();
      const result=run(['build.mjs']);
      assert.notEqual(result.status,0);
      assert.match(result.stderr,/aliases/);
      assert.equal(await readFile(path.join(fixture,'dist/index.html'),'utf8'),before,'invalid aliases must not clear a previously good output');
    });
    await t.test('deleting the content also removes its redirects',async()=>{
      data={...profile,projects:{},articles:{}};
      await verify();
    });
  } finally {await rm(fixture,{recursive:true,force:true});}
});
