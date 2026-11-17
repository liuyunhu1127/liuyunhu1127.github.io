import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'dist');
const port=Number(process.env.PORT || 4317);
const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml','.xml':'application/xml; charset=utf-8','.txt':'text/plain; charset=utf-8','.vcf':'text/vcard; charset=utf-8'};
const server=http.createServer(async(request,response)=>{
  const headers={'X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Cache-Control':'no-cache'};
  if(!['GET','HEAD'].includes(request.method)){response.writeHead(405,{...headers,Allow:'GET, HEAD'});response.end();return;}
  let pathname;
  try { pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname); } catch {response.writeHead(400,headers);response.end('Bad request');return;}
  let filename=path.resolve(root,'.'+pathname);
  if(filename!==root&&!filename.startsWith(root+path.sep)){response.writeHead(403,headers);response.end('Forbidden');return;}
  try {
    const info=await stat(filename);
    if(info.isDirectory()){
      if(!pathname.endsWith('/')){response.writeHead(308,{...headers,Location:encodeURI(pathname+'/')+new URL(request.url,'http://localhost').search});response.end();return;}
      filename=path.join(filename,'index.html');
    }
    const data=await readFile(filename);response.writeHead(200,{...headers,'Content-Type':mime[path.extname(filename)]||'application/octet-stream'});response.end(request.method==='HEAD'?undefined:data);
  } catch(error) {
    const status=['ENOENT','ENOTDIR'].includes(error.code)?404:500;
    let data='Page not found';try{data=await readFile(path.join(root,'404.html'));}catch{}
    response.writeHead(status,{...headers,'Content-Type':'text/html; charset=utf-8'});response.end(request.method==='HEAD'?undefined:data);
  }
});
server.listen(port,'127.0.0.1',()=>console.log(`Local: http://127.0.0.1:${server.address().port}`));
