import {defineConfig} from 'vite';
export default defineConfig({
  server: {
    host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: ['tooling'],
    proxy: {'/game': {target: 'http://127.0.0.1:2567', ws: true, rewrite: p => p.replace(/^\/game/, '')}}
  },
  build: {target: 'es2022', chunkSizeWarningLimit: 1600}
});
