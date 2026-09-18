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
const REEL_X = 5.0;    // service reel on its trailer (nearer the well line in X)
const REEL_Z = -11;    // service reel: set FURTHER back into depth (−Z) so it sits
                       // behind/right of the pulling unit when facing the wellhead
const WELL_X = 9;      // injector / BOP / wellhead vertical stack (right)
// Vertical stack heights (world Y). All three GLBs share the WELL_X centre line
// so the rod threads straight through. Heights are chosen from each model's real
// aspect ratio (see [modelSize] logs) so the pieces nest at believable sizes:
//   wellhead.glb  ≈ 8 × 3.8 × 8  → wide, squat christmas tree
//   bop.glb       ≈ 1.08 × 2.6 × 0.44 → tall, slim ram BOP
//   injector.glb  ≈ 1.07 × 3.36 × 0.85 → tall injector head
// Lower the whole stack so the bottom half of the wellhead is buried in a cellar
// pit (see buildEnvironment). A negative base sinks the wellhead into the ground.
const WELLHEAD_BASE_Y = -4.2;
const WELLHEAD_H = 9.0;                 // squat wellhead/christmas tree (enlarged 2×)
// The wellhead GLB has wide side flanges, so its solid tubing spool (where the
// BOP mates) tops out BELOW the bbox top. This fraction seats the BOP on that
// real mating face instead of the empty bbox top, closing the gap.
const WELLHEAD_MATE_FRAC = 0.62;        // BOP mates at 62% of the wellhead height
const WELLHEAD_TOP_Y = WELLHEAD_BASE_Y + WELLHEAD_H * WELLHEAD_MATE_FRAC;
const BOP_H = 6.4;                      // slim ram BOP (2× size)
const BOP_BASE_Y = WELLHEAD_TOP_Y;      // BOP sits FLUSH on the wellhead mating face
// The BOP's bonnets sit mid-body; its bore exits near the bbox top, so mate the
// injector feed just below the bbox top.
const BOP_MATE_FRAC = 0.92;
const BOP_TOP_Y = BOP_BASE_Y + BOP_H * BOP_MATE_FRAC; // rod exits here
const INJECTOR_BASE_Y = BOP_TOP_Y + 0.25; // injector head base ~1 ft above the BOP top (half the previous gap)
const INJECTOR_MODEL_H = 6.75;         // imported injector height (targetHeight, 3/4 of prior 9.0)
const INJECTOR_TOP_Y = INJECTOR_BASE_Y + INJECTOR_MODEL_H; // pad-eyes / hook point
const MAST_OFFSET_X = 7.5;  // pulling-unit mast stands this far to the SIDE of the
                            // wellhead (so the mast is NOT on top of the injector);
                            // its crown cable angles over to carry the injector.

// Containment/guide arm HEAD position (world). The rod pays off the OUTER SIDE
// of the reel coil (the +X / well-facing edge), runs OUTWARD (never over the top
// and never toward the reel centre — that would clash with the spinning coil),
// threads through this guide head at the end of the reel's red containment arm,
// and the arched rod guide (getRodGuideCurve) begins EXACTLY here so the rod
// runs continuously coil edge → arm guide head → guide arch → injector.
// Placed WELL OUTBOARD of the reel rims (flange radius 2.3) on the +X side, at a
// low/side height (not above the reel), matching the field layout.
// The arm/guide stands on the GROUND at the reel's FRONT-LEFT corner (toward the
// MG/pulling unit). The reel centre is world (REEL_X=5, ·, REEL_Z=-11) with rim
// radius ≈2.3. We place the head to the LEFT (−? no) / FRONT of the reel in +Z
// (toward the MG/camera, clear of the +Z rim edge at z≈-8.7) and only slightly
// toward the well in +X — so the arm sits at the front-left corner beside the
// reel, in the direction the guide arch travels toward the mast/injector.
const GUIDE_HEAD = { x: REEL_X + 1.4, y: 3.2, z: REEL_Z + 3.0 };
// Reel coil geometry proxy (must match buildServiceReel's coil params) so the rod
// can dynamically connect to the coil's CURRENT outer radius as it shrinks.
const COIL_BARREL_R = 0.42;            // barrel radius the first wrap sits on
const COIL_MAX_OUTER_R = 2.05;         // outer radius at a FULL reel
const REEL_CENTER_Y = 3.1;             // world Y of the reel/coil centre (= reelGroup Y)
// Current coil outer radius for a given fill fraction (1 = full, 0 = empty).
function coilOuterRadius(fill: number): number {
  const f = Math.max(0, Math.min(1, fill));
  return COIL_BARREL_R + f * (COIL_MAX_OUTER_R - COIL_BARREL_R);
}

// Shared glTF loader for the imported Blender equipment models.
const gltfLoader = new GLTFLoader();

/**
 * Detect the vertical BORE centre (X/Z) of a well-control model such as a
 * wellhead or BOP. Side outlets (ram bonnets, flow tees, valves) live in the
 * mid-body and skew the overall bounding-box centre, but the tubing bore that
 * the rod passes through is the vertical axis that persists at the very top and
 * very bottom of the body. We therefore sample vertices in thin horizontal
 * slices at the top and bottom of the model — where only the on-axis bore
 * flange/opening exists — and return the median X/Z of those samples.
 *
 * Returns null if no usable geometry is found (caller falls back to bbox centre).
 */
function detectBoreCenterXZ(
  root: THREE.Object3D,
  box: THREE.Box3,
): { x: number; z: number } | null {
  const minY = box.min.y;
  const maxY = box.max.y;
  const height = maxY - minY;
  if (height <= 0) return null;

  // Sample the top 12% and bottom 12% bands, where the geometry is just the
  // on-axis bore flange (no side outlets), so the centre is the true bore.
  const bandTopLo = maxY - height * 0.12;
  const bandBotHi = minY + height * 0.12;

  const xs: number[] = [];
  const zs: number[] = [];
  const v = new THREE.Vector3();

  root.updateWorldMatrix(true, true);
  root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (!mesh.isMesh || !mesh.geometry) return;
    const pos = (mesh.geometry as THREE.BufferGeometry).attributes.position as
      | THREE.BufferAttribute
      | undefined;
    if (!pos) return;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      mesh.localToWorld(v);
      if (v.y >= bandTopLo || v.y <= bandBotHi) {
        xs.push(v.x);
        zs.push(v.z);
      }
    }
  });

  if (xs.length === 0) return null;
  // Median is robust against a few stray outlet verts that sneak into the bands.
  const median = (arr: number[]) => {
    arr.sort((a, b) => a - b);
    const m = Math.floor(arr.length / 2);
    return arr.length % 2 ? arr[m] : (arr[m - 1] + arr[m]) / 2;
  };
  return { x: median(xs), z: median(zs) };
}

/**
 * Load a .glb model, enable shadows, and (optionally) uniformly scale it so its
 * largest dimension matches `targetSize`, then drop it so its base sits at y=0.
 * The loaded model is added to `parent`. Runs asynchronously; a callback fires
 * with the model root once ready.
 */
function loadEquipmentModel(
  url: string,
  parent: THREE.Object3D,
  opts: {
    targetHeight?: number;
    // Fine X/Z nudge applied AFTER alignment, in the parent's local space.
    offsetX?: number;
    offsetZ?: number;
    // When true, align the model's vertical BORE (the tubing pass-through) to the
    // parent origin instead of its bounding-box centre. This reliably centres
    // well-control stacks (wellhead/BOP) whose side outlets skew the bbox.
    alignBore?: boolean;
    onLoaded?: (root: THREE.Object3D) => void;
  } = {},
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
      // Recompute after scaling.
      const box2 = new THREE.Box3().setFromObject(root);
      const c = new THREE.Vector3();
      box2.getCenter(c);

      // Determine the X/Z point to line up on the parent origin.
      let alignX = c.x;
      let alignZ = c.z;
      if (opts.alignBore) {
        const bore = detectBoreCenterXZ(root, box2);
        if (bore) {
          alignX = bore.x;
          alignZ = bore.z;
        }
      }

      // Seat base at y=0, put the chosen alignment point on the parent origin,
      // then apply any fine nudge.
      root.position.x -= alignX - (opts.offsetX ?? 0);
      root.position.z -= alignZ - (opts.offsetZ ?? 0);
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
  // Wound rod coil on the reel + the last fill fraction we (re)built it at. As we
  // RIH, rod pays off the reel: the coil is rebuilt with fewer wraps so it visibly
  // SHRINKS in radius (rope pulled off a spool). We only rebuild when the fill
  // changes past a small threshold so we're not regenerating tube geometry every frame.
  const coilTubeRef = useRef<THREE.Mesh | null>(null);
  const coilMatRef = useRef<THREE.MeshStandardMaterial | null>(null);
  // Containment/guide arm at the reel: the rod pays off the coil, threads through
  // this arm's guide head, then feeds INTO the arched rod guide. It vibrates
  // slightly in sympathy with the rod running through it (like the injector/BOP).
  const containmentArmRef = useRef<THREE.Group | null>(null);
  const containmentArmRestRef = useRef<{ x: number; y: number; z: number }>({ x: 0, y: 0, z: 0 });
  const coilFillRef = useRef<number>(-1);
  const rodStrandRef = useRef<THREE.Mesh | null>(null);
  const gripperChainLeftRef = useRef<THREE.Group | null>(null);
  const gripperChainRightRef = useRef<THREE.Group | null>(null);
  const squeezePlatesRef = useRef<THREE.Group | null>(null);
  const safetyClampJawsRef = useRef<THREE.Group | null>(null);
  const bopRamsRef = useRef<THREE.Group | null>(null);
  // Holder group for the BOP GLB — shaken slightly during operation so the BOP
  // vibrates in sympathy with the injector head (rod running under load).
  const bopModelHolderRef = useRef<THREE.Group | null>(null);
  const bopHolderRestXRef = useRef<number>(0);
  const joyShaftMeshRef = useRef<THREE.Mesh | null>(null);
  const exhaustParticlesRef = useRef<THREE.Mesh[]>([]);
  const floodLightRef = useRef<THREE.SpotLight | null>(null);
  const consoleLightRef = useRef<THREE.PointLight | null>(null);
  const rodTextureOffset = useRef<number>(0);
  // RIH/POOH dynamic-motion effect refs
  const injectorGroupRef = useRef<THREE.Group | null>(null);
  // Meshes of the LIVE over-well rod guide (only), highlighted by operation mode:
  // blue on RIH, green on POOH, red on slip. The storage-rack guides are excluded.
  const injectorGuideMeshesRef = useRef<THREE.Mesh[]>([]);
  // Background pumpjacks: each entry drives a nodding-beam animation. `phase`
  // offsets each unit so they don't all nod in unison.
  const pumpjacksRef = useRef<Array<{ walkingBeam: THREE.Group; crank: THREE.Group; phase: number; rate: number }>>([]);
  const wellheadSprayRef = useRef<THREE.Mesh[]>([]);
  const rodClampRefs = useRef<THREE.Group[]>([]);

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
    // VSMShadowMap gives soft shadows without the PCFSoftShadowMap deprecation
    // warning emitted by newer Three.js builds.
    renderer.shadowMap.type = THREE.VSMShadowMap;
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
    // VSM soft-shadow blur (VSMShadowMap needs a blur radius to look soft).
    sunLight.shadow.radius = 4;
    sunLight.shadow.blurSamples = 16;
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
    // buildMastAndArch superseded by buildRodGuideRack (the arched rod guide).
    buildRodGuideRack(scene);
    // Portable field welder ~100 ft behind the pulling unit but shifted to the
    // LEFT and CLOSER to the camera (more positive Z), kept within the pad.
    buildFieldWelder(scene, WELL_X + MAST_OFFSET_X + 14, 12);
    // Guide-storage rack on the FAR side of the MG unit (−Z, opposite the
    // camera-facing worksite). Quarter size and rotated 90°.
    buildGuideRack(scene, MG_UNIT_X, -6, Math.PI / 2, 0.375);
    buildGripperInjector(scene);
    buildWellheadBopStack(scene);
    buildSafetyCones(scene);
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
      }

      // 2a. Wound-rod coil SHRINKS as rod pays off the reel during RIH -----------
      // Fill = how much rod is still on the reel = 1 − (currentDepth / totalDepth).
      // As we RIH, currentDepthFt rises → fill drops → the coil is rebuilt with
      // fewer wraps, so it visibly gets smaller in radius (rope pulled off a spool).
      // The whole spool is already spinning, so the wraps also rotate away as they
      // unwind. We only rebuild the (relatively costly) tube geometry when the fill
      // changes past a small threshold, and lerp toward the target so it eases.
      if (coilTubeRef.current) {
        const rodS = stateRef.current.rod;
        const total = rodS.totalWellDepthFt > 0 ? rodS.totalWellDepthFt : 1;
        const targetFill = THREE.MathUtils.clamp(1 - rodS.currentDepthFt / total, 0, 1);
        // Ease the displayed fill toward the target so depth jumps don't pop.
        const shown = coilFillRef.current < 0 ? targetFill : coilFillRef.current;
        const eased = THREE.MathUtils.damp(shown, targetFill, 6, delta);
        // Rebuild only when the change is visually meaningful (~2%).
        if (Math.abs(eased - coilFillRef.current) > 0.02) {
          const builder = (coilTubeRef.current.userData as {
            buildCoilGeometry?: (f: number) => THREE.TubeGeometry | null;
          }).buildCoilGeometry;
          if (builder) {
            const newGeo = builder(eased);
            coilTubeRef.current.geometry.dispose();
            coilTubeRef.current.geometry = newGeo ?? new THREE.BufferGeometry();
            coilTubeRef.current.visible = newGeo != null;
          }
          // Rebuild the ROD STRAND too so its coil-connection point tracks the
          // shrinking coil radius (rod stays glued to the wraps at any depth).
          if (rodStrandRef.current) {
            const rodBuilder = (rodStrandRef.current.userData as {
              buildRodStrandGeometry?: (f: number) => THREE.TubeGeometry;
            }).buildRodStrandGeometry;
            if (rodBuilder) {
              const newRodGeo = rodBuilder(eased);
              rodStrandRef.current.geometry.dispose();
              rodStrandRef.current.geometry = newRodGeo;
            }
          }
          coilFillRef.current = eased;
        }
      }

      // 2b. Background pumpjacks — continuously nodding (independent of the rig).
      // The crank rotates steadily; the walking beam nods with a phase offset so
      // the horsehead rises and falls, driven by a sine of the crank angle.
      const t = time * 0.001;
      pumpjacksRef.current.forEach((pj) => {
        const ang = t * pj.rate + pj.phase;
        pj.crank.rotation.z = ang;              // crank+counterweights spin
        pj.walkingBeam.rotation.z = Math.sin(ang) * 0.16; // beam nods ±0.16 rad
      });

      // 2c. LIVE ROD-GUIDE highlight — TWITCHES with the rod, not a fixed colour.
      // The over-well guide glows the SAME direction colours as the rod string
      // (blue on RIH / green on POOH / red on freefall or slip) and PULSES with
      // the exact same frequency & speed-driven intensity as the rod's own
      // emissive pulse, so the guide reads as lighting up in sympathy with the
      // rod running through it. Idle → the glow fades back to dark steel.
      if (injectorGuideMeshesRef.current.length) {
        const rodS = stateRef.current.rod;
        const clampOn = stateRef.current.hydraulics.safetyClampLever === 'ON';
        const gSpeed = rodS.rodSpeedFtPerMin;
        const gSpeedRatio = Math.min(1, Math.abs(gSpeed) / 85); // 0..1 (matches rod)
        const gPulse = 0.5 + 0.5 * Math.sin(time * 0.02);       // SAME pulse as the rod
        // The guide flashes with the SAME colours, frequency & pulse as the rod,
        // but at 70% LOWER intensity (× 0.3) so it reads as a subtler sympathetic
        // twitch rather than matching the rod's brightness.
        const GUIDE_FACTOR = 0.3;                 // 70% lower than the rod
        let emissiveHex = 0x000000;
        let targetIntensity = 0;
        if (rodS.rodGripSlipping || clampOn) {
          emissiveHex = 0xdc2626;                 // red alert — slip/clamp
          targetIntensity = (0.6 * gPulse + 0.3) * GUIDE_FACTOR; // rod freefall × 0.3
        } else if (gSpeed < -0.1) {
          emissiveHex = 0x3b82f6;                 // RIH (running in / down) → blue
          targetIntensity = gSpeedRatio * 0.5 * gPulse * GUIDE_FACTOR; // rod RIH × 0.3
        } else if (gSpeed > 0.1) {
          emissiveHex = 0x22c55e;                 // POOH (pulling out / up) → green
          targetIntensity = gSpeedRatio * 0.5 * gPulse * GUIDE_FACTOR; // rod POOH × 0.3
        }
        for (const gm of injectorGuideMeshesRef.current) {
          const gmat = gm.material as THREE.MeshStandardMaterial;
          gmat.color.setHex(0x111827);            // base stays dark steel
          gmat.emissive.setHex(emissiveHex);
          // Ease intensity toward target so it twitches on/off smoothly with speed.
          gmat.emissiveIntensity = THREE.MathUtils.lerp(gmat.emissiveIntensity, targetIntensity, 0.3);
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

        // NOTE: previously the rod mesh was vertically SCALED by a weight-based
        // "sag factor" (scale.set(1, sagFactor, 1)). Because the arched rod tube
        // is built in world space about y=0, scaling Y squashed the whole arch
        // downward as depth/string-weight grew — which pulled the rod visibly OUT
        // of the guide at higher depths. The rod already follows the exact guide
        // curve, so we keep it locked at scale 1 (no sag) so it always stays
        // threaded inside the guide regardless of depth.
        rodStrandRef.current.scale.set(1, 1, 1);

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

      // 4b-bis. BOP vibration — shakes in SYMPATHY with the injector head (same
      // frequency & speed-driven intensity), but slightly damped since the BOP is
      // a heavy anchored well-control body. Uses the same `f` and `speedRatio` as
      // the injector so the two read as one connected vibrating string.
      if (bopModelHolderRef.current) {
        const restX = bopHolderRestXRef.current;
        if (isRunning) {
          const shake = (0.012 * speedRatio + 0.004) * 0.6; // ~60% of injector amplitude
          const f = time * 0.09;                            // matched frequency
          bopModelHolderRef.current.position.x = restX + Math.sin(f) * shake;
          bopModelHolderRef.current.rotation.z = Math.cos(f * 1.3) * shake * 0.4;
        } else {
          bopModelHolderRef.current.position.x = THREE.MathUtils.lerp(bopModelHolderRef.current.position.x, restX, 0.2);
          bopModelHolderRef.current.rotation.z = THREE.MathUtils.lerp(bopModelHolderRef.current.rotation.z, 0, 0.2);
        }
      }

      // 4b-ter. Containment/guide arm vibration — the rod runs THROUGH its guide
      // head, so it twitches slightly with the rod (same frequency as the injector
      // & BOP, small amplitude scaled by speed). Eases to rest when idle.
      if (containmentArmRef.current) {
        const rest = containmentArmRestRef.current;
        if (isRunning) {
          const shake = (0.012 * speedRatio + 0.004) * 0.5; // ~50% of injector amplitude
          const f = time * 0.09;                            // matched frequency
          containmentArmRef.current.position.x = rest.x + Math.sin(f * 1.1) * shake;
          containmentArmRef.current.rotation.z = Math.cos(f * 1.3) * shake * 0.35;
        } else {
          containmentArmRef.current.position.x = THREE.MathUtils.lerp(containmentArmRef.current.position.x, rest.x, 0.2);
          containmentArmRef.current.rotation.z = THREE.MathUtils.lerp(containmentArmRef.current.rotation.z, 0, 0.2);
        }
      }

      // 4b2. Rod safety clamps — show one mesh per installed mechanical clamp
      if (rodClampRefs.current.length > 0) {
        const installed = liveState.rod.mechanicalClampsInstalled;
        rodClampRefs.current.forEach((g, i) => {
          g.visible = i < installed;
        });
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

    // Cellar geometry constants (used by the field hole, pad hole, and pit below).
    const CELLAR_HALF = 2.6;      // half-width of the square cellar opening (smaller)
    const CELLAR_DEPTH = 4.6;     // how far the pit floor is below grade
    const WALL_T = 0.4;           // wall thickness

    // 1a. Surrounding ROLLING TERRAIN to the horizon. A large subdivided plane is
    // displaced with layered sine "hills" for gentle relief, but kept flat within
    // the worksite radius so no equipment floats. Vertex colours darken the dips
    // and lighten the rises for a natural, non-uniform prairie look.
    const TERRAIN_SIZE = 620;
    const TERRAIN_SEG = 160;
    const FLAT_RADIUS = 42; // keep the worksite area flat
    const terrainGeo = new THREE.PlaneGeometry(TERRAIN_SIZE, TERRAIN_SIZE, TERRAIN_SEG, TERRAIN_SEG);
    const tPos = terrainGeo.attributes.position as THREE.BufferAttribute;
    // SAND palette matching the lease pad (not green). Day vs night variants.
    const baseCol = new THREE.Color(isNightMode ? 0x3a3325 : 0x8a7355);
    const hiCol = new THREE.Color(isNightMode ? 0x4a4230 : 0xa08a63); // sun-lit dune crests
    const loCol = new THREE.Color(isNightMode ? 0x2a2418 : 0x6e5c44); // shaded hollows
    const colors: number[] = [];
    const _c = new THREE.Color();
    for (let i = 0; i < tPos.count; i++) {
      const x = tPos.getX(i);
      const y = tPos.getY(i); // plane-local Y maps to world −Z after rotation
      const dist = Math.hypot(x, y);
      // Layered sine dunes → smooth pseudo-random relief with MORE height
      // variation, and rising sharply toward the horizon to blend into mountains.
      let h =
        Math.sin(x * 0.014) * Math.cos(y * 0.017) * 11.0 +
        Math.sin(x * 0.035 + 1.7) * Math.cos(y * 0.03 + 0.6) * 5.0 +
        Math.sin(x * 0.08 + 3.1) * Math.cos(y * 0.065 + 2.2) * 2.0;
      // Ramp terrain upward far from the site so it climbs into the mountain ring.
      const rise = THREE.MathUtils.smoothstep(dist, 120, 300) * 26.0;
      h += rise;
      // Fade the relief to zero across the flat worksite so nothing floats.
      const fade = THREE.MathUtils.smoothstep(dist, FLAT_RADIUS, FLAT_RADIUS + 60);
      h *= fade;
      // CELLAR CUTOUT: sink any terrain vertex that falls within the cellar
      // opening far below the pit floor so the ground plane doesn't cap the pit
      // (leaving the open cellar visible when you look down into it). Local x ≈
      // world x, local y ≈ world z (plane is rotated −90° about X afterwards).
      if (Math.abs(x - WELL_X) < CELLAR_HALF + 2.0 && Math.abs(y) < CELLAR_HALF + 2.0) {
        h = -(CELLAR_DEPTH + 3.0);
      }
      tPos.setZ(i, h);
      // Colour by height for natural variation.
      const tHi = THREE.MathUtils.clamp((h + 2) / 10, 0, 1);
      _c.copy(h >= 0 ? baseCol.clone().lerp(hiCol, tHi) : baseCol.clone().lerp(loCol, -h / 6));
      colors.push(_c.r, _c.g, _c.b);
    }
    terrainGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    terrainGeo.computeVertexNormals();
    const fieldMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 1.0,
      metalness: 0.0,
    });
    const field = new THREE.Mesh(terrainGeo, fieldMat);
    field.rotation.x = -Math.PI / 2;
    field.position.y = -0.15;
    field.receiveShadow = true;
    scene.add(field);

    // --- MOUNTAIN RANGE ringing the horizon (varying heights, day/night tint).
    // Two staggered rings of low-poly peaks give depth. Deterministic layout.
    let mSeed = 8641;
    const mRnd = () => { mSeed = (mSeed * 1103515245 + 12345) & 0x7fffffff; return mSeed / 0x7fffffff; };
    const mtNear = new THREE.Color(isNightMode ? 0x2a3340 : 0x8f8674); // dusty rock
    const mtFar = new THREE.Color(isNightMode ? 0x1e2836 : 0xa9b0bd);  // hazy distance
    const mtSnow = new THREE.Color(isNightMode ? 0x3a4658 : 0xeef2f6); // capped peaks
    [{ radius: 300, count: 34, hMin: 26, hMax: 60, col: mtNear },
     { radius: 380, count: 30, hMin: 40, hMax: 95, col: mtFar }].forEach((ring) => {
      for (let m = 0; m < ring.count; m++) {
        const ang = (m / ring.count) * Math.PI * 2 + mRnd() * 0.12;
        const rad = ring.radius + (mRnd() - 0.5) * 40;
        const px = Math.cos(ang) * rad;
        const pz = Math.sin(ang) * rad;
        const height = ring.hMin + mRnd() * (ring.hMax - ring.hMin);
        const baseR = height * (0.7 + mRnd() * 0.5);
        const peak = new THREE.Mesh(
          new THREE.ConeGeometry(baseR, height, 5 + Math.floor(mRnd() * 4), 1),
          new THREE.MeshStandardMaterial({ color: ring.col.clone().lerp(mtSnow, mRnd() * 0.15), roughness: 1.0, flatShading: true }),
        );
        peak.position.set(px, height / 2 - 4, pz);
        peak.rotation.y = mRnd() * Math.PI;
        peak.scale.x = 0.8 + mRnd() * 0.5;
        scene.add(peak);
        // Snow/light cap on the taller far peaks.
        if (height > 60) {
          const cap = new THREE.Mesh(
            new THREE.ConeGeometry(baseR * 0.4, height * 0.28, 5, 1),
            new THREE.MeshStandardMaterial({ color: mtSnow, roughness: 0.9, flatShading: true }),
          );
          cap.position.set(px, height - 4 - height * 0.14, pz);
          cap.rotation.copy(peak.rotation);
          cap.scale.copy(peak.scale);
          scene.add(cap);
        }
      }
    });

    // --- DISTANT FIELD SILHOUETTES: a sparse ring of neighbouring facilities
    // (tank batteries, pump-jack shapes, small units) rendered as simple LOW-POLY
    // HAZY SILHOUETTES far out on the terrain, so the site feels like part of a
    // working oil field without adding many draw calls. Deterministic + minimal.
    const silCol = new THREE.Color(isNightMode ? 0x1a2230 : 0x7f8391); // hazy distance tint
    const silMat = new THREE.MeshStandardMaterial({ color: silCol, roughness: 1.0, metalness: 0.0 });
    let dSeed = 4242;
    const dRnd = () => { dSeed = (dSeed * 1103515245 + 12345) & 0x7fffffff; return dSeed / 0x7fffffff; };
    const groundAt = (px: number, pz: number) => {
      // Match the terrain height formula (rise ramp) so props sit ON the ground.
      const dist = Math.hypot(px, pz);
      return THREE.MathUtils.smoothstep(dist, 120, 300) * 26.0 - 0.15;
    };
    // Distant cluster sites at varied bearings/distances (kept OUTSIDE the pad).
    const distantSites: Array<{ x: number; z: number; kind: 'tanks' | 'pumpjack' | 'unit' }> = [
      { x: 120, z: -70, kind: 'tanks' },
      { x: -140, z: 40, kind: 'pumpjack' },
      { x: 60, z: 150, kind: 'unit' },
      { x: -90, z: -150, kind: 'tanks' },
      { x: 170, z: 60, kind: 'pumpjack' },
      { x: -60, z: 170, kind: 'pumpjack' },
      { x: 200, z: -30, kind: 'unit' },
      { x: -180, z: -90, kind: 'tanks' },
    ];
    distantSites.forEach((site) => {
      const gy = groundAt(site.x, site.z);
      if (site.kind === 'tanks') {
        const n = 2 + Math.floor(dRnd() * 3);
        for (let i = 0; i < n; i++) {
          const r = 2.2 + dRnd() * 1.2, hh = 6 + dRnd() * 3;
          const tk = new THREE.Mesh(new THREE.CylinderGeometry(r, r, hh, 12), silMat);
          tk.position.set(site.x + i * (r * 2 + 1), gy + hh / 2, site.z + (dRnd() - 0.5) * 2);
          scene.add(tk);
        }
      } else if (site.kind === 'pumpjack') {
        // Simple pump-jack silhouette: post + tilted beam.
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, 5, 0.8), silMat);
        post.position.set(site.x, gy + 2.5, site.z); scene.add(post);
        const beam = new THREE.Mesh(new THREE.BoxGeometry(8, 0.7, 0.7), silMat);
        beam.position.set(site.x, gy + 5, site.z); beam.rotation.z = 0.18; scene.add(beam);
        const cw = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 0.6), silMat);
        cw.position.set(site.x - 3.6, gy + 3.6, site.z); scene.add(cw);
      } else {
        // Generic unit/derrick block.
        const body = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 2.5), silMat);
        body.position.set(site.x, gy + 1.5, site.z); scene.add(body);
        const derr = new THREE.Mesh(new THREE.ConeGeometry(1.6, 9, 4), silMat);
        derr.position.set(site.x + 3, gy + 4.5, site.z); scene.add(derr);
      }
    });

    // 1b. Wellsite lease pad (dirt/gravel) — the worked ground the rig sits on.
    // Built as a Shape with a SQUARE HOLE punched out over the wellhead so you
    // can see down into the cellar pit (a solid plane would cap it over).
    const PAD_W = 90, PAD_D = 52;
    const padShape = new THREE.Shape();
    padShape.moveTo(-PAD_W / 2, -PAD_D / 2);
    padShape.lineTo(PAD_W / 2, -PAD_D / 2);
    padShape.lineTo(PAD_W / 2, PAD_D / 2);
    padShape.lineTo(-PAD_W / 2, PAD_D / 2);
    padShape.lineTo(-PAD_W / 2, -PAD_D / 2);
    // Hole at the wellhead. In pad-local (pre-rotation) space, shape-X = worldX −
    // siteCenterX, shape-Y = worldZ (the plane is later rotated −90° about X).
    const holeCX = WELL_X - siteCenterX;
    const holeCY = 0;
    const hole = new THREE.Path();
    hole.moveTo(holeCX - CELLAR_HALF, holeCY - CELLAR_HALF);
    hole.lineTo(holeCX + CELLAR_HALF, holeCY - CELLAR_HALF);
    hole.lineTo(holeCX + CELLAR_HALF, holeCY + CELLAR_HALF);
    hole.lineTo(holeCX - CELLAR_HALF, holeCY + CELLAR_HALF);
    hole.lineTo(holeCX - CELLAR_HALF, holeCY - CELLAR_HALF);
    padShape.holes.push(hole);
    const padGeo = new THREE.ShapeGeometry(padShape);
    const padMat = new THREE.MeshStandardMaterial({
      color: isNightMode ? 0x2a2620 : 0x8a7355, // tan dirt/gravel lease pad
      roughness: 0.98,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });
    const pad = new THREE.Mesh(padGeo, padMat);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(siteCenterX, 0.01, 0);
    pad.receiveShadow = true;
    scene.add(pad);

    // 2. Concrete Well CELLAR PIT — a square lined pit dug into the pad so the
    // lower half of the wellhead is buried below grade, per the field diagram.
    // Built from 4 walls + a floor, open at the top so you see down into it.
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x6b6459, roughness: 0.95, metalness: 0.02 });
    const cellarGroup = new THREE.Group();
    cellarGroup.position.set(WELL_X, 0, 0);

    // Pit floor
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(CELLAR_HALF * 2, WALL_T, CELLAR_HALF * 2),
      concreteMat,
    );
    floor.position.y = -CELLAR_DEPTH;
    floor.receiveShadow = true;
    cellarGroup.add(floor);

    // Four retaining walls lining the pit on ALL sides (tops flush with grade
    // ≈ y0). The cellar is "open" at the TOP — you look down into it — but every
    // side is walled so you never see through it to the horizon.
    // Walls run from the pit floor up to a low CURB slightly ABOVE grade so the
    // concrete lip cleanly occludes the pad/terrain edges around the opening
    // (prevents ground from appearing to overlap into the pit).
    const CURB = 0.35;                 // how far the wall tops rise above grade
    const wallH = CELLAR_DEPTH + CURB;
    const wallDefs: Array<[number, number, number, number]> = [
      // [x, z, width(x), depth(z)]
      [0, CELLAR_HALF, CELLAR_HALF * 2 + WALL_T * 2, WALL_T], // +Z wall
      [0, -CELLAR_HALF, CELLAR_HALF * 2 + WALL_T * 2, WALL_T], // −Z wall
      [CELLAR_HALF, 0, WALL_T, CELLAR_HALF * 2], // +X wall
      [-CELLAR_HALF, 0, WALL_T, CELLAR_HALF * 2], // −X wall (console-facing)
    ];
    wallDefs.forEach(([wx, wz, ww, wd]) => {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(ww, wallH, wd), concreteMat);
      // Centre so the top sits at +CURB and the bottom at −CELLAR_DEPTH.
      wall.position.set(wx, CURB - wallH / 2, wz);
      wall.receiveShadow = true;
      wall.castShadow = true;
      cellarGroup.add(wall);
    });

    // 2b. GROUND DETAIL inside the operation area — low gravel mounds, dirt
    // patches and rutted vehicle tracks so the worksite floor isn't flat sand.
    // Deterministic pseudo-random so it's stable across reloads.
    let seed = 1337;
    const rnd = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    const gravelMats = [
      new THREE.MeshStandardMaterial({ color: 0x8f7a5c, roughness: 1.0 }),
      new THREE.MeshStandardMaterial({ color: 0x7d6a50, roughness: 1.0 }),
      new THREE.MeshStandardMaterial({ color: 0x9c8865, roughness: 1.0 }),
    ];
    // Flattened dirt/gravel patches scattered over the pad (avoid the cellar).
    for (let i = 0; i < 40; i++) {
      const px = siteCenterX + (rnd() - 0.5) * 80;
      const pz = (rnd() - 0.5) * 44;
      if (Math.hypot(px - WELL_X, pz) < CELLAR_HALF + 1.5) continue; // skip cellar
      const r = 0.6 + rnd() * 2.2;
      const patch = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r * 1.15, 0.06 + rnd() * 0.12, 10),
        gravelMats[i % gravelMats.length],
      );
      patch.position.set(px, 0.04, pz);
      patch.rotation.y = rnd() * Math.PI;
      patch.receiveShadow = true;
      scene.add(patch);
    }
    // Small gravel/rock clusters for relief.
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x6b5f4c, roughness: 1.0 });
    for (let i = 0; i < 30; i++) {
      const px = siteCenterX + (rnd() - 0.5) * 82;
      const pz = (rnd() - 0.5) * 46;
      if (Math.hypot(px - WELL_X, pz) < CELLAR_HALF + 1.2) continue;
      const s = 0.12 + rnd() * 0.35;
      const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), rockMat);
      rock.position.set(px, s * 0.4, pz);
      rock.rotation.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI);
      rock.castShadow = true; rock.receiveShadow = true;
      scene.add(rock);
    }
    // Rutted vehicle tracks (dark thin strips) crossing the pad toward the well,
    // built as SHORT DASHES so we can skip any that would cross the open cellar
    // (a long strip previously floated over the pit hole).
    const trackMat = new THREE.MeshStandardMaterial({ color: 0x5c4f3a, roughness: 1.0 });
    const DASH_LEN = 1.6, DASH_GAP = 0.5;
    for (let t2 = 0; t2 < 3; t2++) {
      const baseZ = -8 + t2 * 6;
      [-0.55, 0.55].forEach((twin) => {
        const zc = baseZ + twin;
        for (let dx = siteCenterX - 18; dx < siteCenterX + 14; dx += DASH_LEN + DASH_GAP) {
          // Skip dashes overlapping the cellar opening footprint (+margin).
          if (Math.abs(dx - WELL_X) < CELLAR_HALF + 1.2 && Math.abs(zc) < CELLAR_HALF + 1.2) continue;
          const dash = new THREE.Mesh(new THREE.BoxGeometry(DASH_LEN, 0.03, 0.5), trackMat);
          dash.position.set(dx, 0.045, zc);
          dash.receiveShadow = true;
          scene.add(dash);
        }
      });
    }
    scene.add(cellarGroup);

    // (Removed the small striped procedural safety cones — only the larger yellow
    // GLB cones from buildSafetyCones() remain.)
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

    const MAST_H = 26;          // mast height (raised to clear the taller injector/travelling block)
    const LEAN = 0;             // mast stands perfectly vertical (90°)
    const legHalf = 0.9;        // half-spacing of the lattice legs at the base
    const DECK_TOP_Y = 1.7;     // top surface of the carrier-truck deck (mast mounts here)

    const steel = (c: number, r = 0.55, m = 0.6) =>
      new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
    const redMat = steel(0xc23a2b, 0.5, 0.4);    // red crown accents

    // --- Carrier truck that CARRIES the mast: the mast/injector are mounted on
    // the rear of this truck, so the truck deck runs UNDER the mast base and the
    // cab extends out to the side (−X, toward the console). The truck long axis
    // runs along X so the deck sits directly beneath the mast at pu origin. ---
    const truck = new THREE.Group();
    truck.position.set(0, 0, 0); // centred under the mast base (pu origin)
    // Rotate 180° so the CAB faces outward (+X, away from the well) and the
    // rig-carrying rear/bed sits under the mast over the wellsite — like a real
    // workover unit backed up to the well.
    truck.rotation.y = Math.PI;

    // Palette
    const bodyBlue = steel(0x1e3a5f, 0.6, 0.4);   // deep blue truck body/deck
    const frameMat = steel(0x14181d, 0.7, 0.5);   // dark chassis frame steel
    const whMat = steel(0x0a0a0a, 0.9, 0.1);      // tyres
    const hubMat = steel(0x6b7280, 0.8, 0.3);     // wheel hubs
    const chromeMat2 = steel(0xc9ced6, 0.9, 0.25);// chrome trim / stacks
    const glassMat = steel(0x0f2233, 0.2, 0.1);   // cab glass

    // --- LONG chassis frame rails running the full length (−X cab → +X rear) ---
    // A real pulling unit is a long heavy truck. The mast still mounts at local
    // x = 0 (pu origin); the chassis extends well past the cab and past the rear.
    // NOTE: the truck is rotated 180° (truck.rotation.y = π), so truck-local +X maps
    // to WORLD −X (toward the wellhead at WELL_X=9) and local −X maps to world +X
    // (away from the well, toward the cab). The pu group sits at world X = 16.5, so
    // local +X must stay small enough that the rear never reaches the cellar
    // (world ≈ 6.4..11.6). We therefore keep the rear end short and gain LENGTH on
    // the cab side (−X local) so the long trailer extends AWAY from the well.
    const CHASSIS_MIN_X = -14.5;  // cab/front end (long — extends away from the well)
    const CHASSIS_MAX_X = 3.2;    // rear end — kept clear of the wellhead/cellar
    const CHASSIS_LEN = CHASSIS_MAX_X - CHASSIS_MIN_X;
    const CHASSIS_MID = (CHASSIS_MIN_X + CHASSIS_MAX_X) / 2;
    [0.95, -0.95].forEach((fz) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(CHASSIS_LEN, 0.35, 0.22), frameMat);
      rail.position.set(CHASSIS_MID, 1.0, fz); rail.castShadow = true; truck.add(rail);
    });
    // Cross-members tying the frame rails together.
    for (let cx = CHASSIS_MIN_X + 1; cx < CHASSIS_MAX_X; cx += 2.0) {
      const xm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.22, 2.0), frameMat);
      xm.position.set(cx, 1.0, 0); truck.add(xm);
    }

    // --- LONG flatbed trailer bed: extends from the rear (well-side, kept clear
    // of the cellar) all the way forward toward the cab — the long working bed. ---
    const DECK_MIN_X = -9.4;                 // just behind the cab (far from well)
    const DECK_MAX_X = 3.0;                  // rear end — clear of the wellhead/cellar
    const DECK_LEN = DECK_MAX_X - DECK_MIN_X;
    const DECK_MID = (DECK_MIN_X + DECK_MAX_X) / 2;
    const deck = new THREE.Mesh(new THREE.BoxGeometry(DECK_LEN, 0.5, 3.0), bodyBlue);
    deck.position.set(DECK_MID, 1.45, 0); deck.castShadow = true; deck.receiveShadow = true; truck.add(deck);
    // Low deck side rails / toolbox rows down each side of the long bed.
    [1.35, -1.35].forEach((tz) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(DECK_LEN - 1.0, 0.7, 0.5), steel(0x24466e, 0.5, 0.5));
      box.position.set(DECK_MID, 1.9, tz); box.castShadow = true; truck.add(box);
    });

    // --- Hood + engine cowl ahead of the cab (classic conventional truck) ---
    const hood = new THREE.Mesh(new THREE.BoxGeometry(2.6, 1.5, 2.5), bodyBlue);
    hood.position.set(-12.3, 2.05, 0); hood.castShadow = true; truck.add(hood);
    // Chrome grille + front bumper at the very nose.
    const grille = new THREE.Mesh(new THREE.BoxGeometry(0.25, 1.3, 2.3), chromeMat2);
    grille.position.set(-13.65, 2.0, 0); truck.add(grille);
    const bumper = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.4, 2.9), chromeMat2);
    bumper.position.set(-13.9, 1.35, 0); bumper.castShadow = true; truck.add(bumper);
    // Round headlights.
    [1.0, -1.0].forEach((hz) => {
      const hl = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.12, 12), chromeMat2);
      hl.rotation.z = Math.PI / 2; hl.position.set(-13.78, 1.75, hz); truck.add(hl);
    });

    // --- Cab (behind the hood) with windows + roof visor ---
    const cab = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2.5, 2.7), steel(0xe5e7eb, 0.5, 0.3));
    cab.position.set(-10.4, 2.5, 0); cab.castShadow = true; truck.add(cab);
    // Windshield + side windows (dark glass planes slightly proud of the cab).
    const windshield = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.0, 2.3), glassMat);
    windshield.position.set(-11.66, 2.95, 0); truck.add(windshield);
    [1.36, -1.36].forEach((wz) => {
      const sideWin = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.08), glassMat);
      sideWin.position.set(-10.4, 2.95, wz); truck.add(sideWin);
    });
    // Roof sun visor.
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 2.8), steel(0x1e3a5f, 0.5, 0.4));
    visor.position.set(-11.7, 3.7, 0); truck.add(visor);
    // Twin vertical exhaust stacks behind the cab.
    [1.15, -1.15].forEach((sz) => {
      const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 3.0, 12), chromeMat2);
      stack.position.set(-9.2, 3.2, sz); stack.castShadow = true; truck.add(stack);
    });
    // Saddle fuel tank + battery box along the frame between axles.
    const fuelTank = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 2.2, 16), chromeMat2);
    fuelTank.rotation.z = Math.PI / 2; fuelTank.position.set(-8.4, 1.15, 1.25); truck.add(fuelTank);
    const battBox = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.7, 0.7), frameMat);
    battBox.position.set(-8.4, 1.2, -1.25); truck.add(battBox);

    // --- Wheels: steer axle up front + drive axles + REAR trailer axles spread
    // along the long bed. Duals on the load-bearing axles for a heavy unit. ---
    const tyreGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.42, 20); tyreGeo.rotateX(Math.PI / 2);
    const hubGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.5, 12); hubGeo.rotateX(Math.PI / 2);
    const addWheel = (x: number, z: number) => {
      const w = new THREE.Mesh(tyreGeo, whMat); w.position.set(x, 0.72, z); w.castShadow = true; truck.add(w);
      const hub = new THREE.Mesh(hubGeo, hubMat); hub.position.set(x, 0.72, z); truck.add(hub);
    };
    // Steer axle (single tyre each side) up front (under the hood, far from well).
    [1.65, -1.65].forEach((z) => addWheel(-12.4, z));
    // Drive + rear trailer axle groups (dual tyres each side) spread down the bed.
    [-8.6, -7.0, -3.0, -1.4, 1.2, 2.6].forEach((x) => {
      [1.75, 1.28, -1.28, -1.75].forEach((z) => addWheel(x, z));
    });

    // --- Drawworks / hydraulic winch drum on the deck between cab and mast ---
    const drawworks = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 2.0, 20), steel(0x1f6feb, 0.5, 0.5));
    drawworks.rotation.x = Math.PI / 2; drawworks.position.set(-3.3, 2.15, 0); drawworks.castShadow = true;
    truck.add(drawworks);
    // Drum end flanges.
    [1.02, -1.02].forEach((dz) => {
      const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.92, 0.92, 0.1, 20), frameMat);
      flange.rotation.x = Math.PI / 2; flange.position.set(-3.3, 2.15, dz); truck.add(flange);
    });
    // Hydraulic control/power pack box on the deck beside the drawworks.
    const powerPack = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 2.2), steel(0x24466e, 0.5, 0.5));
    powerPack.position.set(-1.4, 2.05, 0); powerPack.castShadow = true; truck.add(powerPack);

    // (Outriggers moved to the MG unit — see buildMobileUnitTruck. The pulling
    // unit keeps a couple of simple vertical rear stabiliser legs under the mast
    // load, but the deployed L-shaped outriggers with pads live on the MG unit.)
    const legMat = steel(0x27272a, 0.6, 0.5);
    [[1.0, 1.4], [1.0, -1.4]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.3, 1.5, 0.3), legMat);
      leg.position.set(lx, 0.75, lz); leg.castShadow = true; truck.add(leg);
      const foot = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.6), frameMat);
      foot.position.set(lx, 0.06, lz); truck.add(foot);
    });
    pu.add(truck);

    // --- Lattice mast: 4 straight vertical corner chords with rungs & real
    // X-braces on all four faces. A slight taper is applied by nudging the top
    // rungs inward (chords stay straight/vertical so it reads as a solid mast). ---
    const mast = new THREE.Group();
    mast.rotation.z = LEAN; // 0 = perfectly vertical (90°)
    mast.position.y = DECK_TOP_Y; // stand the mast base ON the truck deck, not through it
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

    // --- Pad-eye lugs on the injector top + shackles so the hoist bail clearly
    // attaches to the injector. Two lugs straddle the head centre (±Z), matching
    // the real lifting bail; the hook bridges them just above the head. ---
    const lugMat = steel(0x1f2937, 0.5, 0.7);
    const shackleMat = steel(0x9ca3af, 0.4, 0.8);
    [-0.28, 0.28].forEach((lz) => {
      // Flat pad-eye plate rising from the injector top
      const lug = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.5, 0.28), lugMat);
      lug.position.set(INJ_LOCAL_X, INJECTOR_TOP_Y + 0.25, lz);
      lug.castShadow = true;
      pu.add(lug);
      // Shackle ring through the pad-eye hole
      const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.035, 8, 16), shackleMat);
      shackle.rotation.y = Math.PI / 2;
      shackle.position.set(INJ_LOCAL_X, INJECTOR_TOP_Y + 0.45, lz);
      pu.add(shackle);
    });
    // Lifting bail spanning the two pad-eyes that the hook seats into
    const bail = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 10, 24, Math.PI), steel(0x374151, 0.4, 0.7));
    bail.rotation.x = Math.PI / 2;
    bail.position.set(INJ_LOCAL_X, INJECTOR_TOP_Y + 0.5, 0);
    pu.add(bail);

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
    // Ground anchors in pu-LOCAL space (pu is at world X = WELL_X + MAST_OFFSET_X
    // = 16.5). Spread the anchors FURTHER OUT so the guy wires reach well away from
    // the rig, and route the −Z (reel-side) anchors clear of the transport reel at
    // world (≈5, −11) — previously one anchor landed at world (4.5, −12), which put
    // a guy wire straight through the reel. World = (16.5 + localX, ·, localZ).
    const anchors = [
      new THREE.Vector3(16, 0.1, 18),    // world (32.5, 18)   far +X / +Z
      new THREE.Vector3(16, 0.1, -18),   // world (32.5, −18)  far +X / −Z (clear of reel)
      new THREE.Vector3(-16, 0.1, 18),   // world (0.5, 18)    far −X / +Z
      new THREE.Vector3(-16, 0.1, -22),  // world (0.5, −22)   far −X / −Z, well past the reel
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

    // --- Pumpjacks (nodding donkeys) scattered across the lease --------------
    // Reusable builder returning the group + the animated sub-parts. The walking
    // beam pivots on the Samson post; the crank+counterweight rotate; both are
    // registered so the render loop can nod them.
    const buildPumpjack = (paint: number): {
      group: THREE.Group;
      walkingBeam: THREE.Group;
      crank: THREE.Group;
    } => {
      const g = new THREE.Group();
      const paintMat = steel(paint, 0.55, 0.45);
      const darkMat = steel(0x111827, 0.6, 0.4);
      const railMat = steel(0x3f3f46, 0.7, 0.4);

      // Concrete skid base
      const base = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.4, 2.2), steel(0x9ca3af, 0.95, 0.05));
      base.position.y = 0.2; base.receiveShadow = true; g.add(base);
      // Skid steel beams
      [-0.7, 0.7].forEach((bz) => {
        const skid = new THREE.Mesh(new THREE.BoxGeometry(6.0, 0.25, 0.2), darkMat);
        skid.position.set(0, 0.5, bz); g.add(skid);
      });

      // Samson post — a proper 4-leg A-frame tower
      const postTopY = 4.6;
      const postApex = new THREE.Vector3(0, postTopY, 0);
      const footOffsets: [number, number][] = [[-1.0, 0.8], [1.0, 0.8], [-1.0, -0.8], [1.0, -0.8]];
      footOffsets.forEach(([fx, fz]) => {
        const foot = new THREE.Vector3(fx, 0.6, fz);
        const dir = new THREE.Vector3().subVectors(postApex, foot);
        const len = dir.length();
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, len, 8), paintMat);
        leg.position.copy(foot).addScaledVector(dir, 0.5);
        leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        leg.castShadow = true; g.add(leg);
      });
      // Post cap / saddle bearing
      const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 1.1), darkMat);
      saddle.position.set(0, postTopY, 0); g.add(saddle);
      // Stair/ladder up the post (decorative)
      const ladder = new THREE.Mesh(new THREE.BoxGeometry(0.06, postTopY, 0.06), railMat);
      ladder.position.set(0, postTopY / 2, 0.5); g.add(ladder);

      // --- Walking beam (pivots at the saddle) ---
      const walkingBeam = new THREE.Group();
      walkingBeam.position.set(0, postTopY, 0);
      const beam = new THREE.Mesh(new THREE.BoxGeometry(8.4, 0.45, 0.5), paintMat);
      beam.castShadow = true; walkingBeam.add(beam);
      // Horse head at the well end (+X)
      const headGroup = new THREE.Group();
      headGroup.position.set(4.0, 0, 0);
      const headPlate = new THREE.Mesh(
        new THREE.CylinderGeometry(1.3, 1.3, 0.45, 20, 1, false, -Math.PI / 2, Math.PI),
        paintMat,
      );
      headPlate.rotation.z = Math.PI / 2; headPlate.rotation.y = Math.PI / 2;
      headGroup.add(headPlate);
      const headBrow = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.4, 0.5), paintMat);
      headBrow.position.set(0.1, -0.5, 0); headGroup.add(headBrow);
      walkingBeam.add(headGroup);
      // Bridle / carrier bar + polished-rod hanger down to the wellhead
      const bridle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 3.6, 6), darkMat);
      bridle.position.set(5.2, -1.8, 0); walkingBeam.add(bridle);
      // Equalizer at the tail (−X)
      const tailBox = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 1.0), darkMat);
      tailBox.position.set(-4.2, 0, 0); walkingBeam.add(tailBox);
      g.add(walkingBeam);

      // --- Crank + counterweights (rotate) at the gearbox end ---
      const gearbox = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.4, 1.8), steel(0x374151, 0.6, 0.5));
      gearbox.position.set(-4.6, 1.4, 0); gearbox.castShadow = true; g.add(gearbox);
      const crank = new THREE.Group();
      crank.position.set(-4.6, 1.9, 0);
      [-0.65, 0.65].forEach((cz) => {
        const crankArm = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.35, 0.18), darkMat);
        crankArm.position.set(0, 0, cz); crank.add(crankArm);
        const cw = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.1, 0.3), steel(0x1c1917, 0.6, 0.4));
        cw.position.set(-1.0, 0, cz); crank.add(cw);
      });
      // Pitman arms linking crank pin up to the beam tail (visual only)
      [-0.65, 0.65].forEach((cz) => {
        const pitman = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), railMat);
        pitman.position.set(-1.0, 1.3, cz); crank.add(pitman);
      });
      g.add(crank);

      // Motor + belt guard beside the gearbox
      const motor = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.7, 0.7), steel(0x2563eb, 0.5, 0.5));
      motor.position.set(-5.9, 1.0, 0.9); g.add(motor);

      return { group: g, walkingBeam, crank };
    };

    // Scatter several pumpjacks around the lease at varied positions/rotations.
    const pjPlacements: Array<{ x: number; z: number; ry: number; s: number; paint: number; rate: number }> = [
      { x: WELL_X + 26, z: -20, ry: -0.5, s: 1.0, paint: 0xb45309, rate: 0.9 },
      { x: WELL_X + 40, z: 6, ry: -1.9, s: 1.15, paint: 0x1f6feb, rate: 0.7 },
      { x: MG_UNIT_X - 30, z: 22, ry: 0.7, s: 0.9, paint: 0x15803d, rate: 1.1 },
      { x: MG_UNIT_X - 44, z: -14, ry: 2.2, s: 1.25, paint: 0xb91c1c, rate: 0.8 },
      // Moved well CLEAR of the tank farm (which spans ~X 36..68, Z ≈ −30 ± 3).
      // Previously (WELL_X+55=64, −34) sat inside/behind the tank row, clipping it.
      { x: WELL_X + 70, z: -52, ry: -0.9, s: 1.1, paint: 0xca8a04, rate: 0.6 },
    ];
    pumpjacksRef.current = [];
    pjPlacements.forEach((p, i) => {
      const { group, walkingBeam, crank } = buildPumpjack(p.paint);
      group.position.set(p.x, 0, p.z);
      group.rotation.y = p.ry;
      group.scale.setScalar(p.s);
      scene.add(group);
      pumpjacksRef.current.push({
        walkingBeam,
        crank,
        phase: (i / pjPlacements.length) * Math.PI * 2,
        rate: p.rate,
      });
    });

    // --- TANK FARM — a row of large production/storage tanks inside a low
    // containment berm, with a connecting manifold pipe. Positioned off to the
    // side of the lease so it reads as a bulk battery. ---
    const FARM_X = WELL_X + 30;
    const FARM_Z = -30;
    const TANK_R = 2.6;
    const TANK_H = 7.5;
    const tankCount = 5;
    const tankSpacing = TANK_R * 2 + 1.4;
    const farmWidth = (tankCount - 1) * tankSpacing;

    // Containment berm (a low earthen wall ring around the tanks).
    const bermMat = steel(0x7a6a4f, 0.98, 0.02);
    const berm = new THREE.Mesh(
      new THREE.BoxGeometry(farmWidth + TANK_R * 2 + 4, 0.9, TANK_R * 2 + 5),
      bermMat,
    );
    berm.position.set(FARM_X + farmWidth / 2, 0.45, FARM_Z);
    berm.receiveShadow = true;
    scene.add(berm);
    // Gravel pad on top of the berm interior (darker)
    const farmPad = new THREE.Mesh(
      new THREE.BoxGeometry(farmWidth + TANK_R * 2 + 2, 0.2, TANK_R * 2 + 3),
      steel(0x5b5348, 0.98, 0.02),
    );
    farmPad.position.set(FARM_X + farmWidth / 2, 0.95, FARM_Z);
    farmPad.receiveShadow = true;
    scene.add(farmPad);

    const ladderMat = steel(0x374151, 0.6, 0.5);
    const tankTops: [number, number, number][] = [];
    for (let ti = 0; ti < tankCount; ti++) {
      const x = FARM_X + ti * tankSpacing;
      const z = FARM_Z;
      const shade = [0x9ca3af, 0x8b93a1, 0x6b7280, 0xa3a3a3, 0x7c8794][ti % 5];
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(TANK_R, TANK_R, TANK_H, 28),
        steel(shade, 0.8, 0.3),
      );
      tank.position.set(x, 1.05 + TANK_H / 2, z);
      tank.castShadow = true; tank.receiveShadow = true;
      scene.add(tank);
      // Domed/flat top cap
      const topCap = new THREE.Mesh(new THREE.CylinderGeometry(TANK_R + 0.05, TANK_R + 0.05, 0.25, 28), steel(0x4b5563));
      topCap.position.set(x, 1.05 + TANK_H + 0.1, z);
      scene.add(topCap);
      tankTops.push([x, 1.05 + TANK_H, z]);
      // Horizontal seam bands around the tank
      [0.28, 0.55, 0.82].forEach((f) => {
        const band = new THREE.Mesh(new THREE.TorusGeometry(TANK_R + 0.02, 0.04, 6, 28), steel(0x4b5563, 0.7, 0.4));
        band.rotation.x = Math.PI / 2;
        band.position.set(x, 1.05 + TANK_H * f, z);
        scene.add(band);
      });
      // Ladder up the well-facing side
      for (let rung = 0; rung < 10; rung++) {
        const lr = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.5), ladderMat);
        lr.position.set(x, 1.4 + rung * 0.7, z + TANK_R + 0.05);
        scene.add(lr);
      }
      [-0.22, 0.22].forEach((lz) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, TANK_H, 0.04), ladderMat);
        rail.position.set(x, 1.05 + TANK_H / 2, z + TANK_R + 0.05 + lz);
        scene.add(rail);
      });
      // Vent pipe
      const ventPipe = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 1.0, 8), ladderMat);
      ventPipe.position.set(x + TANK_R * 0.5, 1.05 + TANK_H + 0.6, z);
      scene.add(ventPipe);
    }
    // Connecting manifold pipe running along the front of the tanks.
    const manifold = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.16, farmWidth + TANK_R, 12),
      steel(0x1c1917, 0.7, 0.5),
    );
    manifold.rotation.z = Math.PI / 2;
    manifold.position.set(FARM_X + farmWidth / 2, 0.9, FARM_Z + TANK_R + 0.6);
    scene.add(manifold);
    // Risers from manifold up to each tank inlet
    tankTops.forEach(([x, , z]) => {
      const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.2, 8), steel(0x1c1917, 0.7, 0.5));
      riser.position.set(x, 1.9, z + TANK_R + 0.6);
      scene.add(riser);
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

    // (Removed the scattered ground pipe-joint stack that used to sit beside the
    // transport reel — it read as stray floating rods near the reel base and did
    // not correspond to any real prop, so it has been taken out.)
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
    // (Operator figure removed per request — no stylised human at the console.)
    // =========================================================================

    // --- Swap in the imported MG Truck model (with its own console) ----------
    // Hide the procedural truck body, then load the detailed Blender model into
    // the (vibrating) truck group at the MG unit position. Falls back to the
    // procedural body if the model fails to load.
    const useTruckModel = true;
    if (useTruckModel) {
      truckGroup.visible = false;
    }
    truckVibGroup.add(truckGroup);

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

    // --- Deployed L-SHAPED OUTRIGGER STABILISERS on the MG UNIT — just the TWO
    // REAR ones (one per side). Each is an L: a THIN horizontal arm reaches out
    // from the truck side, then a thin vertical leg drops to a round WHITE foot
    // pad on the ground. The L members are CARBON BLACK with a slight sheen.
    // Static ground props (NOT the vibrating group) so they stay planted.
    const ogGroup = new THREE.Group();
    ogGroup.position.set(MG_UNIT_X, 0, 0);
    // Carbon-black, semi-glossy steel (low roughness → visible shine).
    const ogBlack = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, metalness: 0.85, roughness: 0.25 });
    const ogPadWhite = new THREE.MeshStandardMaterial({ color: 0xe8e8ea, metalness: 0.2, roughness: 0.7 });
    const ARM_Y = 1.4;          // height the horizontal arm runs at (off the chassis)
    const ARM_INNER_Z = 1.8;    // where the arm leaves the truck side
    const ARM_OUTER_Z = 4.4;    // how far the arm reaches out
    const ARM_LEN = ARM_OUTER_Z - ARM_INNER_Z;
    const SEC = 0.24;           // THIN square section for the L members
    // Only the REAR pair (one per side) — rear of the MG bed (+X toward the well).
    const ax = 2.6;
    [1, -1].forEach((side) => {
      // Horizontal arm (runs along Z, out from the truck side).
      const arm = new THREE.Mesh(new THREE.BoxGeometry(SEC, SEC, ARM_LEN), ogBlack);
      arm.position.set(ax, ARM_Y, side * (ARM_INNER_Z + ARM_LEN / 2));
      arm.castShadow = true; ogGroup.add(arm);
      // Small pivot housing where the arm leaves the chassis.
      const pivot = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.34), ogBlack);
      pivot.position.set(ax, ARM_Y, side * ARM_INNER_Z); ogGroup.add(pivot);
      // Vertical leg dropping from the arm end down to the ground (the L corner).
      const leg = new THREE.Mesh(new THREE.BoxGeometry(SEC, ARM_Y + 0.2, SEC), ogBlack);
      leg.position.set(ax, (ARM_Y + 0.2) / 2, side * ARM_OUTER_Z);
      leg.castShadow = true; ogGroup.add(leg);
      // Round WHITE foot pad on the ground under the leg.
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.13, 20), ogPadWhite);
      pad.position.set(ax, 0.07, side * ARM_OUTER_Z);
      pad.castShadow = true; pad.receiveShadow = true; ogGroup.add(pad);
    });
    scene.add(ogGroup);
  }

  function buildServiceReel(scene: THREE.Scene) {
    const reelGroup = new THREE.Group();
    // Reel on its own trailer: set back into depth (−Z) from the wellhead line
    // and closer to the well. Sized so the coil sits above its trailer deck.
    // Seat the reel trailer FLAT on the ground: the trailer wheels sit at local
    // y = -2.6 with radius 0.5, so their bottoms reach local y = -3.1. Placing the
    // group at Y = 3.1 lands the wheels exactly on grade (y ≈ 0) instead of floating.
    reelGroup.position.set(REEL_X, 3.1, REEL_Z);
    reelGroup.scale.setScalar(1.0);
    // Stand the reel level (no tilt) so it sits squarely on its trailer/ground.
    reelGroup.rotation.x = 0;

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

    // Reel A-Frame Heavy Support Cradle (weathered dark structural steel).
    const aFrameMat = new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.6, roughness: 0.5 });
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

    // Reel flange rings + spokes (the circular STEEL BOUNDARIES of the spool) are
    // a silverish galvanised steel — distinct from the RED cradle/A-frame and the
    // BLACK wound rod, matching the reference photo.
    const rimMat = new THREE.MeshStandardMaterial({ color: 0xc4c9d0, metalness: 0.85, roughness: 0.35 });
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

    // --- Continuous Coiled Rod Pack (ONE rod wound like rope on a spool) ------
    // Real transport-reel behaviour (the "rope wrapped around a hook" model): a
    // SINGLE continuous rod is wound onto the barrel. It spirals across the drum
    // width one wrap at a time; when it reaches a flange it steps OUT one rod
    // diameter and spirals back — so the pack GROWS IN THICKNESS (radius) OUTWARD
    // while always staying INSIDE the flanges. Every individual wrap ("strap") is
    // still clearly visible. We render the whole thing as one continuous TubeGeometry
    // following the helical path, so it reads as a real wound rod, not stacked rings.
    const BARREL_R = 0.42;              // barrel the first wrap sits on (just off the axle)
    const ROD_R = 0.075;               // individual rod radius
    const PACK = ROD_R * 2.0;          // centre-to-centre pitch of neighbouring wraps
    const FLANGE_R = 2.3;              // containing flange radius (hard outer limit)
    const halfWidth = 1.08;            // wound width, kept just inside the flanges (±1.25)
    // How many radial layers fit between the barrel and the flange rim when the reel
    // is FULLY wound (with a small margin so the outer wrap never pokes past the flanges).
    const maxLayers = Math.max(1, Math.floor((FLANGE_R - ROD_R - BARREL_R) / PACK));
    const wrapsPerLayer = Math.max(2, Math.round((halfWidth * 2) / PACK));

    // Build the wound-rod tube for a given FILL fraction (1 = full spool, 0 = empty).
    // The rod pays off from the OUTSIDE in (real reels unwind their outer wraps first),
    // so as fill drops we drop whole outer layers AND partially unwind the current
    // outer layer — the coil visibly shrinks in radius. Returns a fresh geometry
    // (or null if effectively empty). One continuous helix so it reads as a real rod.
    const buildCoilGeometry = (fill: number): THREE.TubeGeometry | null => {
      const clamped = THREE.MathUtils.clamp(fill, 0, 1);
      // Total wraps at full spool, and how many remain at this fill level.
      const totalWraps = maxLayers * wrapsPerLayer;
      const wrapsRemaining = Math.max(0, clamped * totalWraps);
      if (wrapsRemaining < 0.75) return null; // essentially bare barrel
      const fullLayers = Math.floor(wrapsRemaining / wrapsPerLayer);
      const partialWraps = wrapsRemaining - fullLayers * wrapsPerLayer;

      const path: THREE.Vector3[] = [];
      const TURN_SEG = 48;             // path samples per single wrap (smoothness)
      const emitLayer = (layer: number, wrapsInLayer: number) => {
        const rIn = BARREL_R + layer * PACK;
        const rOut = BARREL_R + (layer + 1) * PACK;
        const forward = layer % 2 === 0;      // alternate sweep direction each layer
        const totalSteps = Math.max(1, Math.round(wrapsInLayer * TURN_SEG));
        for (let s = 0; s <= totalSteps; s++) {
          const w = (s / TURN_SEG);           // wraps completed so far in this layer
          const f = Math.min(1, w / wrapsPerLayer); // 0..1 across the layer width
          const zPos = forward ? -halfWidth + f * halfWidth * 2
                               :  halfWidth - f * halfWidth * 2;
          const ang = w * Math.PI * 2;        // one wrap = 2π
          const r = Math.min(FLANGE_R - ROD_R, rIn + (rOut - rIn) * f);
          path.push(new THREE.Vector3(Math.cos(ang) * r, Math.sin(ang) * r, zPos));
        }
      };
      for (let layer = 0; layer < fullLayers; layer++) emitLayer(layer, wrapsPerLayer);
      if (partialWraps > 0.05) emitLayer(fullLayers, partialWraps);
      if (path.length < 2) return null;

      const coilCurve = new THREE.CatmullRomCurve3(path, false, 'catmullrom', 0.0);
      const tubularSegments = Math.min(4000, path.length); // cap for perf
      return new THREE.TubeGeometry(coilCurve, tubularSegments, ROD_R, 8, false);
    };

    // Initial build at FULL spool. The render loop rebuilds this geometry as the
    // rod pays off during RIH so the coil shrinks live.
    const coilMat = new THREE.MeshStandardMaterial({ color: 0x45403a, metalness: 0.75, roughness: 0.45 });
    const initialGeo = buildCoilGeometry(1);
    const coilTube = new THREE.Mesh(initialGeo ?? new THREE.BufferGeometry(), coilMat);
    coilTube.castShadow = true;
    coilTube.receiveShadow = true;
    spool.add(coilTube);
    coilTubeRef.current = coilTube;
    coilMatRef.current = coilMat;
    coilFillRef.current = 1;
    // Expose the builder on the mesh so the render loop can regenerate geometry.
    (coilTube as THREE.Mesh & { userData: { buildCoilGeometry: (f: number) => THREE.TubeGeometry | null } })
      .userData.buildCoilGeometry = buildCoilGeometry;

    // Dark barrel cylinder under the innermost wrap so no gap shows to the axle.
    const core = new THREE.Mesh(
      new THREE.CylinderGeometry(BARREL_R - ROD_R * 0.5, BARREL_R - ROD_R * 0.5, halfWidth * 2, 32),
      new THREE.MeshStandardMaterial({ color: 0x0c0a08, metalness: 0.4, roughness: 0.8 }),
    );
    core.rotation.x = Math.PI / 2;
    core.castShadow = true; core.receiveShadow = true;
    spool.add(core);

    reelGroup.add(spool);
    reelSpoolRef.current = spool;

    // (Removed the blue level-wind sheave cylinder — it read as a stray floating
    // blue object near the rod path and isn't needed for the visual.)

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

    // --- AUXILIARY EQUIPMENT at the FRONT BASE (−X, tongue side) --------------
    // Heavy red structural skid, deployment hydraulic cylinders, and twin fire
    // extinguishers mounted securely to the frame (per spec / field photo).
    const redSteel = new THREE.MeshStandardMaterial({ color: 0xb01818, metalness: 0.45, roughness: 0.5 });
    const chromeMat = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.9, roughness: 0.25 });

    // Red skid frame across the front of the trailer base.
    const skidCross = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 3.2), redSteel);
    skidCross.position.set(-2.6, -1.95, 0); skidCross.castShadow = true; reelGroup.add(skidCross);
    [-1.3, 1.3].forEach((sz) => {
      const skidRail = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.35, 0.35), redSteel);
      skidRail.position.set(-1.7, -1.95, sz); skidRail.castShadow = true; reelGroup.add(skidRail);
    });

    // Deployment hydraulic cylinders (angled) pushing up toward the A-frame.
    [-1.0, 1.0].forEach((hz) => {
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.7, 14), redSteel);
      cyl.position.set(-1.9, -1.2, hz);
      cyl.rotation.z = 0.5; // angled toward the reel
      cyl.castShadow = true; reelGroup.add(cyl);
      // Chrome piston rod extending out of the cylinder.
      const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 1.1, 10), chromeMat);
      rod.position.set(-1.45, -0.45, hz);
      rod.rotation.z = 0.5; reelGroup.add(rod);
      // Base pivot pin.
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.5, 10), crossBraceMat);
      pin.rotation.x = Math.PI / 2; pin.position.set(-2.4, -1.85, hz); reelGroup.add(pin);
    });

    // Twin fire extinguishers mounted upright on the front skid.
    [-0.55, 0.55].forEach((ez) => {
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.9, 16), redSteel);
      bottle.position.set(-2.95, -1.35, ez); bottle.castShadow = true; reelGroup.add(bottle);
      // Rounded top
      const dome = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), redSteel);
      dome.position.set(-2.95, -0.9, ez); reelGroup.add(dome);
      // Black neck + handle
      const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.2, 8), crossBraceMat);
      neck.position.set(-2.95, -0.72, ez); reelGroup.add(neck);
      const handle = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.05, 0.08), crossBraceMat);
      handle.position.set(-3.02, -0.62, ez); reelGroup.add(handle);
      // Mounting bracket strap to the skid.
      const strap = new THREE.Mesh(new THREE.TorusGeometry(0.18, 0.02, 6, 16), crossBraceMat);
      strap.rotation.y = Math.PI / 2; strap.position.set(-2.95, -1.35, ez); reelGroup.add(strap);
    });

    scene.add(reelGroup);

    // =====================================================================
    // CONTAINMENT / GUIDE ARM (per manual Figs 233-235) --------------------
    // A RED pivoting arm mounted on the reel trailer. The CoRod pays off the
    // coil, threads through this arm's GUIDE HEAD (at GUIDE_HEAD), then feeds
    // straight into the arched rod guide. Built as a WORLD-space group (not the
    // spinning spool) so it stays fixed; it vibrates slightly with the rod.
    // The whole group sits at the reel and the guide head is authored so its
    // WORLD position equals GUIDE_HEAD.
    // =====================================================================
    const armGroup = new THREE.Group();
    armGroup.position.set(REEL_X, 0, 0);          // world-anchored at the reel line
    const armRed = new THREE.MeshStandardMaterial({ color: 0xb01818, metalness: 0.5, roughness: 0.45 });
    const armDark = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.7, roughness: 0.4 });
    const armChrome = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.9, roughness: 0.25 });

    // Guide-head point in LOCAL coords (group is at REEL_X). It sits WELL OUTBOARD
    // of the reel (+X) at a low/side height, so the rod runs sideways out of the
    // coil edge and through it — never over the top, never toward the reel centre.
    const headLX = GUIDE_HEAD.x - REEL_X;   // ≈ 4.2
    const headLY = GUIDE_HEAD.y;            // ≈ 3.4 (side height)
    const headLZ = GUIDE_HEAD.z;            // = REEL_Z (-11)
    const headPt = new THREE.Vector3(headLX, headLY, headLZ);

    // The containment arm is a COMPACT free-standing frame planted on the ground
    // BESIDE the reel (well side). It is a small skid with TWO vertical red posts
    // forming the throat (the "two bars" in the field diagram) that the rod passes
    // between, capped by the guide head. All members are AT headLX so the whole
    // thing sits cleanly to the side of the reel — nothing reaches back toward it.
    const skid = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.2, 1.6), armDark);
    skid.position.set(headLX, 0.1, headLZ); skid.receiveShadow = true; skid.castShadow = true;
    armGroup.add(skid);

    // Two vertical red posts straddling the rod path in Z, standing on the skid,
    // tall enough to carry the guide head at headLY. They stand clear of the reel
    // rims so the reel never contacts them when rotating (per the CAUTION).
    const postH = headLY + 0.2;
    [0.45, -0.45].forEach((pz) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.24, postH, 0.24), armRed);
      post.position.set(headLX, postH / 2, headLZ + pz);
      post.castShadow = true; armGroup.add(post);
    });
    // Cross-tie linking the two posts near the top for rigidity.
    const tie = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 1.1), armRed);
    tie.position.set(headLX, postH - 0.35, headLZ); armGroup.add(tie);
    // Drop-pin barrel at the base (Fig 235 support-arm locking pin).
    const pinBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.55, 12), armChrome);
    pinBarrel.position.set(headLX, 0.45, headLZ + 0.78); armGroup.add(pinBarrel);

    // GUIDE HEAD atop the throat — a ring the rod threads through (axis along the
    // rod's outward travel ≈ +X), flanked by two removable SAFETY FORKS + housing.
    const headHousing = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.6), armRed);
    headHousing.position.copy(headPt); headHousing.castShadow = true; armGroup.add(headHousing);
    const headRing = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.06, 10, 20), armChrome);
    headRing.rotation.y = Math.PI / 2;  // opening faces along the rod path (X)
    headRing.position.copy(headPt); armGroup.add(headRing);
    // Two safety forks straddling the throat (±Z), per "safety forks can be removed".
    [0.3, -0.3].forEach((fz) => {
      const fork = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.55, 0.1), armDark);
      fork.position.set(headPt.x, headPt.y - 0.1, headPt.z + fz);
      armGroup.add(fork);
    });
    // Drop-pin handle detail on the head housing.
    const headPin = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.4, 8), armChrome);
    headPin.position.set(headPt.x, headPt.y + 0.35, headPt.z); armGroup.add(headPin);

    scene.add(armGroup);
    containmentArmRef.current = armGroup;
    containmentArmRestRef.current = { x: armGroup.position.x, y: armGroup.position.y, z: armGroup.position.z };
  }

  // Curve describing the CoRod path from where it pays off the reel, up and over
  // the guide arch, then straight down into the injector head. Both the rod tube
  // and the guide channel follow THIS curve so the rod visibly runs inside the
  // guide up to the injector top. Kept as a shared helper so they stay in sync.
  function getRodGuideCurve(): THREE.CatmullRomCurve3 {
    const apexY = INJECTOR_TOP_Y + 2.6; // top of the arch above the injector head
    // The arch now BEGINS at the containment arm's guide head (GUIDE_HEAD) so the
    // rod threads continuously: reel coil → arm guide head → this arch → injector.
    // The arch is stretched/re-anchored to start there instead of floating off the
    // top of the coil, so the guide physically connects to the containment arm.
    // The rod must leave the guide head HORIZONTALLY (out the END of the arm, like
    // the manual) and only THEN curve up into the arch — not shoot straight up off
    // the head. So the first control points stay at the head's HEIGHT and extend in
    // the travel direction (toward the well/mast, +X and +Z toward z=0), giving a
    // long horizontal lead-out; the arch then sweeps up with a WIDER curve.
    const dirX = WELL_X - GUIDE_HEAD.x;          // horizontal travel toward the well
    const dirZ = 0 - GUIDE_HEAD.z;               // and toward the well's z=0 line
    const dirLen = Math.hypot(dirX, dirZ) || 1;
    const ux = dirX / dirLen, uz = dirZ / dirLen; // unit horizontal travel direction
    return new THREE.CatmullRomCurve3([
      new THREE.Vector3(GUIDE_HEAD.x, GUIDE_HEAD.y, GUIDE_HEAD.z),                       // AT the guide head
      new THREE.Vector3(GUIDE_HEAD.x + ux * 1.4, GUIDE_HEAD.y, GUIDE_HEAD.z + uz * 1.4), // HORIZONTAL lead-out (same height)
      new THREE.Vector3(GUIDE_HEAD.x + ux * 2.8, GUIDE_HEAD.y + 0.4, GUIDE_HEAD.z + uz * 2.8), // still low, just beginning to rise
      new THREE.Vector3(WELL_X - 2.6, INJECTOR_TOP_Y - 0.5, GUIDE_HEAD.z * 0.35),        // wide sweep rising toward the well
      new THREE.Vector3(WELL_X - 1.0, apexY - 0.6, 0),                                   // approaching the apex
      new THREE.Vector3(WELL_X, apexY - 0.05, 0),                                        // over the apex
      new THREE.Vector3(WELL_X, INJECTOR_TOP_Y + 0.4, 0),                                // down into the injector head top
    ]);
  }

  // Build ONE arched rod-guide made of 11 bolt-together sections of VARYING
  // length (as in the field, where numbered guide segments clip together). The
  // guide follows `curve`; the rod threads through it. No blue holders — just the
  // black guide sections with yellow wear-pad stripes and mounting plates at the
  // joints between sections. Added to `parent` (scene or a placement group).
  function buildGuideAlongCurve(
    parent: THREE.Object3D,
    curve: THREE.CatmullRomCurve3,
    collect?: THREE.Mesh[],           // if provided, push section tubes here for highlighting
    tubeRadius = 0.15,                // channel radius; larger keeps the rod visually inside
  ) {
    // Each section gets its OWN material instance so the live guide can be
    // recoloured per operation mode without affecting other guides.
    const plateMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.55, roughness: 0.5 });
    const padMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5, metalness: 0.2 });

    // 11 sections with VARYING relative lengths (sums to 1). Alternating longer/
    // shorter segments so the sizes clearly differ.
    const rawLens = [1.0, 0.7, 1.3, 0.85, 1.15, 0.6, 1.25, 0.9, 1.1, 0.75, 1.2];
    const total = rawLens.reduce((a, b) => a + b, 0);
    let u0 = 0;
    for (let s = 0; s < rawLens.length; s++) {
      const u1 = u0 + rawLens[s] / total;
      // Sub-curve for this section (sampled points between u0..u1).
      const samples = 8;
      const pts: THREE.Vector3[] = [];
      for (let k = 0; k <= samples; k++) {
        pts.push(curve.getPoint(u0 + (u1 - u0) * (k / samples)));
      }
      const seg = new THREE.CatmullRomCurve3(pts);
      const secMat = new THREE.MeshStandardMaterial({ color: 0x111827, metalness: 0.5, roughness: 0.55 });
      // Square-section tube (4 radial segments) reads as a chunky rectangular
      // BOX-BEAM (like the rack guides), not a round cylinder. The rod runs just
      // beneath it in the channel.
      const tube = new THREE.Mesh(new THREE.TubeGeometry(seg, 16, tubeRadius, 4, false), secMat);
      tube.castShadow = true;
      parent.add(tube);
      collect?.push(tube);

      // Mounting plate at the START joint of each section (bolted flange look).
      const jp = curve.getPoint(u0);
      const tan = curve.getTangent(u0).normalize();
      const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), tan);
      const plate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.5), plateMat);
      plate.position.copy(jp);
      plate.quaternion.copy(quat);
      parent.add(plate);

      // 2 yellow wear-pad stripes per section (numbered guides have paired pads).
      [0.33, 0.66].forEach((f) => {
        const p = seg.getPoint(f);
        const ptan = seg.getTangent(f).normalize();
        const pquat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), ptan);
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.18, 0.4), padMat);
        pad.position.copy(p);
        pad.quaternion.copy(pquat);
        parent.add(pad);
      });

      u0 = u1;
    }
    // End plate at the very top joint.
    const endP = curve.getPoint(1);
    const endPlate = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.5, 0.5), plateMat);
    endPlate.position.copy(endP);
    parent.add(endPlate);
  }

  // The LIVE rod guide over the well: arched, 11 sections, rod runs through it
  // from the reel up to the injector top. (No blue holder — the guide is self-
  // supported like the real over-the-well arch.)
  function buildRodGuideRack(scene: THREE.Scene) {
    // Wider channel (0.24) so the rod stays visually INSIDE the guide even where
    // the shared curve bows slightly; collect the section tubes for mode-colour.
    injectorGuideMeshesRef.current = [];
    // 0.18 square-section beam reads as a box-beam; the rod (radius ~0.045) runs
    // through the same curve so it stays visually within the guide.
    buildGuideAlongCurve(scene, getRodGuideCurve(), injectorGuideMeshesRef.current, 0.18);
  }

  // Portable field welder skid (red Weatherford-style unit): steel skid base,
  // engine/generator box, gas bottles, control panel, expanded-metal screen and
  // a red sun umbrella — a recognisable prop matching the field photo.
  function buildFieldWelder(scene: THREE.Scene, x: number, z: number) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const redMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.4, roughness: 0.5 });
    const darkMat = new THREE.MeshStandardMaterial({ color: 0x27272a, metalness: 0.6, roughness: 0.5 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x9ca3af, metalness: 0.7, roughness: 0.4 });

    // Skid base
    const skid = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.25, 2.0), redMat);
    skid.position.y = 0.15; skid.castShadow = true; skid.receiveShadow = true; g.add(skid);
    [-1.9, 1.9].forEach((sx) => {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.2, 2.0), darkMat);
      rail.position.set(sx, 0.1, 0); g.add(rail);
    });
    // Main engine/generator enclosure
    const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.5, 1.6), redMat);
    box.position.set(-0.4, 1.05, 0); box.castShadow = true; g.add(box);

    // Branded label texture: Weatherford wordmark + "PFW" (Portable Field Welder),
    // CENTRED on the panel with louvre/detail lines for a more finished look.
    const makeBrandTexture = () => {
      const cv = document.createElement('canvas');
      cv.width = 512; cv.height = 256;
      const ctx = cv.getContext('2d')!;
      ctx.fillStyle = '#b91c1c'; ctx.fillRect(0, 0, cv.width, cv.height);
      // Subtle darker inner border frame.
      ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 8;
      ctx.strokeRect(14, 14, cv.width - 28, cv.height - 28);
      // Louvre detail lines top & bottom (cooling vents).
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 4;
      for (let i = 0; i < 6; i++) {
        const yy = 34 + i * 6;
        ctx.beginPath(); ctx.moveTo(40, yy); ctx.lineTo(cv.width - 40, yy); ctx.stroke();
      }
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      // Weatherford wordmark (centred).
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 54px Arial, sans-serif';
      ctx.fillText('Weatherford', cv.width / 2, 112);
      // Chevron accent under the wordmark, centred.
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(cv.width / 2 - 44, 150); ctx.lineTo(cv.width / 2, 172); ctx.lineTo(cv.width / 2 + 44, 150);
      ctx.stroke();
      // PFW big, centred.
      ctx.font = 'bold 92px Arial, sans-serif';
      ctx.fillText('PFW', cv.width / 2, 210);
      const tex = new THREE.CanvasTexture(cv);
      tex.anisotropy = 4;
      return tex;
    };
    const brandTex = makeBrandTexture();
    const brandMat = new THREE.MeshStandardMaterial({ map: brandTex, roughness: 0.6 });
    // Branded panels on BOTH long sides of the enclosure (±Z faces), slightly
    // proud of the box so they read cleanly.
    [0.805, -0.805].forEach((pz, i) => {
      const panelB = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.35), brandMat);
      panelB.position.set(-0.4, 1.05, pz);
      panelB.rotation.y = i === 0 ? 0 : Math.PI;
      g.add(panelB);
    });
    // Radiator/expanded-metal screen at the back (+X end) with vent slats.
    const screen = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.5), new THREE.MeshStandardMaterial({ color: 0xd1d5db, metalness: 0.6, roughness: 0.6 }));
    screen.position.set(1.3, 0.95, 0); g.add(screen);
    for (let sv = 0; sv < 5; sv++) {
      const slat = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.06, 1.3), darkMat);
      slat.position.set(2.01, 0.6 + sv * 0.16, 0); g.add(slat);
    }
    // --- Added detail: lifting bail hoop, hinged access hatch, small gauges on
    // the END face (not the branded side, so the logo stays clean). ---
    const bailHoop = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.03, 8, 20, Math.PI), steelMat);
    bailHoop.position.set(-0.4, 1.85, 0); bailHoop.rotation.x = Math.PI / 2; g.add(bailHoop);
    // Gauges + control panel on the −X END face (away from the branded sides).
    const endPanel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 1.0), darkMat);
    endPanel.position.set(-1.62, 1.15, 0); g.add(endPanel);
    [-0.25, 0, 0.25].forEach((gz) => {
      const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.04, 14),
        new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.5 }));
      gauge.rotation.z = Math.PI / 2;
      gauge.position.set(-1.66, 1.2, gz); g.add(gauge);
    });
    // Coiled welding lead draped on the skid.
    const lead = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.05, 8, 20), darkMat);
    lead.position.set(0.9, 0.45, 0.7); lead.rotation.x = Math.PI / 2; g.add(lead);
    // Twin gas/fuel bottles
    [-1.5, -1.1].forEach((bx) => {
      const bottle = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 1.1, 14), redMat);
      bottle.position.set(bx, 0.85, 0.6); bottle.castShadow = true; g.add(bottle);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.2, 10), steelMat);
      cap.position.set(bx, 1.5, 0.6); g.add(cap);
    });
    // Exhaust stack
    const stack = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.0, 10), darkMat);
    stack.position.set(-1.2, 2.1, -0.4); g.add(stack);

    // --- Red sun umbrella over the operator side ---
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.4, 8), steelMat);
    pole.position.set(0.6, 2.4, -0.6); g.add(pole);
    const canopy = new THREE.Mesh(
      new THREE.ConeGeometry(2.0, 0.8, 16, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xdc2626, roughness: 0.7, side: THREE.DoubleSide }),
    );
    canopy.position.set(0.6, 4.0, -0.6); g.add(canopy);

    scene.add(g);
  }

  // Blue A-FRAME GUIDE STORAGE RACK matching the field photo: a welded blue
  // frame (two A-frame end towers + long top/bottom rails) cradling a STACK of
  // curved black guide beams (each with yellow wear-pad stripes and a painted
  // number), with a few pointed hanger tools sticking up at the top corners.
  function buildGuideRack(scene: THREE.Scene, x: number, z: number, ry: number, scale = 1) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    g.scale.setScalar(scale);

    const blueMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.4, roughness: 0.55 }); // red frame
    const guideMat = new THREE.MeshStandardMaterial({ color: 0x22262b, metalness: 0.45, roughness: 0.6 });
    const padMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, roughness: 0.5, metalness: 0.2 });

    const RACK_W = 9.0;   // long axis (z) — width of the rack
    const RACK_H = 4.2;   // tower height
    const RACK_D = 2.2;   // depth (x) between the two A-frame planes

    // --- Two A-frame end towers (at ±RACK_W/2 along z) ---
    const buildTower = (zc: number) => {
      // Splayed legs front/back (±x) meeting near the top.
      const legDefs: [number, number][] = [[-RACK_D / 2, 0], [RACK_D / 2, 0]];
      legDefs.forEach(([lx]) => {
        const foot = new THREE.Vector3(lx, 0.1, zc);
        const apex = new THREE.Vector3(0, RACK_H, zc);
        const dir = new THREE.Vector3().subVectors(apex, foot);
        const len = dir.length();
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.16, len, 0.16), blueMat);
        leg.position.copy(foot).addScaledVector(dir, 0.5);
        leg.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
        leg.castShadow = true;
        g.add(leg);
      });
      // Vertical mullion + horizontal cross-ties on the tower.
      const mull = new THREE.Mesh(new THREE.BoxGeometry(0.14, RACK_H, 0.14), blueMat);
      mull.position.set(0, RACK_H / 2, zc); g.add(mull);
      [1.2, 2.4, 3.6].forEach((ty) => {
        const tie = new THREE.Mesh(new THREE.BoxGeometry(RACK_D + 0.2, 0.12, 0.12), blueMat);
        tie.position.set(0, ty, zc); g.add(tie);
      });
      // Pointed hanger tools sticking up at the tower top.
      [-0.2, 0.05, 0.3].forEach((dz, i) => {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.6, 8),
          new THREE.MeshStandardMaterial({ color: i === 0 ? 0x3a3a3a : 0x5a4a3a, metalness: 0.5, roughness: 0.5 }));
        spike.position.set(-0.2 + i * 0.2, RACK_H + 0.3, zc + dz * 0.4);
        g.add(spike);
      });
    };
    buildTower(-RACK_W / 2);
    buildTower(RACK_W / 2);

    // --- Long top & bottom rails tying the two towers together (both x sides) ---
    [-RACK_D / 2, RACK_D / 2].forEach((rx) => {
      [0.3, RACK_H - 0.2].forEach((ry2) => {
        const rail = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, RACK_W + 0.3), blueMat);
        rail.position.set(rx, ry2, 0); g.add(rail);
      });
    });
    // Base skids on the ground.
    [-RACK_D / 2, RACK_D / 2].forEach((rx) => {
      const skid = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, RACK_W + 1.2), blueMat);
      skid.position.set(rx, 0.08, 0); skid.receiveShadow = true; g.add(skid);
    });

    // --- 11 curved guide beams (TOTAL) cradled in the rack, of VARYING SIZE ---
    // These are the numbered field guides stored together; 11 individual beams
    // stacked up the towers, each a single curved box-beam with yellow wear pads.
    const NUM = 11;                              // total guides in the rack
    const sizeFactors = [1.0, 0.82, 1.12, 0.9, 1.05, 0.75, 1.18, 0.88, 1.0, 0.8, 1.1];
    for (let i = 0; i < NUM; i++) {
      const y = 0.9 + i * 0.28;                  // stacked tightly up the towers
      const sf = sizeFactors[i % sizeFactors.length];
      const half = (RACK_W / 2 - 0.4) * sf;      // varying span per beam
      const sag = (1.1 - i * 0.03) * sf;         // varying curvature per beam
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, y, -half),
        new THREE.Vector3(0, y + sag * 0.8, -half * 0.4),
        new THREE.Vector3(0, y + sag, 0),
        new THREE.Vector3(0, y + sag * 0.8, half * 0.4),
        new THREE.Vector3(0, y, half),
      ]);
      const beam = new THREE.Mesh(new THREE.TubeGeometry(curve, 26, 0.15, 8, false), guideMat);
      beam.castShadow = true; g.add(beam);
      // Yellow wear-pad stripes along the beam.
      [0.22, 0.42, 0.58, 0.78].forEach((u) => {
        const p = curve.getPoint(u);
        const pad = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.11, 0.42), padMat);
        pad.position.copy(p); pad.position.y += 0.14; g.add(pad);
      });
      // Chunky numbered end lugs at both ends.
      [-half, half].forEach((pz) => {
        const lug = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.36), guideMat);
        lug.position.set(0, y, pz); g.add(lug);
      });
    }

    scene.add(g);
  }

  function buildGripperInjector(scene: THREE.Scene) {
    const injectorGroup = new THREE.Group();
    // Right side of the site (over the wellhead), per the side-on field layout.
    // Anchored at the injector-head base so the imported model seats ~4 ft above
    // the BOP top and the rod threads straight down through its centre.
    injectorGroup.position.set(WELL_X, INJECTOR_BASE_Y, 0);

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
      // The injector group is already anchored at INJECTOR_BASE_Y, and the loader
      // seats the model base at the holder origin, so no extra vertical offset is
      // needed — the head sits exactly ~4 ft above the BOP top.
      injModelHolder.position.set(0, 0, 0);
      // Face the injector's FRONT toward the operator console / MG unit, which is
      // in the −X direction (MG_UNIT_X = −10) from the wellhead (WELL_X = 9).
      // Rotating the holder (whose origin is on the rod line) keeps the model
      // centred on the rod while spinning it about the vertical axis.
      injModelHolder.rotation.y = Math.PI / 2;
      injectorGroup.add(injModelHolder);
      loadEquipmentModel('/models/injector.glb', injModelHolder, {
        targetHeight: INJECTOR_MODEL_H,
        // Centre the injector's bore on the rod line, same as the wellhead/BOP,
        // so the rod threads straight through its head instead of off to a side.
        alignBore: true,
        onLoaded: (root) => {
          // Guarantee the injector stands perfectly upright (no baked tilt).
          root.rotation.set(0, 0, 0);
        },
      });
    }

    // Dual Opposed Continuous Gripper Chains & Hardened Shoes
    // Hidden: the imported injector.glb now provides the visual body. The groups
    // and refs are kept so the 60fps animation loop still has valid targets.
    const chainMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.2 });
    const leftChain = new THREE.Group();
    leftChain.position.set(-0.25, 0, 0);
    for (let i = 0; i < 7; i++) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.4), chainMat);
      block.position.set(0, (i - 3) * 0.45, 0);
      block.visible = false;
      leftChain.add(block);
    }
    injectorGroup.add(leftChain);
    gripperChainLeftRef.current = leftChain;

    const rightChain = new THREE.Group();
    rightChain.position.set(0.25, 0, 0);
    for (let i = 0; i < 7; i++) {
      const block = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, 0.4), chainMat);
      block.position.set(0, (i - 3) * 0.45, 0);
      block.visible = false;
      rightChain.add(block);
    }
    injectorGroup.add(rightChain);
    gripperChainRightRef.current = rightChain;

    // Squeeze Hydraulic Backing Beams (hidden — replaced by injector.glb)
    const squeezePlates = new THREE.Group();
    const beamL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.35), motorMat);
    beamL.position.set(-0.32, 0, 0);
    beamL.visible = false;
    squeezePlates.add(beamL);

    const beamR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.35), motorMat);
    beamR.position.set(0.32, 0, 0);
    beamR.visible = false;
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

    // --- Rod Safety Clamps (mechanical) on the exposed rod above the wellhead --
    // Two clamps stack just above the BOP; visibility follows the installed count.
    const clampGroups: THREE.Group[] = [];
    const clampBodyMat = new THREE.MeshStandardMaterial({
      color: 0xf59e0b,
      metalness: 0.6,
      roughness: 0.4,
    });
    const clampBoltMat = new THREE.MeshStandardMaterial({
      color: 0x9ca3af,
      metalness: 0.9,
      roughness: 0.3,
    });
    for (let i = 0; i < 2; i++) {
      const g = new THREE.Group();
      // Two jaw halves hugging the rod
      const jawGeo = new THREE.BoxGeometry(0.28, 0.5, 0.55);
      const jawL = new THREE.Mesh(jawGeo, clampBodyMat);
      jawL.position.x = -0.2;
      const jawR = new THREE.Mesh(jawGeo, clampBodyMat);
      jawR.position.x = 0.2;
      g.add(jawL, jawR);
      // Bolt studs across the clamp
      for (let b = -1; b <= 1; b += 2) {
        const bolt = new THREE.Mesh(
          new THREE.CylinderGeometry(0.04, 0.04, 0.55, 8),
          clampBoltMat,
        );
        bolt.rotation.x = Math.PI / 2;
        bolt.position.set(0, b * 0.15, 0);
        g.add(bolt);
      }
      // Stacked just above the wellhead / BOP top
      g.position.set(WELL_X, 5.2 + i * 0.7, 0);
      g.visible = false;
      scene.add(g);
      clampGroups.push(g);
    }
    rodClampRefs.current = clampGroups;
  }

  // Safety cones (traffic cones) laid out around the wellsite perimeter to
  // demarcate the work exclusion zone. Loads one GLB then clones it.
  function buildSafetyCones(scene: THREE.Scene) {
    // Cone placements (world X, Z) ringing the wellhead / walkway.
    // Ring the cones OUTSIDE the cellar opening (CELLAR_HALF = 2.6) so none sit
    // on the pit edge or float over the open hole. ~4.5-unit standoff ring.
    const conePositions: [number, number][] = [
      [WELL_X - 4.6, 4.6],
      [WELL_X + 4.6, 4.6],
      [WELL_X - 4.6, -4.6],
      [WELL_X + 4.6, -4.6],
      [WELL_X, 5.4],
      [WELL_X, -5.4],
      [WELL_X - 7.5, 0],
    ];
    gltfLoader.load(
      '/models/cone.glb',
      (gltf) => {
        const proto = gltf.scene;
        proto.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
        });
        // Normalise the prototype to ~0.9 units tall, base at y=0.
        const box = new THREE.Box3().setFromObject(proto);
        const size = new THREE.Vector3();
        box.getSize(size);
        const scale = size.y > 0.0001 ? 0.9 / size.y : 1;
        conePositions.forEach(([x, z], i) => {
          const cone = proto.clone(true);
          cone.scale.setScalar(scale);
          const cb = new THREE.Box3().setFromObject(cone);
          cone.position.set(x, -cb.min.y, z);
          cone.rotation.y = (i * Math.PI) / 3; // vary facing
          scene.add(cone);
        });
      },
      undefined,
      (err) => console.warn('[Rig3DViewport] Failed to load cone.glb', err),
    );
  }

  function buildWellheadBopStack(scene: THREE.Scene) {
    const wellheadGroup = new THREE.Group();
    wellheadGroup.position.set(WELL_X, WELLHEAD_BASE_Y, 0);

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.75, roughness: 0.25 });
    const bopMat = new THREE.MeshStandardMaterial({ color: 0xb91c1c, metalness: 0.5, roughness: 0.35 });

    // --- External GLB models: real Wellhead + BOP replace the procedural body.
    // The animated dog-clamp jaws and BOP rams (below) remain procedural overlays
    // so their existing animations keep working.
    // Wellhead sized up substantially so it reads clearly against the CoRod
    // string. Base sits on the group origin, top ≈ WELLHEAD_TOP_Y. alignBore
    // snaps the tubing bore (not the skewed bbox) onto the rod line at WELL_X.
    const wellheadModelHolder = new THREE.Group();
    wellheadGroup.add(wellheadModelHolder);
    loadEquipmentModel('/models/wellhead.glb', wellheadModelHolder, {
      targetHeight: WELLHEAD_H,
      alignBore: true,
    });
    // BOP stacked directly on top of the wellhead. alignBore centres its bore on
    // the rod line automatically, ignoring the side ram bonnets that would
    // otherwise skew a bounding-box centre. Enlarged to match the wellhead.
    const bopModelHolder = new THREE.Group();
    // Seat the BOP on the wellhead's real mating face (below the wide bbox top).
    bopModelHolder.position.y = WELLHEAD_H * WELLHEAD_MATE_FRAC;
    wellheadGroup.add(bopModelHolder);
    bopModelHolderRef.current = bopModelHolder;
    bopHolderRestXRef.current = bopModelHolder.position.x; // remember rest X for vibration
    loadEquipmentModel('/models/bop.glb', bopModelHolder, {
      targetHeight: BOP_H,
      alignBore: true,
    });

    // NOTE: The procedural flange/bopBody below are retained but made invisible —
    // kept so nothing that references the layout breaks, hidden since the GLBs
    // now provide the visual. Set `showProcedural` true to fall back.
    const showProcedural = false;

    // Tubing Head Flange
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.95, 0.6, 24), steelMat);
    flange.position.y = 0.3;
    flange.visible = showProcedural;
    wellheadGroup.add(flange);

    // Annular BOP Body
    const bopBody = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.72, 1.2, 24), bopMat);
    bopBody.position.y = 1.2;
    bopBody.castShadow = true;
    bopBody.visible = showProcedural;
    wellheadGroup.add(bopBody);

    // BOP Hydraulic Actuator Rams (Side Cylinders)
    const bopRamsGroup = new THREE.Group();
    bopRamsGroup.position.y = 1.2;

    const ramL = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 1.1, 16), steelMat);
    ramL.rotation.z = Math.PI / 2;
    ramL.position.set(-0.8, 0, 0);
    ramL.visible = showProcedural;
    bopRamsGroup.add(ramL);

    const ramR = ramL.clone();
    ramR.position.set(0.8, 0, 0);
    ramR.visible = showProcedural;
    bopRamsGroup.add(ramR);
    wellheadGroup.add(bopRamsGroup);
    bopRamsRef.current = bopRamsGroup;

    // Safety Dog Clamp Table (hidden — GLB stack now provides the visual)
    const clampTable = new THREE.Mesh(new THREE.BoxGeometry(1.15, 0.5, 1.15), steelMat);
    clampTable.position.y = 2.2;
    clampTable.visible = showProcedural;
    wellheadGroup.add(clampTable);

    // Mechanical Safety Dog Clamp Jaws (Component V) — hidden; group/ref kept
    // so the safety-clamp animation still targets a valid object.
    const clampJaws = new THREE.Group();
    clampJaws.position.y = 2.6;
    const clampMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.6 });

    const jawL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.5), clampMat);
    jawL.position.set(-0.22, 0, 0);
    jawL.visible = showProcedural;
    clampJaws.add(jawL);

    const jawR = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.3, 0.5), clampMat);
    jawR.position.set(0.22, 0, 0);
    jawR.visible = showProcedural;
    clampJaws.add(jawR);
    wellheadGroup.add(clampJaws);
    safetyClampJawsRef.current = clampJaws;

    // Item 67: Tubing head flange bolt circle (8 bolts) — hidden
    const flangeBoltGeo = new THREE.CylinderGeometry(0.05, 0.05, 0.18, 8);
    for (let fb = 0; fb < 8; fb++) {
      const fbAngle = (fb / 8) * Math.PI * 2;
      const fbBolt = new THREE.Mesh(flangeBoltGeo, steelMat);
      fbBolt.position.set(Math.cos(fbAngle) * 0.88, 0.6, Math.sin(fbAngle) * 0.88);
      fbBolt.visible = showProcedural;
      wellheadGroup.add(fbBolt);
    }

    // Item 68: BOP side nozzle ports (bleed/kill line connections) — hidden
    const nozzleMat = new THREE.MeshStandardMaterial({ color: 0x374151, metalness: 0.7, roughness: 0.3 });
    const nozzleGeo = new THREE.CylinderGeometry(0.1, 0.1, 0.5, 12);
    [0, Math.PI].forEach((nAngle) => {
      const nozzle = new THREE.Mesh(nozzleGeo, nozzleMat);
      nozzle.rotation.x = Math.PI / 2;
      nozzle.position.set(Math.cos(nAngle) * 0.85, 1.2, Math.sin(nAngle) * 0.85);
      nozzle.visible = showProcedural;
      wellheadGroup.add(nozzle);
      // Valve handle on nozzle
      const nValve = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.06, 0.04), nozzleMat);
      nValve.position.set(Math.cos(nAngle) * 1.12, 1.2, Math.sin(nAngle) * 1.12);
      nValve.visible = showProcedural;
      wellheadGroup.add(nValve);
    });

    // Stuffing Box Riser (hidden — the tall steel cylinder that clashed with the GLBs)
    const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 3.4, 24), steelMat);
    riser.position.y = 4.5;
    riser.visible = showProcedural;
    wellheadGroup.add(riser);

    // Item 72: Packing gland flange at riser bottom connection — hidden
    const packingGland = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.2, 24), steelMat);
    packingGland.position.y = 2.85;
    packingGland.visible = showProcedural;
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
    // The rod follows the SAME curve as the guide channel (getRodGuideCurve) so
    // it visibly runs inside the guide from the reel up to the injector top, then
    // continues straight down through the injector, BOP and into the wellhead.
    // Follow the EXACT guide arch by sampling the guide curve densely, then append
    // the vertical descent. Because the shared arc is baked in as many fixed
    // points, the descent points can't bend it — so the rod sits perfectly inside
    // the guide (relocation only; guide width unchanged).
    const guideCurve = getRodGuideCurve();
    const ARC_SAMPLES = 80;

    // DYNAMIC rod-strand geometry builder, parameterised by the reel FILL fraction
    // (1 = full reel, 0 = empty). The rod's start point rides on the coil's CURRENT
    // outer radius via coilOuterRadius(fill), so as the coil SHRINKS during RIH the
    // connection point tracks inward and the rod stays glued to the wraps (never a
    // floating stub). From the coil edge it runs OUTWARD (never over the top / never
    // toward the reel centre) through the containment guide head, into the arch,
    // then down the well line. Rebuilt in the render loop whenever fill changes.
    const buildRodStrandGeometry = (fill: number): THREE.TubeGeometry => {
      const r = coilOuterRadius(fill);                 // current coil outer radius
      const rodPoints: THREE.Vector3[] = [];
      // Emerge from the coil surface on the +X (well-facing) side, at coil centre
      // height. Tuck slightly INSIDE the surface (r − 0.1) so it reads as connected.
      // The rod must CURVE AROUND the OUTSIDE of the reel rims — never cut straight
      // through them. The flanges sit at z = REEL_Z ± 1.25 with rim radius ≈2.3
      // (world +X rim edge ≈ REEL_X+2.3). So the rod first swings OUT past the rim
      // radius in +X (clearing the flange circle), then curves FORWARD (+Z) around
      // the front rim edge, and only then comes IN to the front-corner guide head.
      const RIM_CLEAR_X = REEL_X + COIL_MAX_OUTER_R + 0.9;  // out past the rim (world ≈ 7.95)
      rodPoints.push(new THREE.Vector3(REEL_X + Math.max(0.15, r - 0.1), REEL_CENTER_Y, REEL_Z));   // emerge from coil surface
      rodPoints.push(new THREE.Vector3(REEL_X + r + 0.2, REEL_CENTER_Y + 0.05, REEL_Z));            // just off the coil surface
      rodPoints.push(new THREE.Vector3(RIM_CLEAR_X, REEL_CENTER_Y, REEL_Z + 0.4));                  // swing OUT past the rim radius
      rodPoints.push(new THREE.Vector3(RIM_CLEAR_X, GUIDE_HEAD.y, REEL_Z + 1.8));                   // curve FORWARD around the front rim
      rodPoints.push(new THREE.Vector3((RIM_CLEAR_X + GUIDE_HEAD.x) / 2, GUIDE_HEAD.y, GUIDE_HEAD.z)); // come IN toward the head, clear of the rim
      rodPoints.push(new THREE.Vector3(GUIDE_HEAD.x, GUIDE_HEAD.y, GUIDE_HEAD.z));                  // through the guide head
      for (let i = 0; i <= ARC_SAMPLES; i++) {
        rodPoints.push(guideCurve.getPoint(i / ARC_SAMPLES));
      }
      rodPoints.push(new THREE.Vector3(WELL_X, INJECTOR_TOP_Y, 0));   // into injector head centre
      rodPoints.push(new THREE.Vector3(WELL_X, INJECTOR_BASE_Y, 0));  // through the injector
      rodPoints.push(new THREE.Vector3(WELL_X, BOP_TOP_Y - 2.0, 0));  // through the BOP
      rodPoints.push(new THREE.Vector3(WELL_X, 0.0, 0));              // into the wellhead
      const rodCurve = new THREE.CatmullRomCurve3(rodPoints);
      return new THREE.TubeGeometry(rodCurve, 96, 0.045, 16, false);
    };

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

    // Thin CoRod string (â‰ˆ1" continuous rod). Built at FULL fill initially; the
    // render loop rebuilds it as the reel pays off so the connection point tracks
    // the shrinking coil.
    const rodMesh = new THREE.Mesh(buildRodStrandGeometry(1), rodMat);
    rodMesh.castShadow = true;
    // Expose the builder so the render loop can regenerate the strand on fill change.
    (rodMesh as THREE.Mesh & { userData: { buildRodStrandGeometry: (f: number) => THREE.TubeGeometry } })
      .userData.buildRodStrandGeometry = buildRodStrandGeometry;
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
