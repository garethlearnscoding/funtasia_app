import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { threeMinifier } from "@yushijinhun/three-minifier-rollup";
import { ViteMinifyPlugin } from 'vite-plugin-minify'
import { fileURLToPath, URL } from 'node:url';
import { resolve } from 'path';
import { compression } from 'vite-plugin-compression2'

// const base = "/funtasia_app/"
const base = ""

export default defineConfig({
  base:base,  
  plugins: [
    threeMinifier(), // 7kB saved
    ViteMinifyPlugin({removeAttributeQuotes: true, removeComments: true, removeRedundantAttributes: true}), // 1kB saved
    tailwindcss(),
    compression(),
  ],
  define: {
    ASSETS_BASE_URL: JSON.stringify('https://cdn.jsdelivr.net/gh/garethlearnscoding/funtasia_assets@0.2.0'),
    VERSION: JSON.stringify('v5-30-4')
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
    minify: "terser",
    terserOptions: {
      toplevel: true,
    },
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        notfound404: resolve(__dirname, "404.html")
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
