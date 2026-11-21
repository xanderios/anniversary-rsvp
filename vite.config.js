import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { writeFile } from 'node:fs/promises';

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

// Dev only: the page opened with ?fotos draws the still images of the fallback journey (the same
// scene, day and night, wide and tall) and sends them here; they are saved in web/public/stills.
const fotos = () => ({
  name: 'fotos-convite',
  configureServer(server) {
    server.middlewares.use('/__still', (req, res) => {
      const nome = (req.url || '').split('?')[0].slice(1);
      if (req.method !== 'POST' || !/^[a-z0-9_]+\.jpg$/.test(nome)) { res.statusCode = 400; res.end(); return; }
      const partes = [];
      req.on('data', (c) => partes.push(c));
      req.on('end', async () => {
        await writeFile(resolve('web/public/stills', nome), Buffer.concat(partes));
        res.statusCode = 204;
        res.end();
      });
    });
  },
});

export default defineConfig({
  root: 'web',
  plugins: [rotas(), fotos()],
  server: { proxy: { '/api': API, '^/c/[^/]+/(evento\\.ics|og\\.jpg)$': API } },
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
