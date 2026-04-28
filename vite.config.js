import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'path';

// const base = "/funtasia_app/"
const base =""

export default defineConfig({
  base:base,  
  plugins: [
    tailwindcss(),
  ],
  define: {
    ASSETS_BASE_URL: JSON.stringify('https://cdn.jsdelivr.net/gh/garethlearnscoding/funtasia_assets@main'),
    VERSION: JSON.stringify('v3-11-4')
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  assetsInclude: ['**/*.glb'],
  server: {
    port:5317,
    allowedHosts: ["chunky-toaster.seagull-hippocampus.ts.net","broken-toaster.seagull-hippocampus.ts.net"],
    host:true,
    proxy: {
      '/queue-api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/queue-api/, '/api'),
      },
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        map: resolve(__dirname, 'map.html'),
      },
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three')) {
              return 'vendor-three';
            }
            return 'vendor'; // all other node_modules
          }
        }
      }
    }
  }
});
