import assert from 'node:assert/strict';
import { createServer } from 'vite';
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
try {
  const THREE = await vite.ssrLoadModule('three');
  const { addInjectorDetails } = await vite.ssrLoadModule('/src/components/three/injectorDetails.ts');
  const { createPullingUnitCrew } = await vite.ssrLoadModule('/src/components/three/pullingUnitCrew.ts');
  const { createEmergencyEffects } = await vite.ssrLoadModule('/src/components/three/emergencyEffects.ts');
  const { soundManager } = await vite.ssrLoadModule('/src/utils/audio.ts');
  soundManager.setMuted(true);
  const scene = new THREE.Scene(), group = new THREE.Group(); scene.add(group);
  // Fake imported injector model (model units, scaled ×2 like the 6.75 m GLB).
  const model = new THREE.Group(); model.scale.setScalar(2); group.add(model);
  const staticChain = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()); staticChain.name = 'Chain_L_Block_00001'; model.add(staticChain);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshStandardMaterial()); frame.name = 'Injector_FrameBody'; model.add(frame);
  const chains = addInjectorDetails(group, scene, new THREE.Box3(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,6,1)), {groundWorldY:0,hoseEndWorld:new THREE.Vector3(-10,1,0),model,rodRadiusWorld:0.045});
  assert.equal(staticChain.visible, false, 'static model chain replaced by animated chain');
  assert.equal(frame.material.clippingPlanes.length, 1, 'front wall opened as inspection face');
  const left = model.getObjectByName('LeftGripperChain'), right = model.getObjectByName('RightGripperChain'), m = new THREE.Matrix4();
  const worldY = (mesh, i) => { mesh.getMatrixAt(i, m); return new THREE.Vector3().setFromMatrixPosition(m).applyMatrix4(mesh.matrixWorld).y; };
  scene.updateMatrixWorld(true);
  chains.update(0,0,0); const y0 = worldY(left, 2);
  chains.update(0.1,1,0); assert.ok(Math.abs(worldY(left,2)-y0-0.03048)<1e-5,'POOH chain surface speed (world)');
  chains.update(0.1,-1,0); assert.ok(Math.abs(worldY(left,2)-y0)<1e-5,'RIH reverses chain travel');
  const F = { halfX: 0.4, minY: 0, maxY: 1.9 };
  let minInner = Infinity;
  for(let k=0;k<300;k++) chains.update(0.1,k%2?-3:3,0);
  for (const chain of [left, right]) for(let i=0;i<chain.count;i++){
    chain.getMatrixAt(i,m); assert.ok(m.elements.every(Number.isFinite));
    const p = new THREE.Vector3().setFromMatrixPosition(m);
    assert.ok(Math.abs(p.x) + 0.044 < F.halfX && p.y - 0.044 > F.minY && p.y + 0.044 < F.maxY, 'chain link inside housing '+p.toArray());
    minInner = Math.min(minInner, Math.abs(p.x) - 0.03 - 0.014);
  }
  assert.ok(Math.abs(minInner - (0.045/2 + 0.002)) < 0.003, 'gripper pads close on the rod surface: '+minInner);
  // --- Pulling-unit crew: works ON the carrier, evacuates to the muster point ---
  const muster = new THREE.Vector3(-12.4, 0, 17.9);
  const crew=createPullingUnitCrew(scene,{groundAt:()=>0,unitX:16.5,muster,injector:new THREE.Vector3(9,8,0)});
  const frameAt=(t,emergencyId=null,activity='rih')=>({time:t,delta:0.05,activity,speedRatio:0.5,alarm:false,emergencyId});
  const visited = crew.root.children.map(()=>new Set());
  let onDeck = 0, minX = Infinity, maxX = -Infinity;
  for(let t=0;t<180;t+=0.05){crew.update(frameAt(t));crew.root.children.forEach((member,i)=>{
    assert.equal(member.scale.x,1.2);
    member.traverse(o=>assert.ok([...o.position.toArray(),...o.rotation.toArray().slice(0,3)].every(Number.isFinite)));
    visited[i].add(crew.states()[i].at);
    if (member.position.y > 1.6) onDeck++;
    minX = Math.min(minX, member.position.x); maxX = Math.max(maxX, member.position.x);
  });}
  assert.ok(onDeck > 0 && minX > 12 && maxX < 21, `crew works on/around the carrier (${minX.toFixed(1)}..${maxX.toFixed(1)})`);
  assert.ok(visited[1].size >= 2 && visited[2].has('stairTop') && visited[2].has('groundSide'), 'floorman/roustabout move between stations and use the stairs');
  assert.equal(crew.root.getObjectByName('driller').position.y, 1.7, 'driller stays on the deck at the console');
  let t = 180;
  for(;t<300;t+=0.05) crew.update(frameAt(t,'emg-h2s'));
  crew.musterSpots().forEach((spot,i)=>{const p=crew.root.children[i].position; assert.ok(Math.hypot(p.x-spot.x,p.z-spot.z)<0.2, `${crew.root.children[i].name} reached muster`); assert.equal(crew.states()[i].mode,'evac');});
  for(;t<420;t+=0.05) crew.update(frameAt(t));
  crew.states().forEach(st=>assert.ok(st.mode==='work', st.name+' returned to work: '+st.mode));
  assert.equal(crew.root.getObjectByName('driller').position.y, 1.7, 'driller climbed back to the console');
  const anchors={beaconPoles:[new THREE.Vector3(4,0,4)],beaconHeads:[],gripper:new THREE.Vector3(9,10,0),wellheadLeak:new THREE.Vector3(9,1,0),bop:new THREE.Vector3(9,4,0),engine:new THREE.Vector3(-10,3,0)};
  const ids=['freefall','charge','blowout','h2s','engine','hydraulic','lightning','outrigger','overpull','chain','overheat','bopair','wind'];
  for(const id of ids) {
    const drillScene = new THREE.Scene();
    const fx = createEmergencyEffects(drillScene, anchors);
    let visibleFault = false;
    for(let i=0;i<20;i++) {
      fx.update({scenarioId:`emg-${id}`,alarmTier:'none',time:i*0.05,delta:0.05,rodSpeedFtPerMin:-60,wind:new THREE.Vector3(10,0,0)});
      visibleFault ||= drillScene.getObjectByName('EmergencyFaultDemonstrators').children.some(o=>o.visible) || drillScene.children.some(o=>o.isPoints&&o.visible);
    }
    assert.ok(visibleFault, 'Distinct visible fault for '+id);
    if(id === 'h2s') assert.ok(drillScene.children.filter(o=>o.isPoints).every(o=>!o.visible), 'H2S must not be depicted as visible gas');
    fx.update({scenarioId:null,alarmTier:'none',time:10,delta:0.1,rodSpeedFtPerMin:0,wind:new THREE.Vector3()});
    assert.ok(drillScene.getObjectByName('EmergencyFaultDemonstrators').children.every(o=>!o.visible));
    fx.dispose();
  }
  const particleCount=scale=>{const s=new THREE.Scene();const f=createEmergencyEffects(s,{...anchors,particleScale:scale});const n=s.children.filter(o=>o.isPoints).reduce((n,o)=>n+o.geometry.attributes.position.count,0);f.dispose();return n;};
  assert.ok(particleCount(0.18)<particleCount(1)*0.2);
  const { createFieldSky } = await vite.ssrLoadModule('/src/components/three/fieldSky.ts');
  const sky = createFieldSky(scene, 4);
  const env = {timeOfDay:'day',weather:'clear',windSpeedMph:5,windDirectionDeg:0};
  sky.update(env, 1, new THREE.Vector3());
  assert.equal(sky.root.getObjectByName('Sun').visible, true);
  assert.equal(sky.root.getObjectByName('Moon').visible, false);
  sky.update({...env,timeOfDay:'night'}, 2, new THREE.Vector3());
  assert.equal(sky.root.getObjectByName('Sun').visible, false);
  assert.equal(sky.root.getObjectByName('Moon').visible, true);
  const { createSiteAtmosphere } = await vite.ssrLoadModule('/src/components/three/siteAtmosphere.ts');
  const weatherCount = scale => {
    const s = new THREE.Scene();
    const atmosphere = createSiteAtmosphere({scene:s,renderer:{toneMappingExposure:1},ambient:new THREE.AmbientLight(),sun:new THREE.DirectionalLight(),workLights:[],lampMaterials:[],center:new THREE.Vector3(),particleScale:scale});
    const n=s.children.reduce((n,o)=>n+(o.geometry?.attributes.position.count??0),0);
    atmosphere.update({env:{...env,weather:'rain'},delta:0.1,time:1,cameraPosition:new THREE.Vector3(),lightning:false});
    atmosphere.dispose(); return n;
  };
  assert.ok(weatherCount(0.18) < weatherCount(1)*0.2);
  // --- perf: engine loop compaction is mono, bounded and seamless ---------
  const { compactLoopBuffer } = await vite.ssrLoadModule('/src/utils/audio.ts');
  const mkBuf = (ch, len, sr) => { const data = Array.from({length: ch}, () => new Float32Array(len)); return { numberOfChannels: ch, length: len, sampleRate: sr, duration: len / sr, getChannelData: c => data[c] }; };
  const fakeCtx = { createBuffer: (ch, len, sr) => mkBuf(ch, len, sr) };
  const sr = 1000, srcBuf = mkBuf(2, 60 * sr, sr);
  for (let c = 0; c < 2; c++) { const d = srcBuf.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] = Math.sin(i * 0.05); }
  const loop = compactLoopBuffer(fakeCtx, srcBuf, 20, 0.35, 0.05);
  assert.equal(loop.numberOfChannels, 1);
  assert.equal(loop.length, 20 * sr);
  const L = loop.getChannelData(0);
  const step = Math.abs(L[0] - L[L.length - 1]);
  assert.ok(step < 0.06, `loop seam jump ${step}`);
  assert.equal(compactLoopBuffer(fakeCtx, mkBuf(2, 5 * sr, sr)), null);
  // --- security: persisted data guards drop malformed records ------------
  const G = await vite.ssrLoadModule('/src/utils/storageGuards.ts');
  const good = { id: 'a', name: 'Op', role: 'r', unit: 'u', grade: 'A', difficulty: 'easy', score: 90, eventsResolved: 1, eventsHandled: 1, avgReactionSec: null, hintsUsed: 0, durationSec: 60, timestamp: 1 };
  const rows = G.parseStoredArray(JSON.stringify([good, { ...good, score: 'x' }, null, 7, { ...good, name: 'x'.repeat(5000) }]), G.isLeaderboardEntry);
  assert.equal(rows.length, 1);
  assert.deepEqual(G.parseStoredArray('{"a":1}', G.isLeaderboardEntry), []);
  const merged = G.mergeKnownKeys({ a: 1, b: 'x' }, JSON.parse('{"a":"bad","b":"ok","__proto__":{"polluted":1},"c":3}'));
  assert.deepEqual(merged, { a: 1, b: 'ok' });
  assert.equal({}.polluted, undefined);
  const { isInstructorCommand } = await vite.ssrLoadModule('/src/utils/simEvents.ts');
  assert.ok(isInstructorCommand({ kind: 'trigger-emergency', scenarioId: 'emg-h2s' }));
  assert.ok(!isInstructorCommand({ kind: 'trigger-emergency' }));
  assert.ok(!isInstructorCommand({ kind: 'rm -rf' }));
  console.log('PASS: chains inside the housing gripping the rod, crew working on the carrier + muster evacuation, 13 isolated drills, invisible H2S, cleanup, sky transitions and reduced weather/emergency allocations; seamless compact engine loop; storage/broadcast guards');
} finally { await vite.close(); }
