import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, type Plugin} from 'vite';

/**
 * Content-Security-Policy for the production build only (Vite's dev server
 * relies on inline scripts for HMR / React Refresh, so it is not applied in
 * dev). `frame-ancestors` cannot be set via <meta>; configure it as an HTTP
 * header on the hosting platform if click-jacking protection is required.
 */
const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  // 'wasm-unsafe-eval' lets the meshopt decoder (WebAssembly) unpack the GLB models.
  "script-src 'self' 'wasm-unsafe-eval'",
  // React inline style attributes. Fonts are self-hosted (@fontsource).
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: data:",
  // GLTFLoader / audio fetches; embedded GLB textures are decoded via blob: URLs.
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

/** HTTP response headers for `vite preview` (and documented for the production host). */
const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': `${CONTENT_SECURITY_POLICY}; frame-ancestors 'self'`,
  'X-Frame-Options': 'SAMEORIGIN',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
};

/** Dev/preview Host allow-list from ALLOWED_HOSTS (unset = Vite default: localhost + IPs only). */
const ALLOWED_HOSTS: true | string[] | undefined = (() => {
  const raw = process.env.ALLOWED_HOSTS?.trim();
  if (!raw) return undefined;
  if (raw === 'all' || raw === 'true') return true;
  return raw.split(',').map((h) => h.trim()).filter(Boolean);
})();

function securityHeadersPlugin(): Plugin {
  return {
    name: 'corod-security-meta',
    apply: 'build',
    transformIndexHtml() {
      return [
        {tag: 'meta', attrs: {'http-equiv': 'Content-Security-Policy', content: CONTENT_SECURITY_POLICY}, injectTo: 'head-prepend'},
        {tag: 'meta', attrs: {name: 'referrer', content: 'strict-origin-when-cross-origin'}, injectTo: 'head-prepend'},
      ];
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), securityHeadersPlugin()],
    build: {
      // three.js alone is ~650 kB minified; it is lazy-loaded with the 3D viewport.
      chunkSizeWarningLimit: 700,
      rollupOptions: {
        output: {
          // Long-term-cacheable vendor chunks, separate from app code.
          manualChunks(id: string) {
            if (!id.includes('node_modules')) return undefined;
            if (id.includes('/three/')) return 'vendor-three';
            if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('/scheduler/')) return 'vendor-react';
            if (id.includes('/motion/') || id.includes('/framer-motion/') || id.includes('/motion-dom/') || id.includes('/motion-utils/')) return 'vendor-motion';
            return undefined;
          },
        },
      },
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // Host-header allow-list (DNS-rebinding protection). Vite's default only
      // accepts localhost / IP hosts. Opt in explicitly for hosted preview
      // proxies: ALLOWED_HOSTS=all, or ALLOWED_HOSTS=my.proxy.dev,other.host
      allowedHosts: ALLOWED_HOSTS,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify - file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    preview: {
      allowedHosts: ALLOWED_HOSTS,
      // Production-like security headers (incl. click-jacking protection, which
      // cannot be expressed in a <meta> CSP). Mirror these on the real host —
      // see public/_headers for Netlify / Cloudflare Pages.
      headers: SECURITY_HEADERS,
    },
  };
});
