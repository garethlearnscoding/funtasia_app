import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'path';

export default defineConfig({
  base:"/funtasia_app/",  
  plugins: [
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,glb}']
      }
    })
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  },
  define:{
    __APP_VERSION__:JSON.stringify(process.env.npm_package_version)
  },
  assetsInclude: ['**/*.glb'],
  server: {
    port:3000,
    allowedHosts: ["chunky-toaster.seagull-hippocampus.ts.net"]
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        map: resolve(__dirname, 'map.html'),
      }
    }
  }
});
