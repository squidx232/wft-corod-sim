export type GraphicsQuality = 'ultra' | 'high' | 'medium' | 'low';
export const GRAPHICS_PRESETS = {
  ultra: { pixelRatio: 2, shadows: 2048, particles: 1, clouds: 24, sceneryDistance: 350 },
  high: { pixelRatio: 1.5, shadows: 1024, particles: 0.7, clouds: 16, sceneryDistance: 240 },
  medium: { pixelRatio: 1, shadows: 512, particles: 0.4, clouds: 8, sceneryDistance: 155 },
  low: { pixelRatio: 0.75, shadows: 0, particles: 0.18, clouds: 4, sceneryDistance: 100 },
} as const;
export function readGraphicsQuality(): GraphicsQuality {
  try {
    const saved = localStorage.getItem('corod-graphics-quality');
    if (saved && Object.prototype.hasOwnProperty.call(GRAPHICS_PRESETS, saved)) return saved as GraphicsQuality;
  } catch { /* Storage may be disabled. */ }
  return 'high';
}
