import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'path';

const base = "/funtasia_app/"

export default defineConfig({
  base:base,  
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Funtasia',
        short_name: 'Funtasia',
        description: 'Funtasia Map App',
        theme_color: '#e0c2ff',
        icons: [
          {
            src: `${base}public/icon192x192.png`,
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: `${base}public/icon512x512.png`,
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,glb}']
      },
    })
  ],
  define: {
    ASSETS_BASE_URL: JSON.stringify('https://cdn.jsdelivr.net/gh/garethlearnscoding/funtasia_app@assets')
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
