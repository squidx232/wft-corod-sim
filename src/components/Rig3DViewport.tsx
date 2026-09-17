import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { SimulatorState } from '../types';
import { soundManager } from '../utils/audio';
import {
  Camera,
  RotateCw,
  Eye,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Layers,
  Sun,
  Moon,
  Compass,
  Move,
  ArrowUp,
  ArrowDown,
  RotateCcw,
  Volume2,
  ShieldAlert,
  Sliders,
  Pause,
  Play,
  Flame,
  CheckCircle,
} from 'lucide-react';

interface Rig3DViewportProps {
  state: SimulatorState;
  onInstallClamp?: () => void;
  onTapTest?: () => void;
  onToggleReelSafetyFork?: () => void;
  onToggleBopClosed?: () => void;
  onUpdateJoystick?: (pos: number) => void;
  onUpdateHydraulics?: (updates: Partial<SimulatorState['hydraulics']>) => void;
  onSoundAirHorn?: () => void;
  onTriggerEmergencyStop?: () => void;
  onResetEmergencyStop?: () => void;
  /** When true the viewport fills its parent's height (cab windshield mode)
      instead of using its own fixed 520/620px height. The internal
      ResizeObserver keeps the WebGL canvas correctly sized either way. */
  fillHeight?: boolean;
  /** Cab/windshield mode: locks the camera to the rig sightline, hides the
      redundant "Console Dials" 3D preset and the bottom HUD dock (because the
      real HTML console dashboard is docked directly below the windshield). */
  cabMode?: boolean;
}

export type CameraViewPreset = 'operator' | 'orbit' | 'injector' | 'reel' | 'wellhead' | 'console';

// ---------------------------------------------------------------------------
// Site coordinate layout (side-on, matching the field diagram, X = left→right):
//   [MG UNIT + operator@console] ... [trailer + reel] ...~guide~... [injector/BOP/wellhead]
// The whole worksite is spread left→right so the operator (far left) looks
// across to the wellhead/injector (right).
// ---------------------------------------------------------------------------
const MG_UNIT_X = -10; // MG unit cabin (left, closer to wellhead); back faces WH
const REEL_X = 3.5;    // service reel on its trailer (closer to wellhead)
const REEL_Z = -6;     // service reel: set back into depth from the wellhead line
const WELL_X = 9;      // injector / BOP / wellhead vertical stack (right)
const INJECTOR_TOP_Y = 8.4; // height of the injector head over the wellhead
const MAST_OFFSET_X = 4.5;  // pulling-unit mast stands this far to the SIDE of the
                            // wellhead (so the mast is NOT on top of the injector);
                            // its crown cable angles over to carry the injector.

// Shared glTF loader for the imported Blender equipment models.
const gltfLoader = new GLTFLoader();

/**
 * Load a .glb model, enable shadows, and (optionally) uniformly scale it so its
 * largest dimension matches `targetSize`, then drop it so its base sits at y=0.
 * The loaded model is added to `parent`. Runs asynchronously; a callback fires
 * with the model root once ready.
 */
function loadEquipmentModel(
  url: string,
  parent: THREE.Object3D,
  opts: { targetHeight?: number; onLoaded?: (root: THREE.Object3D) => void } = {},
) {
  gltfLoader.load(
    url,
    (gltf) => {
      const root = gltf.scene;
      root.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
      // Normalise: measure bounds, scale to target height, seat base on ground.
      const box = new THREE.Box3().setFromObject(root);
      const size = new THREE.Vector3();
      box.getSize(size);
      if (opts.targetHeight && size.y > 0.0001) {
        const s = opts.targetHeight / size.y;
        root.scale.setScalar(s);
      }
      // Recompute after scaling and re-seat base at y=0, centre on X/Z.
      const box2 = new THREE.Box3().setFromObject(root);
      const c = new THREE.Vector3();
      box2.getCenter(c);
      root.position.x -= c.x;
      root.position.z -= c.z;
      root.position.y -= box2.min.y;
      parent.add(root);
      opts.onLoaded?.(root);
    },
    undefined,
    (err) => {
      console.warn('[Rig3DViewport] Failed to load model', url, err);
    },
  );
}

export const Rig3DViewport: React.FC<Rig3DViewportProps> = ({
  state,
  onInstallClamp,
  onTapTest,
  onToggleReelSafetyFork,
  onToggleBopClosed,
  onUpdateJoystick,
  onUpdateHydraulics,
  onSoundAirHorn,
  onTriggerEmergencyStop,
  onResetEmergencyStop,
  fillHeight = false,
  cabMode = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [cameraPreset, setCameraPreset] = useState<CameraViewPreset>('operator');
  const cameraPresetRef = useRef<CameraViewPreset>('operator');
  const [isNightMode, setIsNightMode] = useState(false);
  const [showStats, setShowStats] = useState(true);
  // In cab mode the bottom HUD dock is redundant (real console is docked below).
  const [showHudControls, setShowHudControls] = useState(!cabMode);
  const [interactionMode, setInteractionMode] = useState<'orbit' | 'pan'>('orbit');

  // Keep a mutable ref of state for the 60fps render loop
  const stateRef = useRef<SimulatorState>(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Scene references
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const animFrameId = useRef<number | null>(null);

  // Animated 3D Parts & Dynamically controlled meshes
  const truckVibrationGroupRef = useRef<THREE.Group | null>(null);
  const reelSpoolRef = useRef<THREE.Group | null>(null);
  const levelWindRef = useRef<THREE.Mesh | null>(null);
  const rodStrandRef = useRef<THREE.Mesh | null>(null);
  const gripperChainLeftRef = useRef<THREE.Group | null>(null);
  const gripperChainRightRef = useRef<THREE.Group | null>(null);
  const squeezePlatesRef = useRef<THREE.Group | null>(null);
  const safetyClampJawsRef = useRef<THREE.Group | null>(null);
  const bopRamsRef = useRef<THREE.Group | null>(null);
  const joyShaftMeshRef = useRef<THREE.Mesh | null>(null);
  const exhaustParticlesRef = useRef<THREE.Mesh[]>([]);
  const floodLightRef = useRef<THREE.SpotLight | null>(null);
  const consoleLightRef = useRef<THREE.PointLight | null>(null);
  const rodTextureOffset = useRef<number>(0);
  // RIH/POOH dynamic-motion effect refs
  const injectorGroupRef = useRef<THREE.Group | null>(null);
  const wellheadSprayRef = useRef<THREE.Mesh[]>([]);

  // Live 3D Needle Meshes on Console
  const needlesMapRef = useRef<Record<string, THREE.Mesh>>({});

  // Reusable Vector3 for orbit camera (avoids per-frame allocation / GC pressure)
  const _orbitCamPos = useRef(new THREE.Vector3());

  // Pointer interaction for Free Orbit & Pan
  const isDraggingRef = useRef(false);
  const dragButtonRef = useRef<number>(0);
  const prevPointerPos = useRef({ x: 0, y: 0 });
  const sphericalRef = useRef({ radius: 9.5, theta: Math.PI + 0.15, phi: 1.35 });
  const targetLookAt = useRef(new THREE.Vector3(0, 4.5, 0));

  // Sync preset ref
  useEffect(() => {
    cameraPresetRef.current = cameraPreset;
  }, [cameraPreset]);

  // In cab mode, guarantee the windshield opens on the rig sightline (never the
  // 3D console close-up). Runs once the camera has been created.
  useEffect(() => {
    if (!cabMode) return;
    const t = setTimeout(() => {
      if (cameraRef.current) setCameraPositionPreset('operator');
    }, 120);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cabMode]);

  // Set Camera Preset Handler
  const setCameraPositionPreset = (preset: CameraViewPreset) => {
    setCameraPreset(preset);
    cameraPresetRef.current = preset;
    if (!cameraRef.current) return;

    if (preset === 'operator') {
      // Wide SIDE-ON view of the whole worksite: MG unit + operator (left),
      // reel/trailer (center-left), and the pulling-unit mast + injector/BOP/
      // wellhead (right). Pulled back & up to frame the tall (~22u) mast.
      const siteCenterX = (MG_UNIT_X + WELL_X + MAST_OFFSET_X) / 2;
      targetLookAt.current.set(siteCenterX + 2, 9.5, 0);
      cameraRef.current.position.set(siteCenterX + 3, 13, 52);
      sphericalRef.current = { radius: 52, theta: Math.PI / 2, phi: 1.13 };
      cameraRef.current.lookAt(targetLookAt.current);
    } else if (preset === 'console') {
      // Close-Up on the operator's console at the MG unit (far left).
      targetLookAt.current.set(MG_UNIT_X + 3.8, 2.2, 0);
      cameraRef.current.position.set(MG_UNIT_X + 3.8, 3.0, 7.5);
      sphericalRef.current = { radius: 7.5, theta: Math.PI / 2, phi: 1.32 };
      cameraRef.current.lookAt(targetLookAt.current);
    } else if (preset === 'injector') {
      // Zoomed into the Gripper Injector head (right, above the BOP).
      targetLookAt.current.set(WELL_X, 8.4, 0);
      cameraRef.current.position.set(WELL_X + 3.5, 9.4, 6.5);
      sphericalRef.current = { radius: 7.5, theta: 1.0, phi: 1.2 };
      cameraRef.current.lookAt(targetLookAt.current);
    } else if (preset === 'reel') {
      // Close up of the COROD Service Reel on its trailer (center-left).
      targetLookAt.current.set(REEL_X, 4.0, REEL_Z);
      cameraRef.current.position.set(REEL_X - 1, 5.5, REEL_Z + 9);
      sphericalRef.current = { radius: 9, theta: 1.4, phi: 1.15 };
      cameraRef.current.lookAt(targetLookAt.current);
    } else if (preset === 'wellhead') {
      // Ground view of the BOP, safety clamps & wellhead flange (right).
      targetLookAt.current.set(WELL_X, 2.2, 0);
      cameraRef.current.position.set(WELL_X + 2, 2.6, 7);
      sphericalRef.current = { radius: 7, theta: 1.1, phi: 1.35 };
      cameraRef.current.lookAt(targetLookAt.current);
    } else if (preset === 'orbit') {
      const siteCenterX = (MG_UNIT_X + WELL_X) / 2;
      sphericalRef.current = { radius: 52, theta: 1.2, phi: 1.05 };
      targetLookAt.current.set(siteCenterX, 8.0, 0);
    }
  };

  // Helper: Create a brushed silver aluminum rectangular placard texture
  function createPlacardTexture(title: string) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;

    // Brushed Silver Gradient
    const grad = ctx.createLinearGradient(0, 0, 256, 64);
    grad.addColorStop(0, '#f1f5f9');
    grad.addColorStop(0.3, '#cbd5e1');
    grad.addColorStop(0.7, '#e2e8f0');
    grad.addColorStop(1, '#94a3b8');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 64);

    // Beveled frame
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, 252, 60);

    // Corner rivets
    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(12, 32, 4, 0, Math.PI * 2);
    ctx.arc(244, 32, 4, 0, Math.PI * 2);
    ctx.fill();

    // Bold Black Text
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 20px monospace, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, 128, 33);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    return tex;
  }

  // Helper: Create an authentic crisp white gauge dial texture with black graduations & markings
  function createGaugeDialTexture(letter: string, title: string, maxVal: number, unit: string, colorZone?: { start: number; end: number; color: string }) {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;

    // Item 21: Cream/off-white dial face per real photos (slightly aged ivory)
    ctx.fillStyle = '#f5f0e8';
    ctx.beginPath();
    ctx.arc(128, 128, 124, 0, Math.PI * 2);
    ctx.fill();

    // Heavy Black Outer Bezel Rim
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 7;
    ctx.stroke();

    // Inner hairline track
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(128, 128, 118, 0, Math.PI * 2);
    ctx.stroke();

    // Color Arc Zone (if applicable)
    if (colorZone) {
      const startAngle = Math.PI * 0.75 + (colorZone.start / maxVal) * (Math.PI * 1.5);
      const endAngle = Math.PI * 0.75 + (colorZone.end / maxVal) * (Math.PI * 1.5);
      ctx.strokeStyle = colorZone.color;
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.arc(128, 128, 102, startAngle, endAngle);
      ctx.stroke();
    }

    // Dial Graduations & Ticks (Crisp Black)
    const numTicks = 20;
    for (let i = 0; i <= numTicks; i++) {
      const angle = Math.PI * 0.75 + (i / numTicks) * (Math.PI * 1.5);
      const isMajor = i % 4 === 0;
      const r1 = 114;
      const r2 = isMajor ? 94 : 104;
      ctx.strokeStyle = '#0f172a';
      ctx.lineWidth = isMajor ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(128 + Math.cos(angle) * r1, 128 + Math.sin(angle) * r1);
      ctx.lineTo(128 + Math.cos(angle) * r2, 128 + Math.sin(angle) * r2);
      ctx.stroke();

      // Major tick numeric labels
      if (isMajor) {
        const lr = 78;
        const lx = 128 + Math.cos(angle) * lr;
        const ly = 128 + Math.sin(angle) * lr;
        const tickVal = Math.round((i / numTicks) * maxVal);
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tickVal >= 1000 ? `${tickVal / 1000}k` : `${tickVal}`, lx, ly);
      }
    }

    // Dial Brand / Watermark
    ctx.fillStyle = '#334155';
    ctx.font = '900 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CPW', 128, 155);
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(unit, 128, 170);

    // Center Black Cap Hub
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(128, 128, 10, 0, Math.PI * 2);
    ctx.fill();

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
  }

  // Initialize Three.js Scene
  useEffect(() => {
    if (!containerRef.current || !canvasRef.current) return;

    const width = containerRef.current.clientWidth || 800;
    const height = containerRef.current.clientHeight || 450;

    // 1. Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(isNightMode ? 0x070b14 : 0x9fc0dc);
    // Lighter, thinner haze in daytime so the field/sky read as an open site.
    scene.fog = new THREE.FogExp2(isNightMode ? 0x070b14 : 0xbfd4e6, isNightMode ? 0.012 : 0.0045);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(48, width / height, 0.1, 350);
    cameraRef.current = camera;
    setCameraPositionPreset('operator');

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: true,
      powerPreference: 'high-performance',
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    // Item 100: Tuned exposure for more contrast in daylight
    renderer.toneMappingExposure = 1.25;
    rendererRef.current = renderer;

    // 4. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, isNightMode ? 0.35 : 0.9);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, isNightMode ? 0.2 : 1.45);
    sunLight.position.set(30, 45, 25);
    sunLight.castShadow = true;
    // Item 36/97: Higher shadow map resolution for crisper shadows
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 100;
    sunLight.shadow.camera.left = -30;
    sunLight.shadow.camera.right = 30;
    sunLight.shadow.camera.top = 30;
    sunLight.shadow.camera.bottom = -30;
    scene.add(sunLight);

    // Mast Work Floodlight (positioned at actual mast top, aimed at injector/wellhead)
    const floodLight = new THREE.SpotLight(0xffffff, 2.5, 50, Math.PI / 3.5, 0.3, 1);
    floodLight.position.set(WELL_X + MAST_OFFSET_X, 20, 2);
    floodLight.target.position.set(WELL_X, 6, 0);
    floodLight.castShadow = true;
    scene.add(floodLight);
    scene.add(floodLight.target);
    floodLightRef.current = floodLight;

    // Operator Console Illumination Spot Light (near the actual console at MG truck rear)
    const consoleLight = new THREE.PointLight(0xffd599, 1.8, 10);
    consoleLight.position.set(MG_UNIT_X + 5.0, 3.6, 0);
    scene.add(consoleLight);
    consoleLightRef.current = consoleLight;

    // 5. Build Environment & Rig Meshes
    buildEnvironment(scene);
    buildBackgroundProps(scene);
    buildPullingUnit(scene);
    buildMobileUnitTruck(scene);
    buildServiceReel(scene);
    buildMastAndArch(scene);
    buildGripperInjector(scene);
    buildWellheadBopStack(scene);
    buildContinuousRodPath(scene);
    buildExhaustParticleSystem(scene);

    // 6. Resize Observer
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width: w, height: h } = entry.contentRect;
        if (w > 0 && h > 0 && cameraRef.current && rendererRef.current) {
          cameraRef.current.aspect = w / h;
          cameraRef.current.updateProjectionMatrix();
          rendererRef.current.setSize(w, h);
        }
      }
    });
    resizeObserver.observe(containerRef.current);

    // 7. Animation Loop with full real-time dynamics
    let lastTime = performance.now();
    const animate = (time: number) => {
      const delta = Math.min((time - lastTime) / 1000, 0.1);
      lastTime = time;

      const liveState = stateRef.current;
      const speed = liveState.rod.rodSpeedFtPerMin;
      const isEngineOn = liveState.hydraulics.engineRunning;
      const rpm = liveState.hydraulics.engineRpm || 0;

      // 1. Engine & Chassis Harmonic Vibration
      if (truckVibrationGroupRef.current) {
        if (isEngineOn) {
          const vibAmp = 0.0018 * (rpm / 1400);
          const vibFreq = time * 0.055;
          truckVibrationGroupRef.current.position.y = Math.sin(vibFreq) * vibAmp;
          truckVibrationGroupRef.current.rotation.z = Math.cos(vibFreq * 0.8) * (vibAmp * 0.3);
        } else {
          truckVibrationGroupRef.current.position.y = 0;
          truckVibrationGroupRef.current.rotation.z = 0;
        }
      }

      // 2. Service Reel Dynamic Rotation with Inertia
      if (reelSpoolRef.current) {
        const radPerSec = (speed / 15) * Math.PI * 0.5;
        reelSpoolRef.current.rotation.z += radPerSec * delta;

        // Level-Wind Sheave Traverse Animation
        if (levelWindRef.current) {
          levelWindRef.current.position.z = Math.sin(reelSpoolRef.current.rotation.z * 0.35) * 1.1;
        }
      }

      // 3. Gripper Chain Shoes & Teeth Movement
      if (gripperChainLeftRef.current && gripperChainRightRef.current) {
        const chainDelta = speed * delta * 0.08;
        gripperChainLeftRef.current.children.forEach((child) => {
          child.position.y = (((child.position.y - chainDelta + 2) % 4) + 4) % 4 - 2;
        });
        gripperChainRightRef.current.children.forEach((child) => {
          child.position.y = (((child.position.y - chainDelta + 2) % 4) + 4) % 4 - 2;
        });
      }

      // 4. Rod Texture & Catenary Sag / Tension Dynamics
      const absSpeed = Math.abs(speed);
      const isRunning = absSpeed > 0.5;
      const speedRatio = Math.min(1, absSpeed / 85); // 0..1 (freefall/max ≈ 85 ft/min)
      if (rodStrandRef.current && (rodStrandRef.current.material as THREE.MeshStandardMaterial).map) {
        rodTextureOffset.current += speed * delta * 0.025;
        const rodMat = rodStrandRef.current.material as THREE.MeshStandardMaterial;
        rodMat.map!.offset.y = rodTextureOffset.current;

        // Dynamic Catenary Tension straightens under heavy weight
        const stringWeight = liveState.rod.totalStringWeightLbs;
        const sagFactor = Math.max(0.7, 1.0 - (stringWeight / 25000) * 0.3);
        rodStrandRef.current.scale.set(1, sagFactor, 1);

        // Directional emissive pulse: green when POOH (up), blue when RIH (down),
        // red when freefalling; intensity scales with speed.
        const pulse = 0.5 + 0.5 * Math.sin(time * 0.02);
        if (liveState.rod.rodInTensionOrCompression === 'freefall') {
          rodMat.emissive.setHex(0xef4444);
          rodMat.emissiveIntensity = 0.6 * pulse + 0.3;
        } else if (speed > 0.5) {
          rodMat.emissive.setHex(0x22c55e); // POOH up
          rodMat.emissiveIntensity = speedRatio * 0.5 * pulse;
        } else if (speed < -0.5) {
          rodMat.emissive.setHex(0x3b82f6); // RIH down
          rodMat.emissiveIntensity = speedRatio * 0.5 * pulse;
        } else {
          rodMat.emissiveIntensity = THREE.MathUtils.lerp(rodMat.emissiveIntensity, 0, 0.2);
        }
      }

      // 4b. Injector head mechanical vibration under load (shake ∝ speed)
      if (injectorGroupRef.current) {
        if (isRunning) {
          const shake = 0.012 * speedRatio + 0.004;
          const f = time * 0.09;
          injectorGroupRef.current.position.x = WELL_X + Math.sin(f) * shake;
          injectorGroupRef.current.rotation.z = Math.cos(f * 1.3) * shake * 0.4;
        } else {
          injectorGroupRef.current.position.x = THREE.MathUtils.lerp(injectorGroupRef.current.position.x, WELL_X, 0.2);
          injectorGroupRef.current.rotation.z = THREE.MathUtils.lerp(injectorGroupRef.current.rotation.z, 0, 0.2);
        }
      }

      // 4c. Wellhead spray / dust puffs while the rod is moving fast
      if (wellheadSprayRef.current.length > 0) {
        wellheadSprayRef.current.forEach((puff, idx) => {
          const mat = puff.material as THREE.MeshBasicMaterial;
          if (isRunning && speedRatio > 0.15) {
            puff.visible = true;
            // Rise (POOH) or settle downward (RIH) depending on direction
            const dir = speed > 0 ? 1 : -1;
            puff.position.y += delta * (0.6 + speedRatio) * dir;
            puff.position.x += delta * Math.sin(time * 0.004 + idx) * 0.25;
            const s = puff.scale.x + delta * 0.9 * speedRatio;
            puff.scale.set(s, s, s);
            mat.opacity = Math.max(0, 0.35 * speedRatio - Math.abs(puff.position.y - 6.2) * 0.15);
            // Recycle
            if (Math.abs(puff.position.y - 6.2) > 1.6 || mat.opacity <= 0.01) {
              puff.position.set(WELL_X + (Math.random() - 0.5) * 0.4, 6.2, (Math.random() - 0.5) * 0.4);
              puff.scale.set(0.12, 0.12, 0.12);
              mat.opacity = 0.35 * speedRatio;
            }
          } else {
            mat.opacity = Math.max(0, mat.opacity - delta * 0.8);
            if (mat.opacity <= 0.01) puff.visible = false;
          }
        });
      }

      // 5. Animated Exhaust Smoke Particles from Stack (items 83-88 enhanced)
      if (exhaustParticlesRef.current.length > 0) {
        // Item 88: idle vs load — more particles visible and denser at load
        const joyActive = Math.abs(liveState.joystickPosition) > 0.05;
        const exhaustIntensity = joyActive ? 1.0 : 0.5;
        exhaustParticlesRef.current.forEach((p, idx) => {
          if (isEngineOn) {
            // Item 88: at idle, only show every other particle
            p.visible = joyActive || idx % 2 === 0;
            p.position.y += delta * 2.2;
            // Item 85: Perlin-like turbulent drift (multi-frequency sin)
            p.position.x += delta * (Math.sin(time * 0.003 + idx) * 0.3 + Math.sin(time * 0.007 + idx * 2.3) * 0.1);
            p.position.z += delta * (Math.cos(time * 0.003 + idx) * 0.3 + Math.cos(time * 0.005 + idx * 1.7) * 0.1);
            // Item 86: faster growth rate
            const scale = p.scale.x + delta * 1.5 * exhaustIntensity;
            p.scale.set(scale, scale, scale);
            (p.material as THREE.MeshBasicMaterial).opacity = Math.max(0, (0.45 * exhaustIntensity) - (p.position.y - 4.5) * 0.12);

            if (p.position.y > 8.0) {
              p.position.set(MG_UNIT_X - 1.2, 4.5, 1.1 + (Math.random() - 0.5) * 0.3);
              p.scale.set(0.12, 0.12, 0.12);
              (p.material as THREE.MeshBasicMaterial).opacity = 0.45 * exhaustIntensity;
            }
          } else {
            p.visible = false;
          }
        });
      }

      // 6. Live 3D Gauge Needles Update
      const needles = needlesMapRef.current;
      const setNeedleAngle = (needle: THREE.Mesh | undefined, val: number, max: number) => {
        if (!needle) return;
        const ratio = Math.max(0, Math.min(1, val / max));
        const angle = -Math.PI * 0.75 + ratio * (Math.PI * 1.5);
        needle.rotation.z = angle;
      };

      setNeedleAngle(needles['A'], liveState.hydraulics.airRegulatorPsi || 120, 150);
      setNeedleAngle(needles['B'], liveState.bop.reganBopClosed ? liveState.bop.bopRegulatorPsi : 0, 5000);
      setNeedleAngle(needles['E'], liveState.hydraulics.chargePressure, 600);
      setNeedleAngle(needles['F'], liveState.hydraulics.systemPressure, 3000);
      setNeedleAngle(needles['G'], liveState.hydraulics.chainTensionPressure, 600);
      setNeedleAngle(needles['H'], liveState.hydraulics.safetyPressure, 5000);
      setNeedleAngle(needles['I'], liveState.hydraulics.squeezePressure, 3000);
      setNeedleAngle(needles['L'], liveState.hydraulics.upPressure, 5000);
      setNeedleAngle(needles['M'], liveState.hydraulics.downPressure, 5000);

      // 7. Live 3D Joystick Tilt Movement
      if (joyShaftMeshRef.current) {
        const joyVal = liveState.joystickPosition;
        joyShaftMeshRef.current.rotation.x = joyVal * 0.42;
      }

      // 8. Squeeze Pressure Clamping Hydraulics
      if (squeezePlatesRef.current) {
        const squeeze = liveState.hydraulics.squeezePressure;
        const clampOffset = Math.min(0.08, (squeeze / 3000) * 0.08);
        squeezePlatesRef.current.children[0].position.x = -0.32 + clampOffset;
        squeezePlatesRef.current.children[1].position.x = 0.32 - clampOffset;
      }

      // 9. Rod Safety Clamp Mechanical Jaws (V)
      if (safetyClampJawsRef.current) {
        const isClampOn = liveState.hydraulics.safetyClampLever === 'ON';
        const targetX = isClampOn ? 0.08 : 0.22;
        safetyClampJawsRef.current.children[0].position.x = THREE.MathUtils.lerp(
          safetyClampJawsRef.current.children[0].position.x,
          -targetX,
          0.2
        );
        safetyClampJawsRef.current.children[1].position.x = THREE.MathUtils.lerp(
          safetyClampJawsRef.current.children[1].position.x,
          targetX,
          0.2
        );
      }

      // 10. BOP Rams Mechanical Closure
      if (bopRamsRef.current) {
        const isBopClosed = liveState.bop.reganBopClosed;
        const ramTargetX = isBopClosed ? 0.25 : 0.8;
        bopRamsRef.current.children[0].position.x = THREE.MathUtils.lerp(
          bopRamsRef.current.children[0].position.x,
          -ramTargetX,
          0.15
        );
        bopRamsRef.current.children[1].position.x = THREE.MathUtils.lerp(
          bopRamsRef.current.children[1].position.x,
          ramTargetX,
          0.15
        );
      }

      // 11. Orbit / Free Camera calculations
      if (cameraRef.current) {
        if (cameraPresetRef.current === 'orbit') {
          const { radius, theta, phi } = sphericalRef.current;
          const x = targetLookAt.current.x + radius * Math.sin(phi) * Math.sin(theta);
          const y = targetLookAt.current.y + radius * Math.cos(phi);
          const z = targetLookAt.current.z + radius * Math.sin(phi) * Math.cos(theta);
          cameraRef.current.position.lerp(_orbitCamPos.current.set(x, y, z), 0.12);
          cameraRef.current.lookAt(targetLookAt.current);
        }
      }

      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }

      animFrameId.current = requestAnimationFrame(animate);
    };

    animFrameId.current = requestAnimationFrame(animate);

    return () => {
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      resizeObserver.disconnect();

      // Dispose all geometries, materials, and textures to prevent memory leaks
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry?.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
          mats.forEach((mat) => {
            if (mat && typeof mat.dispose === 'function') {
              // Dispose any attached textures
              Object.values(mat).forEach((val) => {
                if (val && (val as THREE.Texture).isTexture) {
                  (val as THREE.Texture).dispose();
                }
              });
              mat.dispose();
            }
          });
        }
        if ((obj as THREE.Line).isLine) {
          (obj as THREE.Line).geometry?.dispose();
          const lineMat = (obj as THREE.Line).material;
          if (lineMat && typeof (lineMat as THREE.Material).dispose === 'function') {
            (lineMat as THREE.Material).dispose();
          }
        }
      });
      renderer.dispose();
    };
  }, []);

  // Update Night Mode / Lighting dynamically
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.background = new THREE.Color(isNightMode ? 0x070b14 : 0x9fc0dc);
    if (sceneRef.current.fog) {
      (sceneRef.current.fog as THREE.FogExp2).color = new THREE.Color(isNightMode ? 0x070b14 : 0xbfd4e6);
    }
  }, [isNightMode]);

  // ---------------------------------------------------------------------------
  // 3D Scene Geometry Construction
  // ---------------------------------------------------------------------------

  function buildEnvironment(scene: THREE.Scene) {
    // === IMMERSIVE OIL & GAS SITE ENVIRONMENT ================================
    const siteCenterX = (MG_UNIT_X + WELL_X) / 2;

    // 0. Sky dome — daytime gradient (blue up top → pale haze at horizon).
    if (!isNightMode) {
      const skyGeo = new THREE.SphereGeometry(300, 32, 16);
      const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: {
          topColor: { value: new THREE.Color(0x3a78c8) },
          bottomColor: { value: new THREE.Color(0xcfe0ef) },
          offset: { value: 20 },
          exponent: { value: 0.7 },
        },
        vertexShader: `
          varying vec3 vWorldPosition;
          void main() {
            vec4 wp = modelMatrix * vec4(position, 1.0);
            vWorldPosition = wp.xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }`,
        fragmentShader: `
          uniform vec3 topColor; uniform vec3 bottomColor;
          uniform float offset; uniform float exponent;
          varying vec3 vWorldPosition;
          void main() {
            float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
            float t = max(pow(max(h, 0.0), exponent), 0.0);
            gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
          }`,
      });
      const sky = new THREE.Mesh(skyGeo, skyMat);
      scene.add(sky);
    }

    // 1a. Surrounding grass field to the horizon (large flat prairie disc).
    const fieldGeo = new THREE.CircleGeometry(280, 48);
    const fieldMat = new THREE.MeshStandardMaterial({
      color: isNightMode ? 0x1a2e18 : 0x6b7a3a, // dry prairie grass
      roughness: 1.0,
      metalness: 0.0,
    });
    const field = new THREE.Mesh(fieldGeo, fieldMat);
    field.rotation.x = -Math.PI / 2;
    field.position.y = -0.05;
    field.receiveShadow = true;
    scene.add(field);

    // 1b. Wellsite lease pad (dirt/gravel) — the worked ground the rig sits on.
    const padGeo = new THREE.PlaneGeometry(90, 52, 8, 8);
    const padMat = new THREE.MeshStandardMaterial({
      color: isNightMode ? 0x2a2620 : 0x8a7355, // tan dirt/gravel lease pad
      roughness: 0.98,
      metalness: 0.02,
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(siteCenterX, 0.01, 0);
    pad.receiveShadow = true;
    scene.add(pad);

    // 2. Concrete Well Center Cellar Slab (under the wellhead, right side)
    const cellarGeo = new THREE.BoxGeometry(6, 0.4, 6);
    const cellarMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.9 });
    const cellar = new THREE.Mesh(cellarGeo, cellarMat);
    cellar.position.set(WELL_X, 0.2, 0);
    cellar.receiveShadow = true;
    scene.add(cellar);

    // Item 29: Safety cones with white reflective stripes + base plate
    const coneMat = new THREE.MeshStandardMaterial({ color: 0xf97316 });
    const coneStripeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.2, metalness: 0.3 });
    const coneBaseMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.9 });
    [
      [MG_UNIT_X - 3, 0.32, 4],
      [MG_UNIT_X - 3, 0.32, -4],
      [WELL_X + 4, 0.32, 5],
      [WELL_X + 4, 0.32, -5],
      [REEL_X, 0.32, 5],
      [WELL_X - 3, 0.32, 5],
    ].forEach(([x, y, z]) => {
      const coneGroup = new THREE.Group();
      coneGroup.position.set(x, y, z);
      // Orange cone body
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.65, 16), coneMat);
      coneGroup.add(cone);
      // Square base plate
      const base = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.5), coneBaseMat);
      base.position.y = -0.32;
      coneGroup.add(base);
      // 2 white reflective stripe bands — radius matches cone taper at each height
      // Cone: radius 0.2, height 0.65, base at y=-0.325, tip at y=+0.325
      // At height h from base: r = 0.2 * (1 - h/0.65)
      [0.15, 0.35].forEach((hFromBase) => {
        const stripeY = -0.325 + hFromBase; // local Y on cone
        const stripeR = 0.2 * (1 - hFromBase / 0.65); // tapered radius
        const stripe = new THREE.Mesh(
          new THREE.TorusGeometry(stripeR, 0.015, 8, 16),
          coneStripeMat
        );
        stripe.position.y = stripeY;
        coneGroup.add(stripe);
      });
      scene.add(coneGroup);
    });
  }

  // =========================================================================
  // PULLING UNIT (WORKOVER RIG) — carrier truck + telescoping lattice mast
  // raised over the wellhead, crown block, racking board, drawworks, traveling
  // block + hook (which carries the injector), and guy wires to ground anchors.
  // The mast base sits AT the wellhead so the injector hangs over the well.
  // =========================================================================
  function buildPullingUnit(scene: THREE.Scene) {
    const pu = new THREE.Group();
    // Mast stands to the SIDE of the wellhead (not on top of it). The injector
    // sits over the wellhead at local X = −MAST_OFFSET_X within this group.
    pu.position.set(WELL_X + MAST_OFFSET_X, 0, 0);
    const INJ_LOCAL_X = -MAST_OFFSET_X; // injector/wellhead position in pu-local space

    const MAST_H = 22;          // mast height (units ≈ feet-ish)
    const LEAN = -0.06;         // slight lean of the mast toward the well (−X)
    const legHalf = 0.9;        // half-spacing of the lattice legs at the base

    const steel = (c: number, r = 0.55, m = 0.6) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const redMat = steel(0xc23a2b, 0.5, 0.4);    // red crown accents

    // --- Carrier truck deck + cab (simple), parked at the mast base ---
    const truck = new THREE.Group();
    truck.position.set(-3.5, 0, -3.2);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.5, 2.6), steel(0x1e3a5f, 0.6, 0.4));
    deck.position.set(0, 1.5, 0); deck.castShadow = true; deck.receiveShadow = true; truck.add(deck);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.0, 2.4), steel(0xe5e7eb, 0.5, 0.3));
    cab.position.set(-3.6, 2.4, 0); cab.castShadow = true; truck.add(cab);
    // Wheels
    const whGeo = new THREE.CylinderGeometry(0.7, 0.7, 0.5, 18); whGeo.rotateX(Math.PI / 2);
    const whMat = steel(0x0a0a0a, 0.9, 0.1);
    [[-3.4, 1.5], [1.0, 1.5], [2.2, 1.5], [-3.4, -1.5], [1.0, -1.5], [2.2, -1.5]].forEach(([x, z]) => {
      const w = new THREE.Mesh(whGeo, whMat); w.position.set(x, 0.7, z); truck.add(w);
    });
    // Drawworks drum on the deck (spooled cable winch)
    const drawworks = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.0, 20), steel(0x1f6feb, 0.5, 0.5));
    drawworks.rotation.x = Math.PI / 2; drawworks.position.set(2.4, 2.3, 0); drawworks.castShadow = true;
    truck.add(drawworks);
    pu.add(truck);

    // --- Lattice mast: 4 straight vertical corner chords with rungs & real
    // X-braces on all four faces. A slight taper is applied by nudging the top
    // rungs inward (chords stay straight/vertical so it reads as a solid mast). ---
    const mast = new THREE.Group();
    mast.rotation.z = LEAN; // slight lean toward the well
    const chordMat = steel(0xc23a2b, 0.5, 0.45); // painted red-orange derrick steel
    const corners = [
      [legHalf, legHalf], [legHalf, -legHalf], [-legHalf, legHalf], [-legHalf, -legHalf],
    ];
    corners.forEach(([cx, cz]) => {
      const chord = new THREE.Mesh(new THREE.BoxGeometry(0.16, MAST_H, 0.16), chordMat);
      chord.position.set(cx, MAST_H / 2, cz);
      chord.castShadow = true;
      mast.add(chord);
    });

    const rungMat = steel(0xd0d4d8, 0.6, 0.5);
    const bays = 14;
    const bayH = MAST_H / bays;
    // Four side definitions (pairs of corner XZ) to brace every face.
    const sides = [
      { a: [legHalf, legHalf], b: [legHalf, -legHalf], axis: 'z' as const },   // +X face
      { a: [-legHalf, legHalf], b: [-legHalf, -legHalf], axis: 'z' as const },  // −X face
      { a: [legHalf, legHalf], b: [-legHalf, legHalf], axis: 'x' as const },    // +Z face
      { a: [legHalf, -legHalf], b: [-legHalf, -legHalf], axis: 'x' as const },  // −Z face
    ];
    for (let i = 0; i <= bays; i++) {
      const y = i * bayH;
      // Horizontal rung on each side
      sides.forEach((s) => {
        const midX = (s.a[0] + s.b[0]) / 2;
        const midZ = (s.a[1] + s.b[1]) / 2;
        const len = Math.hypot(s.a[0] - s.b[0], s.a[1] - s.b[1]);
        const geo = s.axis === 'z'
          ? new THREE.BoxGeometry(0.06, 0.06, len)
          : new THREE.BoxGeometry(len, 0.06, 0.06);
        const rung = new THREE.Mesh(geo, rungMat);
        rung.position.set(midX, y, midZ);
        mast.add(rung);
      });
    }
    // Diagonal X-braces per bay per side
    for (let i = 0; i < bays; i++) {
      const y0 = i * bayH;
      sides.forEach((s) => {
        const midX = (s.a[0] + s.b[0]) / 2;
        const midZ = (s.a[1] + s.b[1]) / 2;
        const spanLen = Math.hypot(s.a[0] - s.b[0], s.a[1] - s.b[1]);
        const diagLen = Math.hypot(spanLen, bayH);
        [1, -1].forEach((dir) => {
          const brace = new THREE.Mesh(new THREE.BoxGeometry(0.04, diagLen, 0.04), rungMat);
          brace.position.set(midX, y0 + bayH / 2, midZ);
          if (s.axis === 'z') {
            // brace lies in the Y–Z plane
            brace.rotation.x = dir * Math.atan2(spanLen, bayH);
          } else {
            brace.rotation.z = dir * Math.atan2(spanLen, bayH);
          }
          mast.add(brace);
        });
      });
    }

    // --- Crown block at the top (frame + sheaves) ---
    const crown = new THREE.Group();
    crown.position.set(0, MAST_H, 0);
    const crownFrame = new THREE.Mesh(new THREE.BoxGeometry(legHalf * 2.4, 0.9, legHalf * 2.4), redMat);
    crownFrame.castShadow = true; crown.add(crownFrame);
    const crownSheave = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.08, 10, 20), steel(0x111827));
    crownSheave.rotation.y = Math.PI / 2; crownSheave.position.y = 0.15; crown.add(crownSheave);
    mast.add(crown);

    // --- Racking / tubing board platform partway up (on the well-facing side) ---
    const board = new THREE.Group();
    board.position.set(-legHalf - 0.9, MAST_H * 0.6, 0);
    const boardFloor = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.1, 2.2), steel(0xd4a017, 0.7, 0.3));
    boardFloor.castShadow = true; board.add(boardFloor);
    const boardRail = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.5, 0.06), steel(0xd4a017, 0.7, 0.3));
    boardRail.position.set(0, 0.3, -1.05); board.add(boardRail);
    mast.add(board);

    pu.add(mast);
    // Ensure the mast's local matrix reflects its lean rotation so we can read
    // exact world-relative positions of its top for the cables/guy wires below.
    mast.updateMatrix();

    // --- Hoist cable from crown → over to the injector (which sits to the side
    // over the wellhead). The travelling block + hook hang directly above the
    // injector top, and the drilling line angles from the crown across to it,
    // exactly like the hand-drawn diagram. ---
    const lineMat = new THREE.LineBasicMaterial({ color: 0x0a0a0a });
    // Real (leaned) crown-sheave position in pu-space.
    const crownTop = new THREE.Vector3(0, MAST_H - 0.4, 0).applyMatrix4(mast.matrix);
    const blockY = INJECTOR_TOP_Y + 2.4; // travelling block sits above the injector
    const blockPos = new THREE.Vector3(INJ_LOCAL_X, blockY, 0); // above injector

    // Travelling block (over the injector)
    const tBlock = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.0, 0.7), redMat);
    tBlock.position.copy(blockPos);
    tBlock.castShadow = true;
    pu.add(tBlock);
    // Hook + bail link down to the injector top
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, blockY - INJECTOR_TOP_Y - 0.4, 10), steel(0x374151, 0.5, 0.6));
    hook.position.set(INJ_LOCAL_X, (blockY + INJECTOR_TOP_Y) / 2, 0);
    pu.add(hook);

    // Main hoist line: crown → travelling block (angles across, as in the diagram)
    [-0.12, 0, 0.12].forEach((dz) => {
      const g = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(crownTop.x, crownTop.y, dz),
        new THREE.Vector3(blockPos.x, blockPos.y + 0.5, dz),
      ]);
      pu.add(new THREE.Line(g, lineMat));
    });
    // Fast line from crown down to the drawworks drum on the carrier truck
    pu.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(crownTop.x, crownTop.y, -0.3),
      new THREE.Vector3(-1.1, 2.3, -3.2),
    ]), lineMat));

    // --- Guy wires from the ACTUAL mast top to ground anchors ---
    // The mast group is rotated by LEAN about Z, so transform the mast-local
    // collar point (0, MAST_H-1.5, 0) into pu-space so the wires connect exactly
    // to the real (leaned) mast top instead of an imaginary vertical one.
    const guyMat = new THREE.LineBasicMaterial({ color: 0x1f2937 });
    const guyTop = new THREE.Vector3(0, MAST_H - 1.5, 0).applyMatrix4(mast.matrix);
    const anchors = [
      new THREE.Vector3(9, 0.1, 12),
      new THREE.Vector3(9, 0.1, -12),
      new THREE.Vector3(-12, 0.1, 12),
      new THREE.Vector3(-12, 0.1, -12),
    ];
    anchors.forEach((a) => {
      const g = new THREE.BufferGeometry().setFromPoints([guyTop.clone(), a]);
      pu.add(new THREE.Line(g, guyMat));
      // ground anchor stub
      const stub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.6, 8), steel(0x3f3f46));
      stub.position.set(a.x, 0.3, a.z); pu.add(stub);
    });

    scene.add(pu);
  }

  // =========================================================================
  // BACKGROUND SITE PROPS — pumpjack, storage tanks, power poles, perimeter
  // fence & scattered equipment for a fully-populated oil & gas lease.
  // =========================================================================
  function buildBackgroundProps(scene: THREE.Scene) {
    const steel = (c: number, r = 0.7, m = 0.4) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });

    // --- Pumpjack (nodding donkey) in the background behind the wellhead ---
    const pj = new THREE.Group();
    pj.position.set(WELL_X + 24, 0, -18);
    pj.rotation.y = -0.5;
    // Concrete base
    const pjBase = new THREE.Mesh(new THREE.BoxGeometry(3, 0.4, 1.6), steel(0x6b7280, 0.95, 0.05));
    pjBase.position.y = 0.2; pjBase.castShadow = true; pj.add(pjBase);
    // Samson post (A-frame)
    const postMat = steel(0x1f6feb, 0.5, 0.5);
    const legA = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5.2, 0.25), postMat);
    legA.position.set(-0.7, 2.6, 0); legA.rotation.z = 0.16; legA.castShadow = true; pj.add(legA);
    const legB = new THREE.Mesh(new THREE.BoxGeometry(0.25, 5.2, 0.25), postMat);
    legB.position.set(0.7, 2.6, 0); legB.rotation.z = -0.16; legB.castShadow = true; pj.add(legB);
    // Walking beam
    const beam = new THREE.Mesh(new THREE.BoxGeometry(7.5, 0.35, 0.4), postMat);
    beam.position.set(-0.4, 5.1, 0); beam.rotation.z = 0.12; beam.castShadow = true; pj.add(beam);
    // Horse head
    const head = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, 0.4, 16, 1, false, 0, Math.PI), postMat);
    head.position.set(3.1, 4.6, 0); head.rotation.z = Math.PI / 2; pj.add(head);
    // Counterweight / crank
    const cw = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.4, 0.4), steel(0x111827, 0.6, 0.4));
    cw.position.set(-3.4, 3.2, 0); cw.castShadow = true; pj.add(cw);
    scene.add(pj);

    // --- Storage tank battery (a couple of vertical tanks) ---
    [
      [WELL_X + 22, -26],
      [WELL_X + 25.5, -26.5],
    ].forEach(([x, z], i) => {
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(1.8, 1.8, 5.5, 24),
        steel(i === 0 ? 0x9ca3af : 0x6b7280, 0.8, 0.3),
      );
      tank.position.set(x, 2.75, z); tank.castShadow = true; tank.receiveShadow = true;
      scene.add(tank);
      const topCap = new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.85, 0.2, 24), steel(0x4b5563));
      topCap.position.set(x, 5.6, z); scene.add(topCap);

      // Item 90: Tank ladder rungs
      const ladderMat = steel(0x374151, 0.6, 0.5);
      for (let rung = 0; rung < 8; rung++) {
        const lr = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.5), ladderMat);
        lr.position.set(x + 1.85, 0.8 + rung * 0.65, z);
        scene.add(lr);
      }
      // Ladder side rails
      [-0.22, 0.22].forEach((lz) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 5.5, 0.04), ladderMat);
        rail.position.set(x + 1.85, 2.75, z + lz);
        scene.add(rail);
      });

      // Item 91: Tank vent pipe at top
      const ventPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.8, 8), ladderMat);
      ventPipe.position.set(x + 0.5, 6.1, z);
      scene.add(ventPipe);
    });

    // --- Power line poles receding across the field ---
    const woodMat = steel(0x5c4326, 0.95, 0.0);
    const polePositions: [number, number][] = [];
    for (let i = 0; i < 5; i++) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 8, 8), woodMat);
      const px = MG_UNIT_X - 12 - i * 0.5;
      const pz = -18 - i * 9;
      polePositions.push([px, pz]);
      pole.position.set(px, 4, pz); pole.castShadow = true; scene.add(pole);
      const cross = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.16, 0.16), woodMat);
      cross.position.set(px, 7.2, pz); scene.add(cross);
    }
    // Item 93: Power line wires between poles (3 conductors)
    const powerWireMat = new THREE.LineBasicMaterial({ color: 0x1f2937 });
    [-0.9, 0, 0.9].forEach((wireOffset) => {
      const wirePoints: THREE.Vector3[] = [];
      polePositions.forEach(([px, pz]) => {
        wirePoints.push(new THREE.Vector3(px + wireOffset, 7.2, pz));
      });
      const pwGeo = new THREE.BufferGeometry().setFromPoints(wirePoints);
      scene.add(new THREE.Line(pwGeo, powerWireMat));
    });

    // --- Perimeter fence posts with horizontal wire runs ---
    const fenceMat = steel(0x3f3f46, 0.9, 0.2);
    const wireMat = new THREE.LineBasicMaterial({ color: 0x6b7280 });
    const siteCenterX = (MG_UNIT_X + WELL_X) / 2;
    const halfW = 32, halfD = 20;
    for (let i = -halfW; i <= halfW; i += 4) {
      [halfD, -halfD].forEach((dz) => {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.3, 6), fenceMat);
        post.position.set(siteCenterX + i, 0.65, dz);
        scene.add(post);
      });
    }
    // Horizontal fence wires between posts (2 wire runs at 0.5 and 1.0 height)
    [halfD, -halfD].forEach((dz) => {
      [0.5, 1.0].forEach((wireY) => {
        const pts: THREE.Vector3[] = [];
        for (let i = -halfW; i <= halfW; i += 4) {
          pts.push(new THREE.Vector3(siteCenterX + i, wireY, dz));
        }
        const wireGeo = new THREE.BufferGeometry().setFromPoints(pts);
        scene.add(new THREE.Line(wireGeo, wireMat));
      });
    });

    // --- A few scattered pipe joints on the ground (like the reference) ---
    const pipeMat = steel(0x1c1917, 0.7, 0.5);
    for (let i = 0; i < 5; i++) {
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 5, 10), pipeMat);
      pipe.rotation.z = Math.PI / 2;
      pipe.position.set(WELL_X - 1 + (i % 2) * 0.3, 0.15 + i * 0.26, -9 - i * 0.28);
      pipe.castShadow = true; scene.add(pipe);
    }
  }

  function buildMobileUnitTruck(scene: THREE.Scene) {
    const truckVibGroup = new THREE.Group();
    truckVibrationGroupRef.current = truckVibGroup;

    const truckGroup = new THREE.Group();
    // MG UNIT cabin positioned far left of the site; operator platform/console
    // at its rear faces across toward the wellhead (right), per the diagram.
    truckGroup.position.set(MG_UNIT_X, 0, 0);

    const chassisMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.7 });
    const cabMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.3, roughness: 0.4 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.95, roughness: 0.1 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 });

    // Heavy Main Frame Rails
    const railL = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.35, 0.2), chassisMat);
    railL.position.set(-0.5, 1.1, 0.7);
    railL.castShadow = true;
    truckGroup.add(railL);

    const railR = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.35, 0.2), chassisMat);
    railR.position.set(-0.5, 1.1, -0.7);
    railR.castShadow = true;
    truckGroup.add(railR);

    // Front Kenworth Commercial Heavy Cab
    const cab = new THREE.Mesh(new THREE.BoxGeometry(3.6, 2.7, 2.5), cabMat);
    cab.position.set(-4.5, 2.6, 0);
    cab.castShadow = true;
    truckGroup.add(cab);

    // Item 41: Windshield — transparent glass plane on cab front
    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x88aacc, transparent: true, opacity: 0.35,
      metalness: 0.9, roughness: 0.05,
    });
    const windshield = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.3), glassMat);
    windshield.position.set(-2.68, 3.05, 0);
    windshield.rotation.y = Math.PI / 2;
    truckGroup.add(windshield);

    // Item 43: Side mirrors
    const mirrorMat = new THREE.MeshStandardMaterial({ color: 0xd0d8e0, metalness: 0.95, roughness: 0.05 });
    [-1.35, 1.35].forEach((mz) => {
      const mirrorArm = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.6, 6), chassisMat);
      mirrorArm.rotation.x = Math.PI / 2;
      mirrorArm.position.set(-3.5, 3.5, mz);
      truckGroup.add(mirrorArm);
      const mirrorFace = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.25, 0.18), mirrorMat);
      mirrorFace.position.set(-3.5, 3.5, mz > 0 ? mz + 0.35 : mz - 0.35);
      truckGroup.add(mirrorFace);
    });

    // Engine Hood & Radiator Grille
    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.6, 2.3), cabMat);
    hood.position.set(-7.2, 2.05, 0);
    hood.castShadow = true;
    truckGroup.add(hood);

    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 2.1), chromeMat);
    grille.position.set(-8.45, 2.05, 0);
    truckGroup.add(grille);

    // Item 42: Headlights — yellow spheres on hood front
    const headlightMat = new THREE.MeshStandardMaterial({ color: 0xffd700, emissive: 0xffaa00, emissiveIntensity: 0.3, roughness: 0.1 });
    const headlightGeo = new THREE.SphereGeometry(0.18, 12, 12);
    [-0.75, 0.75].forEach((hz) => {
      const headlight = new THREE.Mesh(headlightGeo, headlightMat);
      headlight.position.set(-8.5, 2.1, hz);
      truckGroup.add(headlight);
    });

    // Vertical Chrome Exhaust Stack
    const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 3.8, 16), chromeMat);
    exhaust.position.set(-1.2, 3.2, 1.1);
    truckGroup.add(exhaust);

    // Tandem Drive Axles & Tires (8 Heavy Road Wheels)
    const wheelGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.38, 24);
    wheelGeo.rotateX(Math.PI / 2);
    [
      [-7.2, 0.55, 1.25],
      [-7.2, 0.55, -1.25],
      [0.8, 0.55, 1.25],
      [0.8, 0.55, -1.25],
      [2.2, 0.55, 1.25],
      [2.2, 0.55, -1.25],
    ].forEach(([x, y, z]) => {
      const tire = new THREE.Mesh(wheelGeo, tireMat);
      tire.position.set(x, y, z);
      tire.castShadow = true;
      truckGroup.add(tire);
    });

    // Rear Steel Working Deck (Diamond Plate)
    const deckGeo = new THREE.BoxGeometry(6.2, 0.22, 2.6);
    const deckMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      metalness: 0.8,
      roughness: 0.3,
    });
    const deck = new THREE.Mesh(deckGeo, deckMat);
    deck.position.set(1.4, 1.35, 0);
    deck.receiveShadow = true;
    truckGroup.add(deck);

    // =========================================================================
    // OPEN-AIR REAR OPERATOR PLATFORM & WEATHERFORD CONSOLE
    // =========================================================================
    const opPlatformGroup = new THREE.Group();
    opPlatformGroup.position.set(3.8, 1.46, 0);

    // Grated Metal Platform (Open standing area at the back of the truck)
    const platFloor = new THREE.Mesh(
      new THREE.BoxGeometry(2.2, 0.12, 2.5),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.75, roughness: 0.4 })
    );
    platFloor.position.set(0, 0, 0);
    platFloor.receiveShadow = true;
    opPlatformGroup.add(platFloor);

    // Safety Railings (Safety Amber/Yellow) — industrial pipe rails, not solid walls
    const railMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, roughness: 0.4, metalness: 0.3 });
    const railPipeGeo = new THREE.CylinderGeometry(0.035, 0.035, 2.3, 10);
    railPipeGeo.rotateZ(Math.PI / 2); // horizontal along X
    const railPipeGeoZ = new THREE.CylinderGeometry(0.035, 0.035, 2.6, 10);
    railPipeGeoZ.rotateX(Math.PI / 2); // horizontal along Z
    const railPostGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8);

    // Left side railing (+Z)
    [0.35, 1.05].forEach((ry) => {
      const pipe = new THREE.Mesh(railPipeGeo, railMat);
      pipe.position.set(0, ry, 1.27);
      opPlatformGroup.add(pipe);
    });
    [-1.0, 0, 1.0].forEach((rx) => {
      const post = new THREE.Mesh(railPostGeo, railMat);
      post.position.set(rx, 0.6, 1.27);
      opPlatformGroup.add(post);
    });

    // Right side railing (-Z)
    [0.35, 1.05].forEach((ry) => {
      const pipe = new THREE.Mesh(railPipeGeo, railMat);
      pipe.position.set(0, ry, -1.27);
      opPlatformGroup.add(pipe);
    });
    [-1.0, 0, 1.0].forEach((rx) => {
      const post = new THREE.Mesh(railPostGeo, railMat);
      post.position.set(rx, 0.6, -1.27);
      opPlatformGroup.add(post);
    });

    // Back railing (-X side)
    [0.35, 1.05].forEach((ry) => {
      const pipe = new THREE.Mesh(railPipeGeoZ, railMat);
      pipe.position.set(-1.15, ry, 0);
      opPlatformGroup.add(pipe);
    });
    [-1.1, 0, 1.1].forEach((rz) => {
      const post = new THREE.Mesh(railPostGeo, railMat);
      post.position.set(-1.15, 0.6, rz);
      opPlatformGroup.add(post);
    });

    // =========================================================================
    // WEATHERFORD OUTDOOR CONTROL CONSOLE WITH FULL GAUGES, BUTTONS & LEVERS
    // =========================================================================
    const consoleStandGroup = new THREE.Group();
    consoleStandGroup.position.set(0.65, 0.65, 0);

    // Heavy Industrial Carbon / Graphite Pedestal & Outer Frame
    const consoleHousingMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      metalness: 0.6,
      roughness: 0.4,
    });
    const consoleBase = new THREE.Mesh(new THREE.BoxGeometry(0.8, 1.25, 2.2), consoleHousingMat);
    consoleBase.position.set(0, 0, 0);
    consoleBase.castShadow = true;
    consoleStandGroup.add(consoleBase);

    // Weatherford Industrial Red Paint Material
    const consoleRedMat = new THREE.MeshStandardMaterial({
      color: 0xb91c1c,
      roughness: 0.35,
      metalness: 0.15,
    });

    // Per real photo (item 10): Instrument panel face is BRUSHED ALUMINUM, not red
    const aluminumPanelMat = new THREE.MeshStandardMaterial({
      color: 0xb8bec6,
      metalness: 0.7,
      roughness: 0.35,
    });
    const aluminumVerticalPanel = new THREE.Mesh(
      new THREE.BoxGeometry(0.04, 1.1, 2.1),
      aluminumPanelMat
    );
    aluminumVerticalPanel.position.set(-0.38, 0.55, 0);
    consoleStandGroup.add(aluminumVerticalPanel);

    // Lower Horizontal Red Operator Shelf / Deck (Extending towards Operator at -X)
    const redShelfDeck = new THREE.Mesh(
      new THREE.BoxGeometry(0.55, 0.04, 2.1),
      consoleRedMat
    );
    redShelfDeck.position.set(-0.65, 0.05, 0);
    consoleStandGroup.add(redShelfDeck);

    // Per real photo (item 25): Sunhood is RED, not black
    const consoleSunhood = new THREE.Mesh(
      new THREE.BoxGeometry(0.85, 0.06, 2.25),
      consoleRedMat
    );
    consoleSunhood.position.set(-0.05, 1.12, 0);
    consoleStandGroup.add(consoleSunhood);

    // Side Protective Charcoal Cheeks
    const sideCheekMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.5 });
    const cheekL = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.05, 0.06), sideCheekMat);
    cheekL.position.set(-0.35, 0.55, 1.08);
    consoleStandGroup.add(cheekL);

    const cheekR = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.05, 0.06), sideCheekMat);
    cheekR.position.set(-0.35, 0.55, -1.08);
    consoleStandGroup.add(cheekR);

    // Item 20: Weatherford Branding with RED chevron logo (per real photo 1)
    const logoCanvas = document.createElement('canvas');
    logoCanvas.width = 512;
    logoCanvas.height = 96;
    const logoCtx = logoCanvas.getContext('2d')!;
    logoCtx.fillStyle = '#c0c8d0';
    logoCtx.fillRect(0, 0, 512, 96);
    // Red chevron "W" logo
    logoCtx.fillStyle = '#cc2222';
    logoCtx.beginPath();
    logoCtx.moveTo(50, 65); logoCtx.lineTo(70, 30); logoCtx.lineTo(90, 55);
    logoCtx.lineTo(110, 30); logoCtx.lineTo(130, 65);
    logoCtx.lineTo(120, 65); logoCtx.lineTo(110, 42); logoCtx.lineTo(90, 65);
    logoCtx.lineTo(70, 42); logoCtx.lineTo(60, 65);
    logoCtx.fill();
    // Brand text
    logoCtx.font = 'bold 32px Arial, sans-serif';
    logoCtx.fillStyle = '#1a1a2e';
    logoCtx.fillText('Weatherford', 140, 58);
    logoCtx.font = '14px Arial, sans-serif';
    logoCtx.fillStyle = '#555';
    logoCtx.fillText('COROD® MG-093', 360, 58);
    const logoTex = new THREE.CanvasTexture(logoCanvas);
    const badgeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.85, 0.16),
      new THREE.MeshBasicMaterial({ map: logoTex })
    );
    badgeMesh.rotation.y = -Math.PI / 2;
    badgeMesh.position.set(-0.41, 1.02, 0);
    consoleStandGroup.add(badgeMesh);

    // Item 19: NOTICE placard — "CYCLE COOLER AS NECESSARY..." (per real photo 1)
    const noticeCanvas = document.createElement('canvas');
    noticeCanvas.width = 192;
    noticeCanvas.height = 128;
    const nCtx = noticeCanvas.getContext('2d')!;
    nCtx.fillStyle = '#ffffff';
    nCtx.fillRect(0, 0, 192, 128);
    nCtx.fillStyle = '#2563eb';
    nCtx.fillRect(4, 4, 184, 30);
    nCtx.font = 'bold 18px Arial';
    nCtx.fillStyle = '#ffffff';
    nCtx.textAlign = 'center';
    nCtx.fillText('NOTICE', 96, 26);
    nCtx.font = '11px Arial';
    nCtx.fillStyle = '#1a1a2e';
    nCtx.fillText('CYCLE COOLER AS', 96, 52);
    nCtx.fillText('NECESSARY TO', 96, 66);
    nCtx.fillText('MAINTAIN', 96, 80);
    nCtx.fillText('HYDRAULIC OIL', 96, 94);
    nCtx.fillText('TEMPERATURE', 96, 108);
    nCtx.strokeStyle = '#2563eb';
    nCtx.lineWidth = 3;
    nCtx.strokeRect(2, 2, 188, 124);
    const noticeTex = new THREE.CanvasTexture(noticeCanvas);
    const noticeMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(0.14, 0.10),
      new THREE.MeshBasicMaterial({ map: noticeTex })
    );
    noticeMesh.rotation.y = -Math.PI / 2;
    noticeMesh.position.set(-0.40, 0.58, 0.55);
    consoleStandGroup.add(noticeMesh);

    // -------------------------------------------------------------------------
    // 8 HIGH-DEFINITION ANALOG GAUGES WITH BRUSHED SILVER PLACARDS
    // Left: 6 Gauges (3 cols x 2 rows) | Right: 2 Large High-Pressure Gauges
    // -------------------------------------------------------------------------
    const gaugeDefs = [
      // Top Row (y = 0.82): Air Regulator, Charge Pressure, Safety Pressure, Motor Pressure
      { id: 'A', title: 'AIR REG.', max: 150, unit: 'PSI', y: 0.82, z: 0.97, isLarge: false, hasHandle: false, zone: { start: 100, end: 130, color: '#22c55e' } },
      { id: 'E', title: 'CHARGE PRESS.', max: 600, unit: 'PSI', y: 0.82, z: 0.75, isLarge: false, hasHandle: false, zone: { start: 250, end: 350, color: '#22c55e' } },
      { id: 'H', title: 'SAFETY PRESS.', max: 5000, unit: 'PSI', y: 0.82, z: 0.48, isLarge: false, hasHandle: false, zone: { start: 2000, end: 2800, color: '#22c55e' } },
      // Per real photo (item 5): Gauge B is BOP PRESSURE, not MOTOR PRESS.
      { id: 'B', title: 'BOP PRESSURE', max: 5000, unit: 'PSI', y: 0.82, z: 0.20, isLarge: false, hasHandle: false, zone: { start: 1000, end: 1500, color: '#22c55e' } },

      // Bottom Row (y = 0.48): System Pressure, Squeeze Pressure, Chain Tension (each with side handle)
      { id: 'F', title: 'SYSTEM PRESS.', max: 3000, unit: 'PSI', y: 0.48, z: 0.75, isLarge: false, hasHandle: true, zone: { start: 2000, end: 2500, color: '#22c55e' } },
      { id: 'I', title: 'SQUEEZE PRESS.', max: 3000, unit: 'PSI', y: 0.48, z: 0.48, isLarge: false, hasHandle: true, zone: { start: 400, end: 2500, color: '#22c55e' } },
      { id: 'G', title: 'CHAIN TENSION', max: 600, unit: 'PSI', y: 0.48, z: 0.20, isLarge: false, hasHandle: true, zone: { start: 100, end: 200, color: '#22c55e' } },

      // Right 2 Prominent Large Gauges (y = 0.65): Down Pressure, Up Pressure
      { id: 'M', title: 'DOWN PRESSURE', max: 5000, unit: 'PSI', y: 0.65, z: -0.28, isLarge: true, hasHandle: false, zone: { start: 3000, end: 4200, color: '#22c55e' } },
      { id: 'L', title: 'UP PRESSURE', max: 5000, unit: 'PSI', y: 0.65, z: -0.74, isLarge: true, hasHandle: false, zone: { start: 3000, end: 4200, color: '#22c55e' } },
    ];

    const needleMat = new THREE.MeshBasicMaterial({ color: 0x0f172a });
    // Reuses `chromeMat` declared earlier in this function (line ~597).
    const blackMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.4 });

    gaugeDefs.forEach((g) => {
      const radius = g.isLarge ? 0.17 : 0.10;
      const dialTex = createGaugeDialTexture(g.id, g.title, g.max, g.unit, g.zone);
      const dialMat = new THREE.MeshBasicMaterial({ map: dialTex });

      // Silver Brushed Metal Placard Above Gauge
      const placardWidth = g.isLarge ? 0.36 : 0.23;
      const placardHeight = g.isLarge ? 0.07 : 0.05;
      const placardY = g.isLarge ? g.y + radius + 0.06 : g.y + radius + 0.045;
      const placardMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(placardWidth, placardHeight),
        new THREE.MeshBasicMaterial({ map: createPlacardTexture(g.title) })
      );
      placardMesh.rotation.y = -Math.PI / 2;
      placardMesh.position.set(-0.405, placardY, g.z);
      consoleStandGroup.add(placardMesh);

      // Outer Bezel Rim (Facing -X)
      const bezel = new THREE.Mesh(
        new THREE.CylinderGeometry(radius, radius, 0.025, 24),
        g.isLarge ? blackMat : chromeMat
      );
      bezel.rotation.z = Math.PI / 2;
      bezel.position.set(-0.40, g.y, g.z);
      consoleStandGroup.add(bezel);

      // White Dial Face
      const dial = new THREE.Mesh(
        new THREE.CylinderGeometry(radius - 0.012, radius - 0.012, 0.028, 24),
        dialMat
      );
      dial.rotation.z = Math.PI / 2;
      dial.position.set(-0.402, g.y, g.z);
      consoleStandGroup.add(dial);

      // Item 11: 3 chrome flanged mounting bolts per gauge (per real photo 3)
      const gaugeBoltGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.012, 6);
      for (let mb = 0; mb < 3; mb++) {
        const mbAngle = (mb * Math.PI * 2) / 3 + Math.PI / 6;
        const mbBolt = new THREE.Mesh(gaugeBoltGeo, chromeMat);
        mbBolt.rotation.z = Math.PI / 2;
        mbBolt.position.set(
          -0.39,
          g.y + Math.sin(mbAngle) * (radius + 0.005),
          g.z + Math.cos(mbAngle) * (radius + 0.005)
        );
        consoleStandGroup.add(mbBolt);
      }

      // Side Isolation Handle on bottom row gauges
      if (g.hasHandle) {
        const handleStem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.007, 0.007, 0.06, 8),
          blackMat
        );
        handleStem.rotation.x = Math.PI / 3;
        handleStem.position.set(-0.41, g.y, g.z - radius - 0.03);
        consoleStandGroup.add(handleStem);

        const handleBall = new THREE.Mesh(
          new THREE.SphereGeometry(0.018, 12, 12),
          blackMat
        );
        handleBall.position.set(-0.41, g.y + 0.025, g.z - radius - 0.05);
        consoleStandGroup.add(handleBall);
      }

      // 3D Needle Pivot Mesh
      const needlePivot = new THREE.Group();
      needlePivot.rotation.y = -Math.PI / 2;
      needlePivot.position.set(-0.42, g.y, g.z);

      const pointerLen = radius * 0.72;
      const needlePointer = new THREE.Mesh(
        new THREE.ConeGeometry(0.008, pointerLen, 4),
        needleMat
      );
      needlePointer.position.set(0, pointerLen / 2, 0.005);
      needlePivot.add(needlePointer);

      const needleCenterCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.016, 0.016, 0.01, 12),
        blackMat
      );
      needleCenterCap.rotation.x = Math.PI / 2;
      needlePivot.add(needleCenterCap);

      consoleStandGroup.add(needlePivot);
      needlesMapRef.current[g.id] = needlePivot as unknown as THREE.Mesh;
    });

    // -------------------------------------------------------------------------
    // LOWER RED SHELF / OPERATOR DECK CONTROLS
    // Left: 4 Actuator Blocks (Bronze + LIME GREEN) | Right: DOWNHOLE & RELIEF
    // -------------------------------------------------------------------------
    const bronzeBlockMat = new THREE.MeshStandardMaterial({
      color: 0x78350f,
      roughness: 0.35,
      metalness: 0.5,
    });
    const limeGreenBlockMat = new THREE.MeshStandardMaterial({
      color: 0x84cc16,
      roughness: 0.3,
      metalness: 0.2,
    });
    const leverStemMat = new THREE.MeshStandardMaterial({ color: 0x09090b, metalness: 0.9 });
    const knobBlackMat = new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.3 });
    // Per real photos: ball lever knobs are RED, not black (items 1-2)
    const knobRedMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3, metalness: 0.1 });
    // Per real photos: pressure adjust blocks (U, W, X) are RED cast metal (item 3)
    const redBlockMat = new THREE.MeshStandardMaterial({ color: 0xcc2222, roughness: 0.35, metalness: 0.3 });
    // Per real photos: Air Regulator (C) is a YELLOW rotary knob (item 4)
    const yellowKnobMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.4, metalness: 0.1 });

    // 4 Control Blocks:
    const deckBlocks = [
      { id: 'P', title: 'CHAIN TENSION', z: 0.75, isGreen: false },
      { id: 'R', title: 'SQUEEZE PRESS.', z: 0.48, isGreen: false },
      { id: 'T', title: 'INJECTOR BRAKE', z: 0.20, isGreen: false },
      { id: 'V', title: 'SAFETY', z: -0.05, isGreen: true }, // THE ICONIC LIME GREEN SAFETY BLOCK!
    ];

    // Shared materials & geometries for deck blocks (avoid per-iteration allocations)
    const boltMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.5 });
    const boltGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.015, 6);
    const dialKnobMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.3 });
    const dialKnobGeo = new THREE.CylinderGeometry(0.042, 0.042, 0.035, 16);
    const blockGeo = new THREE.BoxGeometry(0.18, 0.12, 0.18);
    const stemGeo = new THREE.CylinderGeometry(0.01, 0.01, 0.18, 8);
    const ballGeo = new THREE.SphereGeometry(0.028, 12, 12);
    const knobPlateGeo = new THREE.BoxGeometry(0.12, 0.015, 0.12);

    deckBlocks.forEach((blk) => {
      // Main Cast Metal Block
      const blockMesh = new THREE.Mesh(
        blockGeo,
        blk.isGreen ? limeGreenBlockMat : bronzeBlockMat
      );
      blockMesh.position.set(-0.58, 0.12, blk.z);
      blockMesh.castShadow = true;
      consoleStandGroup.add(blockMesh);

      // Silver Placard on Front Face
      const placardMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(0.16, 0.045),
        new THREE.MeshBasicMaterial({ map: createPlacardTexture(blk.title) })
      );
      placardMesh.rotation.y = -Math.PI / 2;
      placardMesh.position.set(-0.675, 0.13, blk.z);
      consoleStandGroup.add(placardMesh);

      // 4 Hex Corner Bolts on Top
      [-0.065, 0.065].forEach((dx) => {
        [-0.065, 0.065].forEach((dz) => {
          const bolt = new THREE.Mesh(boltGeo, boltMat);
          bolt.position.set(-0.58 + dx, 0.185, blk.z + dz);
          consoleStandGroup.add(bolt);
        });
      });

      // Vertical Black Ball Lever
      const stem = new THREE.Mesh(stemGeo, leverStemMat);
      stem.position.set(-0.58, 0.24, blk.z);
      stem.rotation.z = -0.15;
      consoleStandGroup.add(stem);

      // Per real photos: ball lever knobs are RED (item 1)
      const ball = new THREE.Mesh(ballGeo, knobRedMat);
      ball.position.set(-0.61, 0.33, blk.z);
      consoleStandGroup.add(ball);

      // Item 17: Pressure adjust blocks are RED cast metal per real photos
      // (Q: Chain Tension, S: Squeeze, U: Down, X: Up pressure blocks)
      const knobPlate = new THREE.Mesh(knobPlateGeo, redBlockMat);
      knobPlate.position.set(-0.78, 0.075, blk.z);
      consoleStandGroup.add(knobPlate);

      const dialKnob = new THREE.Mesh(dialKnobGeo, dialKnobMat);
      dialKnob.position.set(-0.78, 0.095, blk.z);
      consoleStandGroup.add(dialKnob);
    });

    // Non-slip Black Rubber Grip Strips along red deck
    const rubberStripMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 });
    for (let r = 0; r < 4; r++) {
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.008, 1.9), rubberStripMat);
      strip.position.set(-0.50 - r * 0.10, 0.072, 0);
      consoleStandGroup.add(strip);
    }

    // -------------------------------------------------------------------------
    // RIGHT OPERATOR CONTROLS: EMERGENCY SHUTDOWN, HORN, DOWNHOLE & RELIEF
    // -------------------------------------------------------------------------

    // 1. Vertical Red Wall Plates: EMERGENCY SHUT-DOWN & HORN
    // EMERGENCY SHUT-DOWN (Component J) — Per real photo: RED mushroom push-button (item 6)
    const estopBox = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.11, 0.18), blackMat);
    estopBox.position.set(-0.395, 0.22, -0.32);
    consoleStandGroup.add(estopBox);

    const estopPlacard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.04),
      new THREE.MeshBasicMaterial({ map: createPlacardTexture('EMERGENCY\nSHUT-DOWN') })
    );
    estopPlacard.rotation.y = -Math.PI / 2;
    estopPlacard.position.set(-0.41, 0.27, -0.32);
    consoleStandGroup.add(estopPlacard);

    // Red mushroom cap button (item 6)
    const estopMushroomMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.2, metalness: 0.1 });
    const estopBase = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16), blackMat);
    estopBase.rotation.z = Math.PI / 2;
    estopBase.position.set(-0.42, 0.20, -0.32);
    consoleStandGroup.add(estopBase);
    const estopMushroom = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), estopMushroomMat);
    estopMushroom.rotation.z = Math.PI / 2;
    estopMushroom.position.set(-0.43, 0.20, -0.32);
    consoleStandGroup.add(estopMushroom);

    // HORN PUSH BUTTON
    const hornBox = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.11, 0.14), blackMat);
    hornBox.position.set(-0.395, 0.22, -0.58);
    consoleStandGroup.add(hornBox);

    const hornPlacard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.12, 0.04),
      new THREE.MeshBasicMaterial({ map: createPlacardTexture('HORN') })
    );
    hornPlacard.rotation.y = -Math.PI / 2;
    hornPlacard.position.set(-0.41, 0.25, -0.58);
    consoleStandGroup.add(hornPlacard);

    const hornBtn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.025, 0.025, 0.025, 16),
      new THREE.MeshStandardMaterial({ color: 0x18181b, roughness: 0.3 })
    );
    hornBtn.rotation.z = Math.PI / 2;
    hornBtn.position.set(-0.415, 0.20, -0.58);
    consoleStandGroup.add(hornBtn);

    // 2. Lower Red Deck: DOWNHOLE DRIVE JOYSTICK & SAFETY RELIEF WHEEL VALVE
    // DOWNHOLE JOYSTICK (Component Y)
    const joyDeckPlate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.015, 0.20), blackMat);
    joyDeckPlate.position.set(-0.68, 0.075, -0.32);
    consoleStandGroup.add(joyDeckPlate);

    const joyPlacard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.16, 0.04),
      new THREE.MeshBasicMaterial({ map: createPlacardTexture('DOWNHOLE') })
    );
    joyPlacard.rotation.x = -Math.PI / 2;
    joyPlacard.position.set(-0.68, 0.085, -0.39);
    consoleStandGroup.add(joyPlacard);

    // Ribbed Rubber Boot
    [0.055, 0.045, 0.035].forEach((rad, idx) => {
      const bootRing = new THREE.Mesh(
        new THREE.CylinderGeometry(rad, rad + 0.01, 0.025, 16),
        blackMat
      );
      bootRing.position.set(-0.68, 0.09 + idx * 0.022, -0.32);
      consoleStandGroup.add(bootRing);
    });

    const joyShaftGroup = new THREE.Group();
    joyShaftGroup.position.set(-0.68, 0.15, -0.32);

    const joyShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.30, 12), leverStemMat);
    joyShaft.position.set(0, 0.12, 0);
    joyShaftGroup.add(joyShaft);

    const joyHandle = new THREE.Mesh(new THREE.SphereGeometry(0.04, 16, 16), knobBlackMat);
    joyHandle.position.set(0, 0.27, 0);
    joyShaftGroup.add(joyHandle);

    consoleStandGroup.add(joyShaftGroup);
    joyShaftMeshRef.current = joyShaftGroup as unknown as THREE.Mesh;

    // SAFETY RELIEF WHEEL VALVE ON ARCHED RISER PIPE
    const reliefDeckPlate = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.015, 0.24), blackMat);
    reliefDeckPlate.position.set(-0.68, 0.075, -0.74);
    consoleStandGroup.add(reliefDeckPlate);

    const reliefPlacard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.18, 0.04),
      new THREE.MeshBasicMaterial({ map: createPlacardTexture('SAFETY RELIEF') })
    );
    reliefPlacard.rotation.x = -Math.PI / 2;
    reliefPlacard.position.set(-0.68, 0.085, -0.83);
    consoleStandGroup.add(reliefPlacard);

    // Arched Bronze Mounting Pipe Riser
    const pipeCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.68, 0.08, -0.78),
      new THREE.Vector3(-0.68, 0.22, -0.76),
      new THREE.Vector3(-0.68, 0.25, -0.74),
      new THREE.Vector3(-0.68, 0.22, -0.72),
      new THREE.Vector3(-0.68, 0.08, -0.70),
    ]);
    const riserPipe = new THREE.Mesh(
      new THREE.TubeGeometry(pipeCurve, 16, 0.018, 12, false),
      bronzeBlockMat
    );
    consoleStandGroup.add(riserPipe);

    // Polished Chrome 5-Spoke Handwheel Valve
    const wheelGroup = new THREE.Group();
    wheelGroup.position.set(-0.68, 0.28, -0.74);

    // Outer Torus Rim
    const wheelRim = new THREE.Mesh(
      new THREE.TorusGeometry(0.11, 0.014, 12, 28),
      chromeMat
    );
    wheelRim.rotation.x = Math.PI / 2;
    wheelGroup.add(wheelRim);

    // 5 Radial Spokes
    for (let s = 0; s < 5; s++) {
      const sAngle = (s * Math.PI * 2) / 5;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.10, 8), chromeMat);
      spoke.rotation.z = Math.PI / 2;
      spoke.rotation.y = sAngle;
      spoke.position.set(Math.cos(sAngle) * 0.05, 0, Math.sin(sAngle) * 0.05);
      wheelGroup.add(spoke);
    }

    // Center Hub Cap
    const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16), chromeMat);
    wheelGroup.add(wheelHub);

    consoleStandGroup.add(wheelGroup);

    // -------------------------------------------------------------------------
    // ADDITIONAL CONSOLE CONTROLS PER REAL PHOTOS (items 4, 7, 8, 9, 14, 15)
    // -------------------------------------------------------------------------

    // Item 4: Air Regulator (C) — YELLOW rotary knob with DECREASE/INCREASE
    const airRegGroup = new THREE.Group();
    airRegGroup.position.set(-0.42, 0.40, 0.97);
    const airRegBase = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 16), blackMat);
    airRegBase.rotation.z = Math.PI / 2;
    airRegGroup.add(airRegBase);
    const airRegKnob = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 0.03, 16), yellowKnobMat);
    airRegKnob.rotation.z = Math.PI / 2;
    airRegKnob.position.set(-0.015, 0, 0);
    airRegGroup.add(airRegKnob);
    // Arrow indicator notch on top
    const airRegNotch = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.02, 0.002), blackMat);
    airRegNotch.position.set(-0.03, 0.02, 0);
    airRegGroup.add(airRegNotch);
    const airRegPlacard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.10, 0.03),
      new THREE.MeshBasicMaterial({ map: createPlacardTexture('AIR REGULATOR') })
    );
    airRegPlacard.rotation.y = -Math.PI / 2;
    airRegPlacard.position.set(-0.04, -0.06, 0);
    airRegGroup.add(airRegPlacard);
    consoleStandGroup.add(airRegGroup);

    // Item 7: Panel Lights switch (D) — RED rocker switch (per photo 3)
    const panelLightsGroup = new THREE.Group();
    panelLightsGroup.position.set(-0.42, 0.88, 0.97);
    const plSwitchBase = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.06, 0.04), blackMat);
    panelLightsGroup.add(plSwitchBase);
    const plRocker = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.04, 0.03),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.3 }));
    plRocker.position.set(-0.005, 0.01, 0);
    plRocker.rotation.z = 0.2;
    panelLightsGroup.add(plRocker);
    const plPlacard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.08, 0.025),
      new THREE.MeshBasicMaterial({ map: createPlacardTexture('PANEL\nLIGHTS') })
    );
    plPlacard.rotation.y = -Math.PI / 2;
    plPlacard.position.set(-0.02, -0.05, 0);
    panelLightsGroup.add(plPlacard);
    consoleStandGroup.add(panelLightsGroup);

    // Item 8: Chain Oiler switch (K) — toggle switch ON/OFF (per photo 3)
    const chainOilerGroup = new THREE.Group();
    chainOilerGroup.position.set(-0.42, 0.65, -0.10);
    const coBase = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.015, 12), chromeMat);
    coBase.rotation.z = Math.PI / 2;
    chainOilerGroup.add(coBase);
    const coToggle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8), chromeMat);
    coToggle.rotation.z = Math.PI / 2 + 0.4;
    coToggle.position.set(-0.02, 0.01, 0);
    chainOilerGroup.add(coToggle);
    const coKnob = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 8), chromeMat);
    coKnob.position.set(-0.04, 0.025, 0);
    chainOilerGroup.add(coKnob);
    const coPlacard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.08, 0.025),
      new THREE.MeshBasicMaterial({ map: createPlacardTexture('CHAIN\nOILER') })
    );
    coPlacard.rotation.y = -Math.PI / 2;
    coPlacard.position.set(-0.02, 0.05, 0);
    chainOilerGroup.add(coPlacard);
    consoleStandGroup.add(chainOilerGroup);

    // Item 9: Component Weight placard with real values (per photo 1)
    // Real placard: SERVICE REEL 550 KG, SAFETY ASSY 340 KG, GUIDE RACK AND
    // SAFETY ASSY 1000 KG, GRIPPER 2050 KG, PORTABLE FORGE WELDER 775 KG
    const weightPlacardCanvas = document.createElement('canvas');
    weightPlacardCanvas.width = 256;
    weightPlacardCanvas.height = 200;
    const wCtx = weightPlacardCanvas.getContext('2d')!;
    wCtx.fillStyle = '#c0c8d0';
    wCtx.fillRect(0, 0, 256, 200);
    wCtx.fillStyle = '#b0b8c0';
    wCtx.fillRect(2, 2, 252, 196);
    wCtx.font = 'bold 16px monospace';
    wCtx.fillStyle = '#1a1a2e';
    wCtx.textAlign = 'left';
    wCtx.fillText('COMPONENT WEIGHTS', 16, 28);
    wCtx.font = '13px monospace';
    const weights = [
      ['SERVICE REEL', '550 KG'],
      ['SAFETY ASSY', '340 KG'],
      ['GUIDE RACK AND', ''],
      ['  SAFETY ASSY', '1000 KG'],
      ['GRIPPER', '2050 KG'],
      ['PORTABLE FORGE', ''],
      ['  WELDER', '775 KG'],
    ];
    weights.forEach(([label, val], i) => {
      wCtx.fillText(label, 16, 52 + i * 20);
      if (val) wCtx.fillText('- ' + val, 170, 52 + i * 20);
    });
    const weightTex = new THREE.CanvasTexture(weightPlacardCanvas);
    const weightPlacard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.30, 0.22),
      new THREE.MeshBasicMaterial({ map: weightTex })
    );
    weightPlacard.rotation.y = -Math.PI / 2;
    weightPlacard.position.set(-0.40, 0.45, -0.12);
    consoleStandGroup.add(weightPlacard);

    // Item 14: BOP Bleed valve (N) — T-handle valve with OPEN/CLOSE
    const bopBleedGroup = new THREE.Group();
    bopBleedGroup.position.set(-0.58, 0.28, -0.85);
    const bbStem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.10, 8), chromeMat);
    bbStem.rotation.z = -0.15;
    bopBleedGroup.add(bbStem);
    const bbTHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.06, 8), chromeMat);
    bbTHandle.position.set(-0.005, 0.05, 0);
    bbTHandle.rotation.x = Math.PI / 2;
    bopBleedGroup.add(bbTHandle);
    const bbPlacard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.08, 0.025),
      new THREE.MeshBasicMaterial({ map: createPlacardTexture('BOP\nBLEED') })
    );
    bbPlacard.rotation.y = -Math.PI / 2;
    bbPlacard.position.set(-0.03, -0.07, 0);
    bopBleedGroup.add(bbPlacard);
    consoleStandGroup.add(bopBleedGroup);

    // Item 15: BOP ON/OFF switch (O) — RED rotary switch
    const bopSwitchGroup = new THREE.Group();
    bopSwitchGroup.position.set(-0.58, 0.10, -0.85);
    const boBase = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.02, 16), redBlockMat);
    boBase.rotation.z = Math.PI / 2;
    bopSwitchGroup.add(boBase);
    const boKnob = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 12), knobBlackMat);
    boKnob.position.set(-0.015, 0, 0);
    bopSwitchGroup.add(boKnob);
    const boPlacard = new THREE.Mesh(
      new THREE.PlaneGeometry(0.06, 0.025),
      new THREE.MeshBasicMaterial({ map: createPlacardTexture('BOP') })
    );
    boPlacard.rotation.y = -Math.PI / 2;
    boPlacard.position.set(-0.02, -0.04, 0);
    bopSwitchGroup.add(boPlacard);
    consoleStandGroup.add(bopSwitchGroup);

    opPlatformGroup.add(consoleStandGroup);
    // NOTE: opPlatformGroup (the detailed procedural Weatherford console + its
    // live 3D gauge needles) is intentionally NOT added to the hidden truckGroup.
    // It is re-parented below to a visible holder so it replaces the imported
    // model's simplified built-in console.

    // Outrigger Stabilizer Jacks (planted firmly on gravel pad)
    const outriggerGeo = new THREE.CylinderGeometry(0.12, 0.16, 1.4, 12);
    const outriggerMat = new THREE.MeshStandardMaterial({ color: 0xd97706 });
    [
      [-4.8, 0.7, 2.2],
      [-4.8, 0.7, -2.2],
      [4.8, 0.7, 2.2],
      [4.8, 0.7, -2.2],
    ].forEach(([x, y, z]) => {
      const leg = new THREE.Mesh(outriggerGeo, outriggerMat);
      leg.position.set(x, y, z);
      truckGroup.add(leg);
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 12), outriggerMat);
      foot.position.set(x, 0.05, z);
      truckGroup.add(foot);
    });

    // =========================================================================
    // OPERATOR FIGURE — standing at the console on the rear platform, facing
    // across the site toward the wellhead (right). Simple stylised human.
    // =========================================================================
    const operator = new THREE.Group();
    // Positioned relative to the platform group: standing on the grated floor
    // (floor top ≈ y=0.06 local), set back from the console toward the cab side.
    operator.position.set(-0.7, 0.06, 0);

    const suitMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.6 }); // red coveralls
    const skinMat = new THREE.MeshStandardMaterial({ color: 0xd9a066, roughness: 0.7 });
    const hatMat = new THREE.MeshStandardMaterial({ color: 0xf5f5f5, roughness: 0.4 }); // white hard hat
    const bootMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.8 });

    // Torso
    const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.22, 0.5, 4, 12), suitMat);
    torso.position.set(0, 0.95, 0);
    torso.castShadow = true;
    operator.add(torso);

    // Head
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 16), skinMat);
    head.position.set(0, 1.42, 0);
    head.castShadow = true;
    operator.add(head);

    // Hard hat
    const hat = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), hatMat);
    hat.position.set(0, 1.5, 0);
    operator.add(hat);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 16), hatMat);
    brim.position.set(0, 1.48, 0.05);
    operator.add(brim);

    // Arms reaching toward the console (in front, +X toward well side)
    const armMat = suitMat;
    const armL = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.45, 4, 8), armMat);
    armL.position.set(0.28, 1.0, 0.18);
    armL.rotation.z = -0.9;
    operator.add(armL);
    const armR = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.45, 4, 8), armMat);
    armR.position.set(0.28, 1.0, -0.18);
    armR.rotation.z = -0.9;
    operator.add(armR);

    // Legs
    const legL = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 8), suitMat);
    legL.position.set(0, 0.35, 0.12);
    operator.add(legL);
    const legR = new THREE.Mesh(new THREE.CapsuleGeometry(0.09, 0.5, 4, 8), suitMat);
    legR.position.set(0, 0.35, -0.12);
    operator.add(legR);

    // Boots
    const bootL = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.24), bootMat);
    bootL.position.set(0.03, 0.06, 0.12);
    operator.add(bootL);
    const bootR = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.1, 0.24), bootMat);
    bootR.position.set(0.03, 0.06, -0.12);
    operator.add(bootR);

    // Keep the operator in a separate holder so it stays visible when the
    // procedural truck body is hidden in favour of the imported glTF model.
    const operatorHolder = new THREE.Group();
    operatorHolder.position.set(MG_UNIT_X, 0, 0);
    // Place the operator at the truck's rear (well-facing +X side) by the console.
    operator.position.set(4.6, 0.0, 1.9);
    operator.rotation.y = -Math.PI / 2; // face across toward the wellhead (+X)
    operatorHolder.add(operator);

    // --- Swap in the imported MG Truck model (with its own console) ----------
    // Hide the procedural truck body, then load the detailed Blender model into
    // the (vibrating) truck group at the MG unit position. Falls back to the
    // procedural body if the model fails to load.
    const useTruckModel = true;
    if (useTruckModel) {
      truckGroup.visible = false;
    }
    truckVibGroup.add(truckGroup);
    truckVibGroup.add(operatorHolder);

    // Re-parent the detailed procedural Weatherford console (with live 3D gauge
    // needles) to a visible holder at the truck's rear (well-facing +X side),
    // replacing the imported model's simplified built-in console.
    const consoleHolder = new THREE.Group();
    consoleHolder.position.set(MG_UNIT_X + 4.7, 0, 2.4);
    // opPlatformGroup already carries an internal (3.8, 1.46) offset; keep its
    // console but re-seat via the holder.
    opPlatformGroup.position.set(0, 1.46, 0);
    consoleHolder.add(opPlatformGroup);
    truckVibGroup.add(consoleHolder);

    if (useTruckModel) {
      const modelHolder = new THREE.Group();
      modelHolder.position.set(MG_UNIT_X, 0, 0);
      truckVibGroup.add(modelHolder);
      loadEquipmentModel('/models/mg_truck.glb', modelHolder, {
        targetHeight: 8.6, // larger, per feedback
        onLoaded: (root) => {
          // Reverse the truck so its BACK (deck/crane/console) faces the
          // wellhead (+X) and the cab points away to the left, per the photo.
          root.rotation.y = Math.PI;
          // Hide the model's own simplified console so our detailed procedural
          // console (with working gauges) shows instead.
          root.traverse((child) => {
            const nm = (child.name || '').toLowerCase();
            if (nm.includes('console') || nm.includes('gauge') || nm.includes('panel')) {
              child.visible = false;
            }
          });
        },
      });
    }

    scene.add(truckVibGroup);
  }

  function buildServiceReel(scene: THREE.Scene) {
    const reelGroup = new THREE.Group();
    // Reel on its own trailer: set back into depth (−Z) from the wellhead line
    // and closer to the well. Sized so the coil sits above its trailer deck.
    reelGroup.position.set(REEL_X, 3.8, REEL_Z);
    reelGroup.scale.setScalar(1.15);

    // Simple flatbed trailer under the reel (per the field diagram).
    const trailerMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.4, roughness: 0.6 });
    const trailerDeck = new THREE.Mesh(new THREE.BoxGeometry(6.5, 0.4, 3.0), trailerMat);
    trailerDeck.position.set(0, -2.0, 0);
    trailerDeck.castShadow = true;
    trailerDeck.receiveShadow = true;
    reelGroup.add(trailerDeck);
    // Trailer wheels
    const trWheelGeo = new THREE.CylinderGeometry(0.5, 0.5, 0.35, 20);
    trWheelGeo.rotateX(Math.PI / 2);
    const trWheelMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.9 });
    [
      [-2.0, -2.6, 1.4], [-2.0, -2.6, -1.4],
      [2.0, -2.6, 1.4], [2.0, -2.6, -1.4],
    ].forEach(([x, y, z]) => {
      const w = new THREE.Mesh(trWheelGeo, trWheelMat);
      w.position.set(x, y, z);
      reelGroup.add(w);
    });

    // Reel A-Frame Heavy Support Cradle
    const aFrameMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.5 });
    const leftLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3.6, 8), aFrameMat);
    leftLeg.rotation.z = 0.32;
    leftLeg.position.set(-0.55, -1.1, 1.5);
    reelGroup.add(leftLeg);

    const rightLeg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 3.6, 8), aFrameMat);
    rightLeg.rotation.z = -0.32;
    rightLeg.position.set(0.55, -1.1, 1.5);
    reelGroup.add(rightLeg);

    const leftLegR = leftLeg.clone();
    leftLegR.position.z = -1.5;
    reelGroup.add(leftLegR);

    const rightLegR = rightLeg.clone();
    rightLegR.position.z = -1.5;
    reelGroup.add(rightLegR);

    // Spool Rotating Assembly
    const spool = new THREE.Group();

    const axleMat = new THREE.MeshStandardMaterial({ color: 0x09090b, metalness: 0.85 });
    const axle = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 2.9, 24), axleMat);
    axle.rotation.x = Math.PI / 2;
    spool.add(axle);

    const rimMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.5, roughness: 0.3 });
    const rimLeft = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.08, 12, 48), rimMat);
    rimLeft.position.z = 1.25;
    spool.add(rimLeft);

    const rimRight = new THREE.Mesh(new THREE.TorusGeometry(2.3, 0.08, 12, 48), rimMat);
    rimRight.position.z = -1.25;
    spool.add(rimRight);

    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const spoke = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 2.3, 8), rimMat);
      spoke.position.set(Math.cos(angle) * 1.15, Math.sin(angle) * 1.15, 1.25);
      spoke.rotation.z = angle + Math.PI / 2;
      spool.add(spoke);

      const spokeR = spoke.clone();
      spokeR.position.z = -1.25;
      spool.add(spokeR);
    }

    // Continuous Coiled Rod Pack
    const coilMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.92, roughness: 0.22 });
    const coil = new THREE.Mesh(new THREE.CylinderGeometry(1.95, 1.95, 2.3, 32), coilMat);
    coil.rotation.x = Math.PI / 2;
    coil.castShadow = true;
    spool.add(coil);

    reelGroup.add(spool);
    reelSpoolRef.current = spool;

    // Traversing Level-Wind Sheave Guide Arm
    const levelWindMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, metalness: 0.7 });
    const levelWind = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.4, 16), levelWindMat);
    levelWind.position.set(1.9, 0.6, 0);
    levelWind.rotation.x = Math.PI / 2;
    reelGroup.add(levelWind);
    levelWindRef.current = levelWind;

    // Item 52: Trailer tongue/hitch at front (LOCAL coords — group already at REEL_X, 3.8, REEL_Z)
    const tongueGeo = new THREE.BoxGeometry(3.0, 0.12, 0.15);
    const tongueMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.7, roughness: 0.4 });
    const tongue = new THREE.Mesh(tongueGeo, tongueMat);
    tongue.position.set(-4.5, -2.7, 0); // local: y=-2.7 (ground level relative to group at y=3.8)
    tongue.castShadow = true;
    reelGroup.add(tongue);
    // Pintle hitch ring
    const hitchRing = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.04, 8, 16), tongueMat);
    hitchRing.position.set(-6.0, -2.7, 0);
    reelGroup.add(hitchRing);

    // Item 57: Trailer fenders over wheels (LOCAL coords)
    const fenderMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.8 });
    const fenderGeo = new THREE.BoxGeometry(1.2, 0.06, 0.8);
    [-1.5, 1.5].forEach((ox) => {
      [-1.8, 1.8].forEach((fz) => {
        const fender = new THREE.Mesh(fenderGeo, fenderMat);
        fender.position.set(ox, -2.15, fz); // above wheel tops in local space
        reelGroup.add(fender);
      });
    });

    // Item 55: A-frame cross-bracing (LOCAL coords)
    const crossBraceMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.6, roughness: 0.3 });
    const crossBrace = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.8, 8), crossBraceMat);
    crossBrace.position.set(0, -0.3, 0); // mid-height of A-frame in local space
    crossBrace.rotation.x = Math.PI / 2;
    reelGroup.add(crossBrace);

    scene.add(reelGroup);
  }

  function buildMastAndArch(scene: THREE.Scene) {
    // Item 59: Gooseneck guide arch above injector — curved steel frame
    const archMat = new THREE.MeshStandardMaterial({ color: 0x6b7280, metalness: 0.75, roughness: 0.25 });
    const gooseneckCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(WELL_X - 2.5, INJECTOR_TOP_Y + 1.0, 0),
      new THREE.Vector3(WELL_X - 1.5, INJECTOR_TOP_Y + 2.5, 0),
      new THREE.Vector3(WELL_X - 0.3, INJECTOR_TOP_Y + 3.0, 0),
      new THREE.Vector3(WELL_X, INJECTOR_TOP_Y + 2.5, 0),
      new THREE.Vector3(WELL_X, INJECTOR_TOP_Y + 1.2, 0),
    ]);
    const gooseneck = new THREE.Mesh(
      new THREE.TubeGeometry(gooseneckCurve, 24, 0.12, 10, false), archMat
    );
    gooseneck.castShadow = true;
    scene.add(gooseneck);
    // Sheave block and wheel at apex
    const sheaveBlock = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.4), archMat);
    sheaveBlock.position.set(WELL_X - 0.3, INJECTOR_TOP_Y + 3.05, 0);
    scene.add(sheaveBlock);
    const sheaveWheel = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.05, 10, 20),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8, roughness: 0.3 })
    );
    sheaveWheel.position.set(WELL_X - 0.3, INJECTOR_TOP_Y + 3.05, 0);
    scene.add(sheaveWheel);
    // Support legs
    const legMat = new THREE.MeshStandardMaterial({ color: 0x4b5563, metalness: 0.6, roughness: 0.3 });
    [-0.3, 0.3].forEach((lz) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.0, 8), legMat);
      leg.position.set(WELL_X, INJECTOR_TOP_Y + 1.5, lz);
      scene.add(leg);
    });
  }

  function buildGripperInjector(scene: THREE.Scene) {
    const injectorGroup = new THREE.Group();
    // Right side of the site (over the wellhead), per the side-on field layout.
    injectorGroup.position.set(WELL_X, 8.4, 0);

    // Static procedural housing (body + motors). Hidden when the imported
    // injector model is used; the animated internals below stay visible.
    const useInjectorModel = true;
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, roughness: 0.35, metalness: 0.4 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 3.2, 1.4), bodyMat);
    body.castShadow = true;
    body.receiveShadow = true;
    body.visible = !useInjectorModel;
    injectorGroup.add(body);

    const motorMat = new THREE.MeshStandardMaterial({ color: 0x09090b, metalness: 0.85, roughness: 0.3 });
    const motorL = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.9, 16), motorMat);
    motorL.position.set(-0.65, 1.9, 0);
    motorL.visible = !useInjectorModel;
    injectorGroup.add(motorL);

    const motorR = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.9, 16), motorMat);
    motorR.position.set(0.65, 1.9, 0);
    motorR.visible = !useInjectorModel;
    injectorGroup.add(motorR);

    // --- Imported Injector model (visual shell) ------------------------------
    // Loaded as the realistic body around the procedural animated internals.
    // injectorGroup is anchored at (WELL_X, 8.4); the model is added at local
    // origin and re-seated by the loader, so nudge it down to straddle the head.
    if (useInjectorModel) {
      const injModelHolder = new THREE.Group();
      // Seat the injector model so it straddles the stuffing-box riser that
      // rises from the BOP/wellhead below (riser top ≈ y6.2 world; injector
      // group origin is at y8.4, so drop the model to bridge the gap).
      injModelHolder.position.set(0, -2.4, 0);
      injectorGroup.add(injModelHolder);
      loadEquipmentModel('/models/injector.glb', injModelHolder, {
        targetHeight: 5.6, // slightly bigger, per feedback
        onLoaded: (root) => {
          // Guarantee the injector stands perfectly upright (no baked tilt).
          root.rotation.set(0, 0, 0);
        },
      });
    }

    // Dual Opposed Continuous Gripper Chains & Hardened Shoes
    const chainMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.2 });
    const leftChain = new THREE.Group();
    leftChain.position.set(-0.25, 0, 0);
    for (let i = 0; i < 7; i++) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.4), chainMat);
      block.position.set(0, (i - 3) * 0.45, 0);
      leftChain.add(block);
    }
    injectorGroup.add(leftChain);
    gripperChainLeftRef.current = leftChain;

    const rightChain = new THREE.Group();
    rightChain.position.set(0.25, 0, 0);
    for (let i = 0; i < 7; i++) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.4), chainMat);
      block.position.set(0, (i - 3) * 0.45, 0);
      rightChain.add(block);
    }
    injectorGroup.add(rightChain);
    gripperChainRightRef.current = rightChain;

    // Squeeze Hydraulic Backing Beams
    const squeezePlates = new THREE.Group();
    const beamL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.35), motorMat);
    beamL.position.set(-0.32, 0, 0);
    squeezePlates.add(beamL);

    const beamR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.35), motorMat);
    beamR.position.set(0.32, 0, 0);
    squeezePlates.add(beamR);
    injectorGroup.add(squeezePlates);
    squeezePlatesRef.current = squeezePlates;

    injectorGroupRef.current = injectorGroup;
    scene.add(injectorGroup);

    // --- Wellhead spray / dust puffs emitted while the rod runs fast ---------
    const sprayMat = new THREE.MeshBasicMaterial({
      color: 0xd6c9a8,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const spray: THREE.Mesh[] = [];
    for (let i = 0; i < 14; i++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), sprayMat.clone());
      // Emitted at the wellhead (below the injector, at the BOP top ~ y 6.2 world)
      puff.position.set(WELL_X + (Math.random() - 0.5) * 0.4, 6.2, (Math.random() - 0.5) * 0.4);
      puff.visible = false;
      spray.push(puff);
      scene.add(puff);
    }
    wellheadSprayRef.current = spray;
  }

  function buildWellheadBopStack(scene: THREE.Scene) {
    const wellheadGroup = new THREE.Group();
    wellheadGroup.position.set(WELL_X, 0.3, 0);

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.75, roughness: 0.25 });
    const bopMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.5, roughness: 0.35 });

    // Tubing Head Flange
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.6, 24), steelMat);
    flange.position.y = 0.3;
    wellheadGroup.add(flange);

    // Annular BOP Body
    const bopBody = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 1.2, 24), bopMat);
    bopBody.position.y = 1.2;
    bopBody.castShadow = true;
    wellheadGroup.add(bopBody);

    // BOP Hydraulic Actuator Rams (Side Cylinders)
    const bopRamsGroup = new THREE.Group();
    bopRamsGroup.position.y = 1.2;

    const ramL = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.1, 16), steelMat);
    ramL.rotation.z = Math.PI / 2;
    ramL.position.set(-0.8, 0, 0);
    bopRamsGroup.add(ramL);

    const ramR = ramL.clone();
    ramR.position.set(0.8, 0, 0);
    bopRamsGroup.add(ramR);
    wellheadGroup.add(bopRamsGroup);
    bopRamsRef.current = bopRamsGroup;

    // Safety Dog Clamp Table
    const clampTable = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.5, 1.15), steelMat);
    clampTable.position.y = 2.2;
    wellheadGroup.add(clampTable);

    // Mechanical Safety Dog Clamp Jaws (Component V)
    const clampJaws = new THREE.Group();
    clampJaws.position.y = 2.6;
    const clampMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.6 });

    const jawL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.5), clampMat);
    jawL.position.set(-0.22, 0, 0);
    clampJaws.add(jawL);

    const jawR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.5), clampMat);
    jawR.position.set(0.22, 0, 0);
    clampJaws.add(jawR);
    wellheadGroup.add(clampJaws);
    safetyClampJawsRef.current = clampJaws;

    // Item 67: Tubing head flange bolt circle (8 bolts)
    const flangeBoltGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.18, 8);
    for (let fb = 0; fb < 8; fb++) {
      const fbAngle = (fb / 8) * Math.PI * 2;
      const fbBolt = new THREE.Mesh(flangeBoltGeo, steelMat);
      fbBolt.position.set(Math.cos(fbAngle) * 0.88, 0.6, Math.sin(fbAngle) * 0.88);
      wellheadGroup.add(fbBolt);
    }

    // Item 68: BOP side nozzle ports (bleed/kill line connections)
    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.7, roughness: 0.3 });
    const nozzleGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.5, 12);
    [0, Math.PI].forEach((nAngle) => {
      const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(Math.cos(nAngle) * 0.85, 1.2, Math.sin(nAngle) * 0.85);
      wellheadGroup.add(nozzle);
      // Valve handle on nozzle
      const nValve = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.04), nozzleMat);
      nValve.position.set(Math.cos(nAngle) * 1.12, 1.2, Math.sin(nAngle) * 1.12);
      wellheadGroup.add(nValve);
    });

    // Stuffing Box Riser
    const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3.4, 24), steelMat);
    riser.position.y = 4.5;
    wellheadGroup.add(riser);

    // Item 72: Packing gland flange at riser bottom connection
    const packingGland = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 24), steelMat);
    packingGland.position.y = 2.85;
    wellheadGroup.add(packingGland);

    scene.add(wellheadGroup);
  }

  function buildContinuousRodPath(scene: THREE.Scene) {
    // Rod route (side-on): pays off the reel, rises, bends over the guide
    // sheave, then drops straight down through the injector, BOP and into the
    // wellhead — matching the field diagram left→right.
    // The rod pays off the reel, arcs UP and OVER directly to the injector's
    // gooseneck (no separate guide post), then drops straight down through the
    // injector, BOP and into the wellhead — as in the real footage.
    const gooseneckY = INJECTOR_TOP_Y + 3.2;
    const rodCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(REEL_X + 0.5, 6.2, REEL_Z),        // off top of reel coil
      new THREE.Vector3(REEL_X + 2.2, gooseneckY - 1.0, REEL_Z * 0.5), // rising & swinging toward well line
      new THREE.Vector3(WELL_X - 2.4, gooseneckY + 0.3, 0),// top of the arc approaching gooseneck
      new THREE.Vector3(WELL_X, gooseneckY, 0),            // over the gooseneck sheave
      new THREE.Vector3(WELL_X, INJECTOR_TOP_Y + 1.2, 0),  // down into injector top
      new THREE.Vector3(WELL_X, INJECTOR_TOP_Y, 0),        // through injector
      new THREE.Vector3(WELL_X, 4.0, 0),                   // through BOP
      new THREE.Vector3(WELL_X, 0.0, 0),                   // into wellhead
    ]);

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 256;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#94a3b8';
    ctx.fillRect(0, 0, 64, 256);
    ctx.fillStyle = '#1e293b';
    for (let y = 0; y < 256; y += 32) {
      ctx.fillRect(0, y, 64, 4);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1, 10);

    const rodMat = new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xcbd5e1,
      metalness: 0.95,
      roughness: 0.2,
    });

    const rodGeo = new THREE.TubeGeometry(rodCurve, 64, 0.08, 16, false);
    const rodMesh = new THREE.Mesh(rodGeo, rodMat);
    rodMesh.castShadow = true;
    scene.add(rodMesh);
    rodStrandRef.current = rodMesh;
  }

  function buildExhaustParticleSystem(scene: THREE.Scene) {
    // Items 83-88: Enhanced exhaust — 36 particles (was 14), gradient colors, varied opacity
    const particles: THREE.Mesh[] = [];
    const pGeo = new THREE.SphereGeometry(0.12, 8, 8);
    const layerColors = [0x3a3a3a, 0x64748b, 0x9ca3af]; // item 84: dark→mid→light
    const layerOpacities = [0.5, 0.4, 0.25];
    const perLayer = 12; // item 83: 36 total particles
    for (let layer = 0; layer < 3; layer++) {
      for (let i = 0; i < perLayer; i++) {
        const pMat = new THREE.MeshBasicMaterial({
          color: layerColors[layer],
          transparent: true,
          opacity: layerOpacities[layer] + (Math.random() - 0.5) * 0.1, // item 87
          depthWrite: false,
        });
        const p = new THREE.Mesh(pGeo, pMat);
        p.position.set(
          MG_UNIT_X - 1.2,
          4.5 + (layer * perLayer + i) * 0.12,
          1.1 + (Math.random() - 0.5) * 0.3
        );
        p.scale.set(0.12 + layer * 0.04, 0.12 + layer * 0.04, 0.12 + layer * 0.04);
        p.visible = false;
        scene.add(p);
        particles.push(p);
      }
    }
    exhaustParticlesRef.current = particles;
  }

  // ---------------------------------------------------------------------------
  // Pointer & Mouse Orbit / Pan / Zoom Handlers
  // ---------------------------------------------------------------------------

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = true;
    dragButtonRef.current = e.button;
    prevPointerPos.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture(e.pointerId);

    if (cameraPresetRef.current !== 'orbit') {
      setCameraPreset('orbit');
      cameraPresetRef.current = 'orbit';
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - prevPointerPos.current.x;
    const dy = e.clientY - prevPointerPos.current.y;
    prevPointerPos.current = { x: e.clientX, y: e.clientY };

    const isPan = dragButtonRef.current === 2 || e.shiftKey || interactionMode === 'pan';

    if (isPan) {
      const right = new THREE.Vector3(
        Math.cos(sphericalRef.current.theta),
        0,
        -Math.sin(sphericalRef.current.theta)
      );
      targetLookAt.current.addScaledVector(right, -dx * 0.02);
      targetLookAt.current.y += dy * 0.02;
    } else {
      sphericalRef.current.theta -= dx * 0.007;
      sphericalRef.current.phi = Math.max(0.1, Math.min(Math.PI / 2 + 0.1, sphericalRef.current.phi - dy * 0.007));
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    isDraggingRef.current = false;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // Ignored
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    if (cameraPresetRef.current !== 'orbit') {
      setCameraPreset('orbit');
      cameraPresetRef.current = 'orbit';
    }
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    sphericalRef.current.radius = Math.max(1.5, Math.min(60, sphericalRef.current.radius * zoomFactor));
  };

  return (
    <div className={`relative w-full ${fillHeight ? 'h-full min-h-0' : 'h-[520px] lg:h-[620px]'} rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-2xl flex flex-col select-none`}>
      {/* 3D WebGL Canvas Container */}
      <div ref={containerRef} className="w-full h-full relative cursor-grab active:cursor-grabbing">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onWheel={handleWheel}
          onContextMenu={(e) => e.preventDefault()}
          className="w-full h-full block touch-none"
        />

        {/* TOP FLOATING OVERLAY: Camera Presets & Environment Controls */}
        <div className="absolute top-3 inset-x-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
          {/* Camera View Presets */}
          <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 shadow-lg pointer-events-auto">
            <span className="text-[9px] font-mono font-bold text-slate-400 px-1.5 uppercase hidden sm:inline">
              CAM:
            </span>
            {[
              { id: 'operator' as const, label: 'Operator Sightline' },
              // "Console Dials" 3D preset is hidden in cab mode — the real
              // interactive HTML console is docked directly below the windshield.
              ...(cabMode ? [] : [{ id: 'console' as const, label: 'Console Dials' }]),
              { id: 'injector' as const, label: 'Gripper Head' },
              { id: 'wellhead' as const, label: 'BOP & Flange' },
              { id: 'reel' as const, label: 'Service Reel' },
              { id: 'orbit' as const, label: 'Free 3D Orbit' },
            ].map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setCameraPositionPreset(preset.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all ${
                  cameraPreset === preset.id
                    ? 'bg-amber-600 text-white shadow-md'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Environmental Controls (Day/Night, HUD Toggle, Orbit/Pan) */}
          <div className="flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1 rounded-xl border border-slate-700/80 shadow-lg pointer-events-auto">
            {/* Day / Night Floodlights */}
            <button
              type="button"
              onClick={() => setIsNightMode(!isNightMode)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-all"
              title={isNightMode ? 'Switch to Daylight' : 'Switch to Night Rig Lights'}
            >
              {isNightMode ? <Moon className="w-4 h-4 text-indigo-400" /> : <Sun className="w-4 h-4 text-amber-400" />}
            </button>

            {/* Orbit / Pan Toggle */}
            <button
              type="button"
              onClick={() => setInteractionMode(interactionMode === 'orbit' ? 'pan' : 'orbit')}
              className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1 ${
                interactionMode === 'pan' ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:bg-slate-800'
              }`}
              title="Toggle Orbit vs Pan Mode (or use Right-Click / Shift+Drag)"
            >
              <Move className="w-3.5 h-3.5" />
              <span>{interactionMode === 'pan' ? 'PAN' : 'ORBIT'}</span>
            </button>

            {/* Direct HUD Controls Toggle */}
            <button
              type="button"
              onClick={() => setShowHudControls(!showHudControls)}
              className={`px-2 py-1 rounded-lg text-[11px] font-mono font-bold flex items-center gap-1 ${
                showHudControls ? 'bg-emerald-700 text-white' : 'text-slate-400 hover:bg-slate-800'
              }`}
              title="Toggle Integrated Direct Controls on 3D Viewport"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{showHudControls ? 'HUD: ON' : 'HUD: OFF'}</span>
            </button>
          </div>
        </div>

        {/* BOTTOM FLOATING DIRECT OPERATOR HUD DOCK (ZERO SCROLL CONSOLE ACCESS) */}
        {showHudControls && (
          <div className="absolute bottom-3 inset-x-3 bg-slate-900/95 backdrop-blur-md border-2 border-slate-700 rounded-2xl p-3 shadow-2xl pointer-events-auto flex flex-wrap items-center justify-between gap-3">
            {/* 1. Live Telemetry Readout */}
            <div className="flex items-center gap-2 font-mono text-xs">
              <div className="bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">DEPTH:</span>
                <span className="font-bold text-emerald-400 text-sm">
                  {Math.round(state.rod.currentDepthFt)} FT
                </span>
              </div>

              <div className="bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 flex items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">WEIGHT:</span>
                <span className="font-bold text-amber-400 text-sm">
                  {Math.round(state.rod.totalStringWeightLbs).toLocaleString()} LBS
                </span>
              </div>

              <div className="hidden sm:flex bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 items-center gap-1.5">
                <span className="text-slate-400 text-[10px]">SPEED:</span>
                <span
                  className={`font-bold text-xs ${
                    state.rod.rodSpeedFtPerMin > 0
                      ? 'text-emerald-400'
                      : state.rod.rodSpeedFtPerMin < 0
                      ? 'text-blue-400'
                      : 'text-slate-400'
                  }`}
                >
                  {state.rod.rodSpeedFtPerMin > 0
                    ? `+${state.rod.rodSpeedFtPerMin.toFixed(1)} POOH`
                    : state.rod.rodSpeedFtPerMin < 0
                    ? `${state.rod.rodSpeedFtPerMin.toFixed(1)} RIH`
                    : '0.0 FT/M'}
                </span>
              </div>
            </div>

            {/* 2. Direct Hydraulic Levers & Knobs Quick Actions */}
            <div className="flex items-center gap-2">
              {/* Squeeze Quick Knob */}
              <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800 text-xs font-mono">
                <span className="text-slate-400 text-[10px]">SQUEEZE (S):</span>
                <span className="font-bold text-slate-200 min-w-[55px]">
                  {Math.round(state.hydraulics.squeezePressure)} PSI
                </span>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateHydraulics &&
                    onUpdateHydraulics({
                      squeezePressureTarget: Math.max(0, state.hydraulics.squeezePressureTarget - 100),
                    })
                  }
                  className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  -
                </button>
                <button
                  type="button"
                  onClick={() =>
                    onUpdateHydraulics &&
                    onUpdateHydraulics({
                      squeezePressureTarget: Math.min(3000, state.hydraulics.squeezePressureTarget + 100),
                    })
                  }
                  className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 hover:bg-slate-700"
                >
                  +
                </button>
              </div>

              {/* Rod Safety Clamp Toggle (V) */}
              <button
                type="button"
                onClick={() =>
                  onUpdateHydraulics &&
                  onUpdateHydraulics({
                    safetyClampLever: state.hydraulics.safetyClampLever === 'ON' ? 'OFF' : 'ON',
                  })
                }
                className={`px-3 py-1.5 rounded-xl font-mono font-bold text-xs uppercase border transition-all active:scale-95 ${
                  state.hydraulics.safetyClampLever === 'ON'
                    ? 'bg-amber-600 text-white border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:text-white'
                }`}
                title="Toggle Rod Safety Clamp (V)"
              >
                CLAMP (V): {state.hydraulics.safetyClampLever}
              </button>

              {/* Air Horn Alert Button */}
              <button
                type="button"
                onClick={() => {
                  soundManager.playAirHorn(1.5);
                  if (onSoundAirHorn) onSoundAirHorn();
                }}
                className="p-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white shadow active:scale-95"
                title="Sound Air Horn"
              >
                <Volume2 className="w-4 h-4" />
              </button>

              {/* Emergency Stop Button (J) */}
              <button
                type="button"
                onClick={() => {
                  if (state.hydraulics.emergencyStopTripped) {
                    if (onResetEmergencyStop) onResetEmergencyStop();
                  } else {
                    if (onTriggerEmergencyStop) onTriggerEmergencyStop();
                  }
                }}
                className={`p-2 rounded-xl font-bold text-xs uppercase flex items-center gap-1 shadow active:scale-95 ${
                  state.hydraulics.emergencyStopTripped
                    ? 'bg-emerald-600 text-white animate-pulse'
                    : 'bg-red-600 hover:bg-red-500 text-white'
                }`}
                title={state.hydraulics.emergencyStopTripped ? 'Reset E-Stop (J)' : 'Trigger E-Stop (J)'}
              >
                <ShieldAlert className="w-4 h-4" />
                <span className="hidden md:inline">
                  {state.hydraulics.emergencyStopTripped ? 'RESET E-STOP' : 'E-STOP (J)'}
                </span>
              </button>
            </div>

            {/* 3. Direct Gripper Joystick Push & Hold Drive Bar */}
            <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800 shadow-inner">
              <button
                type="button"
                onClick={() => {
                  soundManager.playMetalTap();
                  if (onUpdateJoystick) onUpdateJoystick(Math.min(1.0, state.joystickPosition + 0.35));
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 border border-emerald-500 text-white font-mono font-bold text-xs active:scale-95 transition-all shadow"
                title="Pull Out Of Hole (POOH)"
              >
                <ArrowUp className="w-3.5 h-3.5" />
                <span>POOH (PULL)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundManager.playMetalTap();
                  if (onUpdateJoystick) onUpdateJoystick(0);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 font-mono font-bold text-xs active:scale-95 transition-all"
                title="Neutral Center Stop"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>STOP</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  soundManager.playMetalTap();
                  if (onUpdateJoystick) onUpdateJoystick(Math.max(-1.0, state.joystickPosition - 0.35));
                }}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-600 border border-blue-500 text-white font-mono font-bold text-xs active:scale-95 transition-all shadow"
                title="Run In Hole (RIH)"
              >
                <ArrowDown className="w-3.5 h-3.5" />
                <span>RIH (RUN)</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
