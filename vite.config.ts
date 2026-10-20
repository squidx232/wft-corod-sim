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
  "script-src 'self'",
  // React inline style attributes + the Google Fonts stylesheet.
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob:",
  "media-src 'self' blob: data:",
  // GLTFLoader / audio fetches; embedded GLB textures are decoded via blob: URLs.
  "connect-src 'self' blob: data:",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

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
      // Allow access through hosted preview proxies (e.g. sandbox live preview),
      // which forward requests with a non-localhost Host header that Vite 6
      // would otherwise reject with 403 "Blocked request".
      allowedHosts: true as const,
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
