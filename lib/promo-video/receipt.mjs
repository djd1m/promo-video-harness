import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';

export const aggregate = (codes) => codes.includes(1) ? 1 : codes.some(c => c !== 0) ? 2 : 0;
export function observation(raw, rc, stop, image = null, cid = null, owner = null) {
  let data;
  try { data = JSON.parse(raw)?.[0]; } catch {}
  const s = data?.State;
  const valid = s && Number.isInteger(s.ExitCode) && typeof s.OOMKilled === 'boolean' &&
    typeof s.Running === 'boolean' && Number.isInteger(data.RestartCount);
  const defect = valid && (s.OOMKilled || data.RestartCount > 0 || (stop === 'none' && s.ExitCode !== 0 && s.ExitCode !== 2));
  const identityMismatch = (image && data?.Image && data.Image !== image) ||
    (cid && data?.Id && data.Id !== cid) || (owner && data?.Config?.Labels?.['promo.attempt'] && data.Config.Labels['promo.attempt'] !== owner);
  const identityMissing = image && (!data?.Image || !data?.Id || !data?.Config?.Labels?.['promo.attempt']);
  const code = defect || identityMismatch ? 1 : !valid || identityMissing || s.Running || stop !== 'none' || rc === 2 ? 2 : rc === 0 && s.ExitCode === 0 ? 0 : 1;
  return {code, exit_code: valid ? s.ExitCode : null, OOMKilled: valid ? s.OOMKilled : null,
    restart_count: valid ? data.RestartCount : null, running: valid ? s.Running : null,
    image_id:data?.Image ?? null, identity_mismatch:!!identityMismatch,
    command_exit: rc, timeout: stop === 'timeout', interrupted: stop === 'interrupted', inspection_available: !!valid};
}
export async function loadConfig(file) {
  const cfg = (await import(pathToFileURL(file).href)).default;
  if (!cfg || cfg.id !== 'demo' || !Array.isArray(cfg.scenes) || cfg.scenes.length !== 5 ||
      cfg.scenes.reduce((n, s) => n + s.seconds, 0) !== 45 ||
      cfg.scenes.map(s => s.type).join(',') !== 'title,screen,screen,screen,outro') throw Error('Expected five demo scenes totaling 45 seconds');
  for (const [id, size] of Object.entries({'16x9': [1920,1080], '9x16': [1080,1920], '1x1': [1080,1080]})) {
    if (JSON.stringify(cfg.capture?.formats?.[id]) !== JSON.stringify(size)) throw Error(`Invalid format ${id}`);
  }
  if(cfg.capture.seconds !== 37 || cfg.capture.fps !== 25 ||
      !['name','tagline','url'].every(k=>typeof cfg[k] === 'string' && cfg[k].trim()) ||
      !['paper','ink','accent'].every(k=>/^#[a-f0-9]{6}$/i.test(cfg.tokens?.[k] ?? '')) ||
      !cfg.font?.family || !['400','600','700'].every(w=>cfg.font.files?.some(f=>f.weight === w && /^fonts\/[a-z0-9-]+\.ttf$/.test(f.file)))) throw Error('Invalid capture/tokens/font fields');
  for (const scene of cfg.scenes) {
    if (!(scene.seconds > 0) || !Number.isInteger(scene.seconds * 30) || scene.footnote !== 'Synthetic demo data') throw Error('Invalid timing/demo marking');
    if (scene.type !== 'screen') continue;
    for (const fmt of ['wide', 'tall', 'square']) {
      const tr = scene.tracks?.[scene.use?.[fmt]?.track];
      if (!tr || !/^[a-z0-9-]+\.webm$/.test(tr.file) || tr.size?.length !== 2 ||
          !tr.size.every(n => Number.isInteger(n) && n > 0) ||
          !Array.isArray(tr.segments) || tr.segments.reduce((n, s) => n + s.seconds, 0) !== scene.seconds ||
          tr.segments.some(s => !(s.from >= 0 && s.to > s.from && s.to <= 37 && s.seconds > 0) || !s.caption)) throw Error('Invalid demo track');
    }
  }
  return cfg;
}
const hash = async (file) => {
  const h = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) h.update(chunk);
  return h.digest('hex');
};
const walk = (dir, budget={entries:0}) => fs.readdirSync(dir, {withFileTypes:true}).flatMap(e => {
  if (++budget.entries > 10000) throw Error('File inventory exceeds the 10000-entry attempt bound');
  const p=path.join(dir,e.name);
  if(e.isSymbolicLink()) throw Error(`Unexpected symlink in evidence inventory: ${p}`);
  return e.isDirectory() ? walk(p,budget) : e.isFile() ? [p] : [];
});
const git = (...args) => {
  const r = spawnSync('git', ['-C', process.env.PROMO_ROOT, ...args], {encoding:'utf8', timeout:5000, maxBuffer:1048576});
  return r.status === 0 ? r.stdout.trim() : null;
};
async function identity() {
  const root = process.env.PROMO_ROOT;
  const files = ['bin/promo-video','lib/promo-video','demo/synthetic','promo/remotion/shared',
    'promo/capture/hidpi-recorder.mjs','promo/remotion/package.json','promo/remotion/package-lock.json','promo/remotion/tsconfig.json',
    '.claude/skills/promo-video/scripts','promo/render-image/Dockerfile',
    'promo/render-image/fonts/build_onest.py'].flatMap(f => {
      const p = path.join(root,f); return fs.statSync(p).isDirectory() ? walk(p) : [p];
    }).sort();
  const sources = [];
  for (const f of files) sources.push([path.relative(root,f), await hash(f)]);
  return {revision:git('rev-parse','HEAD'), dirty_state:git('status','--porcelain'),
    tree_sha256:createHash('sha256').update(JSON.stringify(sources)).digest('hex'), files:sources,
    configuration:{path:process.env.PROMO_CONFIG, sha256:await hash(process.env.PROMO_CONFIG)}};
}
const receiptPath = () => path.join(process.env.PROMO_ATTEMPT,'receipt.json');
const read = () => JSON.parse(fs.readFileSync(receiptPath(),'utf8'));
const save = (r) => {
  const file = receiptPath(), tmp=file+`.${process.pid}.tmp`; fs.writeFileSync(tmp, JSON.stringify(r,null,2)+'\n'); fs.renameSync(tmp,file);
};
const executionFiles = (dir, command, sources) => command === 'capture' ? [path.join(dir,'config.mjs')] :
  ['package.json','package-lock.json','tsconfig.json','demo/project.config.ts','demo/demo-intervals.tsv',
    ...sources.filter(([f])=>f.startsWith('promo/remotion/shared/')).map(([f])=>f.slice('promo/remotion/'.length))].map(f=>path.join(dir,'work',f));
const publicFiles = (dir, cfg) => [...new Set(cfg.font.files.map(f=>f.file)),
  ...Object.keys(cfg.capture.formats).map(f=>`rec/demo-${f}.webm`)].map(f=>path.join(dir,'work/demo/public',f));
function stagedInventory(dir, expected, deps) {
  const actual=[], dirs=new Set([dir]); let count=0;
  for(const f of expected) for(let p=path.dirname(f); p.startsWith(dir+path.sep); p=path.dirname(p)) dirs.add(p);
  const visit=p=>{
    for(const e of fs.readdirSync(p,{withFileTypes:true})) {
      if(++count>10000) throw Error('Staged inventory exceeds bound');
      const f=path.join(p,e.name);
      if(e.isSymbolicLink()) {
        if(f!==path.join(dir,'node_modules') || fs.readlinkSync(f)!=='/deps/node_modules') return false;
      } else if(e.isDirectory()) { if(!dirs.has(f) || !visit(f)) return false; }
      else if(e.isFile()) actual.push(f); else return false;
    }
    return true;
  };
  return visit(dir) && actual.every(f=>expected.includes(f)) &&
    (!deps || !fs.lstatSync(path.join(dir,'node_modules'),{throwIfNoEntry:false}) ||
      fs.lstatSync(path.join(dir,'node_modules')).isSymbolicLink());
}
async function checkExecution(r, dir, sealing=false) {
  const codes=[], required=executionFiles(dir,r.command,r.source.files);
  for(const [actual,expected] of [[r.artifacts.attempt,dir], ...(r.command === 'render' ?
    [[r.artifacts.work,path.join(dir,'work')], [r.artifacts.dependencies,path.join(process.env.PROMO_ROOT,'promo/remotion/node_modules')]] : [])]) {
    if(!actual) codes.push(2); else if(actual!==expected) return 1;
  }
  if(r.command === 'render') {
    const cfg=await loadConfig(process.env.PROMO_CONFIG);
    if(r.execution_sealed || sealing) required.push(...publicFiles(dir,cfg));
    const expected=sealing ? required : Object.keys(r.execution || {});
    if(!fs.existsSync(path.join(dir,'work'))) codes.push(2);
    else if(!stagedInventory(path.join(dir,'work'),expected,true)) return 1;
    if(!fs.lstatSync(path.join(dir,'work/node_modules'),{throwIfNoEntry:false})) codes.push(2);
    if(!r.execution_sealed && !sealing && Object.keys(r.execution || {}).some(f=>!required.includes(f))) return 1;
  }
  if (!r.execution || required.some(f=>!r.execution[f] && !sealing)) codes.push(2);
  for (const [f,h] of Object.entries(r.execution || {})) {
    if (!required.includes(f) || !/^[a-f0-9]{64}$/.test(h)) return 1;
    if (!fs.existsSync(f)) { codes.push(2); continue; }
    if (fs.realpathSync(f) !== path.resolve(f) || await hash(f) !== h) return 1;
  }
  if(sealing && required.some(f=>!fs.existsSync(f))) codes.push(2);
  return aggregate(codes);
}
const mutableReview = f => /(?:^|\/)(?:verdict|captions-proof)\.tsv$/.test(f);
async function checkHashes(r, dir) {
  if (!r.hashes || !Object.keys(r.hashes).length) return 2;
  const codes=[], required=r.command === 'capture' ? ['16x9','9x16','1x1'].map(f=>path.join(r.artifacts.assets,`demo-${f}.webm`))
    : ['16x9','9x16','1x1','16x9-repeat'].map(f=>path.join(dir,'out/final',`${f}.mp4`));
  if(r.command==='render') {
    const proof=path.join(dir,'out/final/proof');
    required.push(...['config-inspect.tsv','index.tsv','transitions/index.tsv'].map(f=>path.join(proof,f)));
    for(const fmt of ['16x9','9x16','1x1']) if(!Object.keys(r.hashes).some(f=>f.startsWith(path.join(proof,'sheets',fmt+'-')) && f.endsWith('.png'))) codes.push(2);
  }
  if(required.some(f=>!r.hashes[f])) codes.push(2);
  const allowed=[path.join(dir,'out/final'), r.artifacts.assets];
  for(const [f,h] of Object.entries(r.hashes)) {
    if(!allowed.some(base=>base && f.startsWith(base+path.sep)) || !/^[a-f0-9]{64}$/.test(h) || mutableReview(f)) return 1;
    if(!fs.existsSync(f)) { codes.push(2); continue; }
    if(fs.realpathSync(f)!==path.resolve(f) || await hash(f)!==h) return 1;
  }
  // Declarations may change, but remain regular files at their prescribed paths.
  const proof=path.join(dir,'out/final/proof');
  if(fs.existsSync(proof)) {
    let files;try { files=walk(proof); } catch { return 1; }
    if(files.some(f=>!mutableReview(f) && !r.hashes[f])) return 1;
  }
  return aggregate(codes);
}
async function sourceCheck(r) {
  const now=await identity();
  return r.source?.revision===now.revision && JSON.stringify(r.source.files)===JSON.stringify(now.files) &&
    r.source.tree_sha256===now.tree_sha256 && r.source.configuration?.sha256===now.configuration.sha256 ? 0 : 1;
}
export function renderMeasurements(r, since='', ops='bundle 16x9 9x16 1x1 16x9-repeat') {
  if(r.schema!=='promo-portable-attempt/v1' || r.command!=='render' || r.attempt_id!==path.basename(r.artifacts?.attempt || '')) return 1;
  if(r.status===1 || (r.checks || []).some(c=>c.code===1)) return 1;
  if((r.docker || []).some((o,i,rows)=>o.code===1 || o.OOMKilled===true || o.restart_count>0 ||
    o.identity_mismatch || (o.image_id && o.image_id!==r.environment?.image_id) ||
    rows.findIndex(row=>row.operation===o.operation)!==i)) return 1;
  const codes=[r.status===1 ? 1 : r.status===0 ? 0 : 2, ...(r.checks || []).map(c=>c.code)];
  if(!r.finished || !r.started || !Number.isFinite(Date.parse(r.started)) || !Number.isFinite(Date.parse(r.finished))) codes.push(2);
  if(Date.parse(r.finished)<Date.parse(r.started) || (since && Date.parse(r.started)<Date.parse(since))) return 1;
  if(r.execution_sealed!==true || !/^sha256:[a-f0-9]{64}$/.test(r.environment?.image_id || '')) codes.push(2);
  if(r.watchdog?.state!=='not_applicable' || !r.watchdog.rationale?.trim()) codes.push(2);
  const required=[...new Set(['bundle','16x9','9x16','1x1','16x9-repeat',...ops.split(/\s+/),
    'probe-16x9','probe-9x16','probe-1x1',...(r.docker || []).map(o=>o.operation)])];
  for(const op of required) {
    const rows=(r.docker || []).filter(o=>o.operation===op);
    if(rows.length!==1) {codes.push(rows.length>1?1:2);continue;}
    const o=rows[0];
    if(o.image_id && o.image_id!==r.environment?.image_id) {codes.push(1);continue;}
    if(o.OOMKilled===true || o.restart_count>0 || o.identity_mismatch || o.code===1) {codes.push(1);continue;}
    if(o.code!==0 || o.exit_code!==0 || o.command_exit!==0 || o.OOMKilled!==false || o.restart_count!==0 ||
      o.running!==false || o.timeout!==false || o.interrupted!==false || o.inspection_available!==true ||
      o.image_id!==r.environment?.image_id || !/^[a-f0-9]{64}$/.test(o.container || '')) codes.push(2);
    const cleanup=(r.checks || []).filter(c=>c.name===`${op}-cleanup`);
    if(cleanup.some(c=>c.code===1)) codes.push(1);
    codes.push(cleanup.length===1 && cleanup[0].code===0 && cleanup[0].detail===`cid=${o.container} stop_raw_exit=not_requested remove_raw_exit=0 order=inspect,remove` ? 0 : 2);
  }
  for(const name of ['gate-config','gate-media','repro','storyboard','transitions-make']) {
    const rows=(r.checks || []).filter(c=>c.name===name);codes.push(rows.length===1 ? rows[0].code : 2);
  }
  return aggregate(codes);
}
async function portableGate(r, file, since, ops) {
  if(path.resolve(file)!==path.join(r.artifacts?.attempt || '', 'receipt.json') || fs.realpathSync(file)!==path.resolve(file)) return 1;
  if(await sourceCheck(r)===1) return 1;
  const measurements=renderMeasurements(r,since,ops);if(measurements===1) return 1;
  const execution=await checkExecution(r,r.artifacts.attempt);if(execution===1) return 1;
  const hashes=await checkHashes(r,r.artifacts.attempt);if(hashes===1) return 1;
  return aggregate([measurements,execution,hashes]);
}
async function bindExecution(r) {
  r.execution={};
  for (const f of executionFiles(process.env.PROMO_ATTEMPT,r.command,r.source.files)) r.execution[f]=await hash(f);
}
async function main() {
  const [mode,...a] = process.argv.slice(2);
  if (mode === 'validate') { await loadConfig(process.env.PROMO_CONFIG); return 0; }
  if (mode === 'init') {
    save({schema:'promo-portable-attempt/v1', attempt_id:path.basename(process.env.PROMO_ATTEMPT),
      command:process.env.PROMO_COMMAND, started:new Date().toISOString(), finished:null, status:2,
      source:await identity(), artifacts:{attempt:process.env.PROMO_ATTEMPT, inputs:process.env.PROMO_INPUTS || null},
      environment:{image:process.env.PROMO_IMAGE, image_id:null, playwright:'1.60.0', remotion:'4.0.529',
        cpus:process.env.PROMO_CPUS, memory:process.env.PROMO_MEMORY, operation_timeout_seconds:Number(process.env.PROMO_TIMEOUT), attempt_timeout_seconds:Number(process.env.PROMO_ATTEMPT_TIMEOUT), cleanup_grace_seconds:45},
      watchdog:{state:process.env.PROMO_WATCHDOG, rationale:process.env.PROMO_WATCHDOG === 'not_applicable'
        ? 'Portable Docker observations replace the optional private host adapter.' : 'Required host adapter is unavailable; success is blocked.'},
      actual_model:null, usage:null, evidence:process.env.PROMO_TEST_DOCKER === '1' ? 'simulated' : 'docker_cli',
      runtime_acceptance:'not_performed', independent_review:'not_performed', checks:[], docker:[], hashes:{}});
    return 0;
  }
  if(mode === 'portable-gate') {
    const r=JSON.parse(fs.readFileSync(a[0],'utf8'));
    if(a[1] !== 'demo') return 1;
    return portableGate(r,a[0],a[3] || '',a[2]);
  }
  const r = read();
  if (mode === 'check') {
    r.checks.push({name:a[0], code:Number(a[1]), detail:a[2] || null}); save(r); return 0;
  }
  if (mode === 'validation') { r.validation={raw_exit:Number(a[0]),cause:a[1]}; save(r); return 0; }
  if (mode === 'supervisor') { r.supervisor={raw_exit:Number(a[0]),cause:a[1]}; save(r); return 0; }
  if (mode === 'image') { r.environment.image_id=a[0] || null; save(r); return 0; }
  if (mode === 'observe') {
    const o = observation(a[4], Number(a[2]), a[3], r.environment.image_id, a[1], r.attempt_id);
    r.docker.push({operation:a[0], container:a[1], evidence:r.evidence, ...o}); save(r); return o.code;
  }
  if (mode === 'capture-stage') {
    const cfg=await loadConfig(process.env.PROMO_CONFIG);
    fs.writeFileSync(path.join(process.env.PROMO_ATTEMPT,'config.mjs'),`export default ${JSON.stringify(cfg)};\n`);
    await bindExecution(r); r.artifacts.assets=path.join(process.env.PROMO_ATTEMPT,'assets'); save(r); return 0;
  }
  if (mode === 'stage') {
    const cfg = await loadConfig(process.env.PROMO_CONFIG);
    const work=path.join(process.env.PROMO_ATTEMPT,'work'); fs.mkdirSync(work);
    for (const f of ['package.json','package-lock.json','tsconfig.json','shared']) {
      fs.cpSync(path.join(process.env.PROMO_ROOT,'promo/remotion',f),path.join(work,f),{recursive:true});
    }
    // Dependencies are separately provisioned by the coordinator; never install here.
    const deps=path.join(process.env.PROMO_ROOT,'promo/remotion/node_modules');
    fs.symlinkSync('/deps/node_modules',path.join(work,'node_modules'));
    fs.mkdirSync(path.join(work,'demo/public/rec'),{recursive:true});
    fs.writeFileSync(path.join(work,'demo/project.config.ts'),`export default ${JSON.stringify(cfg,null,2)};\n`);
    fs.writeFileSync(path.join(work,'demo/demo-intervals.tsv'),'0-45\n');
    await bindExecution(r); r.artifacts.work=work; r.artifacts.assets=process.env.PROMO_INPUTS; r.artifacts.dependencies=deps; save(r); return 0;
  }
  if (mode === 'execution-check' || mode === 'execution-seal') {
    const code=await checkExecution(r,process.env.PROMO_ATTEMPT,mode === 'execution-seal');
    if(code !== 0) return code;
    if(mode === 'execution-seal') {
      for(const f of publicFiles(process.env.PROMO_ATTEMPT,await loadConfig(process.env.PROMO_CONFIG))) r.execution[f]=await hash(f);
      r.execution_sealed=true;
      save(r);
    }
    return 0;
  }
  if(mode === 'captions') {
    const cfg=await loadConfig(process.env.PROMO_CONFIG), rows=['# caption\tfile\tinterval\twhat the frame proves\tverdict'];
    const seen=new Set();
    for(const scene of cfg.scenes.filter(s=>s.type==='screen')) for(const tr of Object.values(scene.tracks))
      for(const seg of tr.segments) if(!seen.has(seg.caption)) { seen.add(seg.caption); rows.push(`${seg.caption}\t${tr.file}\t${seg.from}-${seg.to}\t?\t?`); }
    const file=path.join(process.env.PROMO_ATTEMPT,'out/final/proof/captions-proof.tsv');
    if(fs.existsSync(file)) return 1;
    fs.writeFileSync(file,rows.join('\n')+'\n'); return 0;
  }
  if (mode === 'bind') {
    r.hashes={};
    for (const dir of a) if (fs.existsSync(dir)) for (const f of walk(dir)) {
      if (!mutableReview(f) && /\.(mp4|webm|json|tsv|txt|png)$/.test(f)) r.hashes[f]=await hash(f);
    }
    save(r); return 0;
  }
  if (mode === 'prior' || mode === 'capture-prior') {
    const dir=mode === 'capture-prior' ? path.dirname(process.env.PROMO_INPUTS) : process.env.PROMO_INPUTS;
    const file=path.join(dir,'receipt.json');
    if(!fs.existsSync(file)) return 2;
    const prior=JSON.parse(fs.readFileSync(file,'utf8'));
    if(await sourceCheck(prior)===1) return 1;
    if(prior.status===1 || (prior.checks || []).some(c=>c.code===1) || (prior.docker || []).some(o=>o.code===1)) return 1;
    if(prior.command !== (mode === 'capture-prior' ? 'capture' : 'render') || prior.evidence !== r.evidence) return 1;
    if(r.environment.image_id && prior.environment?.image_id && prior.environment.image_id !== r.environment.image_id) return 1;
    if(mode === 'capture-prior' && prior.artifacts.assets !== process.env.PROMO_INPUTS) return 1;
    const codes=[prior.status===0 && prior.finished ? 0 : 2,
      r.environment.image_id && !prior.environment?.image_id ? 2 : 0,
      ...(prior.checks || []).map(c=>c.code), ...(prior.docker || []).map(o=>o.code),
      mode === 'prior' ? renderMeasurements(prior) : 0];
    if(aggregate(codes)===1) return 1;
    const execution=await checkExecution(prior,dir);if(execution===1) return 1;
    const hashes=await checkHashes(prior,dir);if(hashes===1) return 1;
    const code=aggregate([...codes,execution,hashes]);
    if(code!==0) return code;
    // Return only validated external paths to the shell, never eval.
    if(mode === 'prior') console.log(prior.artifacts.assets); return 0;
  }
  if (mode === 'finish') {
    r.status=aggregate([Number(a[0]),...r.checks.map(c=>c.code),...r.docker.map(o=>o.code),
      r.watchdog.state === 'unavailable' ? 2 : 0]);
    r.finished=new Date().toISOString(); save(r); return r.status;
  }
  throw Error(`Unknown receipt operation: ${mode}`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname)) {
  try { process.exitCode=await main(); } catch(e) { console.error(`Not performed: ${e.message}`); process.exitCode=2; }
}
