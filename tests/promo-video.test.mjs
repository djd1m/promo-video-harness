import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync,spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {aggregate,observation,loadConfig,renderMeasurements} from '../lib/promo-video/receipt.mjs';
import demo from '../demo/synthetic/config.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const temp=()=>fs.mkdtempSync(path.join(os.tmpdir(),'promo test '));
function fixture(t) {
  const dir=temp();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const bin=path.join(dir,'bin');fs.mkdirSync(bin);fs.symlinkSync(path.join(root,'tests/fixtures/docker'),path.join(bin,'docker'));
  return {dir,env:{...process.env,PATH:bin+':'+process.env.PATH,PROMO_TEST_DOCKER:'1',PROMO_MOCK_ROOT:path.join(dir,'mock')}};
}
const cli=(args,env=process.env)=>spawnSync('bash',[path.join(root,'bin/promo-video'),...args],{env,encoding:'utf8',timeout:20000});
const receiptFrom=(dir,cmd)=>JSON.parse(fs.readFileSync(path.join(dir,'attempts',fs.readdirSync(path.join(dir,'attempts')).find(n=>n.startsWith(cmd+'-')),'receipt.json')));
test('arguments/help and prohibited paths fail before Docker',t=>{
  const {dir,env}=fixture(t);
  for(const args of [[],['wrong'],['capture','--artifacts'],['capture','--unknown','x'],
    ['capture','--artifacts',root],['capture','--artifacts',os.homedir()],
    ['doctor','--artifacts',dir,'--timeout','0'],['doctor','--artifacts',dir,'--cpus','8']]) {
    const r=cli(args,env);assert.equal(r.status,2,r.stderr);
  }
  assert.equal(cli(['--help'],env).status,0);
  assert.equal(cli(['render','--help'],env).status,0);
  assert.ok(!fs.existsSync(path.join(dir,'mock/calls.jsonl')));
});
test('config: five scenes, 45 seconds and three dimensions; malformed input rejected',async t=>{
  const dir=temp();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  assert.equal(demo.scenes.length,5);assert.equal(demo.scenes.reduce((n,s)=>n+s.seconds,0),45);
  assert.deepEqual(demo.capture.formats,{'16x9':[1920,1080],'9x16':[1080,1920],'1x1':[1080,1080]});
  assert.equal((await loadConfig(path.join(root,'demo/synthetic/config.mjs'))).id,'demo');
  const file=path.join(dir,'bad.mjs');fs.writeFileSync(file,'export default {id:"demo",scenes:[]}');
  const r=cli(['doctor','--artifacts',dir,'--config',file]);assert.equal(r.status,2);assert.match(r.stderr,/five demo scenes/);
});
test('aggregation never promotes missing evidence or hides defects',()=>{
  assert.equal(aggregate([0,0]),0);assert.equal(aggregate([0,2]),2);
  assert.equal(aggregate([2,1,0]),1);assert.equal(aggregate([1,2]),1);
  assert.equal(observation('null',0,'none').exit_code,null);
  assert.equal(observation('not json',0,'none').code,2);
});
test('doctor checks only metadata, missing image/dependencies and watchdog remain incomplete',t=>{
  const {dir,env}=fixture(t);env.PROMO_MOCK_MODE='absent-image';
  const r=cli(['doctor','--artifacts',dir,'--watchdog','unavailable'],env);
  assert.equal(r.status,2,r.stderr);
  const receipt=receiptFrom(dir,'doctor');assert.equal(receipt.status,2);
  assert.equal(receipt.watchdog.state,'unavailable');assert.equal(receipt.actual_model,null);assert.equal(receipt.usage,null);
  assert.ok(receipt.checks.some(c=>c.name==='image'&&c.code===2));
  const calls=fs.readFileSync(path.join(dir,'mock/calls.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  assert.ok(calls.every(c=>c[0]==='image'));
});
test('capture uses paths with spaces, source-bound receipts and restricted mounts/resources',t=>{
  const {dir,env}=fixture(t);const r=cli(['capture','demo','--artifacts',dir,'--timeout','3'],env);
  assert.equal(r.status,0,r.stdout+r.stderr);
  const receipt=receiptFrom(dir,'capture');assert.equal(receipt.status,0);
  assert.equal(receipt.evidence,'simulated');assert.equal(receipt.runtime_acceptance,'not_performed');
  assert.equal(receipt.independent_review,'not_performed');assert.equal(receipt.watchdog.state,'not_applicable');
  assert.equal(receipt.source.revision?.length,40);assert.equal(receipt.source.configuration.sha256.length,64);
  assert.equal(receipt.docker.length,2);assert.equal(Object.keys(receipt.hashes).length,4);
  const calls=fs.readFileSync(path.join(dir,'mock/calls.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  for(const call of calls.filter(c=>c[0]==='run')) {
    for(const flag of ['--restart=no','--cpus=2','--memory=4g','--network=none','--pids-limit=256']) assert.ok(call.includes(flag));
    assert.ok(!call.includes('--rm'));assert.ok(!call.some(v=>v.includes('docker.sock')||v.includes('src='+os.homedir())));
    assert.ok(!call.includes('-p'));assert.ok(!call.includes('--publish'));
    assert.ok(call.includes('--pull=never'));assert.ok(call.includes('sha256:'+'a'.repeat(64)));
    const name=receipt.docker[calls.filter(c=>c[0]==='run').indexOf(call)].container,run=calls.indexOf(call);
    const inspect=calls.findIndex((c,i)=>i>run&&c[0]==='container'&&c[2]===name);
    const cleanup=calls.findIndex((c,i)=>i>run&&c[0]==='rm'&&c.at(-1)===name);
    assert.ok(inspect>run&&cleanup>inspect);
  }
});
for(const [mode,want] of [['success',0],['nonzero',1],['oom',1],['restart',1],['timeout',2],['inspect-failure',2],['not-performed',2],['non-timeout137',1],['image-mismatch',1],['ownership-conflict',2]]) {
  test(`Docker lifecycle ${mode}: observations then cleanup`,t=>{
    const {dir,env}=fixture(t);env.PROMO_MOCK_MODE=mode;
    Object.assign(env,{PROMO_ROOT:root,PROMO_COMMAND:'capture',PROMO_CONFIG:path.join(root,'demo/synthetic/config.mjs'),
      PROMO_ARTIFACTS:dir,PROMO_INPUTS:'',PROMO_ATTEMPT:path.join(dir,'attempt'),PROMO_IMAGE:'promo-render:2026-09-29',
      PROMO_IMAGE_ID:'sha256:'+'a'.repeat(64),PROMO_CPUS:'2',PROMO_MEMORY:'4g',PROMO_TIMEOUT:'1',PROMO_WATCHDOG:'not_applicable'});
    fs.mkdirSync(env.PROMO_ATTEMPT);
    const script=`source "$PROMO_ROOT/lib/promo-video/env.sh"
source "$PROMO_ROOT/lib/promo-video/docker.sh"
node "$PROMO_ROOT/lib/promo-video/receipt.mjs" init || exit 2
node "$PROMO_ROOT/lib/promo-video/receipt.mjs" image "$PROMO_IMAGE_ID" || exit 2
promo_container test "$PROMO_ATTEMPT/test.txt" "$PROMO_IMAGE_ID" true
rc=$?
node "$PROMO_ROOT/lib/promo-video/receipt.mjs" finish "$rc"
exit $?`;
    const r=spawnSync('bash',['-c',script],{env,encoding:'utf8',timeout:15000});assert.equal(r.status,want,r.stderr+r.stdout);
    const receipt=JSON.parse(fs.readFileSync(path.join(env.PROMO_ATTEMPT,'receipt.json'))),o=receipt.docker[0];
    if(mode==='ownership-conflict') {
      assert.equal(receipt.status,2);assert.equal(o,undefined);
      const calls=fs.readFileSync(path.join(dir,'mock/calls.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
      assert.ok(!calls.some(c=>['stop','rm'].includes(c[0])));
      assert.ok(fs.readdirSync(env.PROMO_MOCK_ROOT).some(f=>f.endsWith('.json')));return;
    }
    assert.equal(receipt.status,want);assert.equal(o.code,want);
    if(mode==='oom') {assert.equal(o.OOMKilled,true);assert.equal(o.timeout,false);}
    if(mode==='non-timeout137') {assert.equal(o.exit_code,137);assert.equal(o.timeout,false);}
    if(mode==='restart') assert.equal(o.restart_count,1);
    if(mode==='timeout') assert.equal(o.timeout,true);
    if(mode==='inspect-failure') {assert.equal(o.exit_code,null);assert.equal(o.inspection_available,false);}
    const calls=fs.readFileSync(path.join(dir,'mock/calls.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
    const run=calls.findIndex(c=>c[0]==='run'),inspect=calls.findIndex((c,i)=>i>run&&c[0]==='container'),rm=calls.findIndex(c=>c[0]==='rm');
    assert.ok(run>=0&&inspect>run&&rm>inspect);
  });
}
test('stale source-bound capture receipt cannot be used for rendering',t=>{
  const {dir,env}=fixture(t);assert.equal(cli(['capture','--artifacts',dir],env).status,0);
  const prior=receiptFrom(dir,'capture');fs.writeFileSync(path.join(prior.artifacts.assets,'demo-16x9.webm'),'changed');
  const attempt=path.join(dir,'verify-binding');fs.mkdirSync(attempt);
  Object.assign(env,{PROMO_ROOT:root,PROMO_COMMAND:'render',PROMO_CONFIG:path.join(root,'demo/synthetic/config.mjs'),
    PROMO_INPUTS:prior.artifacts.assets,PROMO_ATTEMPT:attempt,PROMO_WATCHDOG:'not_applicable'});
  const r=spawnSync('bash',['-c','node "$PROMO_ROOT/lib/promo-video/receipt.mjs" init && node "$PROMO_ROOT/lib/promo-video/receipt.mjs" capture-prior'],{env,encoding:'utf8'});
  assert.equal(r.status,1,r.stderr);
});
test('preserved verdict gate rejects another SHA and missing demo marker; accepts restored evidence',t=>{
  const {dir}=fixture(t),proof=path.join(dir,'proof'),media=path.join(dir,'media'),rec=path.join(dir,'rec');
  for(const p of [proof,media,rec]) fs.mkdirSync(p);
  for(const fmt of ['16x9','9x16','1x1']) fs.writeFileSync(path.join(media,fmt+'.mp4'),'fixture media '+fmt);
  const hash=spawnSync('sha256sum',[path.join(media,'16x9.mp4')],{encoding:'utf8'}).stdout.slice(0,64);
  fs.writeFileSync(path.join(proof,'sheet.png'),'fixture sheet');fs.writeFileSync(path.join(rec,'demo.webm'),'fixture recording');
  fs.writeFileSync(path.join(proof,'index.tsv'),`лист\tформат\tтип\tинтервал\tsha\nsheet.png\t16x9\tstep\t0-6\t${hash}\n`);
  const inspect=path.join(proof,'config-inspect.tsv'),caps=path.join(proof,'captions-proof.tsv'),intervals=path.join(proof,'demo-intervals.tsv');
  fs.writeFileSync(inspect,'CAPTION\tscreen\t10\t1\tCollect ideas\n');
  fs.writeFileSync(caps,'Collect ideas\tdemo.webm\t1-12\tFixture demonstrates text\tпринят\n');
  fs.writeFileSync(intervals,'0-45\n');
  const gate=()=>spawnSync('bash',[path.join(root,'.claude/skills/promo-video/scripts/gate-verdict.sh'),proof,media,inspect,caps,rec,intervals],{encoding:'utf8'});
  fs.writeFileSync(path.join(proof,'verdict.tsv'),`sheet.png\tпринят\tнет\tвидна\t${'b'.repeat(64)}\n`);
  assert.equal(gate().status,1);
  fs.writeFileSync(path.join(proof,'verdict.tsv'),`sheet.png\tпринят\tнет\tнет-демо-данных\t${hash}\n`);
  assert.equal(gate().status,1);
  fs.writeFileSync(path.join(proof,'verdict.tsv'),`sheet.png\tпринят\tнет\tвидна\t${hash}\n`);
  const r=gate();assert.equal(r.status,0,r.stdout+r.stderr);
  fs.writeFileSync(path.join(proof,'verdict.tsv'),`sheet.png\t?\tнет\tвидна\t${hash}\n`);
  assert.equal(gate().status,2);
});
function runtimeEnv(dir,env,command='render') {
  const attempt=path.join(dir,'attempt');fs.mkdirSync(attempt);
  const assets=path.join(dir,'assets');fs.mkdirSync(assets);
  for(const f of ['16x9','9x16','1x1']) fs.writeFileSync(path.join(assets,`demo-${f}.webm`),'MOCK capture');
  fs.writeFileSync(path.join(assets,'record-log-demo.json'),JSON.stringify({events:[],simulated:true}));
  return {...env,PROMO_ROOT:root,PROMO_COMMAND:command,PROMO_CONFIG:path.join(root,'demo/synthetic/config.mjs'),
    PROMO_ARTIFACTS:dir,PROMO_INPUTS:assets,PROMO_ATTEMPT:attempt,PROMO_IMAGE:'promo-render:2026-09-29',
    PROMO_IMAGE_ID:'sha256:'+'a'.repeat(64),PROMO_CPUS:'2',PROMO_MEMORY:'4g',PROMO_TIMEOUT:'3',PROMO_WATCHDOG:'not_applicable',PROMO_PORTABLE:'1'};
}
const receiptOp=(env,...args)=>spawnSync('node',[path.join(root,'lib/promo-video/receipt.mjs'),...args],{env,encoding:'utf8',timeout:10000});
const initRuntime=env=>{
  assert.equal(receiptOp(env,'init').status,0);
  assert.equal(receiptOp(env,'image',env.PROMO_IMAGE_ID).status,0);
};
const renderChild=env=>spawnSync('bash',[path.join(root,'promo/remotion/shared/render.sh'),'demo'],{env,encoding:'utf8',timeout:20000});
test('render shim integration preserves config/media gate output and status; policy/config/image binding',t=>{
  const {dir,env}=fixture(t),runEnv=runtimeEnv(dir,env);
  runEnv.PROMO_IMAGE='promo-harness-rc:isolated-test';initRuntime(runEnv);
  const result=renderChild(runEnv);assert.equal(result.status,0,result.stdout+result.stderr);
  const calls=fs.readFileSync(path.join(env.PROMO_MOCK_ROOT,'calls.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  assert.ok(calls.some(a=>a[0]==='image' && a[1]==='inspect' && a[2]===runEnv.PROMO_IMAGE_ID));
  for(const call of calls.filter(a=>a[0]==='run')) {
    assert.ok(call.includes(runEnv.PROMO_IMAGE_ID));
    assert.ok(!call.includes('promo-render:2026-09-29'));
    assert.ok(!call.includes(runEnv.PROMO_IMAGE));
  }
  assert.equal(receiptOp(runEnv,'finish','0').status,0);
  const render=JSON.parse(fs.readFileSync(path.join(runEnv.PROMO_ATTEMPT,'receipt.json')));
  assert.ok(render.source.files.some(([f])=>f==='promo/remotion/tsconfig.json'));
  assert.ok(render.execution[path.join(runEnv.PROMO_ATTEMPT,'work/demo/project.config.ts')]);
  assert.ok(render.execution[path.join(runEnv.PROMO_ATTEMPT,'work/shared/scripts/in-container.sh')]);
  assert.match(fs.readFileSync(path.join(runEnv.PROMO_ATTEMPT,'out/final/proof/config-inspect.tsv'),'utf8'),/CAPTION/);
  const verify=path.join(dir,'verify');fs.mkdirSync(verify);
  const verifyEnv={...runEnv,PROMO_COMMAND:'verify',PROMO_ATTEMPT:verify,PROMO_INPUTS:runEnv.PROMO_ATTEMPT};initRuntime(verifyEnv);
  const prior=()=>receiptOp(verifyEnv,'prior');assert.equal(prior().status,0,prior().stderr);
  for(const f of ['demo/demo-intervals.tsv','demo/project.config.ts','tsconfig.json','shared/scripts/in-container.sh']) {
    const file=path.join(runEnv.PROMO_ATTEMPT,'work',f),original=fs.readFileSync(file);
    fs.writeFileSync(file,'');assert.equal(prior().status,1,f);
    fs.writeFileSync(file,original);assert.equal(prior().status,0,f+' restored');
    fs.unlinkSync(file);assert.equal(prior().status,2,f+' missing');fs.writeFileSync(file,original);
  }
  for(const rel of ['shared/package.json','demo/public/rec/extra.webm','demo/public/fonts/extra.ttf']) {
    const extra=path.join(runEnv.PROMO_ATTEMPT,'work',rel);fs.writeFileSync(extra,'{}');
    assert.equal(prior().status,1,rel+' extra');fs.unlinkSync(extra);assert.equal(prior().status,0);
  }
  const link=path.join(runEnv.PROMO_ATTEMPT,'work/shared/extra');fs.symlinkSync('/deps',link);
  assert.equal(prior().status,1,'unexpected dependency symlink');fs.unlinkSync(link);
  const depsLink=path.join(runEnv.PROMO_ATTEMPT,'work/node_modules');fs.unlinkSync(depsLink);fs.symlinkSync('/other',depsLink);
  assert.equal(prior().status,1,'changed intended symlink');fs.unlinkSync(depsLink);fs.symlinkSync('/deps/node_modules',depsLink);
  const caps=path.join(runEnv.PROMO_ATTEMPT,'out/final/proof/captions-proof.tsv');
  assert.match(fs.readFileSync(caps,'utf8'),/Collect your next steps/);
  fs.appendFileSync(caps,'# later genuine review declaration\n');assert.equal(prior().status,0);
  const verdict=path.join(runEnv.PROMO_ATTEMPT,'out/final/proof/verdict.tsv');
  fs.appendFileSync(verdict,'# later genuine review declaration\n');assert.equal(prior().status,0);
  const gate=()=>spawnSync('bash',[path.join(root,'.claude/skills/promo-video/scripts/gate-receipt.sh'),'demo',path.join(runEnv.PROMO_ATTEMPT,'receipt.json')],{env:runEnv,encoding:'utf8'});
  assert.equal(gate().status,0,gate().stderr);
  assert.equal(spawnSync('bash',[path.join(root,'.claude/skills/promo-video/scripts/gate-receipt.sh'),'demo',path.join(runEnv.PROMO_ATTEMPT,'receipt.json'),'bundle 16x9 9x16 1x1 16x9-repeat','2099-01-01T00:00:00Z'],{env:runEnv}).status,1);
  for(const op of ['bundle','16x9','9x16','1x1','16x9-repeat','probe-16x9','probe-9x16','probe-1x1']) {
    assert.equal(renderMeasurements({...render,docker:render.docker.filter(o=>o.operation!==op)}),2,op);
  }
  assert.equal(renderMeasurements({...render,watchdog:{state:'unavailable'}}),2);
  assert.equal(renderMeasurements({...render,finished:null}),2);
  assert.equal(renderMeasurements({...render,checks:render.checks.filter(c=>c.name!=='repro')}),2);
  const file=path.join(runEnv.PROMO_ATTEMPT,'receipt.json');
  render.environment.image_id='sha256:'+'b'.repeat(64);fs.writeFileSync(file,JSON.stringify(render));assert.equal(prior().status,1);
  render.environment.image_id=runEnv.PROMO_IMAGE_ID;render.source.revision='f'.repeat(40);
  fs.writeFileSync(file,JSON.stringify(render));assert.equal(prior().status,1);
  render.source.revision=spawnSync('git',['-C',root,'rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim();
  fs.writeFileSync(file,JSON.stringify(render));
  const interval=path.join(runEnv.PROMO_ATTEMPT,'work/demo/demo-intervals.tsv');
  fs.writeFileSync(interval,'');
  assert.equal(cli(['verify','--artifacts',dir,'--inputs',runEnv.PROMO_ATTEMPT],env).status,1);
  fs.writeFileSync(interval,'0-45\n');
  const verified=cli(['verify','--artifacts',dir,'--inputs',runEnv.PROMO_ATTEMPT],env);
  assert.equal(verified.status,2,verified.stdout+verified.stderr);
  // Mutate a complete external source replica; never change repository inputs in tests.
  const shadow=path.join(dir,'source');fs.mkdirSync(shadow);
  for(const [f] of render.source.files) {
    const dst=path.join(shadow,f);fs.mkdirSync(path.dirname(dst),{recursive:true});fs.copyFileSync(path.join(root,f),dst);
  }
  render.source.revision=null;fs.writeFileSync(file,JSON.stringify(render));
  verifyEnv.PROMO_ROOT=shadow;
  render.artifacts.dependencies=path.join(shadow,'promo/remotion/node_modules');fs.writeFileSync(file,JSON.stringify(render));
  assert.equal(prior().status,0);
  // Source-replica receipts retain the canonical prepared dependency mount identity.
  render.artifacts.dependencies=path.join(shadow,'promo/remotion/node_modules');fs.writeFileSync(file,JSON.stringify(render));
  for(const name of ['promo/remotion/tsconfig.json','promo/render-image/Dockerfile','promo/render-image/fonts/build_onest.py']) {
    const target=path.join(shadow,name),bytes=fs.readFileSync(target);
    fs.writeFileSync(target,Buffer.concat([bytes,Buffer.from('\n')]));assert.equal(prior().status,1,name);
    fs.writeFileSync(target,bytes);assert.equal(prior().status,0,name+' restored');
  }
});
test('verify preserves prior status and defects outrank incomplete input evidence',t=>{
  const {dir,env}=fixture(t),runEnv=runtimeEnv(dir,env);initRuntime(runEnv);
  const rendered=renderChild(runEnv);assert.equal(rendered.status,0,rendered.stdout+rendered.stderr);
  assert.equal(receiptOp(runEnv,'finish','0').status,0);
  const file=path.join(runEnv.PROMO_ATTEMPT,'receipt.json'),complete=JSON.parse(fs.readFileSync(file));
  const verify=path.join(dir,'verify');fs.mkdirSync(verify);
  const verifyEnv={...runEnv,PROMO_COMMAND:'verify',PROMO_ATTEMPT:verify,PROMO_INPUTS:runEnv.PROMO_ATTEMPT};initRuntime(verifyEnv);
  const write=r=>fs.writeFileSync(file,JSON.stringify(r));
  const prior=()=>receiptOp(verifyEnv,'prior');
  const expect=(want,label)=>{
    const result=prior();assert.equal(result.status,want,label+' '+result.stdout+result.stderr);
    const gate=receiptOp(runEnv,'portable-gate',file,'demo');assert.equal(gate.status,want,label+' gate '+gate.stderr);
  };
  expect(0,'complete checked receipt');
  write({...complete,status:2});expect(2,'finished prior status=2');
  for(const finished of [null,complete.finished]) for(const status of [0,1,2]) {
    const r={...complete,status,finished};write(r);
    const want=status===1 ? 1 : status===2 || !finished ? 2 : 0;
    expect(want,`status=${status} finished=${!!finished}`);
    if(status!==0) {
      const result=cli(['verify','--artifacts',dir,'--inputs',runEnv.PROMO_ATTEMPT],env);
      assert.equal(result.status,want,result.stdout+result.stderr);
    }
  }
  const incomplete={...complete,status:2,finished:null};write(incomplete);
  for(const base of [complete,incomplete]) {
    for(const files of [undefined,null]) {
      const r=structuredClone(base);
      if(files===undefined) delete r.source.files;else r.source.files=files;
      write(r);expect(1,`source files=${files} status=${r.status}`);
    }
    const r=structuredClone(base);r.source.tree_sha256='f'.repeat(64);r.source.files=[null];
    write(r);expect(1,`source tamper plus malformed execution sources status=${r.status}`);
  }
  for(const mutate of [r=>{r.source.tree_sha256='f'.repeat(64);},
    r=>{r.environment.image_id='sha256:'+'b'.repeat(64);},
    r=>{r.checks.push({name:'known-defect',code:1});},r=>{r.docker[0].OOMKilled=true;}]) {
    const r=structuredClone(incomplete);mutate(r);write(r);expect(1,'incomplete plus receipt defect');
  }
  write(incomplete);
  const missing=path.join(runEnv.PROMO_ATTEMPT,'work/package.json');
  const changed=path.join(runEnv.PROMO_ATTEMPT,'work/tsconfig.json');
  const media=path.join(runEnv.PROMO_ATTEMPT,'out/final/9x16.mp4');
  const missingBytes=fs.readFileSync(missing),changedBytes=fs.readFileSync(changed),mediaBytes=fs.readFileSync(media);
  for(const base of [complete,{...complete,status:2},incomplete]) {
    write(base);fs.unlinkSync(media);fs.mkdirSync(media);
    expect(2,`bound MP4 directory status=${base.status} finished=${!!base.finished}`);
    fs.writeFileSync(changed,'tampered');
    expect(1,`staged tsconfig tamper plus bound MP4 directory status=${base.status} finished=${!!base.finished}`);
    fs.writeFileSync(changed,changedBytes);
    const measuredDefect=structuredClone(base);measuredDefect.docker[0].OOMKilled=true;write(measuredDefect);
    expect(1,`measurement defect plus bound MP4 directory status=${base.status} finished=${!!base.finished}`);
    fs.rmdirSync(media);fs.writeFileSync(media,mediaBytes);
  }
  write(incomplete);
  fs.unlinkSync(missing);expect(2,'missing execution file');
  fs.writeFileSync(changed,'tampered');expect(1,'missing execution file plus later execution tamper');
  fs.writeFileSync(changed,changedBytes);
  const unbound=structuredClone(incomplete);delete unbound.execution[missing];write(unbound);
  expect(2,'missing execution binding and file');
  fs.writeFileSync(changed,'tampered');expect(1,'missing execution binding plus tamper');
  fs.writeFileSync(changed,changedBytes);write(incomplete);
  fs.writeFileSync(media,'tampered');expect(1,'incomplete execution plus output tamper');
  fs.writeFileSync(missing,missingBytes);fs.writeFileSync(media,mediaBytes);
  const firstHash=Object.keys(incomplete.hashes)[0],firstBytes=fs.readFileSync(firstHash);
  fs.unlinkSync(firstHash);expect(2,'missing first hashed file');
  fs.writeFileSync(media,'tampered');expect(1,'missing first hashed file plus later hash tamper');
  fs.writeFileSync(media,mediaBytes);
  const unboundHash=structuredClone(incomplete);delete unboundHash.hashes[firstHash];write(unboundHash);
  expect(2,'missing required hash binding and file');
  fs.writeFileSync(media,'tampered');expect(1,'missing required hash binding plus tamper');
  fs.writeFileSync(media,mediaBytes);fs.writeFileSync(firstHash,firstBytes);write(incomplete);
  const sheets=Object.keys(incomplete.hashes).filter(f=>f.includes('/sheets/16x9-'));
  const noSheets=structuredClone(incomplete),sheetBytes=sheets.map(f=>fs.readFileSync(f));
  for(const f of sheets) {delete noSheets.hashes[f];fs.unlinkSync(f);}
  write(noSheets);expect(2,'missing required proof sheets');
  fs.writeFileSync(media,'tampered');expect(1,'missing proof sheets plus output tamper');
  fs.writeFileSync(media,mediaBytes);sheets.forEach((f,i)=>fs.writeFileSync(f,sheetBytes[i]));write(incomplete);
  const work=path.join(runEnv.PROMO_ATTEMPT,'work'),savedWork=path.join(dir,'saved-work');
  fs.renameSync(work,savedWork);expect(2,'unstaged execution');
  const unstaged=structuredClone(incomplete);delete unstaged.artifacts.work;delete unstaged.artifacts.dependencies;
  unstaged.execution={};delete unstaged.execution_sealed;unstaged.hashes={};unstaged.docker=[];unstaged.checks=[];
  unstaged.environment.image_id=null;write(unstaged);expect(2,'unfinished receipt before staging');
  write({...unstaged,status:1});expect(1,'known defect before staging');write(incomplete);
  fs.writeFileSync(media,'tampered');expect(1,'unstaged execution plus output tamper');
  fs.writeFileSync(media,mediaBytes);write({...incomplete,status:1});expect(1,'known defect without execution');
  fs.renameSync(savedWork,work);write(complete);expect(0,'restored checked receipt');
});
test('render measurements preserve known defects before malformed rationale',t=>{
  const dir=temp();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const runEnv=runtimeEnv(dir,process.env);initRuntime(runEnv);
  const file=path.join(runEnv.PROMO_ATTEMPT,'receipt.json'),base=JSON.parse(fs.readFileSync(file));
  base.status=0;base.finished=base.started;base.execution_sealed=true;base.watchdog.rationale=42;
  const observation={operation:'bundle',code:0,image_id:base.environment.image_id};
  for(const [label,mutate] of [
    ['status=1',r=>{r.status=1;}],
    ['check code=1',r=>{r.checks.push({name:'known-defect',code:1});}],
    ['docker code=1',r=>{r.docker=[{...observation,code:1}];}],
    ['docker OOM',r=>{r.docker=[{...observation,OOMKilled:true}];}],
    ['docker restart',r=>{r.docker=[{...observation,restart_count:1}];}],
    ['docker identity mismatch',r=>{r.docker=[{...observation,identity_mismatch:true}];}],
    ['docker image mismatch',r=>{r.docker=[{...observation,image_id:'sha256:'+'b'.repeat(64)}];}],
    ['duplicate docker operation',r=>{r.docker=[observation,observation];}]
  ]) {
    const r=structuredClone(base);mutate(r);
    assert.equal(renderMeasurements(r),1,label);
    fs.writeFileSync(file,JSON.stringify(r));
    const gate=receiptOp(runEnv,'portable-gate',file,'demo');
    assert.equal(gate.status,1,label+' '+gate.stderr);
  }
  assert.throws(()=>renderMeasurements(base),TypeError);
  fs.writeFileSync(file,JSON.stringify(base));
  const gate=receiptOp(runEnv,'portable-gate',file,'demo');
  assert.equal(gate.status,2,'malformed rationale alone '+gate.stderr);
});
test('capture prior preserves unfinished status and detects tampered inputs',t=>{
  const {dir,env}=fixture(t);assert.equal(cli(['capture','--artifacts',dir],env).status,0);
  const complete=receiptFrom(dir,'capture'),file=path.join(complete.artifacts.attempt,'receipt.json');
  const runEnv=runtimeEnv(dir,env);runEnv.PROMO_INPUTS=complete.artifacts.assets;initRuntime(runEnv);
  for(const status of [0,1,2]) for(const finished of [null,complete.finished]) {
    fs.writeFileSync(file,JSON.stringify({...complete,status,finished}));
    const result=receiptOp(runEnv,'capture-prior');
    assert.equal(result.status,status===1 ? 1 : status===2 || !finished ? 2 : 0,result.stderr);
  }
  fs.writeFileSync(file,JSON.stringify({...complete,status:2,finished:null}));
  fs.unlinkSync(path.join(complete.artifacts.assets,'demo-16x9.webm'));
  fs.writeFileSync(path.join(complete.artifacts.assets,'demo-9x16.webm'),'tampered');
  assert.equal(receiptOp(runEnv,'capture-prior').status,1);
});
test('render shim keeps media defect=1',t=>{
  const {dir,env}=fixture(t),runEnv=runtimeEnv(dir,env);runEnv.PROMO_MOCK_MODE='media-defect';initRuntime(runEnv);
  const result=renderChild(runEnv);assert.equal(result.status,1,result.stdout+result.stderr);
  assert.match(result.stdout,/декодированных кадров 1/);
  const receipt=JSON.parse(fs.readFileSync(path.join(runEnv.PROMO_ATTEMPT,'receipt.json')));
  assert.ok(receipt.checks.some(c=>c.name==='gate-media'&&c.code===1));
});
test('interrupted actual rendering child owns CID stop inspect cleanup; finalization follows child',async t=>{
  const {dir,env}=fixture(t),runEnv=runtimeEnv(dir,env);runEnv.PROMO_TIMEOUT='10';initRuntime(runEnv);
  // Let the config shim finish; block the direct fonts operation via a fixture wrapper.
  const wrapper=path.join(dir,'bin/docker');fs.unlinkSync(wrapper);
  fs.writeFileSync(wrapper,`#!/bin/bash\nif [[ "$*" == *dst=/public* ]]; then export PROMO_MOCK_MODE=interrupt; fi\nexec '${root}/tests/fixtures/docker' "$@"\n`);fs.chmodSync(wrapper,0o755);
  const child=spawn('bash',[path.join(root,'promo/remotion/shared/render.sh'),'demo'],{env:runEnv,detached:true,stdio:'ignore'});
  const ended=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
  t.after(()=>{try{process.kill(-child.pid,'SIGKILL');}catch{}});
  const deadline=Date.now()+7000;
  while(Date.now()<deadline) {
    const file=path.join(dir,'mock/calls.jsonl');
    if(fs.existsSync(file)&&fs.readFileSync(file,'utf8').includes('dst=/public')) break;
    await new Promise(resolve=>setTimeout(resolve,40));
  }
  assert.ok(Date.now()<deadline,'direct fonts child started');
  // Wait for Docker creation, rather than racing the CID write.
  while(!fs.existsSync(path.join(runEnv.PROMO_ATTEMPT,'fonts.cid'))&&Date.now()<deadline) await new Promise(r=>setTimeout(r,20));
  child.kill('SIGTERM');
  const result=await Promise.race([ended,new Promise(resolve=>setTimeout(()=>resolve({code:'timeout'}),7000))]);
  assert.equal(result.code,2);
  const receipt=JSON.parse(fs.readFileSync(path.join(runEnv.PROMO_ATTEMPT,'receipt.json'))),o=receipt.docker.find(o=>o.operation==='fonts');
  assert.ok(o);assert.equal(o.interrupted,true);assert.equal(o.timeout,false);assert.equal(receipt.finished,null);
  const calls=fs.readFileSync(path.join(dir,'mock/calls.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  const stop=calls.findIndex(c=>c[0]==='stop'&&c.at(-1)===o.container);
  const inspect=calls.findIndex((c,i)=>i>stop&&c[0]==='container'&&c[2]===o.container);
  const rm=calls.findIndex((c,i)=>i>inspect&&c[0]==='rm'&&c.at(-1)===o.container);
  assert.ok(stop>=0&&inspect>stop&&rm>inspect);
  assert.equal(receiptOp(runEnv,'finish','2').status,2);
});
test('supervisory deadline ignores inherited budget/guard and cleans up at two seconds',t=>{
  const {dir,env}=fixture(t);Object.assign(env,{PROMO_ATTEMPT_GUARDED:'1',PROMO_ATTEMPT_TIMEOUT:'7200',PROMO_MOCK_MODE:'timeout'});
  const started=Date.now(),r=cli(['capture','--artifacts',dir,'--timeout','10','--attempt-timeout','2'],env);
  assert.equal(r.status,2,r.stdout+r.stderr);assert.ok(Date.now()-started<12000);
  const receipt=receiptFrom(dir,'capture');assert.equal(receipt.status,2);assert.equal(receipt.supervisor.cause,'timeout');
  assert.equal(receipt.supervisor.raw_exit,124);assert.ok(receipt.finished);assert.equal(receipt.environment.attempt_timeout_seconds,2);
  assert.equal(receipt.environment.cleanup_grace_seconds,45);
  const calls=fs.readFileSync(path.join(dir,'mock/calls.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  const o=receipt.docker[0];assert.ok(o);assert.equal(o.interrupted,true);
  const stop=calls.findIndex(c=>c[0]==='stop'&&c.at(-1)===o.container);
  const inspect=calls.findIndex((c,i)=>i>stop&&c[0]==='container'&&c[2]===o.container);
  const rm=calls.findIndex((c,i)=>i>inspect&&c[0]==='rm'&&c.at(-1)===o.container);
  assert.ok(stop>=0&&inspect>stop&&rm>inspect);assert.ok(!fs.existsSync(path.join(dir,'mock',o.container+'.json')));
});
test('config validation timeout is normalized to public 2 with raw cause',t=>{
  const {dir,env}=fixture(t),config=path.join(dir,'slow.mjs');
  fs.writeFileSync(config,'setInterval(()=>{},1000); await new Promise(()=>{}); export default {};\n');
  const r=cli(['doctor','--artifacts',dir,'--config',config],env);assert.equal(r.status,2,r.stderr);
  assert.match(r.stderr,/raw_exit=124/);
  const receipt=receiptFrom(dir,'doctor');assert.equal(receipt.validation.raw_exit,124);assert.equal(receipt.validation.cause,'timeout');assert.equal(receipt.status,2);
});
test('attempt timeout rejects invalid selections before supervision or Docker',t=>{
  const {dir,env}=fixture(t),wrapper=path.join(dir,'bin/timeout');
  fs.writeFileSync(wrapper,'#!/bin/bash\necho launched > "$PROMO_MOCK_ROOT-supervised"\nexit 2\n');fs.chmodSync(wrapper,0o755);
  for(const value of [undefined,'','abc','1.5','-1','0','7201','99999999999999999999']) {
    const args=['doctor','--artifacts',dir,'--attempt-timeout'];if(value!==undefined) args.push(value);
    const r=cli(args,env);assert.equal(r.status,2,r.stderr);assert.match(r.stderr,/Missing value|Attempt timeout range/);
  }
  assert.ok(!fs.existsSync(env.PROMO_MOCK_ROOT+'-supervised'));assert.ok(!fs.existsSync(env.PROMO_MOCK_ROOT));
});
test('attempt budget boundaries/default/custom match supervisor argv and receipt',t=>{
  const {dir,env}=fixture(t);Object.assign(env,{PROMO_ATTEMPT_TIMEOUT:'7',PROMO_ATTEMPT_GUARDED:'1',PROMO_MOCK_MODE:'absent-image'});
  const log=path.join(dir,'supervisor-argv'),wrapper=path.join(dir,'bin/timeout');env.PROMO_TIMER_LOG=log;
  fs.writeFileSync(wrapper,'#!/bin/bash\nif [[ "$1 $2 $3" == "--verbose -k 45" ]]; then printf "%s\\n" "$4" >> "$PROMO_TIMER_LOG"; fi\nexec /usr/bin/timeout "$@"\n');fs.chmodSync(wrapper,0o755);
  for(const selected of [1,7200,1800,4800]) {
    const artifacts=path.join(dir,String(selected)),args=['doctor','--artifacts',selected===1 ? root : artifacts];
    if(selected!==1800) args.push('--attempt-timeout',String(selected));
    if(selected===4800) args.push('--timeout','900','--memory','3g','--cpus','2');
    const r=cli(args,env);assert.equal(r.status,2,r.stderr);
    assert.equal(fs.readFileSync(log,'utf8').trim().split('\n').at(-1),String(selected));
    if(selected===1) continue; // Immediate supervised path rejection exercises the minimum without a timing race.
    const receipt=receiptFrom(artifacts,'doctor');assert.equal(receipt.environment.attempt_timeout_seconds,selected);
    assert.equal(receipt.environment.cleanup_grace_seconds,45);
    if(selected===4800) {assert.equal(receipt.environment.operation_timeout_seconds,900);assert.equal(receipt.environment.memory,'3g');assert.equal(receipt.environment.cpus,'2');}
  }
});
test('legacy scripts require explicit assets/proof/lock before Docker; capture never provisions',t=>{
  const {dir,env}=fixture(t),scripts=path.join(root,'.claude/skills/promo-video/scripts'),rem=path.join(dir,'rem'),cap=path.join(dir,'cap');
  delete env.PROMO_ASSETS;delete env.PROMO_LOCK;Object.assign(env,{PROMO_REMOTION:rem,PROMO_CAPTURE:cap});
  for(const p of [path.join(rem,'demo'),path.join(cap,'demo/node_modules')]) fs.mkdirSync(p,{recursive:true});
  fs.writeFileSync(path.join(rem,'demo/project.config.ts'),'export default {};');
  const capture=path.join(cap,'demo');fs.writeFileSync(path.join(capture,'package.json'),'{}');fs.writeFileSync(path.join(capture,'record-demo.mjs'),'');
  const run=(name,args=['demo'])=>spawnSync('bash',[path.join(scripts,name+'.sh'),...args],{env,encoding:'utf8',timeout:3000});
  let r=run('capture');assert.equal(r.status,2);assert.match(r.stderr,/prepared trusted package-lock/);
  assert.ok(!fs.existsSync(path.join(capture,'package-lock.json')));
  fs.writeFileSync(path.join(capture,'package-lock.json'),'{}');r=run('capture');assert.equal(r.status,2);assert.match(r.stderr,/prepared trusted node_modules/);
  fs.writeFileSync(path.join(capture,'node_modules/.package-lock.json'),'{}');
  for(const name of ['capture','gate-config','render-run','stills']) {r=run(name);assert.equal(r.status,2,r.stderr);assert.match(r.stderr,/set PROMO_ASSETS/);}
  const inspect=path.join(dir,'inspect.tsv');fs.writeFileSync(inspect,'BOUNDARY\twide\t6\n');
  r=run('storyboard',['demo',dir,inspect]);assert.equal(r.status,2);assert.match(r.stderr,/fourth proof directory argument or set PROMO_ASSETS/);
  env.PROMO_ASSETS=dir;r=run('stills');assert.equal(r.status,2);assert.match(r.stderr,/set PROMO_LOCK/);
  assert.ok(!fs.existsSync(env.PROMO_MOCK_ROOT));
  const code=fs.readFileSync(path.join(scripts,'capture.sh'),'utf8');assert.doesNotMatch(code,/npm (?:ci|install)/);assert.match(code,/--network none/);
});
test('gate-git fixture scanning is optional and only uses explicit FIXTURE_ENV',t=>{
  const {dir,env}=fixture(t),repo=path.join(dir,'repo');fs.mkdirSync(path.join(repo,'promo/remotion/demo'),{recursive:true});
  assert.equal(spawnSync('git',['init','-q',repo]).status,0);env.GATE_GIT_ROOT=repo;delete env.FIXTURE_ENV;
  const file=path.join(repo,'promo/remotion/demo/config.ts');fs.writeFileSync(file,'fixture-only-password');
  assert.equal(spawnSync('git',['-C',repo,'add','promo']).status,0);
  const gate=()=>spawnSync('bash',[path.join(root,'.claude/skills/promo-video/scripts/gate-git.sh'),'demo'],{env,encoding:'utf8',timeout:3000});
  assert.equal(gate().status,0);env.FIXTURE_ENV=path.join(dir,'missing.env');assert.equal(gate().status,2);
  fs.writeFileSync(env.FIXTURE_ENV,'FIXTURE_PASSWORD=fixture-only-password\n',{mode:0o600});assert.equal(gate().status,1);
});
test('watchdog requires explicit log before access and preserves explicit-file codes',t=>{
  const {dir,env}=fixture(t);delete env.WATCHDOG_LOG;
  const run=()=>spawnSync('bash',[path.join(root,'.claude/skills/promo-video/scripts/gate-watchdog.sh'),'promo-demo-probe','2026-10-03 00:00:00'],{env,encoding:'utf8',timeout:3000});
  let r=run();assert.equal(r.status,2);assert.match(r.stderr,/WATCHDOG_LOG must be explicitly set/);
  env.WATCHDOG_LOG=path.join(dir,'watchdog.log');assert.equal(run().status,2);
  fs.writeFileSync(env.WATCHDOG_LOG,'[2026-10-03 00:00:01] checked other containers\n');assert.equal(run().status,0);
  fs.appendFileSync(env.WATCHDOG_LOG,"[2026-10-03 00:00:02] stopped 'promo-demo-probe'\n");assert.equal(run().status,1);
  assert.ok(!fs.existsSync(env.PROMO_MOCK_ROOT));
});
