import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// Two builds from the same source:
//   npm run build          → dist/          the demo-only cnviz.com website
//   npm run build:offline  → dist-offline/  one self-contained HTML file for labs to host or open locally
//                                           (no network access; see scripts/inline-offline.mjs)
export default defineConfig(({ mode }) => {
  const offline = mode === 'offline'
  return {
    base: offline ? './' : '/',
    define: {
      __CNVIZ_VERSION__: JSON.stringify(version),
      __CNVIZ_OFFLINE__: JSON.stringify(offline),
    },
    plugins: [react()],
    build: offline ? {
      outDir: 'dist-offline',
      assetsInlineLimit: Number.MAX_SAFE_INTEGER, // images/fonts as data: URIs
      cssCodeSplit: false,
      modulePreload: false,
      rollupOptions: { output: { inlineDynamicImports: true } }, // one JS file to inline
    } : {},
    server: {
      port: 5173,
    },
  }
})
