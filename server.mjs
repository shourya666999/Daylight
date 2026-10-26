import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const root = path.dirname(fileURLToPath(import.meta.url));
const execFileAsync=promisify(execFile);
const dataRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), '.daylight-tracker');
const appData = path.join(dataRoot, 'DaylightTracker');
const backupDir = path.join(appData, 'backups');
const dbPath = path.join(appData, 'tracker.sqlite');
fs.mkdirSync(backupDir, { recursive: true });
let db = new DatabaseSync(dbPath);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
  CREATE TABLE IF NOT EXISTS records (
    id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL,
    payload TEXT NOT NULL DEFAULT '{}', created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS records_type_idx ON records(type);
  CREATE INDEX IF NOT EXISTS records_updated_idx ON records(updated_at);
  CREATE TABLE IF NOT EXISTS preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`);
const now = () => new Date().toISOString();
const stmtList = db.prepare('SELECT * FROM records ORDER BY updated_at DESC');
const stmtGet = db.prepare('SELECT * FROM records WHERE id=?');
const stmtPut = db.prepare(`INSERT INTO records(id,type,title,payload,created_at,updated_at) VALUES(?,?,?,?,?,?)
  ON CONFLICT(id) DO UPDATE SET type=excluded.type,title=excluded.title,payload=excluded.payload,updated_at=excluded.updated_at`);
const recordOut = r => ({ id:r.id, type:r.type, title:r.title, ...JSON.parse(r.payload), createdAt:r.created_at, updatedAt:r.updated_at });

function json(res, code, obj) {
  const data = JSON.stringify(obj);
  res.writeHead(code, securityHeaders({ 'Content-Type':'application/json; charset=utf-8', 'Content-Length':Buffer.byteLength(data), 'Cache-Control':'no-store' }));
  res.end(data);
}
function securityHeaders(extra={}) {
  return {
    'X-Content-Type-Options':'nosniff',
    'X-Frame-Options':'DENY',
    'Referrer-Policy':'no-referrer',
    'Permissions-Policy':'camera=(), microphone=(), geolocation=()',
    'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
    ...extra
  };
}
async function body(req, limit=1_000_000) {
  const contentType=String(req.headers['content-type']||'').toLowerCase();
  if(!contentType.startsWith('application/json')) throw Object.assign(new Error('Content-Type must be application/json'),{statusCode:415});
  const chunks=[]; let size=0;
  for await (const c of req) { size+=c.length; if(size>limit) throw Object.assign(new Error('Request too large'),{statusCode:413}); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}
function snapshot() {
  const file = path.join(backupDir, `daylight-${new Date().toISOString().replace(/[:.]/g,'-')}.sqlite`);
  const escaped = file.replace(/'/g, "''");
  db.exec(`VACUUM INTO '${escaped}'`);
  const files=fs.readdirSync(backupDir).filter(x=>x.endsWith('.sqlite')).map(name=>({name,full:path.join(backupDir,name),mtime:fs.statSync(path.join(backupDir,name)).mtimeMs})).sort((a,b)=>b.mtime-a.mtime);
  for(const old of files.slice(30)) fs.rmSync(old.full,{force:true});
  return { name:path.basename(file), createdAt:new Date().toISOString() };
}
function backupIfDue(force=false) {
  const latest=fs.readdirSync(backupDir).filter(x=>x.endsWith('.sqlite')).map(x=>fs.statSync(path.join(backupDir,x)).mtimeMs).sort((a,b)=>b-a)[0] || 0;
  if(force || Date.now()-latest>24*60*60*1000) return snapshot();
  return null;
}
try { backupIfDue(); } catch (e) { console.error('Automatic backup failed:',e.message); }
setInterval(()=>{ try { backupIfDue(); } catch(e) { console.error('Automatic backup failed:',e.message); } }, 60*60*1000).unref();

const types = new Set(['inbox','task','project','note','log','habit','habitEntry','goal','milestone','workout','pomodoro','income','expense','subscription']);
const server = http.createServer(async (req,res)=>{
  const url = new URL(req.url, 'http://127.0.0.1');
  try {
    const address=server.address();
    const expectedHost=typeof address==='object' && address ? `127.0.0.1:${address.port}` : '';
    const expectedOrigin=`http://${expectedHost}`;
    if(!expectedHost || req.headers.host!==expectedHost) return json(res,403,{error:'Invalid Host header'});
    if(req.headers.origin && req.headers.origin!==expectedOrigin) return json(res,403,{error:'Invalid Origin header'});
    if(req.headers['sec-fetch-site']==='cross-site') return json(res,403,{error:'Cross-site requests are not allowed'});
    if(url.pathname.startsWith('/api/')) {
      if(req.method==='GET' && url.pathname==='/api/records') {
        const type=url.searchParams.get('type'); const q=(url.searchParams.get('q')||'').toLocaleLowerCase();
        let result;
        if(type && q) result=db.prepare("SELECT * FROM records WHERE type=? AND (instr(lower(title),?)>0 OR instr(lower(payload),?)>0) ORDER BY updated_at DESC LIMIT 1000").all(type,q,q).map(recordOut);
        else if(type) result=db.prepare('SELECT * FROM records WHERE type=? ORDER BY updated_at DESC').all(type).map(recordOut);
        else if(q) result=db.prepare("SELECT * FROM records WHERE instr(lower(title),?)>0 OR instr(lower(payload),?)>0 ORDER BY updated_at DESC LIMIT 1000").all(q,q).map(recordOut);
        else result=stmtList.all().map(recordOut);
        return json(res,200,result);
      }
      if(req.method==='POST' && url.pathname==='/api/records') {
        const input=await body(req); const type=String(input.type||'');
        if(!types.has(type) && !/^custom_[a-z0-9_]+$/.test(type)) return json(res,400,{error:'Unsupported record type'});
        const id=input.id || randomUUID(); const title=String(input.title||'Untitled').trim().slice(0,240) || 'Untitled';
        const previous=stmtGet.get(id); const createdAt=previous?.created_at||now(); const updatedAt=now();
        const payload={...input}; delete payload.id; delete payload.type; delete payload.title; delete payload.createdAt; delete payload.updatedAt;
        stmtPut.run(id,type,title,JSON.stringify(payload),createdAt,updatedAt);
        return json(res,200,recordOut(stmtGet.get(id)));
      }
      if(req.method==='DELETE' && url.pathname.startsWith('/api/records/')) {
        const id=decodeURIComponent(url.pathname.slice('/api/records/'.length)); db.prepare('DELETE FROM records WHERE id=?').run(id); return json(res,200,{ok:true});
      }
      if(req.method==='GET' && url.pathname==='/api/settings') {
        const row=db.prepare('SELECT value FROM preferences WHERE key=?').get('app');
        return json(res,200,row?JSON.parse(row.value):{});
      }
      if(req.method==='PUT' && url.pathname==='/api/settings') {
        const settings=await body(req);
        db.prepare('INSERT INTO preferences(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run('app',JSON.stringify(settings));
        return json(res,200,{ok:true});
      }
      if(req.method==='GET' && url.pathname==='/api/backups') {
        const list=fs.readdirSync(backupDir).filter(x=>x.endsWith('.sqlite')).map(name=>({name,createdAt:fs.statSync(path.join(backupDir,name)).mtime.toISOString()})).sort((a,b)=>b.createdAt.localeCompare(a.createdAt));
        const displayDirectory=process.env.LOCALAPPDATA?'%LOCALAPPDATA%\\DaylightTracker\\backups':'~/.daylight-tracker/DaylightTracker/backups';
        return json(res,200,{directory:displayDirectory, lastSuccess:list[0]?.createdAt||null, backups:list});
      }
      if(req.method==='POST' && url.pathname==='/api/open-storage') {
        await body(req);
        if(process.platform==='win32') await execFileAsync(path.join(process.env.WINDIR||'C:\\Windows','explorer.exe'),[`/select,${dbPath}`],{windowsHide:true,timeout:5000});
        else if(process.platform==='darwin') await execFileAsync('open',['-R',dbPath],{timeout:5000});
        else await execFileAsync('xdg-open',[appData],{timeout:5000});
        return json(res,200,{ok:true});
      }
      if(req.method==='POST' && url.pathname==='/api/backups/create') return json(res,200,snapshot());
      if(req.method==='POST' && url.pathname==='/api/backups/restore') {
        const {name}=await body(req);
        if(typeof name!=='string' || path.basename(name)!==name || !name.endsWith('.sqlite')) return json(res,400,{error:'Invalid backup name'});
        const file=path.join(backupDir,name); if(!fs.existsSync(file)) return json(res,404,{error:'Backup not found'});
        snapshot();
        db.close();
        const restored=path.join(appData,'restore.sqlite'); fs.copyFileSync(file,restored);
        for(const suffix of ['','-wal','-shm']) { const current=dbPath+suffix; if(fs.existsSync(current)) fs.rmSync(current,{force:true}); }
        fs.renameSync(restored,dbPath); db=new DatabaseSync(dbPath); db.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;');
        const check=db.prepare('PRAGMA quick_check').get();
        if(check.quick_check!=='ok') return json(res,500,{error:'Backup database failed validation'});
        return json(res,200,{ok:true});
      }
      if(req.method==='GET' && url.pathname==='/api/health') return json(res,200,{ok:true,storage:'local',version:'0.1.0'});
      return json(res,404,{error:'Not found'});
    }
    const rel=url.pathname==='/'?'index.html':decodeURIComponent(url.pathname.slice(1));
    const target=path.resolve(root,'public',rel);
    const publicRoot=path.resolve(root,'public')+path.sep;
    if(!target.startsWith(publicRoot)) return json(res,403,{error:'Forbidden'});
    const ext=path.extname(target);
    const mime={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.svg':'image/svg+xml'}[ext]||'application/octet-stream';
    fs.readFile(target,(err,data)=>{ if(err){res.writeHead(404,securityHeaders({'Cache-Control':'no-store'}));res.end('Not found');return;} res.writeHead(200,securityHeaders({'Content-Type':mime,'Cache-Control':'no-store'}));res.end(data); });
  } catch(error) { console.error(error); if(!res.headersSent) json(res,error.statusCode||500,{error:error.message||'Unexpected error'}); }
});
const requestedPort=Number(process.env.PORT||4173);
function listenOnAvailablePort(port) {
  return new Promise((resolve,reject)=>{
    const onError=error=>{
      server.off('listening',onListening);
      if(error.code==='EADDRINUSE' && port<requestedPort+100) return resolve(listenOnAvailablePort(port+1));
      reject(error);
    };
    const onListening=()=>{
      server.off('error',onError);
      const address=server.address();
      const boundPort=typeof address==='object' && address ? address.port : port;
      fs.writeFileSync(path.join(appData,'server-url.txt'),`http://127.0.0.1:${boundPort}`,'utf8');
      resolve(boundPort);
    };
    server.once('error',onError);
    server.once('listening',onListening);
    server.listen(port,'127.0.0.1');
  });
}
listenOnAvailablePort(requestedPort).then(port=>{
  console.log(`Daylight Tracker running at http://127.0.0.1:${port}`);
  console.log(`Local data: ${appData}`);
}).catch(error=>{
  console.error(`Could not start Daylight Tracker on 127.0.0.1 ports ${requestedPort}–${requestedPort+100}:`,error.message);
  process.exitCode=1;
});
process.on('SIGINT',()=>{try{fs.rmSync(path.join(appData,'server-url.txt'),{force:true});}catch{} try{db.close();}catch{} server.close(()=>process.exit(0));});
