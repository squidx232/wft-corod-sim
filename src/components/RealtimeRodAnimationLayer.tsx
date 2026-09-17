import React, { useEffect, useRef, useState, useId } from 'react';
import { SimulatorState } from '../types';
import {
  ArrowDown,
  ArrowUp,
  Maximize2,
  Minimize2,
  ZoomIn,
  Flame,
  ShieldAlert,
  Disc,
  Layers,
  RotateCw,
  RotateCcw,
  Zap,
} from 'lucide-react';

interface RealtimeRodAnimationLayerProps {
  state: SimulatorState;
  className?: string;
  viewMode?: 'full' | 'gripper' | 'reel';
  onViewModeChange?: (mode: 'full' | 'gripper' | 'reel') => void;
  interactive?: boolean;
}

interface SparkParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
}

export const RealtimeRodAnimationLayer: React.FC<RealtimeRodAnimationLayerProps> = ({
  state,
  className = '',
  viewMode: controlledViewMode,
  onViewModeChange,
  interactive = true,
}) => {
  const [internalViewMode, setInternalViewMode] = useState<'full' | 'gripper' | 'reel'>('full');
  const viewMode = controlledViewMode || internalViewMode;

  const handleSetViewMode = (mode: 'full' | 'gripper' | 'reel') => {
    if (onViewModeChange) {
      onViewModeChange(mode);
    } else {
      setInternalViewMode(mode);
    }
  };

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const { rod, hydraulics, bop } = state;

  // Real-time animation physics accumulators
  const animRef = useRef({
    reelAngle: 0,
    rodLinearOffset: 0,
    chainOffset: 0,
    lastTimestamp: 0,
    sparks: [] as SparkParticle[],
    fps: 60,
    frameCount: 0,
    fpsTimer: 0,
  });

  const isTripping = Math.abs(rod.rodSpeedFtPerMin) > 0.3;
  const isSurfacing = rod.rodSpeedFtPerMin > 0.3;
  const isInjecting = rod.rodSpeedFtPerMin < -0.3;
  const isSlipping = rod.rodGripSlipping;
  const isSafetyEngaged = hydraulics.safetyClampLever === 'ON';
  const reelRpm = Math.abs(Math.round((rod.rodSpeedFtPerMin / 15) * 10) / 10);

  // Depth fraction for spool thickness
  const depthFraction = Math.min(Math.max(rod.currentDepthFt / (rod.totalWellDepthFt || 5000), 0), 1);
  // Reel drum coil radius: decreases as rod goes downhole
  const reelCoilThickness = Math.max(12, 48 * (1 - depthFraction * 0.75));

  // Canvas 60fps rendering engine
  useEffect(() => {
    let animationFrameId: number;

    const render = (timestamp: number) => {
      const anim = animRef.current;
      if (!anim.lastTimestamp) anim.lastTimestamp = timestamp;
      const dt = Math.min((timestamp - anim.lastTimestamp) / 1000, 0.1);
      anim.lastTimestamp = timestamp;

      // FPS tracking
      anim.frameCount++;
      if (timestamp - anim.fpsTimer >= 1000) {
        anim.fps = anim.frameCount;
        anim.frameCount = 0;
        anim.fpsTimer = timestamp;
      }

      // Physics rate: 1 ft/min = 28 deg/sec reel rotation & 45 px/sec rod travel
      const speed = rod.rodSpeedFtPerMin;
      if (Math.abs(speed) > 0.05) {
        // Reel rotation (Surfacing = Reel winds in clockwise; Injecting = Reel unwinds counter-clockwise)
        anim.reelAngle = (anim.reelAngle - speed * dt * 28) % 360;
        // Continuous rod translation offset along guide path
        anim.rodLinearOffset = (anim.rodLinearOffset + speed * dt * 45) % 10000;
        // Gripper chain link cycle offset (40px pitch)
        anim.chainOffset = (anim.chainOffset + speed * dt * 35) % 40;
      }

      // Slippage spark simulation
      if (isSlipping && Math.abs(speed) > 0.2) {
        for (let i = 0; i < 3; i++) {
          anim.sparks.push({
            x: 0,
            y: 0,
            vx: (Math.random() - 0.5) * 120 + (speed > 0 ? -30 : 30),
            vy: (Math.random() - 0.7) * 90,
            life: 1.0,
            maxLife: 0.3 + Math.random() * 0.4,
            size: 1.5 + Math.random() * 2.5,
            color: Math.random() > 0.3 ? '#facc15' : '#ef4444',
          });
        }
      }

      // Update sparks
      for (let i = anim.sparks.length - 1; i >= 0; i--) {
        const p = anim.sparks[i];
        p.life -= dt / p.maxLife;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 150 * dt; // gravity
        if (p.life <= 0) {
          anim.sparks.splice(i, 1);
        }
      }

      // Draw onto canvas
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          drawScene(ctx, canvas.width, canvas.height, anim, viewMode);
        }
      }

      animationFrameId = requestAnimationFrame(render);
    };

    animationFrameId = requestAnimationFrame(render);
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [rod.rodSpeedFtPerMin, rod.currentDepthFt, rod.totalWellDepthFt, isSlipping, viewMode, hydraulics, bop]);

  // Main Canvas Render Routine
  const drawScene = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    anim: typeof animRef.current,
    mode: 'full' | 'gripper' | 'reel'
  ) => {
    ctx.clearRect(0, 0, w, h);

    // Save state
    ctx.save();

    if (mode === 'full') {
      drawFullSightline(ctx, w, h, anim);
    } else if (mode === 'gripper') {
      drawGripperMacro(ctx, w, h, anim);
    } else if (mode === 'reel') {
      drawReelMacro(ctx, w, h, anim);
    }

    ctx.restore();
  };

  // 1. FULL CAB SIGHTLINE VIEW
  const drawFullSightline = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    anim: typeof animRef.current
  ) => {
    const scale = Math.min(w / 800, h / 360);
    ctx.scale(scale, scale);

    // Dark industrial sky & ground
    ctx.fillStyle = '#060a14';
    ctx.fillRect(0, 0, 800, 360);

    // Grid Floor
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    for (let x = 0; x < 800; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, 310);
      ctx.lineTo(x + 20, 360);
      ctx.stroke();
    }
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 310, 800, 50);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 310);
    ctx.lineTo(800, 310);
    ctx.stroke();

    // =========================================================================
    // OVERHEAD GUIDE ARCH (#7 Swivel Apex & Curved Continuous Rod)
    // =========================================================================
    const archStartX = 620;
    const archStartY = 190;
    const archApexX = 420;
    const archApexY = 35;
    const archEndX = 230;
    const archEndY = 120;

    // Outer Heavy Guide Tube
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 22;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(archStartX, archStartY);
    ctx.bezierCurveTo(600, 45, 270, 45, archEndX, archEndY);
    ctx.stroke();

    // Weatherford Blue High-Strength Arch Truss
    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(archStartX, archStartY);
    ctx.bezierCurveTo(600, 45, 270, 45, archEndX, archEndY);
    ctx.stroke();

    // Inner Arch Channel
    ctx.strokeStyle = '#082f49';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(archStartX, archStartY);
    ctx.bezierCurveTo(600, 45, 270, 45, archEndX, archEndY);
    ctx.stroke();

    // Swivel Apex Marker (#7 Swivel)
    ctx.fillStyle = '#f59e0b';
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(archApexX, archApexY + 12, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px monospace';
    ctx.fillText('SWIVEL #7', archApexX - 24, archApexY - 4);

    // =========================================================================
    // DYNAMIC CONTINUOUS ROD GLIDING ALONG ARCH SPLINE
    // =========================================================================
    ctx.save();
    ctx.strokeStyle = isSlipping ? '#ef4444' : '#10b981';
    ctx.lineWidth = 5;
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -anim.rodLinearOffset;
    ctx.beginPath();
    ctx.moveTo(archStartX, archStartY);
    ctx.bezierCurveTo(600, 45, 270, 45, archEndX, archEndY);
    ctx.stroke();

    // Secondary metallic high-gloss highlight
    ctx.strokeStyle = isSlipping ? '#fca5a5' : '#6ee7b7';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 20]);
    ctx.lineDashOffset = -anim.rodLinearOffset * (isSurfacing ? 1 : -1);
    ctx.beginPath();
    ctx.moveTo(archStartX, archStartY);
    ctx.bezierCurveTo(600, 45, 270, 45, archEndX, archEndY);
    ctx.stroke();
    ctx.restore();

    // =========================================================================
    // SERVICE REEL ASSEMBLY (RIGHT SIDE: x=580, y=140)
    // =========================================================================
    const reelCenterX = 620;
    const reelCenterY = 190;
    const reelBaseRadius = 75;

    // Reel A-Frame Mount Stand
    ctx.fillStyle = '#0f172a';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(reelCenterX - 50, 310);
    ctx.lineTo(reelCenterX, reelCenterY);
    ctx.lineTo(reelCenterX + 50, 310);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Outer Flange Rim
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(reelCenterX, reelCenterY, reelBaseRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Multi-layered Continuous Rod Coils (Dynamically sized by well depth)
    const coilInnerR = 26;
    const coilOuterR = coilInnerR + reelCoilThickness;
    const coilGradient = ctx.createRadialGradient(
      reelCenterX,
      reelCenterY,
      coilInnerR,
      reelCenterX,
      reelCenterY,
      coilOuterR
    );
    coilGradient.addColorStop(0, '#064e3b');
    coilGradient.addColorStop(0.5, isSlipping ? '#991b1b' : '#059669');
    coilGradient.addColorStop(1, isSlipping ? '#dc2626' : '#10b981');

    ctx.fillStyle = coilGradient;
    ctx.beginPath();
    ctx.arc(reelCenterX, reelCenterY, coilOuterR, 0, Math.PI * 2);
    ctx.arc(reelCenterX, reelCenterY, coilInnerR, 0, Math.PI * 2, true);
    ctx.fill();

    // Rotating Coiled Bands & Spokes (Canvas Rotation around Reel Center)
    ctx.save();
    ctx.translate(reelCenterX, reelCenterY);
    ctx.rotate((anim.reelAngle * Math.PI) / 180);

    // Coiled Rod Texture lines
    ctx.strokeStyle = '#022c22';
    ctx.lineWidth = 2;
    for (let r = coilInnerR + 6; r < coilOuterR; r += 7) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Steel Spokes (8 heavy beams)
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 3;
    for (let i = 0; i < 8; i++) {
      const ang = (i * 45 * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang) * (reelBaseRadius - 2), Math.sin(ang) * (reelBaseRadius - 2));
      ctx.stroke();

      // Rim Drive Lug Bolts
      ctx.fillStyle = '#f8fafc';
      ctx.beginPath();
      ctx.arc(
        Math.cos(ang) * (reelBaseRadius - 10),
        Math.sin(ang) * (reelBaseRadius - 10),
        3,
        0,
        Math.PI * 2
      );
      ctx.fill();
    }

    // Hub Core
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#eab308';
    ctx.beginPath();
    ctx.arc(0, -8, 3.5, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Reel Safety Fork Lock
    if (rod.reelSafetyForksInPlace) {
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 2;
      ctx.fillRect(reelCenterX - 35, reelCenterY - 60, 70, 18);
      ctx.strokeRect(reelCenterX - 35, reelCenterY - 60, 70, 18);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px monospace';
      ctx.fillText('FORK LOCKED', reelCenterX - 28, reelCenterY - 48);
    }

    // Dynamic Reel Rotation Vector & RPM
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 9px monospace';
    ctx.fillText(
      `REEL: ${reelRpm} RPM ${isSurfacing ? '↻ WIND' : isInjecting ? '↺ FEED' : 'STATIC'}`,
      reelCenterX - 55,
      reelCenterY + 95
    );

    // =========================================================================
    // INJECTOR GRIPPER STACK & WELLHEAD (LEFT-CENTER: x=170, y=90)
    // =========================================================================
    const injX = 170;
    const injY = 90;

    // Injector Blue Outer Frame
    ctx.fillStyle = '#1e3a8a';
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 3;
    ctx.fillRect(injX, injY, 120, 100);
    ctx.strokeRect(injX, injY, 120, 100);

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(injX + 8, injY + 6, 104, 14);
    ctx.fillStyle = '#60a5fa';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('WEATHERFORD GRIPPER', injX + 12, injY + 16);

    // Dual Sprockets & Cycling Chains
    const chainLeftX = injX + 22;
    const chainRightX = injX + 80;
    const rodPathX = injX + 60;

    // Squeeze Beam Hydraulic Clamping (Clamps squeeze toward center based on pressure)
    const squeezeOffset = hydraulics.squeezePressureSwitch ? 5 : 0;

    // Left Sprocket & Chain
    drawMiniChain(ctx, chainLeftX + squeezeOffset, injY + 28, 16, 62, anim.chainOffset);
    // Right Sprocket & Chain
    drawMiniChain(ctx, chainRightX - squeezeOffset, injY + 28, 16, 62, anim.chainOffset);

    // Squeeze Cylinders Indicator
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(chainLeftX + squeezeOffset - 4, injY + 45, 4, 25);
    ctx.fillRect(chainRightX - squeezeOffset + 16, injY + 45, 4, 25);

    // Continuous Rod Traveling Vertically Down Injector into Wellhead
    ctx.save();
    ctx.strokeStyle = isSlipping ? '#ef4444' : '#10b981';
    ctx.lineWidth = 5;
    ctx.setLineDash([14, 10]);
    ctx.lineDashOffset = -anim.rodLinearOffset;
    ctx.beginPath();
    ctx.moveTo(rodPathX, archEndY);
    ctx.lineTo(rodPathX, 310);
    ctx.stroke();

    // Rod metallic highlight
    ctx.strokeStyle = isSlipping ? '#fca5a5' : '#6ee7b7';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(rodPathX, archEndY);
    ctx.lineTo(rodPathX, 310);
    ctx.stroke();
    ctx.restore();

    // Slippage Sparks in Injector
    if (isSlipping && anim.sparks.length > 0) {
      ctx.save();
      ctx.translate(rodPathX, injY + 60);
      for (const spark of anim.sparks) {
        ctx.fillStyle = spark.color;
        ctx.beginPath();
        ctx.arc(spark.x * 0.4, spark.y * 0.4, spark.size * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // Mechanical Safety Clamp Lever #4
    ctx.fillStyle = isSafetyEngaged ? '#7f1d1d' : '#1e293b';
    ctx.strokeStyle = isSafetyEngaged ? '#ef4444' : '#64748b';
    ctx.lineWidth = 2.5;
    ctx.fillRect(injX + 10, injY + 104, 100, 22);
    ctx.strokeRect(injX + 10, injY + 104, 100, 22);
    ctx.fillStyle = isSafetyEngaged ? '#fca5a5' : '#ffffff';
    ctx.font = 'bold 8px monospace';
    ctx.fillText(
      isSafetyEngaged ? 'ROD SAFETY CLAMP: ON' : 'ROD SAFETY CLAMP: OPEN',
      injX + 14,
      injY + 118
    );

    // Regan BOP Stack & Wellhead Flange
    ctx.fillStyle = bop.reganBopClosed ? '#991b1b' : '#1e293b';
    ctx.strokeStyle = bop.reganBopClosed ? '#ef4444' : '#475569';
    ctx.lineWidth = 2.5;
    ctx.fillRect(injX + 15, injY + 130, 90, 26);
    ctx.strokeRect(injX + 15, injY + 130, 90, 26);
    ctx.fillStyle = bop.reganBopClosed ? '#fca5a5' : '#cbd5e1';
    ctx.font = 'bold 8px monospace';
    ctx.fillText(
      bop.reganBopClosed ? 'REGAN BOP: CLOSED' : 'REGAN BOP: OPEN',
      injX + 22,
      injY + 146
    );

    // Casing Flange / Ground Entry
    ctx.fillStyle = '#334155';
    ctx.fillRect(injX + 25, injY + 160, 70, 30);
    ctx.strokeStyle = '#020617';
    ctx.strokeRect(injX + 25, injY + 160, 70, 30);

    // Mechanical Clamps Attached
    if (rod.mechanicalClampsInstalled >= 1) {
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 1.5;
      ctx.fillRect(injX + 12, injY + 96, 96, 8);
      ctx.strokeRect(injX + 12, injY + 96, 96, 8);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 6.5px monospace';
      ctx.fillText('MECH CLAMP #1 (550 FT-LBS)', injX + 18, injY + 102);
    }
    if (rod.mechanicalClampsInstalled >= 2) {
      ctx.fillStyle = '#dc2626';
      ctx.strokeStyle = '#f87171';
      ctx.lineWidth = 1.5;
      ctx.fillRect(injX + 12, injY + 86, 96, 8);
      ctx.strokeRect(injX + 12, injY + 86, 96, 8);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 6.5px monospace';
      ctx.fillText('MECH CLAMP #2 (STACKED)', injX + 22, injY + 92);
    }
  };

  // Helper to draw miniature chain tracks
  const drawMiniChain = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    offset: number
  ) => {
    ctx.fillStyle = '#020617';
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 1.5;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    // Sprocket circles top and bottom
    ctx.fillStyle = '#334155';
    ctx.beginPath();
    ctx.arc(x + w / 2, y + 8, 6, 0, Math.PI * 2);
    ctx.arc(x + w / 2, y + h - 8, 6, 0, Math.PI * 2);
    ctx.fill();

    // Moving chain links
    ctx.fillStyle = '#64748b';
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 0.5;
    for (let i = 0; i < 7; i++) {
      const linkY = y + ((i * 10 + offset) % h);
      const safeY = linkY < y ? linkY + h : linkY;
      ctx.fillRect(x + 2, safeY, w - 4, 4);
      ctx.strokeRect(x + 2, safeY, w - 4, 4);
    }
  };

  // 2. MACRO CLOSE-UP VIEW: INJECTOR GRIPPER & ROD FRICTION DYNAMICS
  const drawGripperMacro = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    anim: typeof animRef.current
  ) => {
    const scale = Math.min(w / 800, h / 360);
    ctx.scale(scale, scale);

    ctx.fillStyle = '#050913';
    ctx.fillRect(0, 0, 800, 360);

    const centerX = 400;
    const centerY = 180;

    // Header Title
    ctx.fillStyle = '#93c5fd';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('WEATHERFORD INJECTOR DRIVE HEAD — DETAIL VIEW', 30, 32);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText(
      `SQUEEZE HYDRAULICS: ${Math.round(hydraulics.squeezePressure)} PSI | REQUIRED: ~${Math.round(
        rod.calculatedSqueezeRequiredPsi
      )} PSI | SPEED: ${Math.round(rod.rodSpeedFtPerMin)} FT/MIN`,
      30,
      48
    );

    // Left Gripper Block & Track (Squeeze displacement)
    const squeezeOffset = hydraulics.squeezePressureSwitch
      ? Math.min(18, (hydraulics.squeezePressure / 2000) * 18)
      : 0;

    const leftTrackX = centerX - 140 + squeezeOffset;
    const rightTrackX = centerX + 60 - squeezeOffset;

    // Dual Massive Sprockets (Left Side)
    drawMacroSprocket(ctx, leftTrackX + 35, 90, 32, anim.chainOffset * 4);
    drawMacroSprocket(ctx, leftTrackX + 35, 270, 32, anim.chainOffset * 4);

    // Dual Massive Sprockets (Right Side)
    drawMacroSprocket(ctx, rightTrackX + 35, 90, 32, -anim.chainOffset * 4);
    drawMacroSprocket(ctx, rightTrackX + 35, 270, 32, -anim.chainOffset * 4);

    // Chain links & Carbide Die Blocks (Left)
    drawMacroChainLinks(ctx, leftTrackX, 80, 70, 200, anim.chainOffset, 'left');
    // Chain links & Carbide Die Blocks (Right)
    drawMacroChainLinks(ctx, rightTrackX, 80, 70, 200, anim.chainOffset, 'right');

    // Squeeze Hydraulic Force Vectors
    if (hydraulics.squeezePressureSwitch) {
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 4;
      // Left arrow ->
      drawArrow(ctx, leftTrackX - 45, centerY, leftTrackX - 5, centerY);
      // Right arrow <-
      drawArrow(ctx, rightTrackX + 115, centerY, rightTrackX + 75, centerY);

      ctx.fillStyle = '#fca5a5';
      ctx.font = 'bold 9px monospace';
      ctx.fillText(`${Math.round(hydraulics.squeezePressure)} PSI`, leftTrackX - 60, centerY - 10);
      ctx.fillText(`${Math.round(hydraulics.squeezePressure)} PSI`, rightTrackX + 80, centerY - 10);
    }

    // Continuous Rod Running Down Center (1.00" to 1.50" COROD)
    const rodWidth = 24;
    const rodX = centerX - rodWidth / 2;

    const rodGradient = ctx.createLinearGradient(rodX, 0, rodX + rodWidth, 0);
    if (isSlipping) {
      rodGradient.addColorStop(0, '#7f1d1d');
      rodGradient.addColorStop(0.5, '#f87171');
      rodGradient.addColorStop(1, '#7f1d1d');
    } else {
      rodGradient.addColorStop(0, '#064e3b');
      rodGradient.addColorStop(0.5, '#34d399');
      rodGradient.addColorStop(1, '#064e3b');
    }

    ctx.fillStyle = rodGradient;
    ctx.fillRect(rodX, 40, rodWidth, 290);
    ctx.strokeStyle = '#022c22';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rodX, 40, rodWidth, 290);

    // Surface Striations / Notches on Rod (Moving with trip speed)
    ctx.save();
    ctx.strokeStyle = isSlipping ? '#fee2e2' : '#a7f3d0';
    ctx.lineWidth = 2;
    for (let y = 40; y < 330; y += 18) {
      const notchY = 40 + ((y - 40 + anim.rodLinearOffset) % 290);
      ctx.beginPath();
      ctx.moveTo(rodX + 2, notchY);
      ctx.lineTo(rodX + rodWidth - 2, notchY);
      ctx.stroke();
    }
    ctx.restore();

    // Slippage Sparks & Heat Glow
    if (isSlipping) {
      // Red glow overlay on contact zones
      ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
      ctx.fillRect(rodX - 6, 90, rodWidth + 12, 180);

      // Render sparks
      ctx.save();
      ctx.translate(centerX, centerY);
      for (const spark of anim.sparks) {
        ctx.fillStyle = spark.color;
        ctx.beginPath();
        ctx.arc(spark.x, spark.y, spark.size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // Slippage Warning Banner
      ctx.fillStyle = '#dc2626';
      ctx.fillRect(centerX - 130, 315, 260, 24);
      ctx.strokeStyle = '#fca5a5';
      ctx.strokeRect(centerX - 130, 315, 260, 24);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px monospace';
      ctx.fillText('WARNING: FRICTION GRIP SLIPPAGE!', centerX - 110, 331);
    }
  };

  // Helper for Macro Sprocket
  const drawMacroSprocket = (
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
    angleDeg: number
  ) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((angleDeg * Math.PI) / 180);

    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#64748b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Sprocket Teeth (12 teeth)
    ctx.fillStyle = '#94a3b8';
    for (let i = 0; i < 12; i++) {
      const ang = (i * 30 * Math.PI) / 180;
      ctx.save();
      ctx.rotate(ang);
      ctx.fillRect(-4, -r - 8, 8, 10);
      ctx.restore();
    }

    // Hub
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  };

  // Helper for Macro Chain Links
  const drawMacroChainLinks = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    offset: number,
    side: 'left' | 'right'
  ) => {
    ctx.fillStyle = '#090d16';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    const linkCount = 8;
    const linkHeight = h / linkCount;

    for (let i = 0; i < linkCount; i++) {
      const linkY = y + ((i * linkHeight + offset * 2) % h);
      const safeY = linkY < y ? linkY + h : linkY;

      // Heavy steel carrier block
      ctx.fillStyle = '#1e293b';
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 1.5;
      ctx.fillRect(x + 4, safeY, w - 8, linkHeight - 4);
      ctx.strokeRect(x + 4, safeY, w - 8, linkHeight - 4);

      // Tungsten Carbide Gripper Die Inserts (Teeth biting facing the rod)
      ctx.fillStyle = '#f59e0b';
      const dieX = side === 'left' ? x + w - 10 : x + 2;
      ctx.fillRect(dieX, safeY + 3, 8, linkHeight - 10);

      // Machined Serrations on die
      ctx.fillStyle = '#000000';
      for (let s = 0; s < 3; s++) {
        ctx.fillRect(dieX + 1, safeY + 5 + s * 4, 6, 1.5);
      }
    }
  };

  // Helper arrow
  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    const headLen = 8;
    const angle = Math.atan2(toY - fromY, toX - fromX);
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  };

  // 3. MACRO CLOSE-UP VIEW: SERVICE REEL WINDER & SPOOLING DYNAMICS
  const drawReelMacro = (
    ctx: CanvasRenderingContext2D,
    w: number,
    h: number,
    anim: typeof animRef.current
  ) => {
    const scale = Math.min(w / 800, h / 360);
    ctx.scale(scale, scale);

    ctx.fillStyle = '#050913';
    ctx.fillRect(0, 0, 800, 360);

    const centerX = 380;
    const centerY = 180;
    const maxRadius = 140;

    // Header
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 13px monospace';
    ctx.fillText('WEATHERFORD CONTINUOUS COIL SERVICE REEL — HIGH RESOLUTION WINDER', 30, 32);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText(
      `DEPTH: ${Math.round(rod.currentDepthFt)} FT | REEL VELOCITY: ${reelRpm} RPM | COIL CAPACITY: ~5,000 FT COROD`,
      30,
      48
    );

    // Spool Drum Rim
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(centerX, centerY, maxRadius, 0, Math.PI * 2);
    ctx.stroke();

    // Concentric Rod Windings
    const drumCoreRadius = 45;
    const currentCoilRadius = drumCoreRadius + (maxRadius - drumCoreRadius) * (1 - depthFraction * 0.7);

    // Coiled Rod Radial Fill
    const coilGrad = ctx.createRadialGradient(
      centerX,
      centerY,
      drumCoreRadius,
      centerX,
      centerY,
      currentCoilRadius
    );
    coilGrad.addColorStop(0, '#064e3b');
    coilGrad.addColorStop(0.6, isSlipping ? '#b91c1c' : '#059669');
    coilGrad.addColorStop(1, isSlipping ? '#ef4444' : '#10b981');

    ctx.fillStyle = coilGrad;
    ctx.beginPath();
    ctx.arc(centerX, centerY, currentCoilRadius, 0, Math.PI * 2);
    ctx.arc(centerX, centerY, drumCoreRadius, 0, Math.PI * 2, true);
    ctx.fill();

    // Rotating Spokes and Lug Bolts
    ctx.save();
    ctx.translate(centerX, centerY);
    ctx.rotate((anim.reelAngle * Math.PI) / 180);

    // Concentric wind ridges
    ctx.strokeStyle = '#022c22';
    ctx.lineWidth = 3;
    for (let r = drumCoreRadius + 10; r < currentCoilRadius; r += 12) {
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Heavy Spokes
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 5;
    for (let i = 0; i < 8; i++) {
      const ang = (i * 45 * Math.PI) / 180;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(ang) * (maxRadius - 5), Math.sin(ang) * (maxRadius - 5));
      ctx.stroke();

      // Rim bolt
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(Math.cos(ang) * (maxRadius - 16), Math.sin(ang) * (maxRadius - 16), 5, 0, Math.PI * 2);
      ctx.fill();
    }

    // Massive Steel Hub Core
    ctx.fillStyle = '#1e293b';
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(0, 0, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Hydraulic Drive Shaft Coupling
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(0, 0, 16, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();

    // Live Unspooling Rod Tangent Line leading up to Guide Arch
    ctx.save();
    ctx.strokeStyle = isSlipping ? '#ef4444' : '#10b981';
    ctx.lineWidth = 8;
    ctx.setLineDash([18, 12]);
    ctx.lineDashOffset = -anim.rodLinearOffset;
    ctx.beginPath();
    ctx.moveTo(centerX - currentCoilRadius * 0.8, centerY - currentCoilRadius * 0.6);
    ctx.lineTo(120, 60);
    ctx.stroke();
    ctx.restore();

    // Level-Wind Guide Roller Indicator
    ctx.fillStyle = '#eab308';
    ctx.strokeStyle = '#713f12';
    ctx.lineWidth = 2;
    ctx.fillRect(centerX - currentCoilRadius * 0.85 - 15, centerY - currentCoilRadius * 0.6 - 15, 30, 30);
    ctx.strokeRect(centerX - currentCoilRadius * 0.85 - 15, centerY - currentCoilRadius * 0.6 - 15, 30, 30);
    ctx.fillStyle = '#000000';
    ctx.font = 'bold 8px monospace';
    ctx.fillText('GUIDE', centerX - currentCoilRadius * 0.85 - 12, centerY - currentCoilRadius * 0.6 + 3);

    // Spool Volume & Telemetry Card (Right Side)
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    ctx.fillRect(570, 75, 200, 240);
    ctx.strokeRect(570, 75, 200, 240);

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px monospace';
    ctx.fillText('REEL TELEMETRY', 585, 98);

    ctx.fillStyle = '#94a3b8';
    ctx.font = '10px monospace';
    ctx.fillText(`Drive Motor: HAGGLUNDS`, 585, 125);
    ctx.fillText(`Angular Vel: ${reelRpm} RPM`, 585, 145);
    ctx.fillText(`Coil Layers: ${Math.round(currentCoilRadius - drumCoreRadius)} px`, 585, 165);
    ctx.fillText(`Fork Lock: ${rod.reelSafetyForksInPlace ? 'ENGAGED' : 'OFF'}`, 585, 185);
    ctx.fillText(`Well Depth: ${Math.round(rod.currentDepthFt)} FT`, 585, 205);
    ctx.fillText(`Max Capacity: ${rod.totalWellDepthFt} FT`, 585, 225);

    // Directional Rotation Pill
    ctx.fillStyle = isSurfacing ? '#065f46' : isInjecting ? '#1e40af' : '#334155';
    ctx.fillRect(585, 245, 170, 26);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.fillText(
      isSurfacing ? '↻ SPOOLING IN (UP)' : isInjecting ? '↺ FEEDING OUT (DOWN)' : '■ STANDBY',
      595,
      262
    );
  };

  const hudId = useId();

  return (
    <div className={`relative rounded-2xl bg-slate-950 border border-slate-800 overflow-hidden select-none flex flex-col ${className}`}>
      {/* Sightline Telemetry Header */}
      <div className="bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex flex-wrap items-center justify-between gap-2 z-10">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
            Rod Feed &amp; Reel Dynamics
          </span>
          <span className="px-2 py-0.5 text-[9px] font-mono font-semibold rounded bg-slate-800 text-slate-300 border border-slate-700">
            LIVE TELEMETRY
          </span>
        </div>

        {/* View Mode Switching Tabs (Full Sightline, Gripper Detail, Spool Reel) */}
        {interactive && (
          <div className="flex items-center gap-1 bg-black/60 p-1 rounded-xl border border-slate-800">
            <button
              id={`tab-view-full-${hudId}`}
              type="button"
              onClick={() => handleSetViewMode('full')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'full'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Maximize2 className="w-3 h-3" />
              <span>Sightline</span>
            </button>

            <button
              id={`tab-view-gripper-${hudId}`}
              type="button"
              onClick={() => handleSetViewMode('gripper')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'gripper'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ZoomIn className="w-3 h-3" />
              <span>Injector Head</span>
            </button>

            <button
              id={`tab-view-reel-${hudId}`}
              type="button"
              onClick={() => handleSetViewMode('reel')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                viewMode === 'reel'
                  ? 'bg-slate-700 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <RotateCw className="w-3 h-3" />
              <span>Transport Reel</span>
            </button>
          </div>
        )}

        {/* Real-time Status Badge */}
        <div
          className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold flex items-center gap-1.5 border transition-colors ${
            isSlipping
              ? 'bg-red-950 text-red-300 border-red-500'
              : isSurfacing
              ? 'bg-emerald-950 text-emerald-300 border-emerald-700'
              : isInjecting
              ? 'bg-blue-950 text-blue-300 border-blue-700'
              : 'bg-slate-900 text-slate-400 border-slate-700'
          }`}
        >
          {isSlipping ? (
            <>
              <ShieldAlert className="w-4 h-4 text-red-400" />
              <span>ROD SLIP DETECTED</span>
            </>
          ) : isSurfacing ? (
            <>
              <ArrowUp className="w-4 h-4 text-emerald-400" />
              <span>PULLING: {Math.abs(Math.round(rod.rodSpeedFtPerMin))} FT/MIN ({reelRpm} RPM)</span>
            </>
          ) : isInjecting ? (
            <>
              <ArrowDown className="w-4 h-4 text-blue-400" />
              <span>FEEDING: {Math.abs(Math.round(rod.rodSpeedFtPerMin))} FT/MIN ({reelRpm} RPM)</span>
            </>
          ) : (
            <span>STATIONARY (0 FT/MIN)</span>
          )}
        </div>
      </div>

      {/* Main HTML5 Canvas Container */}
      <div className="relative w-full h-[300px] sm:h-[340px] bg-slate-950 overflow-hidden flex items-center justify-center">
        <canvas
          ref={canvasRef}
          width={800}
          height={360}
          className="w-full h-full object-contain"
        />

        {/* Telemetry Overlay */}
        <div className="absolute top-2 left-3 right-3 flex items-center justify-between pointer-events-none z-10 text-[11px] font-mono">
          <div className="flex items-center gap-2 bg-slate-950/90 px-3 py-1.5 rounded-lg border border-slate-800 shadow-sm">
            <span className="text-slate-400">DEPTH:</span>
            <span className="font-bold text-emerald-400">{Math.round(rod.currentDepthFt)} FT</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">SQUEEZE:</span>
            <span
              className={`font-bold ${
                hydraulics.squeezePressure < rod.calculatedSqueezeRequiredPsi
                  ? 'text-red-400'
                  : 'text-cyan-400'
              }`}
            >
              {Math.round(hydraulics.squeezePressure)} PSI
            </span>
          </div>

          <div className="flex items-center gap-2 bg-slate-950/90 px-3 py-1.5 rounded-lg border border-slate-800 shadow-sm">
            <span className="text-slate-400">STRING LOAD:</span>
            <span className="font-bold text-slate-200">{Math.round(rod.totalStringWeightLbs)} LBS</span>
            <span className="text-slate-600">|</span>
            <span className="text-slate-400">PUMP:</span>
            <span className="font-bold text-emerald-400">{hydraulics.engineRunning ? 'RUNNING' : 'OFF'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
