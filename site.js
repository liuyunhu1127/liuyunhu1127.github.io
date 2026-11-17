const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const storage = { get(key,fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }, set(key,value) { try { localStorage.setItem(key,JSON.stringify(value)); return true; } catch { return false; } } };
let toastTimeout;
function notify(message) { const toast=$('#toast'); if(!toast) return; toast.textContent=message; toast.classList.add('visible'); clearTimeout(toastTimeout); toastTimeout=setTimeout(()=>toast.classList.remove('visible'),4000); }
const theme = $('.theme-button');
function setTheme(dark) { document.body.classList.toggle('dark',dark); theme?.setAttribute('aria-label',dark?'切换浅色主题':'切换深色主题'); theme?.setAttribute('aria-pressed',String(dark)); $('meta[name="theme-color"]').content=dark?'#20241f':'#f5f4ef'; }
let storedTheme=storage.get('zixu-theme',null);
try { if(storedTheme===null && localStorage.getItem('zixu-theme')==='dark') storedTheme='dark'; } catch {}
setTheme(storedTheme==='dark');
theme?.addEventListener('click',()=> { const dark=!document.body.classList.contains('dark'); setTheme(dark); storage.set('zixu-theme',dark?'dark':'light'); });
const menu=$('.menu-toggle');
function closeMenu() { $('#navigation')?.classList.remove('open'); menu?.setAttribute('aria-expanded','false'); menu?.setAttribute('aria-label','打开导航菜单'); }
menu?.addEventListener('click',()=> { const open=$('#navigation').classList.toggle('open'); menu.setAttribute('aria-expanded',String(open)); menu.setAttribute('aria-label',open?'关闭导航菜单':'打开导航菜单'); });
$$('#navigation a').forEach(link=>link.addEventListener('click',closeMenu));
document.addEventListener('keydown',event=> { if(event.key==='Escape') closeMenu(); });
document.addEventListener('click',event=> { if(!event.target.closest('.header')) closeMenu(); });
let projectFilter='all';
const params=new URLSearchParams(location.search);
if(['design','code','life'].includes(params.get('category'))) projectFilter=params.get('category');
function filterProjects() { $$('[data-filter]').forEach(button=> { const active=button.dataset.filter===projectFilter; button.classList.toggle('selected',active); button.setAttribute('aria-pressed',String(active)); }); $$('[data-category]').forEach(card=>card.hidden=projectFilter!=='all'&&card.dataset.category!==projectFilter); }
filterProjects();
$$('[data-filter]').forEach(button=>button.addEventListener('click',()=> { projectFilter=button.dataset.filter; filterProjects(); const url=new URL(location.href); if(projectFilter==='all') url.searchParams.delete('category'); else url.searchParams.set('category',projectFilter); history.replaceState(null,'',url); }));
let saved=storage.get('zixu-saved',[]); if(!Array.isArray(saved)) saved=[];
let savedOnly=false;
const search=$('#journal-search');
const topic=$('#journal-topic');
if(search) search.value=params.get('q') || '';
if(topic && [...topic.options].some(option=>option.value===params.get('topic'))) topic.value=params.get('topic');
function searchArticles(updateUrl=false) {
  if(!search) return;
  const words=search.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean); const category=topic.value;
  let count=0;
  $$('#journal-results .journal-item').forEach(item=> { const matches=words.every(word=>item.dataset.search.toLocaleLowerCase().includes(word))&&(category==='all'||item.dataset.topic===category)&&(!savedOnly||saved.includes(new URL(item.href).pathname)); item.hidden=!matches; if(matches) count++; });
  $('#result-count').textContent=`共 ${count} 篇手记${savedOnly?' · 本机收藏':''}`; $('#search-empty').hidden=count!==0;
  if(updateUrl) { const url=new URL(location.href); for(const [key,value] of [['q',search.value.trim()],['topic',category==='all'?'':category]]) { if(value) url.searchParams.set(key,value); else url.searchParams.delete(key); } history.replaceState(null,'',url); }
}
search?.addEventListener('input',()=>searchArticles(true)); topic?.addEventListener('change',()=>searchArticles(true));
$('#saved-filter')?.addEventListener('click',event=> { savedOnly=!savedOnly; event.currentTarget.setAttribute('aria-pressed',String(savedOnly)); searchArticles(); });
$('#search-reset')?.addEventListener('click',()=> { search.value=''; topic.value='all'; savedOnly=false; $('#saved-filter').setAttribute('aria-pressed','false'); searchArticles(true); search.focus(); });
searchArticles();
const saveButton=$('#save-article');
const articlePath=location.pathname;
function updateSavedButton() { const active=saved.includes(articlePath); if(saveButton) { saveButton.setAttribute('aria-pressed',String(active)); saveButton.textContent=active?'已收藏 ★':'收藏这篇手记 ☆'; } }
updateSavedButton();
saveButton?.addEventListener('click',()=> { const active=saved.includes(articlePath); const next=active?saved.filter(x=>x!==articlePath):[...saved,articlePath]; if(storage.set('zixu-saved',next)) { saved=next; updateSavedButton(); notify(active?'已取消收藏':'已保存到当前浏览器的收藏'); } else notify('当前浏览器无法保存收藏，请使用浏览器书签。'); });
window.addEventListener('storage',event=> { if(event.key==='zixu-saved') { saved=storage.get('zixu-saved',[]); if(!Array.isArray(saved)) saved=[]; updateSavedButton(); searchArticles(); } });
async function copyText(text) { try { await navigator.clipboard.writeText(text); notify('已复制'); return true; } catch { notify('无法自动复制，请手动选择并复制。'); return false; } }
$$('[data-copy]').forEach(button=>button.addEventListener('click',()=>copyText(button.dataset.copy)));
$('#share-link')?.addEventListener('click',async()=> { if(!await copyText(location.href)) { const fallback=$('#share-fallback'); fallback.hidden=false; const input=fallback.querySelector('input'); input.value=location.href; input.focus(); input.select(); } });
$('#copy-feed')?.addEventListener('click',async()=> { const url=location.origin+'/feed.xml'; if(!await copyText(url)) notify('订阅地址：'+url); });
$('#print-page')?.addEventListener('click',()=>window.print());
$('#clear-local-data')?.addEventListener('click',()=> { try { localStorage.removeItem('zixu-theme'); localStorage.removeItem('zixu-saved'); saved=[]; setTheme(false); notify('已清除本站保存在本机的主题和收藏。'); } catch { notify('当前浏览器不允许访问本地存储。'); } });
$('#contact-form')?.addEventListener('submit',event=> { event.preventDefault(); const form=event.currentTarget; if(!form.reportValidity() || !form.dataset.email) return; const values=new FormData(form); const subject=`来自 ${String(values.get('name')).trim()} 的网站来信`; const body=`你好：\n\n${String(values.get('message')).trim()}\n\n——\n姓名：${String(values.get('name')).trim()}\n回复邮箱：${String(values.get('email')).trim()}`; location.href=`mailto:${form.dataset.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; $('#form-status').textContent='已请求打开邮件应用，邮件尚未发送。若未弹出，请使用左侧邮箱直接联系。'; });
const progress=$('.reading-progress span');
if(progress) { const update=()=> { const height=document.documentElement.scrollHeight-innerHeight; progress.style.width=`${height>0?Math.min(100,scrollY/height*100):100}%`; }; addEventListener('scroll',update,{passive:true}); addEventListener('resize',update); update(); }
function updateTime() { const now=new Date(); if($('#local-time')) $('#local-time').textContent='CHINA · '+new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Shanghai',hour:'2-digit',minute:'2-digit',hour12:false}).format(now); if($('#year')) $('#year').textContent=new Intl.DateTimeFormat('en',{timeZone:'Asia/Shanghai',year:'numeric'}).format(now); }
updateTime(); setInterval(updateTime,60000);
