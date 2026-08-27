import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { buildSync } from 'esbuild';

function bundleExtensionScripts(): Plugin {
  return {
    name: 'bundle-extension-scripts',
    closeBundle() {
      // Content scripts in Manifest V3 cannot have ES module imports.
      // We bundle content.ts and service-worker.ts as standalone IIFE scripts.
      buildSync({
        entryPoints: {
          content: resolve(__dirname, 'src/content/content.ts'),
          'service-worker': resolve(__dirname, 'src/background/service-worker.ts'),
        },
        bundle: true,
        outdir: resolve(__dirname, 'dist'),
        format: 'iife',
        target: 'es2020',
        platform: 'browser',
      });
      console.log('✓ Standalone content.js & service-worker.js bundled with zero import statements.');
    },
  };
}

export default defineConfig({
  plugins: [react(), bundleExtensionScripts()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sidepanel: resolve(__dirname, 'sidepanel.html'),
      },
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: {
        url: 'https://www.linkedin.com/in/sarah-jenkins',
      },
    },
    globals: false,
  },
});
