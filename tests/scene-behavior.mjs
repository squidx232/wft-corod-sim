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
  const chains = addInjectorDetails(group, scene, new THREE.Box3(new THREE.Vector3(-1,0,-1),new THREE.Vector3(1,6,1)), {groundWorldY:0,hoseEndWorld:new THREE.Vector3(-10,1,0)});
  const left = group.getObjectByName('LeftGripperChain'), m = new THREE.Matrix4();
  chains.update(0,0,0); left.getMatrixAt(2,m); const y0=m.elements[13];
  chains.update(0.1,1,0); left.getMatrixAt(2,m); assert.ok(Math.abs(m.elements[13]-y0-0.03048)<1e-5,'POOH chain surface speed');
  chains.update(0.1,-1,0); left.getMatrixAt(2,m); assert.ok(Math.abs(m.elements[13]-y0)<1e-5,'RIH reverses chain travel');
  for(let i=0;i<300;i++) chains.update(0.1,i%2?-3:3,0);
  for(let i=0;i<left.count;i++){left.getMatrixAt(i,m);assert.ok(m.elements.every(Number.isFinite));assert.ok(m.elements[13]>=0.89&&m.elements[13]<=5.11);}
  const crew=createPullingUnitCrew(scene,{groundAt:()=>0});
  for(let t=0;t<600;t+=0.5){crew.update(0.5,t,null);for(const member of crew.root.children){assert.ok(member.position.x>15&&member.position.z>=4.2);assert.equal(member.scale.x,1.2);member.traverse(o=>assert.ok([...o.position.toArray(),...o.rotation.toArray().slice(0,3)].every(Number.isFinite)));}}
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
  console.log('PASS: signed chain speed/direction, bounded links, 10-minute crew paths, 13 isolated drills, invisible H2S, cleanup, sky transitions and reduced weather/emergency allocations');
} finally { await vite.close(); }
