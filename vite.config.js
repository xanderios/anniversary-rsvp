import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Dev only: the Node server (npm run dev, port 3000) owns the data; Vite serves the pages.
const rotas = () => ({
  name: 'rotas-convite',
  configureServer(server) {
    server.middlewares.use((req, _res, next) => {
      const url = req.url.split('?')[0];
      if (/^\/c\/[^/]+$/.test(url)) req.url = '/index.html';
      else if (url === '/admin' || url.startsWith('/admin/')) req.url = '/admin.html';
      next();
    });
  },
});

const API = `http://127.0.0.1:${process.env.API_PORT || 3000}`; // dev: where `npm run dev` listens

export default defineConfig({
  root: 'web',
  plugins: [rotas()],
  server: { proxy: { '/api': API, '^/c/[^/]+/evento\\.ics$': API } },
  build: {
    outDir: '../dist',
    emptyOutDir: true,
    target: 'es2020',
    assetsInlineLimit: 0,          // fonts stay as files: the site's CSP allows no data: fonts
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: {
        index: resolve('web/index.html'),
        admin: resolve('web/admin.html'),
        fechado: resolve('web/fechado.html'),
      },
    },
  },
});
