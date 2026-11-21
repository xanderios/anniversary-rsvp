import fs from 'node:fs';
import path from 'node:path';
import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { compress } from 'hono/compress';
import { bodyLimit } from 'hono/body-limit';
import { config, evento, inicioMs, mapaUrl, prazoMs, SENHA_MIN, textos, wazeUrl } from './config.js';
import { store } from './store.js';
import { bloqueado, falta, limite, tokenOk } from './security.js';
import { rotasAdmin } from './admin.js';

const app = new Hono();

// Behind our own proxy the visitor is the LAST address in X-Forwarded-For (the one the proxy
// itself wrote); anything before it comes from the visitor and cannot be trusted.
const ipDe = (c) => {
  if (config.trustProxy) {
    const xf = c.req.header('x-forwarded-for');
    if (xf) return xf.split(',').pop().trim();
  }
  return c.env?.incoming?.socket?.remoteAddress || 'local';
};

// ---------------------------------------------------------------- headers
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "form-action 'self'",
].join('; ');

app.use('*', async (c, next) => {
  await next();
  c.header('Content-Security-Policy', CSP);
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('X-Frame-Options', 'DENY');
  c.header('Referrer-Policy', 'no-referrer'); // invitation links never leak to other sites
  c.header('X-Robots-Tag', 'noindex, nofollow');
  c.header('Permissions-Policy', 'accelerometer=(self), gyroscope=(self), camera=(), microphone=(), geolocation=()');
  if (config.https) c.header('Strict-Transport-Security', 'max-age=31536000');
});
app.use('*', compress());

// ---------------------------------------------------------------- pages
const paginas = new Map();
function pagina(nome) {
  if (config.production && paginas.has(nome)) return paginas.get(nome);
  const arq = path.join(config.distDir, nome);
  const html = fs.existsSync(arq) ? fs.readFileSync(arq, 'utf8') : null;
  if (html) paginas.set(nome, html);
  return html;
}
const semBuild = (c) => c.text('O site ainda não foi compilado. Rode "npm run build".', 503);
const html = (c, nome, status = 200) => {
  const h = pagina(nome);
  if (!h) return semBuild(c);
  c.header('Cache-Control', 'no-store');
  return c.html(h, status);
};

// A wrong link counts against the visitor's address; after a few, that address is shut out of
// every invitation (right or wrong) for a while, so links cannot be found by trial and error.
function convitePara(c) {
  const ip = ipDe(c);
  if (bloqueado(ip)) return 'bloqueado';
  const t = c.req.param('token');
  const r = tokenOk(t) ? store.porToken(t) : null;
  if (!r) falta(ip);
  return r;
}

// Optional extras from config/evento.json, cut down to what the page shows (anything missing
// or malformed is simply left out, and the page hides that part).
const texto = (v, max = 200) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const linkOk = (v) => { try { return ['http:', 'https:'].includes(new URL(v).protocol) ? String(v) : ''; } catch { return ''; } };
function extras() {
  const zap = String(evento.contato?.whatsapp ?? '').replace(/\D/g, '');
  const itens = (Array.isArray(evento.presentes?.itens) ? evento.presentes.itens : [])
    .map((i) => ({ nome: texto(i?.nome), obs: texto(i?.obs), url: linkOk(i?.url) }))
    .filter((i) => i.nome)
    .slice(0, 30)
    .map((i) => ({ nome: i.nome, ...(i.obs && { obs: i.obs }), ...(i.url && { url: i.url }) }));
  const pix = texto(evento.presentes?.pix);
  return {
    ...(zap && { contato: { whatsapp: zap } }),
    ...((itens.length || pix) && { presentes: { itens, ...(pix && { pix }) } }),
  };
}
const extrasConvite = extras();

function dadosConvite(r) {
  return {
    convidado: r.nome,
    resposta: r.resposta,
    encerrado: Date.now() >= prazoMs,
    prazoTexto: textos.prazo,
    inicioTexto: textos.inicio,
    mapaUrl,
    wazeUrl,
    evento: {
      nome: evento.nome, iniciais: evento.iniciais, idade: evento.idade, anfitrioes: evento.anfitrioes,
      poema: evento.poema, poemaDestaque: evento.poemaDestaque,
      inicio: evento.inicio, diaSemana: textos.diaSemana, dataLonga: evento.dataLonga, horaLonga: evento.horaLonga, horaNota: evento.horaNota,
      local: evento.local, bairro: evento.bairro, enderecoLinha: evento.enderecoLinha,
      boasVindas: evento.boasVindas, subtitulo: evento.subtitulo, contagemNota: evento.contagemNota, avisos: evento.avisos,
      ...extrasConvite,
    },
  };
}

app.get('/', (c) => html(c, 'fechado.html'));
app.get('/robots.txt', (c) => c.text('User-agent: *\nDisallow: /\n'));

app.get('/c/:token', (c) => {
  const r = convitePara(c);
  if (r === 'bloqueado') return c.text('Muitas tentativas. Tente mais tarde.', 429);
  if (!r) return html(c, 'fechado.html', 404);
  const base = pagina('index.html');
  if (!base) return semBuild(c);
  store.abrir(r);
  const json = JSON.stringify(dadosConvite(r)).replace(/</g, '\\u003c');
  c.header('Cache-Control', 'no-store');
  return c.html(base.replace('<!--CONVITE-->', () => `<script id="convite" type="application/json">${json}</script>`));
});

app.get('/api/convite/:token', (c) => {
  const r = convitePara(c);
  c.header('Cache-Control', 'no-store');
  if (r === 'bloqueado') return c.json({ erro: 'Muitas tentativas.' }, 429);
  if (!r) return c.json({ erro: 'Convite não encontrado.' }, 404);
  return c.json(dadosConvite(r));
});

app.post('/api/convite/:token/resposta', bodyLimit({ maxSize: 1024, onError: (c) => c.json({ erro: 'Pedido grande demais.' }, 413) }), async (c) => {
  const r = convitePara(c);
  c.header('Cache-Control', 'no-store');
  if (r === 'bloqueado') return c.json({ erro: 'Muitas tentativas.' }, 429);
  if (!r) return c.json({ erro: 'Convite não encontrado.' }, 404);
  if (!limite('resposta:' + r.id, 30, 3600e3)) return c.json({ erro: 'Muitas alterações. Tente mais tarde.' }, 429);
  if (Date.now() >= prazoMs) return c.json({ erro: 'As respostas foram encerradas.', ...dadosConvite(r) }, 409);
  let resposta;
  try { resposta = (await c.req.json()).resposta; } catch { /* handled below */ }
  if (resposta !== 'sim' && resposta !== 'nao') return c.json({ erro: 'Resposta inválida.' }, 400);
  store.responder(r, resposta);
  return c.json(dadosConvite(r));
});

app.get('/c/:token/evento.ics', (c) => {
  const r = convitePara(c);
  if (!r || r === 'bloqueado') return c.text('Não encontrado.', 404);
  const z = (ms) => new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const t = (s) => String(s).replace(/([,;\\])/g, '\\$1').replace(/\r?\n/g, '\\n');
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Convite//PT-BR', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
    `UID:festa-${inicioMs}@${new URL(config.baseUrl).hostname}`, `DTSTAMP:${z(Date.now())}`, `DTSTART:${z(inicioMs)}`,
    `DTEND:${z(inicioMs + (evento.duracaoHoras || 4) * 3600e3)}`, `SUMMARY:${t(evento.titulo || evento.nome)}`,
    `LOCATION:${t([evento.local, ...evento.endereco].join(', '))}`, 'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n');
  c.header('Content-Type', 'text/calendar; charset=utf-8');
  c.header('Content-Disposition', 'attachment; filename="festa.ics"');
  return c.body(ics);
});

// ---------------------------------------------------------------- admin
app.route('/api/admin', rotasAdmin(ipDe));
app.get('/admin', (c) => html(c, 'admin.html'));
app.get('/admin/*', (c) => html(c, 'admin.html'));

// ---------------------------------------------------------------- static files
const raiz = path.relative(process.cwd(), config.distDir) || '.';
app.use('/assets/*', async (c, next) => { await next(); if (c.res.ok) c.header('Cache-Control', 'public, max-age=31536000, immutable'); });
app.use('/img/*', async (c, next) => { await next(); if (c.res.ok) c.header('Cache-Control', 'public, max-age=86400'); });
app.use('/stills/*', async (c, next) => { await next(); if (c.res.ok) c.header('Cache-Control', 'public, max-age=86400'); });
app.use('/assets/*', serveStatic({ root: raiz, precompressed: true, mimes: { glb: 'model/gltf-binary' } }));
for (const p of ['/img/*', '/stills/*']) app.use(p, serveStatic({ root: raiz }));
app.get('/favicon.svg', serveStatic({ root: raiz }));

app.notFound((c) => (c.req.path.startsWith('/api/') ? c.json({ erro: 'Não encontrado.' }, 404) : html(c, 'fechado.html', 404)));
app.onError((e, c) => {
  console.error(e);
  return c.req.path.startsWith('/api/') ? c.json({ erro: 'Algo deu errado. Tente de novo.' }, 500) : c.text('Algo deu errado.', 500);
});

// ---------------------------------------------------------------- start
serve({ fetch: app.fetch, port: config.port, hostname: process.env.HOST || '127.0.0.1' }, () => {
  console.log(`Convites de ${evento.nome} em ${config.baseUrl} (porta ${config.port})`);
  if (!config.adminOk) console.warn(`⚠  Painel desativado: defina ADMIN_USER e ADMIN_PASSWORD (${SENHA_MIN} caracteres ou mais) no arquivo .env.`);
});
