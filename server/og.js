// The picture that WhatsApp (and any app that previews links) shows beside an invitation link:
// the card's flowers, a gold frame and the party's details, with the guest's name on it. One
// picture per invitation, drawn when the invitation is created (or renamed) and kept in data/og.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { config, evento, ROOT, textos } from './config.js';

export const OG = { w: 1200, h: 630 };
const DESENHO = 1;        // raise it when the drawing changes: every picture is made again
const QUALIDADE = 86;     // JPEG; a picture stays near 100 KB (WhatsApp ignores heavy ones)
const pasta = path.join(config.dataDir, 'og');

// The drawing library is a compiled module. Where it cannot be loaded the site still works:
// links simply go out without a picture.
let lib = null;
try { lib = await import('@napi-rs/canvas'); } catch (e) { console.warn(`⚠  Imagem do link desativada (${e.message}).`); }
export const ogAtivo = Boolean(lib);

// ---- the palette (web/src/styles/tokens.css)
const PAPEL = '#FDFCFA';      // the card's own paper, so its flowers sit on it without a seam
const OURO = '#CFA858';       // --gold-hi: the light gold of the frame and ornaments
const OURO_CLARO = '#E6CD98'; // --gold-soft
const OURO_TEXTO = '#A9813A'; // --gold: small lettering needs the darker one to be read
const TINTA = '#5B3A3F';      // --ink

// ---- lettering: the site's own fonts, straight from the packages the pages are built with
const fonte = (nome, px) => `${px}px "${nome}", "${nome} Ext", serif`;
function fontes() {
  const reg = (pacote, arq, nome) => {
    for (const parte of ['latin', 'latin-ext']) {
      const f = path.join(ROOT, 'node_modules', '@fontsource', pacote, 'files', `${pacote}-${parte}-${arq}.woff2`);
      if (!lib.GlobalFonts.registerFromPath(f, parte === 'latin' ? nome : `${nome} Ext`)) throw new Error(`fonte não encontrada: ${f}`);
    }
  };
  reg('montecarlo', '400-normal', 'OG Letra');
  reg('cormorant-garamond', '600-normal', 'OG Serifa');
  reg('cormorant-garamond', '700-normal', 'OG Serifa Forte');
  reg('cormorant-garamond', '600-italic', 'OG Serifa Italica');
}

// ---- ornaments (the crown, heart and flourish are the ones in web/index.html)
const COROA = ['M13 44 8.5 20 24 31 40 8 56 31 71.5 20 67 44Z', 'M13.5 46.5h53a1.5 1.5 0 0 1 1.5 1.5v5a1.5 1.5 0 0 1-1.5 1.5h-53a1.5 1.5 0 0 1-1.5-1.5v-5a1.5 1.5 0 0 1 1.5-1.5Z'];
const COROA_PONTAS = [[8, 17, 3.6], [40, 5, 4], [72, 17, 3.6], [24, 27.5, 2.6], [56, 27.5, 2.6]];
const COROA_BRILHO = 'M40 47.6l2.6 2.9-2.6 2.9-2.6-2.9zM26 48.4l2 2.1-2 2.1-2-2.1zM54 48.4l2 2.1-2 2.1-2-2.1zM40 22l4 7-4 7-4-7z';
const CORACAO = 'M12 21C5 15 1 11 1 6.5A5.5 5.5 0 0 1 12 4.6 5.5 5.5 0 0 1 23 6.5C23 11 19 15 12 21Z';
const ARABESCO = ['M3 13c14-9 24 8 37 2s14-9 19-3c-5 1-7 4-12 3', 'M137 13c-14-9-24 8-37 2s-14-9-19-3c5 1 7 4 12 3'];
const ARABESCO_JOIA = 'M70 5.5l3.4 6.5-3.4 6.5-3.4-6.5z';
// A corner of the frame, drawn for the top left one (the corner is 0,0 and the frame runs along
// both axes): each side ends in a scroll, and three leaves point at the corner between them.
const CANTO = 70;             // how far from the corner each side of the frame stops
const CANTO_VOLTA = 'M70 0C60 0 55-7 46-7 35-7 27 1 27 11c0 8 6 14 13 14 6 0 10-4.5 10-9 0-4-3-6.5-6-6.5-2.5 0-4 2-4 4';
const CANTO_FOLHAS = ['M25 25C14 22 6 13 2 2c11 4 20 12 23 23Z', 'M25 25C18 20 14.500 11 16.500 1 22 7 26 16 25 25Z', 'M25 25C20 18 11 14.500 1 16.500 7 22 16 26 25 25Z'];

function coroa(g, cx, y, largura) {
  const k = largura / 80;
  g.save();
  g.translate(cx - largura / 2, y);
  g.scale(k, k);
  g.fillStyle = OURO;
  for (const d of COROA) g.fill(new lib.Path2D(d));
  for (const [x, yy, r] of COROA_PONTAS) { g.beginPath(); g.arc(x, yy, r, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(255, 251, 242, .85)';
  g.fill(new lib.Path2D(COROA_BRILHO));
  g.restore();
}

function coracao(g, cx, cy, largura, cor = OURO) {
  const k = largura / 24;
  g.save();
  g.translate(cx - largura / 2, cy - 11 * k);
  g.scale(k, k);
  g.fillStyle = cor;
  g.fill(new lib.Path2D(CORACAO));
  g.restore();
}

function arabesco(g, cx, cy, largura) {
  const k = largura / 140;
  g.save();
  g.translate(cx - largura / 2, cy - 12 * k);
  g.scale(k, k);
  g.strokeStyle = g.fillStyle = OURO;
  g.lineWidth = 1.3;
  g.lineCap = 'round';
  for (const d of ARABESCO) g.stroke(new lib.Path2D(d));
  g.fill(new lib.Path2D(ARABESCO_JOIA));
  g.beginPath(); g.arc(70, 21.5, 1.3, 0, 7); g.fill();
  g.restore();
}

function canto(g, x, y, fx, fy) {
  g.save();
  g.translate(x, y);
  g.scale(fx, fy);
  g.strokeStyle = OURO;
  g.lineWidth = 2;
  g.lineCap = g.lineJoin = 'round';
  const volta = new lib.Path2D(CANTO_VOLTA);
  g.stroke(volta);
  g.save(); g.transform(0, 1, 1, 0, 0, 0); g.stroke(volta); g.restore();   // the same scroll on the other side
  g.fillStyle = OURO_CLARO;
  g.lineWidth = 1.2;
  for (const d of CANTO_FOLHAS) { const p = new lib.Path2D(d); g.fill(p); g.stroke(p); }
  g.fillStyle = OURO;
  g.beginPath(); g.arc(27, 27, 2.6, 0, 7); g.fill();
  g.restore();
}

// A straight piece of the frame. `some` is the end that runs in behind the flowers: there the
// line thins out instead of stopping dead.
function linha(g, x0, y0, x1, y1, some = 26) {
  const comp = Math.hypot(x1 - x0, y1 - y0);
  const cor = g.createLinearGradient(x0, y0, x1, y1);
  cor.addColorStop(0, 'rgba(207, 168, 88, 0)');
  cor.addColorStop(Math.min(1, some / comp), OURO);
  cor.addColorStop(1, OURO);
  g.strokeStyle = cor;
  g.lineWidth = 2;
  g.lineCap = 'butt';
  g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke();
}

// Spaced capitals, centred on cx (the space after the last letter is not counted).
function versal(g, s, cx, y, px, espaco, cor = OURO_TEXTO, nome = 'OG Serifa Forte') {
  g.font = fonte(nome, px);
  g.letterSpacing = `${espaco}px`;
  g.fillStyle = cor;
  g.textAlign = 'left';
  g.textBaseline = 'alphabetic';
  const t = String(s).toLocaleUpperCase('pt-BR');
  const w = g.measureText(t).width - espaco;
  g.fillText(t, cx - w / 2, y);
  g.letterSpacing = '0px';
  return w;
}

// ---- the flowers: two corners of the invitation card (web/public/img/convite_arte.jpg)
const papel = (d, i) => Math.min(d[i], d[i + 1], d[i + 2]) > 232 && Math.max(d[i], d[i + 1], d[i + 2]) - Math.min(d[i], d[i + 1], d[i + 2]) < 20;

// The card has its own thin frame printed on it. Wherever it runs over bare paper it is lifted
// off (the paper on both sides is spread across it), so that our frame can be drawn sharp.
function semMoldura(img, w, faixas) {
  const d = img.data;
  for (const { x0, x1, y0, y1, deitada } of faixas) {
    const [a0, a1, b0, b1] = deitada ? [x0, x1, y0, y1] : [y0, y1, x0, x1];   // a runs along the line, b across it
    const em = (a, b) => (deitada ? (b * w + a) : (a * w + b)) * 4;
    for (let a = a0; a <= a1; a++) {
      const i0 = em(a, b0 - 2), i1 = em(a, b1 + 2);
      if (!papel(d, i0) || !papel(d, i1)) continue;
      for (let b = b0; b <= b1; b++) {
        const t = (b - b0 + 1) / (b1 - b0 + 2), i = em(a, b);
        for (let c = 0; c < 3; c++) d[i + c] = Math.round(d[i0 + c] * (1 - t) + d[i1 + c] * t);
      }
    }
  }
}

// Only the bouquets are kept: the rest of the card (where its lettering was lifted off, which
// left faint marks on the paper) becomes transparent, with a soft edge.
const BUQUES = [
  [[-60, -60], [578, -60], [578, 206], [222, 206], [222, 556], [-60, 556]],                                              // top left
  [[764, 850], [920, 850], [920, 1340], [462, 1340], [462, 1180], [510, 1180], [510, 1134], [594, 1134], [594, 1020], [764, 1020]],  // bottom right
];
function buques(limpa) {
  const c = lib.createCanvas(limpa.width, limpa.height), g = c.getContext('2d');
  g.filter = 'blur(11px)';
  for (const pontos of BUQUES) {
    g.beginPath();
    pontos.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
    g.closePath();
    g.fill();
  }
  g.filter = 'none';
  g.globalCompositeOperation = 'source-in';
  g.drawImage(limpa, 0, 0);
  return c;
}

// ---- what the picture says (config/evento.json)
const junta = (v) => (Array.isArray(v) ? v.join(' ') : String(v ?? '')).trim();
const dizeres = {
  nome: junta(evento.nome),
  idade: junta(evento.idade),
  quando: [junta(evento.dataTexto) || junta(evento.dataLonga), junta(evento.horaTexto) || junta(evento.horaLonga)].filter(Boolean).join('  ·  ') || textos.inicio,
  onde: junta(evento.local),
};

const M = 30;                 // the frame's distance from the edge
const CX = 612;               // the lettering's axis: a little right of centre, clear of the big bouquet

// Everything that is the same on every invitation, drawn once and kept.
let fundoPronto = null;
async function fundo() {
  fontes();
  const arte = await lib.loadImage(path.join(ROOT, 'web', 'public', 'img', 'convite_arte.jpg'));
  const limpa = lib.createCanvas(arte.width, arte.height), gl = limpa.getContext('2d');
  gl.drawImage(arte, 0, 0);
  const img = gl.getImageData(0, 0, arte.width, arte.height);
  semMoldura(img, arte.width, [
    { deitada: true, x0: 440, x1: 620, y0: 25, y1: 34 },      // top line, beside the top left bouquet
    { deitada: false, x0: 15, x1: 24, y0: 400, y1: 620 },     // left line, under it
    { deitada: true, x0: 440, x1: 560, y0: 1233, y1: 1242 },  // bottom line, beside the bottom right bouquet
    { deitada: false, x0: 828, x1: 837, y0: 840, y1: 920 },   // right line, above it
  ]);
  gl.putImageData(img, 0, 0);

  const flores = buques(limpa);

  const c = lib.createCanvas(OG.w, OG.h), g = c.getContext('2d');
  g.fillStyle = PAPEL;
  g.fillRect(0, 0, OG.w, OG.h);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.fontVariantNumeric = 'lining-nums';

  // flowers: the big bouquet in the top left corner, the smaller one in the bottom right
  const K = 0.9;
  const peca = (sx, sy, sw, sh, dx, dy) => g.drawImage(flores, sx, sy, sw, sh, dx, dy, sw * K, sh * K);
  peca(0, 6, 600, 600, 0, 0);
  peca(440, 830, 413, 450, OG.w - 413 * K, OG.h - 450 * K + 14);

  // frame: four sides and two ornate corners; the other two corners are under the flowers
  linha(g, 452, M, OG.w - M - CANTO, M);
  linha(g, OG.w - M, 318, OG.w - M, M + CANTO, 18);
  linha(g, 884, OG.h - M, M + CANTO, OG.h - M);
  linha(g, M, 430, M, OG.h - M - CANTO, 22);
  canto(g, OG.w - M, M, -1, 1);
  canto(g, M, OG.h - M, 1, -1);

  // the birthday girl
  coroa(g, CX, 62, 62);
  g.font = fonte('OG Letra', 124);
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  const ouro = g.createLinearGradient(0, 120, 0, 232);
  ouro.addColorStop(0, '#DCBB72');
  ouro.addColorStop(1, '#BC9145');
  g.fillStyle = ouro;
  g.fillText(dizeres.nome, CX, 212);

  if (dizeres.idade) {
    const w = versal(g, dizeres.idade, CX, 272, 30, 6);
    for (const s of [-1, 1]) {
      coracao(g, CX + s * (w / 2 + 26), 262, 13);
      g.strokeStyle = OURO; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(CX + s * (w / 2 + 46), 262); g.lineTo(CX + s * (w / 2 + 130), 262); g.stroke();
    }
  }

  // when and where
  arabesco(g, CX, 462, 190);
  versal(g, dizeres.quando, CX, 524, 29, 4.5);
  if (dizeres.onde) versal(g, dizeres.onde, CX, 566, 22, 5);
  return c;
}

// The guest's name: as large as fits on one line; a long one goes on two.
const LARGURA_NOME = 620;
function convidado(g, nome) {
  versal(g, 'Convite para', CX, 334, 21, 6);
  g.fillStyle = TINTA;
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  const mede = (s, px) => { g.font = fonte('OG Serifa Italica', px); return g.measureText(s).width; };
  for (let px = 64; px >= 46; px -= 2) {
    if (mede(nome, px) <= LARGURA_NOME) { g.fillText(nome, CX, 392 + px * 0.12); return; }
  }
  // two lines: break at the space that leaves them most alike in length
  const pal = nome.split(' ');
  let linhas = [nome, ''];
  if (pal.length > 1) {
    let melhor = Infinity;
    for (let i = 1; i < pal.length; i++) {
      const a = pal.slice(0, i).join(' '), b = pal.slice(i).join(' ');
      const dif = Math.abs(mede(a, 40) - mede(b, 40));
      if (dif < melhor) { melhor = dif; linhas = [a, b]; }
    }
  }
  let px = 46;
  while (px > 26 && Math.max(mede(linhas[0], px), mede(linhas[1], px)) > LARGURA_NOME) px -= 2;
  const corta = (s) => { if (mede(s, px) <= LARGURA_NOME) return s; while (s.length > 1 && mede(s + '…', px) > LARGURA_NOME) s = s.slice(0, -1); return s.trimEnd() + '…'; };
  g.font = fonte('OG Serifa Italica', px);
  if (!linhas[1]) { g.fillText(corta(linhas[0]), CX, 396); return; }
  g.fillText(corta(linhas[0]), CX, 396 - px * 0.5);
  g.fillText(corta(linhas[1]), CX, 396 + px * 0.56);
}

export async function ogDesenhar(nome) {
  if (!lib) return null;
  fundoPronto ||= fundo();
  const base = await fundoPronto;
  const c = lib.createCanvas(OG.w, OG.h), g = c.getContext('2d');
  g.drawImage(base, 0, 0);
  g.fontVariantNumeric = 'lining-nums';
  convidado(g, String(nome));
  return c.encode('jpeg', QUALIDADE);
}

// ---- one file per invitation: data/og/<id>-<versão>.jpg. The version is a digest of everything
// the picture shows, so a new name (or a new date) makes a new file and a new address, which is
// what makes WhatsApp fetch it again instead of showing the picture it kept.
export const ogVersao = (r) => crypto.createHash('sha256').update(JSON.stringify([DESENHO, r.nome, dizeres])).digest('hex').slice(0, 12);
const arquivoDe = (r) => path.join(pasta, `${r.id}-${ogVersao(r)}.jpg`);
const emCurso = new Map();

export function ogApagar(id, menos = '') {
  let nomes = [];
  try { nomes = fs.readdirSync(pasta); } catch { return; }
  for (const n of nomes) if (n.startsWith(`${id}-`) && n !== menos) fs.rmSync(path.join(pasta, n), { force: true });
}

// The invitation's picture, drawn only if it is not on disk yet. null when it cannot be made.
export async function ogImagem(r) {
  if (!lib) return null;
  const arq = arquivoDe(r);
  try { return await fs.promises.readFile(arq); } catch { /* not drawn yet */ }
  if (!emCurso.has(arq)) {
    emCurso.set(arq, (async () => {
      const jpg = await ogDesenhar(r.nome);
      fs.mkdirSync(pasta, { recursive: true });
      const tmp = `${arq}.${process.pid}.tmp`;
      fs.writeFileSync(tmp, jpg, { mode: 0o600 });
      fs.renameSync(tmp, arq);
      ogApagar(r.id, path.basename(arq));   // the pictures of its earlier names
      return jpg;
    })().finally(() => emCurso.delete(arq)));
  }
  return emCurso.get(arq);
}

// Called when an invitation is created or renamed: the picture is ready before the link is sent.
export function ogPreparar(r) {
  if (lib && r) ogImagem(r).catch((e) => console.error(`Imagem do convite ${r.id} não foi gerada:`, e));
}

// ---- the tags for the page's <head>
const esc = (s) => String(s).replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);
export function ogTags(r) {
  const url = `${config.baseUrl}/c/${r.token}`;
  const titulo = `Convite para ${r.nome}`;
  const descricao = [junta(evento.titulo) || dizeres.nome, textos.inicio, dizeres.onde].filter(Boolean).join(' · ');
  const meta = (chave, valor, attr = 'property') => `<meta ${attr}="${chave}" content="${esc(valor)}">`;
  return [
    meta('og:type', 'website'), meta('og:locale', 'pt_BR'), meta('og:site_name', `Convite · ${dizeres.nome}`),
    meta('og:url', url), meta('og:title', titulo), meta('og:description', descricao), meta('description', descricao, 'name'),
    ...(lib ? [
      meta('og:image', `${url}/og.jpg?v=${ogVersao(r)}`), meta('og:image:type', 'image/jpeg'),
      meta('og:image:width', OG.w), meta('og:image:height', OG.h), meta('og:image:alt', `${titulo}: ${descricao}`),
      meta('twitter:card', 'summary_large_image', 'name'),
    ] : []),
  ].join('\n  ');
}
