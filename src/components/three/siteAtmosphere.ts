import * as THREE from 'three';
import type { EnvironmentState, TimeOfDay, WeatherKind } from '../../types';

/**
 * Live site atmosphere: time-of-day lighting, sky, fog, rain/dust particles,
 * wind and lightning flashes. Everything eases toward the target look so an
 * instructor change (e.g. day → dusk, clear → dust storm) blends over a few
 * seconds instead of popping.
 *
 * Kept independent of the viewport component so other modules (e.g. a future
 * knuckle-crane trainer) can reuse the same environment rendering.
 */

export interface AtmosphereTargets {
  scene: THREE.Scene;
  renderer: THREE.WebGLRenderer;
  ambient: THREE.AmbientLight;
  sun: THREE.DirectionalLight;
  /** Sky dome shader with `topColor` / `bottomColor` uniforms. */
  sky?: THREE.ShaderMaterial;
  /** Lights that switch on at dusk/night (light towers, mast flood, console lamp). */
  workLights: Array<{ light: THREE.Light; onIntensity: number; dayIntensity?: number }>;
  /** Emissive lamp lenses that glow when the work lights are on. */
  lampMaterials: THREE.MeshStandardMaterial[];
  /** World-space point the sun orbits around and particles are spawned around. */
  center: THREE.Vector3;
}

export interface AtmosphereFrame {
  env: EnvironmentState;
  delta: number;
  /** Seconds. */
  time: number;
  /** Camera position: precipitation is spawned in a box around it. */
  cameraPosition: THREE.Vector3;
  /** Thunderstorm/lightning drill active → random sky flashes. */
  lightning?: boolean;
}

export interface SiteAtmosphere {
  update(frame: AtmosphereFrame): void;
  /** Unit vector the wind blows TOWARD (XZ plane) × speed in m/s. */
  readonly wind: THREE.Vector3;
  /** 0..1 current work-light level (0 = daylight, 1 = full night lighting). */
  readonly lightLevel: number;
  dispose(): void;
}

interface Look {
  skyTop: number; skyBottom: number; fog: number; fogDensity: number;
  ambient: number; ambientIntensity: number; sun: number; sunIntensity: number;
  /** Sun elevation (rad) and azimuth (rad, around +Y). */
  elevation: number; azimuth: number; exposure: number; lights: number;
}

const TIME_LOOKS: Record<TimeOfDay, Look> = {
  dawn: { skyTop: 0x4a6a9a, skyBottom: 0xf2b88a, fog: 0xd9b9a0, fogDensity: 0.0065, ambient: 0xffd9c0, ambientIntensity: 0.55, sun: 0xffb27a, sunIntensity: 0.9, elevation: 0.18, azimuth: 0.35, exposure: 1.15, lights: 0.55 },
  day: { skyTop: 0x3a78c8, skyBottom: 0xcfe0ef, fog: 0xbfd4e6, fogDensity: 0.0045, ambient: 0xffffff, ambientIntensity: 0.9, sun: 0xfffaed, sunIntensity: 1.45, elevation: 0.95, azimuth: 0.7, exposure: 1.25, lights: 0 },
  dusk: { skyTop: 0x2c3566, skyBottom: 0xe8875a, fog: 0xa07a70, fogDensity: 0.0075, ambient: 0xe0b0a0, ambientIntensity: 0.45, sun: 0xff8a4c, sunIntensity: 0.75, elevation: 0.12, azimuth: 2.6, exposure: 1.1, lights: 0.8 },
  night: { skyTop: 0x03060d, skyBottom: 0x0d1626, fog: 0x070b14, fogDensity: 0.012, ambient: 0x8090c0, ambientIntensity: 0.3, sun: 0x9fb4ff, sunIntensity: 0.18, elevation: 0.7, azimuth: 1.2, exposure: 1.05, lights: 1 },
};

/** Weather tint applied on top of the time-of-day look. */
const WEATHER_MODS: Record<WeatherKind, { tint: number; tintAmount: number; fogMul: number; sunMul: number; ambientMul: number }> = {
  clear: { tint: 0xffffff, tintAmount: 0, fogMul: 1, sunMul: 1, ambientMul: 1 },
  windy: { tint: 0xc8b496, tintAmount: 0.15, fogMul: 1.3, sunMul: 0.95, ambientMul: 1 },
  dust: { tint: 0xb08a5a, tintAmount: 0.7, fogMul: 4.2, sunMul: 0.55, ambientMul: 0.95 },
  rain: { tint: 0x5c6670, tintAmount: 0.6, fogMul: 2.4, sunMul: 0.3, ambientMul: 0.8 },
};

const MPH_TO_MS = 0.44704;
const RAIN_COUNT = 1800;
const DUST_COUNT = 1400;
const BOX = { half: 38, height: 26 };

/** Unit wind vector (XZ). `deg` = direction the wind blows toward, clockwise from +X seen from above. */
export function windDirectionVector(deg: number, out = new THREE.Vector3()): THREE.Vector3 {
  const r = THREE.MathUtils.degToRad(deg);
  return out.set(Math.cos(r), 0, Math.sin(r));
}

/** Target look for an environment (exported for tests / other trainers). */
export function resolveLook(env: EnvironmentState): Look & { rain: number; dust: number } {
  const base = TIME_LOOKS[env.timeOfDay] ?? TIME_LOOKS.day;
  const mod = WEATHER_MODS[env.weather] ?? WEATHER_MODS.clear;
  const tint = new THREE.Color(mod.tint);
  // Tint toward the weather colour, scaled to the base brightness so a rainy
  // night stays dark instead of turning grey.
  const hsl = { h: 0, s: 0, l: 0 };
  const mix = (hex: number) => {
    const c = new THREE.Color(hex);
    const lum = c.getHSL(hsl).l;
    return c.lerp(tint.clone().multiplyScalar(Math.min(1, lum * 1.4 + 0.05)), mod.tintAmount).getHex();
  };
  // Wind alone lifts some dust even in "clear"/"windy" weather.
  // Wet ground doesn't lift dust, so rain suppresses it.
  const windDust = env.weather === 'rain' ? 0 : THREE.MathUtils.clamp((env.windSpeedMph - 18) / 25, 0, 1) * 0.35;
  return {
    ...base,
    skyTop: mix(base.skyTop),
    skyBottom: mix(base.skyBottom),
    fog: mix(base.fog),
    fogDensity: base.fogDensity * mod.fogMul * (1 + windDust),
    sunIntensity: base.sunIntensity * mod.sunMul,
    ambientIntensity: base.ambientIntensity * mod.ambientMul,
    // Overcast weather needs work lights earlier.
    lights: Math.min(1, base.lights + (env.weather === 'dust' || env.weather === 'rain' ? 0.35 : 0)),
    rain: env.weather === 'rain' ? 1 : 0,
    dust: env.weather === 'dust' ? 1 : env.weather === 'windy' ? 0.3 + windDust : windDust,
  };
}

export function createSiteAtmosphere(t: AtmosphereTargets): SiteAtmosphere {
  const { scene, renderer, ambient, sun, sky, workLights, lampMaterials, center } = t;
  if (!(scene.fog instanceof THREE.FogExp2)) scene.fog = new THREE.FogExp2(0xbfd4e6, 0.0045);
  const fog = scene.fog as THREE.FogExp2;
  if (!(scene.background instanceof THREE.Color)) scene.background = new THREE.Color(0x9fc0dc);
  const background = scene.background as THREE.Color;
  const lampBase = lampMaterials.map((m) => m.emissiveIntensity);

  const cur = { ...resolveLook({ timeOfDay: 'day', weather: 'clear', windSpeedMph: 0, windDirectionDeg: 0 }) };
  const col = {
    skyTop: new THREE.Color(cur.skyTop), skyBottom: new THREE.Color(cur.skyBottom), fog: new THREE.Color(cur.fog),
    ambient: new THREE.Color(cur.ambient), sun: new THREE.Color(cur.sun),
  };
  const wind = new THREE.Vector3();
  const windTarget = new THREE.Vector3();
  const tmpColor = new THREE.Color();
  let lightLevel = 0;
  let flash = 0;
  let nextFlashAt = 2;

  // --- Rain: short line streaks, slanted by the wind -------------------------------
  const rainPos = new Float32Array(RAIN_COUNT * 6);
  const rainSeed = new Float32Array(RAIN_COUNT * 3);
  for (let i = 0; i < RAIN_COUNT; i++) {
    rainSeed[i * 3] = (Math.random() * 2 - 1) * BOX.half;
    rainSeed[i * 3 + 1] = Math.random() * BOX.height;
    rainSeed[i * 3 + 2] = (Math.random() * 2 - 1) * BOX.half;
  }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
  const rainMat = new THREE.LineBasicMaterial({ color: 0xaab8c8, transparent: true, opacity: 0, depthWrite: false });
  const rain = new THREE.LineSegments(rainGeo, rainMat);
  rain.frustumCulled = false;
  rain.visible = false;
  scene.add(rain);

  // --- Dust: soft drifting points ----------------------------------------------------
  const dustPos = new Float32Array(DUST_COUNT * 3);
  for (let i = 0; i < DUST_COUNT; i++) {
    dustPos[i * 3] = (Math.random() * 2 - 1) * BOX.half;
    dustPos[i * 3 + 1] = Math.pow(Math.random(), 2) * 9;
    dustPos[i * 3 + 2] = (Math.random() * 2 - 1) * BOX.half;
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({ color: 0xc7a878, size: 0.22, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.frustumCulled = false;
  dust.visible = false;
  scene.add(dust);

  const wrap = (v: number, half: number) => ((((v + half) % (2 * half)) + 2 * half) % (2 * half)) - half;

  const update = ({ env, delta, time, cameraPosition, lightning }: AtmosphereFrame) => {
    const target = resolveLook(env);
    const k = 1 - Math.exp(-delta * 1.2); // ~2.5 s blend
    const lerpNum = (key: 'fogDensity' | 'ambientIntensity' | 'sunIntensity' | 'elevation' | 'exposure' | 'lights' | 'rain' | 'dust') => {
      cur[key] += (target[key] - cur[key]) * k;
    };
    (['fogDensity', 'ambientIntensity', 'sunIntensity', 'elevation', 'exposure', 'lights', 'rain', 'dust'] as const).forEach(lerpNum);
    // Azimuth: take the short way around.
    const dAz = Math.atan2(Math.sin(target.azimuth - cur.azimuth), Math.cos(target.azimuth - cur.azimuth));
    cur.azimuth += dAz * k;
    col.skyTop.lerp(tmpColor.setHex(target.skyTop), k);
    col.skyBottom.lerp(tmpColor.setHex(target.skyBottom), k);
    col.fog.lerp(tmpColor.setHex(target.fog), k);
    col.ambient.lerp(tmpColor.setHex(target.ambient), k);
    col.sun.lerp(tmpColor.setHex(target.sun), k);

    // Wind (m/s vector) eases too, so gust changes feel physical.
    windDirectionVector(env.windDirectionDeg, windTarget).multiplyScalar(env.windSpeedMph * MPH_TO_MS);
    wind.lerp(windTarget, 1 - Math.exp(-delta * 0.8));

    // Lightning: occasional double-flash when the drill is active (or in rain with strong wind).
    const storm = lightning || (env.weather === 'rain' && env.windSpeedMph > 30);
    if (storm && time >= nextFlashAt) {
      flash = 1;
      nextFlashAt = time + 2.5 + Math.random() * 6;
    } else if (!storm) {
      nextFlashAt = Math.min(nextFlashAt, time + 1.5);
    }
    const flashLevel = flash > 0 ? flash * (0.6 + 0.4 * Math.abs(Math.sin(time * 90))) : 0;
    flash = Math.max(0, flash - delta * 4.5);

    // Lights & sky
    ambient.color.copy(col.ambient);
    ambient.intensity = cur.ambientIntensity + flashLevel * 1.8;
    sun.color.copy(col.sun);
    sun.intensity = cur.sunIntensity;
    const r = 55;
    sun.position.set(
      center.x + Math.cos(cur.azimuth) * Math.cos(cur.elevation) * r,
      center.y + Math.sin(cur.elevation) * r,
      center.z + Math.sin(cur.azimuth) * Math.cos(cur.elevation) * r,
    );
    sun.target.position.copy(center);
    sun.target.updateMatrixWorld();
    fog.color.copy(col.fog);
    fog.density = cur.fogDensity;
    background.copy(col.fog);
    if (sky) {
      (sky.uniforms.topColor.value as THREE.Color).copy(col.skyTop).lerp(tmpColor.setHex(0xdde6ff), flashLevel * 0.8);
      (sky.uniforms.bottomColor.value as THREE.Color).copy(col.skyBottom).lerp(tmpColor.setHex(0xdde6ff), flashLevel * 0.6);
    }
    renderer.toneMappingExposure = cur.exposure;

    lightLevel = THREE.MathUtils.clamp(cur.lights, 0, 1);
    for (const w of workLights) {
      w.light.intensity = THREE.MathUtils.lerp(w.dayIntensity ?? 0, w.onIntensity, lightLevel);
      w.light.visible = w.light.intensity > 0.001;
    }
    lampMaterials.forEach((m, i) => { m.emissiveIntensity = THREE.MathUtils.lerp(lampBase[i], 3, lightLevel); });

    // Rain streaks
    rain.visible = cur.rain > 0.02;
    if (rain.visible) {
      rainMat.opacity = 0.55 * cur.rain;
      const fall = 14;
      const streak = 0.55;
      for (let i = 0; i < RAIN_COUNT; i++) {
        let y = rainSeed[i * 3 + 1] - fall * delta;
        if (y < 0) y += BOX.height;
        rainSeed[i * 3 + 1] = y;
        rainSeed[i * 3] = wrap(rainSeed[i * 3] + wind.x * delta, BOX.half);
        rainSeed[i * 3 + 2] = wrap(rainSeed[i * 3 + 2] + wind.z * delta, BOX.half);
        const x = cameraPosition.x + rainSeed[i * 3];
        const z = cameraPosition.z + rainSeed[i * 3 + 2];
        const o = i * 6;
        rainPos[o] = x; rainPos[o + 1] = y; rainPos[o + 2] = z;
        rainPos[o + 3] = x - (wind.x / fall) * streak; rainPos[o + 4] = y + streak; rainPos[o + 5] = z - (wind.z / fall) * streak;
      }
      rainGeo.attributes.position.needsUpdate = true;
    }

    // Dust drifting with the wind, gently swirling
    dust.visible = cur.dust > 0.02;
    if (dust.visible) {
      dustMat.opacity = 0.5 * cur.dust;
      dust.position.set(cameraPosition.x, 0, cameraPosition.z);
      const drift = Math.max(1.5, wind.length());
      const dir = wind.lengthSq() > 0.01 ? wind.clone().normalize() : new THREE.Vector3(1, 0, 0);
      for (let i = 0; i < DUST_COUNT; i++) {
        const o = i * 3;
        dustPos[o] = wrap(dustPos[o] + (dir.x * drift + Math.sin(time * 0.7 + i) * 0.4) * delta, BOX.half);
        dustPos[o + 2] = wrap(dustPos[o + 2] + (dir.z * drift + Math.cos(time * 0.6 + i * 1.3) * 0.4) * delta, BOX.half);
        dustPos[o + 1] = Math.abs(dustPos[o + 1] + Math.sin(time * 1.1 + i * 0.7) * 0.25 * delta) % 9;
      }
      dustGeo.attributes.position.needsUpdate = true;
    }
  };

  return {
    update,
    wind,
    get lightLevel() { return lightLevel; },
    dispose() {
      scene.remove(rain, dust);
      rainGeo.dispose(); rainMat.dispose(); dustGeo.dispose(); dustMat.dispose();
    },
  };
}
